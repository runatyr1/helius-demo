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

  const subscriptionIdRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

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
    if (wsRef.current && subscriptionIdRef.current !== null) {
      // Unsubscribe
      wsRef.current.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'accountUnsubscribe',
          params: [subscriptionIdRef.current],
        })
      );

      wsRef.current.close();
      wsRef.current = null;
      subscriptionIdRef.current = null;
    }

    setIsStreaming(false);
    setConnectionStatus('disconnected');
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
          reject(new Error('WebSocket connection failed'));
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setConnectionStatus('disconnected');
        };

        setConnectionStatus('connecting');
      } catch (error) {
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
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputSection}>
        <Text style={styles.label}>Solana Wallet Address</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="Enter wallet address (e.g., 7xKXtg...)"
          placeholderTextColor="#999"
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
    backgroundColor: '#f5f5f5',
  },
  inputSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#f9f9f9',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#6366f1',
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
    color: '#666',
  },
  balanceCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6366f1',
    marginBottom: 4,
  },
  balanceLamports: {
    fontSize: 12,
    color: '#999',
  },
});
