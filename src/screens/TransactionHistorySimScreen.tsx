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
  Animated,
} from 'react-native';
import {
  getSimulatedTransactions,
  SimulatedTransaction,
  lamportsToSol,
} from '../services/helius';

const REFRESH_INTERVAL = 2000; // 2 seconds
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
          // Log new transactions to console
          console.log(`[TransactionSim] Found ${newTransactions.length} new transactions:`);
          newTransactions.forEach((tx, idx) => {
            console.log(
              `  ${idx + 1}. ${tx.signature.slice(0, 12)}...${tx.signature.slice(-12)} ` +
              `(Slot: ${tx.slot.toLocaleString()}, Fee: ${lamportsToSol(tx.fee).toFixed(6)} SOL, Success: ${tx.success})`
            );
          });

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

  const startAutoRefresh = (forceInitialFetch = false) => {
    setIsPaused(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Fetch immediately (force if restarting)
    fetchTransactions(forceInitialFetch);

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
    console.log(`[TransactionSim] Stopping monitoring - captured ${transactions.length} transactions`);
    setIsMonitoring(false);
    stopAutoRefresh();
    Alert.alert(
      'Monitoring Stopped',
      `Captured ${transactions.length} transactions. You can now scroll through them. Refresh to restart monitoring.`,
      [{ text: 'OK' }]
    );
  };

  const restartMonitoring = () => {
    console.log('[TransactionSim] Restarting monitoring - clearing all data');
    // Clear accumulated transactions and restart
    setTransactions([]);
    seenSignatures.current.clear();
    setTotalFetched(0);
    lastSignatureRef.current = null;
    setIsMonitoring(true);
    startAutoRefresh(true); // Force initial fetch to bypass state race condition
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    const timeStr = date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return `${timeStr}.${ms}`;
  };

  const formatSignature = (sig: string) => {
    return `${sig.slice(0, 12)}...${sig.slice(-12)}`;
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
    // Animation for new transactions (first 10 are considered "new")
    const isNew = index < 10;
    const scaleAnim = useRef(new Animated.Value(isNew ? 0 : 1)).current;
    const opacityAnim = useRef(new Animated.Value(isNew ? 0 : 1)).current;

    useEffect(() => {
      if (isNew) {
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, []);

    return (
      <Animated.View
        key={`${tx.signature}-${index}`}
        style={[
          styles.txCard,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <View style={styles.txHeader}>
          <View style={[
            styles.txBadge,
            { backgroundColor: tx.success ? '#10b981' : '#ef4444' }
          ]}>
            <Text style={styles.txBadgeText}>
              {tx.success ? '✓' : '✗'}
            </Text>
          </View>
          <Text style={styles.txTime}>{formatTimestamp(tx.timestamp)}</Text>
        </View>

        {/* Signature as primary element */}
        <View style={styles.txSignatureMain}>
          <Text style={styles.txSignatureText}>
            {formatSignature(tx.signature)}
          </Text>
        </View>

        {/* Metadata in smaller text */}
        <View style={styles.txMeta}>
          <Text style={styles.txMetaItem}>
            Fee: {lamportsToSol(tx.fee).toFixed(6)} SOL
          </Text>
          <Text style={styles.txMetaItem}>Slot: {tx.slot.toLocaleString()}</Text>
          <Text style={styles.txMetaItem}>
            {tx.data.accounts.length} accts • {tx.data.instructions.length} instr
          </Text>
        </View>
      </Animated.View>
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
                  ? 'New transactions appear at top • Auto-refresh every 2s'
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
  txSignatureMain: {
    marginBottom: 10,
    paddingVertical: 8,
  },
  txSignatureText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#a5b4fc',
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  txMeta: {
    borderTopWidth: 1,
    borderTopColor: '#404040',
    paddingTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  txMetaItem: {
    fontSize: 10,
    color: '#808080',
    marginRight: 8,
  },
});
