import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  useWindowDimensions,
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
  const { width: screenWidth } = useWindowDimensions();
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
        return '#34d399';
      case 'connecting':
        return '#fbbf24';
      case 'disconnected':
        return '#fb7185';
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

  const pageHorizontalPadding = screenWidth > 500 ? screenWidth * 0.1 : 14;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.pageContent,
        {
          paddingLeft: pageHorizontalPadding,
          paddingRight: pageHorizontalPadding,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.titleCluster}>
            <Text style={styles.eyebrow}>Wallet stream demo</Text>
            <Text style={styles.heroTitle}>Live balance monitor</Text>
            <Text style={styles.description}>
              Subscribe to a Solana account and watch balance notifications arrive through WebSocket.
            </Text>
          </View>
          <View style={[styles.statusPill, { borderColor: getStatusColor() }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={[styles.statusText, { color: getStatusColor() }]}>{getStatusText()}</Text>
          </View>
        </View>

        <View style={styles.inputCard}>
          <Text style={styles.label}>Solana Wallet Address</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Enter wallet address (e.g., 7xKXtg...)"
            placeholderTextColor="#64748b"
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
                <ActivityIndicator color="#070812" />
              ) : (
                <Text style={styles.buttonText}>Start streaming</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.buttonStop]}
              onPress={handleStopStreaming}
            >
              <Text style={styles.buttonTextStop}>Stop streaming</Text>
            </TouchableOpacity>
          )}
        </View>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070812',
  },
  pageContent: {
    paddingVertical: 14,
    gap: 12,
  },
  heroCard: {
    backgroundColor: '#0f172a',
    borderColor: '#25324a',
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  titleCluster: {
    flex: 1,
    minWidth: 260,
    gap: 6,
  },
  eyebrow: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#f8fafc',
    fontSize: 29,
    lineHeight: 33,
    fontWeight: '900',
    letterSpacing: -1,
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    color: '#38bdf8',
    marginBottom: 8,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  description: {
    maxWidth: 560,
    fontSize: 13,
    lineHeight: 18,
    color: '#94a3b8',
  },
  inputCard: {
    backgroundColor: '#111827',
    borderColor: '#283548',
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#f8fafc',
    backgroundColor: '#070812',
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#facc15',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonStop: {
    backgroundColor: '#3f1220',
    borderColor: '#fb7185',
    borderWidth: 1,
  },
  buttonText: {
    color: '#070812',
    fontSize: 14,
    fontWeight: '900',
  },
  buttonTextStop: {
    color: '#fecdd3',
    fontSize: 14,
    fontWeight: '900',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#111827',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  balanceCard: {
    backgroundColor: '#0f172a',
    borderColor: '#25324a',
    borderWidth: 1,
    padding: 18,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 30,
    fontWeight: '900',
    color: '#34d399',
    marginBottom: 4,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  balanceLamports: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'monospace',
  },
});
