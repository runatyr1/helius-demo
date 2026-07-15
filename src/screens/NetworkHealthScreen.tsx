import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
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
  const { width: screenWidth } = useWindowDimensions();
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

  const pageHorizontalPadding = screenWidth > 500 ? screenWidth * 0.1 : 14;
  const healthColor = health === 'ok' ? '#34d399' : '#fb7185';

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>Loading network data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingLeft: pageHorizontalPadding,
          paddingRight: pageHorizontalPadding,
        },
      ]}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#8b5cf6" />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.titleCluster}>
            <Text style={styles.eyebrow}>Solana RPC monitor</Text>
            <Text style={styles.headerTitle}>Network health</Text>
            <Text style={styles.headerSubtitle}>Live cluster health, epoch progress, version, and recent TPS samples.</Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: healthColor }]}> 
            <View style={[styles.statusDot, { backgroundColor: healthColor }]} />
            <Text style={[styles.statusText, { color: healthColor }]}>{health === 'ok' ? 'Healthy' : 'Degraded'}</Text>
          </View>
        </View>
        <View style={styles.headerMetaRow}>
          <Text style={styles.lastUpdate}>Last updated {formatTime(lastUpdate)}</Text>
          <Text style={styles.autoRefresh}>Auto-refresh 5s</Text>
        </View>
      </View>

      <View style={styles.cardGrid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Current Block Height</Text>
          <Text style={styles.cardValueLarge}>{formatNumber(blockHeight)}</Text>
        </View>

        {version && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Solana Version</Text>
            <Text style={styles.cardValue}>{version['solana-core']}</Text>
            <Text style={styles.cardSubtext}>Feature Set {version['feature-set']}</Text>
          </View>
        )}
      </View>

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
                          backgroundColor: tps > maxTPS * 0.7 ? '#34d399' : tps > maxTPS * 0.4 ? '#fbbf24' : '#8b5cf6',
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
              <Text style={styles.statLabel}>Samples</Text>
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
    backgroundColor: '#070812',
  },
  scrollContent: {
    paddingVertical: 14,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#070812',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#cbd5e1',
    fontWeight: '700',
  },
  header: {
    backgroundColor: '#0f172a',
    borderColor: '#25324a',
    borderWidth: 1,
    padding: 14,
    borderRadius: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  headerTitle: {
    fontSize: 29,
    lineHeight: 33,
    fontWeight: '900',
    color: '#f8fafc',
    letterSpacing: -1,
  },
  headerSubtitle: {
    maxWidth: 560,
    fontSize: 13,
    lineHeight: 18,
    color: '#94a3b8',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
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
  headerMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lastUpdate: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '800',
  },
  autoRefresh: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '800',
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    flexGrow: 1,
    minWidth: 260,
    backgroundColor: '#0f172a',
    borderColor: '#25324a',
    borderWidth: 1,
    padding: 14,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 1,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#38bdf8',
    marginBottom: 8,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  cardValueLarge: {
    fontSize: 30,
    fontWeight: '900',
    color: '#f8fafc',
    fontFamily: 'monospace',
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#f8fafc',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  cardSubtext: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'monospace',
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
    fontWeight: '900',
    color: '#f8fafc',
  },
  epochPercentage: {
    fontSize: 16,
    fontWeight: '900',
    color: '#a78bfa',
    fontFamily: 'monospace',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8b5cf6',
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
    color: '#64748b',
    marginBottom: 4,
    fontWeight: '800',
  },
  epochDetailValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#f8fafc',
    fontFamily: 'monospace',
  },
  chartSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16,
    fontWeight: '800',
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
    backgroundColor: '#0b1220',
    borderRadius: 8,
    overflow: 'hidden',
  },
  bar: {
    width: '80%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 8,
  },
  barLabel: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#25324a',
  },
  stat: {
    alignItems: 'center',
    minWidth: 90,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
    fontWeight: '800',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#a78bfa',
    fontFamily: 'monospace',
  },
});
