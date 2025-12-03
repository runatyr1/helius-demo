import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { PublicKey } from '@solana/web3.js';
import {
  createConnection,
  validateSolanaAddress,
  getCurrentBalance,
  lamportsToSol,
  getHeliusWsUrl,
} from '../services/helius';
import { BalanceUpdate } from '../types';
import BalanceHistory from '../components/BalanceHistory';

export default function LiveBalanceScreen() {
  const [address, setAddress] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [balanceUpdates, setBalanceUpdates] = useState<BalanceUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const subscriptionIdRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentAddressRef = useRef<string>('');
  const isIntentionalCloseRef = useRef(false);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      cleanupConnection();
    };
  }, []);

  const cleanupConnection = () => {
    isIntentionalCloseRef.current = true;

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    subscriptionIdRef.current = null;
  };

  const handleStartStreaming = async () => {
    if (!address.trim()) {
      Alert.alert('Error', 'Please enter a Solana address');
      return;
    }

    if (!validateSolanaAddress(address)) {
      Alert.alert('Error', 'Invalid Solana address');
      return;
    }

    setIsLoading(true);
    setBalanceUpdates([]);
    setReconnectAttempts(0);
    isIntentionalCloseRef.current = false;
    currentAddressRef.current = address;

    try {
      // Get initial balance via HTTP
      const connection = createConnection();
      const initialBalance = await getCurrentBalance(connection, address);

      setCurrentBalance(initialBalance);
      setBalanceUpdates([
        {
          timestamp: Date.now(),
          balance: lamportsToSol(initialBalance),
          lamports: initialBalance,
        },
      ]);

      // Start WebSocket subscription
      await subscribeToAccountUpdates(address);
      setIsStreaming(true);
    } catch (error: any) {
      console.error('Error starting stream:', error);
      Alert.alert('Error', error.message || 'Failed to start streaming');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopStreaming = () => {
    isIntentionalCloseRef.current = true;

    if (wsRef.current && subscriptionIdRef.current !== null) {
      // Unsubscribe
      try {
        wsRef.current.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'accountUnsubscribe',
            params: [subscriptionIdRef.current],
          })
        );
      } catch (error) {
        console.error('Error unsubscribing:', error);
      }
    }

    cleanupConnection();
    setIsStreaming(false);
    setConnectionStatus('disconnected');
    setReconnectAttempts(0);
  };

  const startPingInterval = () => {
    // Clear any existing interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    // Send ping every 60 seconds (Helius recommendation)
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          // Send a getHealth request as keepalive
          wsRef.current.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: 999,
              method: 'getHealth',
            })
          );
          console.log('Keepalive ping sent');
        } catch (error) {
          console.error('Error sending keepalive:', error);
        }
      }
    }, 60000); // 60 seconds
  };

  const attemptReconnect = () => {
    if (isIntentionalCloseRef.current) {
      console.log('Intentional close, not reconnecting');
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
    const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);

    console.log(`Reconnecting in ${backoffMs}ms (attempt ${reconnectAttempts + 1})`);

    setConnectionStatus('connecting');
    setReconnectAttempts((prev) => prev + 1);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (currentAddressRef.current && !isIntentionalCloseRef.current) {
        console.log('Attempting reconnection...');
        subscribeToAccountUpdates(currentAddressRef.current).catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }
    }, backoffMs);
  };

  const subscribeToAccountUpdates = (walletAddress: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = getHeliusWsUrl();

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          setConnectionStatus('connected');
          setReconnectAttempts(0); // Reset on successful connection

          // Start keepalive pings
          startPingInterval();

          // Subscribe to account updates
          const publicKey = new PublicKey(walletAddress);
          ws.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'accountSubscribe',
              params: [
                publicKey.toBase58(),
                {
                  encoding: 'jsonParsed',
                  commitment: 'confirmed',
                },
              ],
            })
          );

          resolve();
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);

          // Handle subscription confirmation
          if (data.id === 1 && data.result) {
            subscriptionIdRef.current = data.result;
            console.log('Subscription ID:', data.result);
            return;
          }

          // Ignore keepalive responses
          if (data.id === 999) {
            return;
          }

          // Handle account updates
          if (data.method === 'accountNotification') {
            const accountInfo = data.params.result.value;
            const slot = data.params.result.context.slot;

            if (accountInfo) {
              const lamports = accountInfo.lamports;
              const sol = lamportsToSol(lamports);

              console.log('Balance update:', { lamports, sol, slot });

              setCurrentBalance(lamports);
              setBalanceUpdates((prev) => [
                ...prev,
                {
                  timestamp: Date.now(),
                  balance: sol,
                  lamports,
                  slot,
                },
              ]);
            }
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionStatus('disconnected');
        };

        ws.onclose = (event) => {
          console.log('WebSocket disconnected', { code: event.code, reason: event.reason });
          setConnectionStatus('disconnected');

          // Clear ping interval
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
          }

          // Attempt reconnection if not intentional
          if (!isIntentionalCloseRef.current) {
            attemptReconnect();
          }
        };

        setConnectionStatus('connecting');
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        reject(error);
      }
    });
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return '#10b981';
      case 'connecting':
        return '#f59e0b';
      case 'disconnected':
        return '#ef4444';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return reconnectAttempts > 0 ? `Connected (recovered from ${reconnectAttempts} attempts)` : 'Connected';
      case 'connecting':
        return reconnectAttempts > 0 ? `Reconnecting (attempt ${reconnectAttempts})...` : 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputSection}>
        <Text style={styles.label}>Solana Wallet Address</Text>
        <Text style={styles.description}>
          Demonstrates fast WebSocket connectivity with real-time balance updates
        </Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="Enter wallet address (e.g., 7xKXtg...)"
          placeholderTextColor="#666"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isStreaming}
        />

        {!isStreaming ? (
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleStartStreaming}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Start Streaming</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.buttonStop]}
            onPress={handleStopStreaming}
          >
            <Text style={styles.buttonText}>Stop Streaming</Text>
          </TouchableOpacity>
        )}

        {isStreaming && (
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
        )}
      </View>

      {currentBalance !== null && (
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceAmount}>
            {lamportsToSol(currentBalance).toFixed(9)} SOL
          </Text>
          <Text style={styles.balanceLamports}>
            {currentBalance.toLocaleString()} lamports
          </Text>
        </View>
      )}

      <BalanceHistory updates={balanceUpdates} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  inputSection: {
    backgroundColor: '#2d2d2d',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#404040',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#f5f5f5',
    backgroundColor: '#1a1a1a',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#4f46e5',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonStop: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#b0b0b0',
  },
  balanceCard: {
    backgroundColor: '#2d2d2d',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#b0b0b0',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#818cf8',
    marginBottom: 4,
  },
  balanceLamports: {
    fontSize: 12,
    color: '#808080',
  },
});
