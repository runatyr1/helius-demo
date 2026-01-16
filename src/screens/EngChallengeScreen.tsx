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
  Linking,
  TextInput,
} from 'react-native';
import {
  getTokenTransfers,
  TokenTransfer,
} from '../services/helius-eng-challenge-ws';

const REFRESH_INTERVAL = 2000; // 2 seconds
const BATCH_SIZE = 100; // Fetch 100 transfers at a time
const GRAFANA_URL = process.env.EXPO_PUBLIC_GRAFANA_URL || '';

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export default function EngChallengeScreen() {
  const [transfers, setTransfers] = useState<TokenTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [totalFetched, setTotalFetched] = useState(0);
  const [currentRate, setCurrentRate] = useState(0);
  const [addressFilter, setAddressFilter] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [loadingStartTime, setLoadingStartTime] = useState<Date>(new Date());
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const seenSignatures = useRef<Set<string>>(new Set());
  const [monitoringStartTime, setMonitoringStartTime] = useState<Date>(new Date());

  const isPausedRef = useRef(isPaused);
  const isMonitoringRef = useRef(isMonitoring);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    isMonitoringRef.current = isMonitoring;
  }, [isMonitoring]);

  // Track loading time
  useEffect(() => {
    if (isLoading) {
      setLoadingStartTime(new Date());
      setLoadingElapsed(0);

      loadingTimerRef.current = setInterval(() => {
        setLoadingElapsed(Date.now() - loadingStartTime.getTime());
      }, 100);

      return () => {
        if (loadingTimerRef.current) {
          clearInterval(loadingTimerRef.current);
        }
      };
    } else {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
      }
    }
  }, [isLoading]);

  const fetchTransfers = async (isManualRefresh = false, currentRetry = 0) => {
    const fetchStartTime = Date.now();
    const attemptLabel = currentRetry > 0 ? `[Retry ${currentRetry}/${MAX_RETRIES}]` : '[Initial]';

    console.log(`${attemptLabel} Starting fetch at ${new Date().toISOString()}`);

    if ((isPausedRef.current || !isMonitoringRef.current) && !isManualRefresh) {
      console.log(`${attemptLabel} Fetch skipped - paused:${isPausedRef.current}, monitoring:${isMonitoringRef.current}`);
      return;
    }

    try {
      if (isManualRefresh) {
        console.log(`${attemptLabel} Manual refresh triggered`);
        setIsRefreshing(true);
      }

      if (currentRetry > 0) {
        console.log(`${attemptLabel} Setting retry UI state`);
        setIsRetrying(true);
        setRetryCount(currentRetry);
      }

      console.log(`${attemptLabel} Calling API: getTokenTransfers(${BATCH_SIZE}, 0)`);
      const apiCallStart = Date.now();
      const response = await getTokenTransfers(BATCH_SIZE, 0);
      const apiCallDuration = Date.now() - apiCallStart;

      console.log(`${attemptLabel} API call completed in ${apiCallDuration}ms`);
      console.log(`${attemptLabel} Received ${response.transfers.length} transfers from API`);

      const processingStart = Date.now();
      if (response.transfers.length > 0) {
        const newTransfers = response.transfers.filter(
          (tx) => !seenSignatures.current.has(tx.signature)
        );

        console.log(`${attemptLabel} Filtered to ${newTransfers.length} new transfers (${response.transfers.length - newTransfers.length} duplicates)`);

        if (newTransfers.length > 0) {
          newTransfers.forEach((tx) => {
            seenSignatures.current.add(tx.signature);
          });

          setTransfers((prev) => [...newTransfers, ...prev]);
          setTotalFetched((prev) => {
            const newTotal = prev + newTransfers.length;
            const elapsed = (Date.now() - monitoringStartTime.getTime()) / 1000;
            const rate = elapsed > 0 ? newTotal / elapsed : 0;
            setCurrentRate(rate);
            return newTotal;
          });
        }
      } else {
        console.log(`${attemptLabel} No transfers received from API`);
      }

      const processingDuration = Date.now() - processingStart;
      const totalDuration = Date.now() - fetchStartTime;

      console.log(`${attemptLabel} Processing completed in ${processingDuration}ms`);
      console.log(`${attemptLabel} ✓ Total fetch operation: ${totalDuration}ms (API: ${apiCallDuration}ms, Processing: ${processingDuration}ms)`);

      // Success - reset retry state
      setError(null);
      setIsLoading(false);
      setIsRetrying(false);
      setRetryCount(0);
    } catch (error: any) {
      const totalDuration = Date.now() - fetchStartTime;
      console.error(`${attemptLabel} ✗ Fetch failed after ${totalDuration}ms:`, error);
      console.error(`${attemptLabel} Error details:`, {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      });

      // Retry logic with exponential backoff
      if (currentRetry < MAX_RETRIES) {
        const nextRetry = currentRetry + 1;
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, currentRetry);

        console.log(`${attemptLabel} ⟳ Scheduling retry ${nextRetry}/${MAX_RETRIES} in ${delay}ms`);
        setError(`Connection failed. Retrying (${nextRetry}/${MAX_RETRIES})...`);
        setIsRetrying(true);
        setRetryCount(nextRetry);

        setTimeout(() => {
          console.log(`[Retry ${nextRetry}/${MAX_RETRIES}] Starting retry now...`);
          fetchTransfers(isManualRefresh, nextRetry);
        }, delay);
      } else {
        // Max retries reached
        console.error(`${attemptLabel} ✗✗✗ All ${MAX_RETRIES} retry attempts exhausted. Giving up.`);
        setError(error.message || 'Failed to fetch transfers after multiple attempts');
        setIsLoading(false);
        setIsRetrying(false);
        setRetryCount(0);

        if (isManualRefresh) {
          Alert.alert('Error', error.message || 'Failed to fetch transfers after multiple attempts');
        }
      }
    } finally {
      if (currentRetry >= MAX_RETRIES || !error) {
        setIsRefreshing(false);
      }
    }
  };

  const startAutoRefresh = (forceInitialFetch = false) => {
    setIsPaused(false);
    isPausedRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    fetchTransfers(forceInitialFetch);
    intervalRef.current = setInterval(() => {
      fetchTransfers();
    }, REFRESH_INTERVAL);
  };

  const stopAutoRefresh = () => {
    setIsPaused(true);
    isPausedRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    console.log('=== EngChallengeScreen mounted ===');
    console.log('Starting initial data fetch...');

    startAutoRefresh();

    return () => {
      console.log('=== EngChallengeScreen unmounting ===');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
      }
    };
  }, []);

  const handleManualRefresh = () => {
    if (!isMonitoring) {
      restartMonitoring();
    } else {
      fetchTransfers(true);
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
    isMonitoringRef.current = false;
    stopAutoRefresh();
    Alert.alert(
      'Monitoring Stopped',
      `Captured ${transfers.length} transfers. Pull down to restart.`,
      [{ text: 'OK' }]
    );
  };

  const restartMonitoring = () => {
    setTransfers([]);
    seenSignatures.current.clear();
    setTotalFetched(0);
    setCurrentRate(0);
    setMonitoringStartTime(new Date());
    setIsMonitoring(true);
    isMonitoringRef.current = true;
    startAutoRefresh(true);
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

  const formatAddress = (addr: string) => {
    if (addr === 'unknown') return addr;
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const formatAmount = (amount: string, decimals: number) => {
    const num = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const intPart = num / divisor;
    const fractPart = num % divisor;
    const fractStr = fractPart.toString().padStart(decimals, '0');
    const intPartFormatted = intPart.toLocaleString('en-US');
    return `${intPartFormatted}.${fractStr.slice(0, 6)}`;
  };

  const getMintSymbol = (mint: string) => {
    // Hardcoded for BONK demo
    return 'BONK';
  };

  const openGrafana = () => {
    if (GRAFANA_URL) {
      Linking.openURL(GRAFANA_URL);
    } else {
      Alert.alert('Grafana URL not configured');
    }
  };

  // Filter transfers by address (full or partial match on from/to)
  const filteredTransfers = addressFilter.trim()
    ? transfers.filter(tx => {
        const filter = addressFilter.trim().toLowerCase();
        const from = tx.from_address.toLowerCase();
        const to = tx.to_address.toLowerCase();

        // Match full address or partial (first/last characters)
        return from.includes(filter) ||
               to.includes(filter) ||
               from.startsWith(filter) ||
               from.endsWith(filter) ||
               to.startsWith(filter) ||
               to.endsWith(filter);
      })
    : transfers;

  if (isLoading) {
    const elapsedSeconds = (loadingElapsed / 1000).toFixed(1);
    const isSlowLoading = loadingElapsed > 3000;

    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={isSlowLoading ? '#f59e0b' : '#6366f1'} />
        <Text style={[styles.loadingText, isSlowLoading && { color: '#f59e0b' }]}>
          {isRetrying
            ? `Retrying connection (${retryCount}/${MAX_RETRIES})...`
            : 'Connecting to backend...'}
        </Text>
        <Text style={styles.loadingElapsed}>
          {elapsedSeconds}s elapsed
        </Text>
        {isRetrying && (
          <Text style={styles.retrySubtext}>
            Connection attempt {retryCount} of {MAX_RETRIES}
          </Text>
        )}
        {isSlowLoading && !isRetrying && (
          <Text style={styles.slowLoadingWarning}>
            ⚠️ Taking longer than expected...
          </Text>
        )}
        <Text style={styles.loadingHint}>
          Check console logs for details
        </Text>
      </View>
    );
  }

  if (error && transfers.length === 0) {
    return (
      <View style={styles.centerContainer}>
        {isRetrying ? (
          <>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={styles.retryingTitle}>Retrying Connection...</Text>
            <Text style={styles.retryingText}>
              Attempt {retryCount} of {MAX_RETRIES}
            </Text>
            <Text style={styles.errorText}>{error}</Text>
          </>
        ) : (
          <>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Connection Error</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchTransfers(true)}>
              <Text style={styles.retryButtonText}>Retry Manually</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with search, author and Grafana link */}
      <View style={styles.authorBar}>
        {/* Left: Search filter */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.compactFilterInput}
            value={addressFilter}
            onChangeText={setAddressFilter}
            placeholder="🔍 Filter address..."
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {addressFilter.trim() && (
            <TouchableOpacity
              style={styles.compactClearButton}
              onPress={() => setAddressFilter('')}
            >
              <Text style={styles.compactClearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Right: Author and Grafana */}
        <View style={styles.authorInfoContainer}>
          <TouchableOpacity onPress={() => Linking.openURL('https://www.linkedin.com/in/pietro-cloud-engineer/')}>
            <Text style={styles.authorText}>Author: <Text style={styles.authorBold}>Pietro</Text></Text>
          </TouchableOpacity>
          {GRAFANA_URL && (
            <TouchableOpacity onPress={openGrafana} style={styles.grafanaLink}>
              <Text style={styles.grafanaLinkText}>📊 Live backend metrics</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Retry Banner */}
      {isRetrying && (
        <View style={styles.retryBanner}>
          <ActivityIndicator size="small" color="#f59e0b" style={styles.retrySpinner} />
          <Text style={styles.retryBannerText}>
            Reconnecting... (Attempt {retryCount}/{MAX_RETRIES})
          </Text>
        </View>
      )}

      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{transfers.length}</Text>
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
            <Text style={styles.controlButtonText}>🔄 Restart</Text>
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
        {transfers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🪙</Text>
            <Text style={styles.emptyTitle}>No Transfers Yet</Text>
            <Text style={styles.emptyText}>
              Waiting for token transfers from eng-challenge indexer...
            </Text>
          </View>
        ) : (
          <View style={styles.txList}>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>
                {isMonitoring ? 'Live Token Transfers' : 'Captured Transfers'}
                {addressFilter.trim() ? ` (${filteredTransfers.length} of ${transfers.length})` : ` (${transfers.length})`}
              </Text>
              <Text style={styles.listSubtitle}>
                {isMonitoring
                  ? 'New transfers appear at top • Auto-refresh every 2s'
                  : 'Scroll through captured transfers • Pull down to restart'}
              </Text>
            </View>
            {filteredTransfers.map((transfer, index) => (
              <TransferCard
                key={`${transfer.signature}-${index}`}
                transfer={transfer}
                index={index}
                formatTimestamp={formatTimestamp}
                formatSignature={formatSignature}
                formatAddress={formatAddress}
                formatAmount={formatAmount}
                getMintSymbol={getMintSymbol}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const TransferCard = React.memo(({ transfer, index, formatTimestamp, formatSignature, formatAddress, formatAmount, getMintSymbol }: {
  transfer: TokenTransfer;
  index: number;
  formatTimestamp: (timestamp: string) => string;
  formatSignature: (sig: string) => string;
  formatAddress: (addr: string) => string;
  formatAmount: (amount: string, decimals: number) => string;
  getMintSymbol: (mint: string) => string;
}) => {
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

  const tokenSymbol = getMintSymbol(transfer.mint);

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
        <View style={styles.txBadge}>
          <Text style={styles.txBadgeText}>{tokenSymbol}</Text>
        </View>
        <Text style={styles.txTime}>{formatTimestamp(transfer.created_at)}</Text>
      </View>

      <TouchableOpacity
        onPress={() => Linking.openURL(`https://solscan.io/tx/${transfer.signature}`)}
        style={styles.txSignatureMain}
      >
        <Text style={styles.txSignatureText}>
          {formatSignature(transfer.signature)} 🔗
        </Text>
      </TouchableOpacity>

      <View style={styles.txTransfer}>
        <Text style={styles.txAddress}>From: {formatAddress(transfer.from_address)}</Text>
        <Text style={styles.txAmount}>
          {formatAmount(transfer.amount, transfer.decimals)}{' '}
          <TouchableOpacity
            onPress={() => Linking.openURL('https://coinmarketcap.com/currencies/bonk/')}
            style={styles.tokenLinkInline}
          >
            <Text style={styles.tokenLink}>{tokenSymbol}</Text>
          </TouchableOpacity>
        </Text>
        <Text style={styles.txAddress}>To: {formatAddress(transfer.to_address)}</Text>
      </View>

      <View style={styles.txMeta}>
        <Text style={styles.txMetaItem}>Slot: {transfer.slot.toLocaleString()}</Text>
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
    fontWeight: '600',
  },
  loadingElapsed: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366f1',
    fontFamily: 'monospace',
  },
  slowLoadingWarning: {
    marginTop: 12,
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '600',
  },
  loadingHint: {
    marginTop: 16,
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  retrySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#808080',
  },
  retryingTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600',
    color: '#f59e0b',
    marginBottom: 8,
  },
  retryingText: {
    fontSize: 16,
    color: '#f59e0b',
    marginBottom: 8,
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
  authorBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2d2d2d',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    maxWidth: 300,
    position: 'relative',
  },
  compactFilterInput: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#404040',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#f5f5f5',
    fontFamily: 'monospace',
  },
  compactClearButton: {
    position: 'absolute',
    right: 6,
    top: '50%',
    transform: [{ translateY: -12 }],
    backgroundColor: '#404040',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactClearButtonText: {
    color: '#a0a0a0',
    fontSize: 12,
    fontWeight: '600',
  },
  authorInfoContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
  },
  authorText: {
    fontSize: 12,
    color: '#a0a0a0',
  },
  authorBold: {
    fontWeight: 'bold',
  },
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  retrySpinner: {
    marginRight: 8,
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  grafanaLink: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#6366f1',
    borderRadius: 4,
  },
  grafanaLinkText: {
    fontSize: 11,
    color: '#fff',
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
    backgroundColor: '#6366f1',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#a5b4fc',
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  txTransfer: {
    marginBottom: 10,
    paddingVertical: 8,
    backgroundColor: '#252525',
    borderRadius: 6,
    paddingHorizontal: 12,
  },
  txAddress: {
    fontSize: 11,
    color: '#b0b0b0',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    fontFamily: 'monospace',
    textAlign: 'center',
    marginVertical: 6,
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
  tokenLinkInline: {
    display: 'inline-block' as any,
  },
  tokenLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
    textDecorationLine: 'underline',
  },
});
