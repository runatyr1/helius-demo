import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {
  getNetworkHealth,
  getBlockHeight,
  getEpochInfo,
  getRecentPerformanceSamples,
  getSolanaVersion,
  EpochInfo,
  PerformanceSample,
  SolanaVersion,
} from '../services/helius';

export default function NetworkHealthScreen() {
  const [health, setHealth] = useState<string>('');
  const [blockHeight, setBlockHeight] = useState<number>(0);
  const [epochInfo, setEpochInfo] = useState<EpochInfo | null>(null);
  const [performanceSamples, setPerformanceSamples] = useState<PerformanceSample[]>([]);
  const [version, setVersion] = useState<SolanaVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchNetworkData();

    // Auto-refresh every 5 seconds
    intervalRef.current = setInterval(() => {
      fetchNetworkData(true);
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const fetchNetworkData = async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const [healthData, heightData, epochData, perfData, versionData] = await Promise.all([
        getNetworkHealth(),
        getBlockHeight(),
        getEpochInfo(),
        getRecentPerformanceSamples(10),
        getSolanaVersion(),
      ]);

      setHealth(healthData);
      setBlockHeight(heightData);
      setEpochInfo(epochData);
      setPerformanceSamples(perfData);
      setVersion(versionData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching network data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchNetworkData();
  };

  const calculateTPS = (sample: PerformanceSample): number => {
    if (sample.samplePeriodSecs === 0) return 0;
    return Math.round(sample.numTransactions / sample.samplePeriodSecs);
  };

  const getEpochProgress = (): number => {
    if (!epochInfo) return 0;
    return (epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100;
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading network data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Solana Network Status!</Text>
          <View style={[styles.statusBadge, { backgroundColor: health === 'ok' ? '#10b981' : '#ef4444' }]}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{health === 'ok' ? 'Healthy' : 'Degraded'}</Text>
          </View>
        </View>
        <Text style={styles.lastUpdate}>Last updated: {formatTime(lastUpdate)}</Text>
        <Text style={styles.autoRefresh}>Auto-refreshes every 5s</Text>
      </View>

      {/* Block Height Card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Current Block Height</Text>
        <Text style={styles.cardValueLarge}>{formatNumber(blockHeight)}</Text>
      </View>

      {/* Epoch Info Card */}
      {epochInfo && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Epoch Progress</Text>
          <View style={styles.epochInfo}>
            <View style={styles.epochRow}>
              <Text style={styles.epochText}>Epoch {epochInfo.epoch}</Text>
              <Text style={styles.epochPercentage}>{getEpochProgress().toFixed(2)}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${getEpochProgress()}%` }]} />
            </View>
            <View style={styles.epochDetails}>
              <View style={styles.epochDetail}>
                <Text style={styles.epochDetailLabel}>Slot</Text>
                <Text style={styles.epochDetailValue}>
                  {formatNumber(epochInfo.slotIndex)} / {formatNumber(epochInfo.slotsInEpoch)}
                </Text>
              </View>
              <View style={styles.epochDetail}>
                <Text style={styles.epochDetailLabel}>Absolute Slot</Text>
                <Text style={styles.epochDetailValue}>{formatNumber(epochInfo.absoluteSlot)}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Version Card */}
      {version && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Solana Version</Text>
          <Text style={styles.cardValue}>{version['solana-core']}</Text>
          <Text style={styles.cardSubtext}>Feature Set: {version['feature-set']}</Text>
        </View>
      )}

      {/* Performance Chart */}
      {performanceSamples.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Recent Performance (TPS)</Text>
          <Text style={styles.chartSubtext}>Last 10 samples</Text>

          <View style={styles.chart}>
            {performanceSamples.slice(0, 10).reverse().map((sample, index) => {
              const tps = calculateTPS(sample);
              const maxTPS = Math.max(...performanceSamples.map(calculateTPS));
              const heightPercent = maxTPS > 0 ? (tps / maxTPS) * 100 : 0;

              return (
                <View key={sample.slot} style={styles.barContainer}>
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max(heightPercent, 5)}%`,
                          backgroundColor: tps > maxTPS * 0.7 ? '#10b981' : tps > maxTPS * 0.4 ? '#f59e0b' : '#6366f1',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{formatNumber(tps)}</Text>
                </View>
              );
            })}
          </View>

          {/* Stats Summary */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Avg TPS</Text>
              <Text style={styles.statValue}>
                {formatNumber(
                  Math.round(
                    performanceSamples.reduce((acc, s) => acc + calculateTPS(s), 0) /
                      performanceSamples.length
                  )
                )}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Peak TPS</Text>
              <Text style={styles.statValue}>
                {formatNumber(Math.max(...performanceSamples.map(calculateTPS)))}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Samplesss</Text>
              <Text style={styles.statValue}>{performanceSamples.length}</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#b0b0b0',
  },
  header: {
    backgroundColor: '#2d2d2d',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f5f5f5',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2d2d2d',
    marginRight: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  lastUpdate: {
    fontSize: 12,
    color: '#808080',
    marginTop: 4,
  },
  autoRefresh: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#2d2d2d',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#b0b0b0',
    marginBottom: 8,
  },
  cardValueLarge: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#818cf8',
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f5f5f5',
    marginBottom: 4,
  },
  cardSubtext: {
    fontSize: 12,
    color: '#808080',
  },
  epochInfo: {
    marginTop: 8,
  },
  epochRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  epochText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f5f5f5',
  },
  epochPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#818cf8',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 4,
  },
  epochDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  epochDetail: {
    flex: 1,
  },
  epochDetailLabel: {
    fontSize: 12,
    color: '#808080',
    marginBottom: 4,
  },
  epochDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f5f5f5',
  },
  chartSubtext: {
    fontSize: 12,
    color: '#808080',
    marginBottom: 16,
  },
  chart: {
    height: 150,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 2,
  },
  barWrapper: {
    width: '100%',
    height: 120,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '80%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 8,
  },
  barLabel: {
    fontSize: 9,
    color: '#b0b0b0',
    marginTop: 4,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#808080',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#818cf8',
  },
});
