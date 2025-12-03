import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {
  getSimulatedTransactions,
  SimulatedTransaction,
  lamportsToSol,
} from '../services/helius';

const REFRESH_INTERVAL = 5000; // 5 seconds
const BATCH_SIZE = 100; // Fetch 100 transactions at a time

export default function TransactionHistorySimScreen() {
  const [transactions, setTransactions] = useState<SimulatedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [totalFetched, setTotalFetched] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSignatureRef = useRef<string | null>(null);
  const seenSignatures = useRef<Set<string>>(new Set());

  const fetchTransactions = async (isManualRefresh = false) => {
    if ((isPaused || !isMonitoring) && !isManualRefresh) return;

    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      }

      const response = await getSimulatedTransactions(BATCH_SIZE, 0);

      if (response.transactions.length > 0) {
        // Filter out transactions we've already seen
        const newTransactions = response.transactions.filter(
          (tx) => !seenSignatures.current.has(tx.signature)
        );

        if (newTransactions.length > 0) {
          // Add new signatures to the set
          newTransactions.forEach((tx) => {
            seenSignatures.current.add(tx.signature);
          });

          // Prepend new transactions (newest at top)
          setTransactions((prev) => [...newTransactions, ...prev]);
          setTotalFetched((prev) => prev + newTransactions.length);
          lastSignatureRef.current = newTransactions[0].signature;
          setLastUpdateTime(new Date());
        }
      }

      setError(null);
      setIsLoading(false);
    } catch (error: any) {
      console.error('Error fetching simulated transactions:', error);
      setError(error.message || 'Failed to fetch transactions');
      setIsLoading(false);

      if (isManualRefresh) {
        Alert.alert('Error', error.message || 'Failed to fetch transactions');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const startAutoRefresh = () => {
    setIsPaused(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Fetch immediately
    fetchTransactions();

    // Then fetch every REFRESH_INTERVAL
    intervalRef.current = setInterval(() => {
      fetchTransactions();
    }, REFRESH_INTERVAL);
  };

  const stopAutoRefresh = () => {
    setIsPaused(true);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    startAutoRefresh();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handleManualRefresh = () => {
    if (!isMonitoring) {
      // Restart monitoring on pull-to-refresh when stopped
      restartMonitoring();
    } else {
      fetchTransactions(true);
    }
  };

  const togglePause = () => {
    if (isPaused) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    stopAutoRefresh();
    Alert.alert(
      'Monitoring Stopped',
      `Captured ${transactions.length} transactions. You can now scroll through them. Refresh to restart monitoring.`,
      [{ text: 'OK' }]
    );
  };

  const restartMonitoring = () => {
    // Clear accumulated transactions and restart
    setTransactions([]);
    seenSignatures.current.clear();
    setTotalFetched(0);
    lastSignatureRef.current = null;
    setIsMonitoring(true);
    startAutoRefresh();
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatSignature = (sig: string) => {
    return `${sig.slice(0, 8)}...${sig.slice(-8)}`;
  };

  const formatBlockTime = (blockTime: number) => {
    const date = new Date(blockTime * 1000);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const renderTransaction = (tx: SimulatedTransaction, index: number) => {
    return (
      <View key={`${tx.signature}-${index}`} style={styles.txCard}>
        <View style={styles.txHeader}>
          <View style={[
            styles.txBadge,
            { backgroundColor: tx.success ? '#10b981' : '#ef4444' }
          ]}>
            <Text style={styles.txBadgeText}>
              {tx.success ? 'Success' : 'Failed'}
            </Text>
          </View>
          <Text style={styles.txTime}>{formatTimestamp(tx.timestamp)}</Text>
        </View>

        <View style={styles.txDetails}>
          <Text style={styles.txAmount}>
            Fee: {lamportsToSol(tx.fee).toFixed(6)} SOL
          </Text>
        </View>

        <View style={styles.txMeta}>
          <Text style={styles.txSignature}>
            Sig: {formatSignature(tx.signature)}
          </Text>
          <Text style={styles.txSlot}>Slot: {tx.slot.toLocaleString()}</Text>
          <Text style={styles.txAccounts}>
            {tx.data.accounts.length} accounts, {tx.data.instructions.length} instructions
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading simulated transactions...</Text>
      </View>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Connection Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchTransactions(true)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{transactions.length}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Rate</Text>
          <Text style={styles.statValue}>~25 tx/s</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Status</Text>
          <Text style={[styles.statValue, {
            color: !isMonitoring ? '#ef4444' : isPaused ? '#f59e0b' : '#10b981'
          }]}>
            {!isMonitoring ? 'Stopped' : isPaused ? 'Paused' : 'Live'}
          </Text>
        </View>
      </View>

      <View style={styles.controlBar}>
        {isMonitoring ? (
          <>
            <TouchableOpacity
              style={[styles.controlButton, isPaused && styles.controlButtonActive]}
              onPress={togglePause}
            >
              <Text style={styles.controlButtonText}>
                {isPaused ? '▶️ Resume' : '⏸️ Pause'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, styles.stopButton]}
              onPress={stopMonitoring}
            >
              <Text style={styles.controlButtonText}>⏹️ Stop</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.controlButton, styles.restartButton]}
            onPress={restartMonitoring}
          >
            <Text style={styles.controlButtonText}>🔄 Restart Monitoring</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleManualRefresh}
            tintColor="#6366f1"
          />
        }
      >
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
            <Text style={styles.emptyText}>
              Waiting for simulated transactions from helius-api-demo...
            </Text>
          </View>
        ) : (
          <View style={styles.txList}>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>
                {isMonitoring ? 'Live Transactions' : 'Captured Transactions'} ({transactions.length})
              </Text>
              <Text style={styles.listSubtitle}>
                {isMonitoring
                  ? 'New transactions appear at top • Auto-refresh every 5s'
                  : 'Scroll through captured transactions • Pull down to restart'}
              </Text>
            </View>
            {transactions.map(renderTransaction)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#b0b0b0',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#b0b0b0',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#2d2d2d',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    color: '#808080',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f5f5f5',
  },
  controlBar: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  controlButton: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#10b981',
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  restartButton: {
    backgroundColor: '#10b981',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f5f5f5',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#808080',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  txList: {
    paddingBottom: 16,
  },
  listHeader: {
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f5f5f5',
    marginBottom: 4,
  },
  listSubtitle: {
    fontSize: 12,
    color: '#808080',
  },
  txCard: {
    backgroundColor: '#2d2d2d',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  txBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  txBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  txTime: {
    fontSize: 11,
    color: '#808080',
  },
  txDetails: {
    marginBottom: 8,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#a5b4fc',
  },
  txMeta: {
    borderTopWidth: 1,
    borderTopColor: '#404040',
    paddingTop: 8,
    gap: 3,
  },
  txSignature: {
    fontSize: 10,
    color: '#808080',
    fontFamily: 'monospace',
  },
  txSlot: {
    fontSize: 10,
    color: '#808080',
  },
  txAccounts: {
    fontSize: 10,
    color: '#808080',
  },
});
