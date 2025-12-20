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

const REFRESH_INTERVAL = 500; // 500ms - fetch 2x per second for smooth streaming
const BATCH_SIZE = 20; // Smaller batches for more frequent, smoother updates

export default function TransactionHistorySimScreen() {
  const [transactions, setTransactions] = useState<SimulatedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [totalFetched, setTotalFetched] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [monitoringStartTime, setMonitoringStartTime] = useState<Date>(new Date());
  const [currentRate, setCurrentRate] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSignatureRef = useRef<string | null>(null);
  const seenSignatures = useRef<Set<string>>(new Set());

  // Use refs to avoid closure issues in interval callback
  const isPausedRef = useRef(isPaused);
  const isMonitoringRef = useRef(isMonitoring);

  // Keep refs in sync with state
  useEffect(() => {
    isPausedRef.current = isPaused;
    console.log(`[TransactionSim] isPausedRef updated to: ${isPaused}`);
  }, [isPaused]);

  useEffect(() => {
    isMonitoringRef.current = isMonitoring;
    console.log(`[TransactionSim] isMonitoringRef updated to: ${isMonitoring}`);
  }, [isMonitoring]);

  const fetchTransactions = async (isManualRefresh = false) => {
    console.log(`[TransactionSim] fetchTransactions called - isPaused: ${isPaused}, isMonitoring: ${isMonitoring}, isPausedRef: ${isPausedRef.current}, isMonitoringRef: ${isMonitoringRef.current}, isManualRefresh: ${isManualRefresh}`);

    if ((isPausedRef.current || !isMonitoringRef.current) && !isManualRefresh) {
      console.log('[TransactionSim] Fetch skipped - paused or not monitoring');
      return;
    }

    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      }

      console.log(`[TransactionSim] Fetching ${BATCH_SIZE} transactions...`);
      const response = await getSimulatedTransactions(BATCH_SIZE, 0);
      console.log(`[TransactionSim] Received ${response.transactions.length} transactions from API`);

      if (response.transactions.length > 0) {
        // Filter out transactions we've already seen
        const newTransactions = response.transactions.filter(
          (tx) => !seenSignatures.current.has(tx.signature)
        );

        console.log(`[TransactionSim] After filtering: ${newTransactions.length} new, ${response.transactions.length - newTransactions.length} duplicates (seenSignatures size: ${seenSignatures.current.size})`);

        if (newTransactions.length > 0) {
          // Add new signatures to the set
          newTransactions.forEach((tx) => {
            seenSignatures.current.add(tx.signature);
          });

          // Prepend new transactions (newest at top)
          setTransactions((prev) => [...newTransactions, ...prev]);
          setTotalFetched((prev) => {
            const newTotal = prev + newTransactions.length;
            // Calculate rate: total transactions / elapsed seconds
            const elapsed = (Date.now() - monitoringStartTime.getTime()) / 1000;
            const rate = elapsed > 0 ? newTotal / elapsed : 0;
            setCurrentRate(rate);
            return newTotal;
          });
          lastSignatureRef.current = newTransactions[0].signature;
          setLastUpdateTime(new Date());
        } else {
          console.log('[TransactionSim] No new transactions - all filtered as duplicates');
        }
      } else {
        console.log('[TransactionSim] API returned 0 transactions');
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
    console.log(`[TransactionSim] Starting auto-refresh with interval: ${REFRESH_INTERVAL}ms`);
    setIsPaused(false);
    isPausedRef.current = false; // Update ref synchronously
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Fetch immediately (force if restarting)
    fetchTransactions(forceInitialFetch);

    // Then fetch every REFRESH_INTERVAL
    intervalRef.current = setInterval(() => {
      console.log('[TransactionSim] Interval tick - calling fetchTransactions');
      fetchTransactions();
    }, REFRESH_INTERVAL);
    console.log(`[TransactionSim] Interval created with ID: ${intervalRef.current}`);
  };

  const stopAutoRefresh = () => {
    setIsPaused(true);
    isPausedRef.current = true; // Update ref synchronously
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
    isMonitoringRef.current = false; // Update ref synchronously
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
    setCurrentRate(0);
    setMonitoringStartTime(new Date());
    lastSignatureRef.current = null;
    setIsMonitoring(true);
    isMonitoringRef.current = true; // Update ref synchronously
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

  // Early returns for loading and error states
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
          <Text style={styles.statValue}>{currentRate.toFixed(1)} tx/s</Text>
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
                  ? 'New transactions appear at top • Auto-refresh every 0.5s'
                  : 'Scroll through captured transactions • Pull down to restart'}
              </Text>
            </View>
            {transactions.map((tx, index) => (
              <TransactionCard
                key={`${tx.signature}-${index}`}
                tx={tx}
                index={index}
                formatTimestamp={formatTimestamp}
                formatSignature={formatSignature}
                lamportsToSol={lamportsToSol}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Separate component for transaction card with animations
const TransactionCard = React.memo(({ tx, index, formatTimestamp, formatSignature, lamportsToSol }: {
  tx: SimulatedTransaction;
  index: number;
  formatTimestamp: (timestamp: string) => string;
  formatSignature: (sig: string) => string;
  lamportsToSol: (lamports: number) => number;
}) => {
  // Animation for new transactions (first 5 are considered "new" for smaller batches)
  const isNew = index < 5;
  const scaleAnim = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const opacityAnim = useRef(new Animated.Value(isNew ? 0 : 1)).current;

  useEffect(() => {
    if (isNew) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6, // Reduced friction for snappier animation
          tension: 50, // Increased tension for faster spring
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200, // Faster fade-in for smoother feel
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, []);

  return (
    <Animated.View
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
});

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
