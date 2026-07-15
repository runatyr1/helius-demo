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
  Modal,
  useWindowDimensions,
} from 'react-native';
import {
  getTokenTransfers,
  TokenTransfer,
  openTokenTransferStream,
  sendBonk,
} from '../services/helius-eng-challenge-ws';
import { getPublicEnv } from '../config/runtime';

const REFRESH_INTERVAL = 2000; // 2 seconds
const BATCH_SIZE = 100; // Fetch 100 transfers at a time
const GRAFANA_URL = getPublicEnv('EXPO_PUBLIC_GRAFANA_URL');
const GRAFANA_E2E_URL = getPublicEnv('EXPO_PUBLIC_GRAFANA_URL2');

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export default function EngChallengeScreen() {
  const { width: screenWidth } = useWindowDimensions();
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
  // Send BONK state
  const [bonkAmount, setBonkAmount] = useState(1);
  const [isSendingBonk, setIsSendingBonk] = useState(false);
  const [bonkError, setBonkError] = useState<string | null>(null);
  const [lastBonkSignature, setLastBonkSignature] = useState<string | null>(null);
  const [selectedPipelineStep, setSelectedPipelineStep] = useState<{
    title: string;
    detail: string;
    summary: string;
    how: string;
  } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transferStreamRef = useRef<{ close: () => void } | null>(null);
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

  const getTransferTime = (transfer: TokenTransfer) => {
    return Date.parse(transfer.block_time || transfer.created_at || '') || 0;
  };

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

  const addNewTransfers = (incomingTransfers: TokenTransfer[], sourceLabel: string) => {
    if (incomingTransfers.length === 0) {
      console.log(`${sourceLabel} No transfers received`);
      return;
    }

    const newTransfers = incomingTransfers.filter(
      (tx) => !seenSignatures.current.has(tx.signature)
    );

    console.log(`${sourceLabel} Filtered to ${newTransfers.length} new transfers (${incomingTransfers.length - newTransfers.length} duplicates)`);

    if (newTransfers.length === 0) return;

    newTransfers.forEach((tx) => {
      seenSignatures.current.add(tx.signature);
    });

    setTransfers((prev) => {
      return [...newTransfers, ...prev].sort(
        (a, b) => getTransferTime(b) - getTransferTime(a)
      );
    });
    setTotalFetched((prev) => {
      const newTotal = prev + newTransfers.length;
      const elapsed = (Date.now() - monitoringStartTime.getTime()) / 1000;
      const rate = elapsed > 0 ? newTotal / elapsed : 0;
      setCurrentRate(rate);
      return newTotal;
    });
  };

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
      addNewTransfers(response.transfers, attemptLabel);

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

  const startTransferStream = () => {
    if (transferStreamRef.current) return;

    transferStreamRef.current = openTokenTransferStream(
      (streamTransfers) => {
        if (isPausedRef.current || !isMonitoringRef.current) {
          console.log('[SSE] Transfer ignored - monitoring paused/stopped');
          return;
        }

        addNewTransfers(streamTransfers, '[SSE]');
        setError(null);
        setIsLoading(false);
      },
      () => {
        // EventSource reconnects automatically; polling remains the fallback.
      }
    );
  };

  const stopTransferStream = () => {
    if (transferStreamRef.current) {
      transferStreamRef.current.close();
      transferStreamRef.current = null;
    }
  };

  const startAutoRefresh = (forceInitialFetch = false) => {
    setIsPaused(false);
    isPausedRef.current = false;
    startTransferStream();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    fetchTransfers(forceInitialFetch);
    // SSE-only test mode: keep initial/manual fetch as snapshot fallback, but
    // disable scheduled polling to verify live feed push behaviour in isolation.
    // intervalRef.current = setInterval(() => {
    //   fetchTransfers();
    // }, REFRESH_INTERVAL);
  };

  const stopAutoRefresh = () => {
    setIsPaused(true);
    isPausedRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    stopTransferStream();
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
      stopTransferStream();
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

  const openE2eGrafana = () => {
    if (GRAFANA_E2E_URL) {
      Linking.openURL(GRAFANA_E2E_URL);
    } else {
      Alert.alert('E2E Grafana URL not configured');
    }
  };

  const handleSendBonk = async () => {
    setIsSendingBonk(true);
    setBonkError(null);
    setLastBonkSignature(null);

    try {
      const result = await sendBonk(bonkAmount);
      setLastBonkSignature(result.signature);
      // Auto-increment by 0.01 for easy tx identification
      setBonkAmount((prev) => Math.round((prev + 0.01) * 100) / 100);
    } catch (err: any) {
      setBonkError(err.message || 'Failed to send');
    } finally {
      setIsSendingBonk(false);
    }
  };

  const adjustBonkAmount = (delta: number) => {
    setBonkAmount((prev) => {
      const newVal = Math.round((prev + delta) * 100) / 100;
      return Math.max(0.01, Math.min(50, newVal));
    });
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

  const statusLabel = !isMonitoring ? 'Stopped' : isPaused ? 'Paused' : 'Live via SSE';
  const statusColor = !isMonitoring ? '#fb7185' : isPaused ? '#fbbf24' : '#34d399';
  const pageHorizontalPadding = screenWidth > 500 ? screenWidth * 0.1 : 14;
  const pipelineSteps = [
    {
      title: 'Send',
      detail: 'transfer',
      summary: 'Creates a small Solana test transfer from the backend wallet.',
      how: 'The UI calls /api/send-bonk. Backend sends the Solana transaction and records the signature for E2E tracking.',
    },
    {
      title: 'WebSocket',
      detail: 'see tx',
      summary: 'Detects the matching on-chain transaction quickly.',
      how: 'The indexer listens to Helius logsSubscribe for the configured token mint and receives the signature when Solana confirms it.',
    },
    {
      title: 'RPC',
      detail: 'enrich',
      summary: 'Fetches full transaction data for the signature.',
      how: 'The indexer calls getTransaction so it can read token balances, accounts, slot, and timestamp context.',
    },
    {
      title: 'Parser',
      detail: 'normalize',
      summary: 'Turns raw transaction data into one transfer row.',
      how: 'Parser compares pre/post token balances and extracts mint, amount, sender, receiver, signature, and slot.',
    },
    {
      title: 'Buffer',
      detail: 'batch',
      summary: 'Queues parsed transfers briefly before writing.',
      how: 'Memory buffer groups transfers by batch size or flush interval to reduce database write overhead.',
    },
    {
      title: 'DB',
      detail: 'persist',
      summary: 'Stores the normalized transfer permanently.',
      how: 'Postgres insert de-duplicates by signature and keeps indexed rows for fast latest-transfer reads.',
    },
    {
      title: 'SSE/API',
      detail: 'deliver',
      summary: 'Pushes or serves transfers to the browser.',
      how: 'SSE streams newly inserted rows live. The API snapshot remains available for initial load and refresh fallback.',
    },
    {
      title: 'UI',
      detail: 'render',
      summary: 'Shows the transfer in the live feed.',
      how: 'The screen dedupes signatures, sorts by time, and renders the newest transfers at the top.',
    },
  ];
  const pipelineColors = ['#0b1220', '#101827', '#132033', '#17253c', '#1a2b45', '#1e314f', '#22375a', '#273d64'];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={[
          styles.pageContent,
          {
            paddingLeft: pageHorizontalPadding,
            paddingRight: pageHorizontalPadding,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleManualRefresh}
            tintColor="#8b5cf6"
          />
        }
      >
        <View style={styles.heroCard}>
          <View style={styles.topRail}>
            <View style={styles.titleCluster}>
              <Text style={styles.heroTitle}>Web3 Pipeline Demo</Text>
              <View style={styles.pipelineFlow}>
                {pipelineSteps.map((step, index) => (
                  <TouchableOpacity
                    key={`${step.title}-${step.detail}`}
                    style={[
                      styles.pipelineStep,
                      { backgroundColor: pipelineColors[index] },
                    ]}
                    onPress={() => setSelectedPipelineStep(step)}
                  >
                    <Text style={styles.pipelineStepTitle}>{index + 1}. {step.title}</Text>
                    <Text style={styles.pipelineStepDetail}>{step.detail}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View
              style={[
                styles.monitorPanel,
                screenWidth > 500 && styles.monitorPanelWide,
              ]}
            >
              <View style={styles.monitorHeader}>
                <Text style={styles.sectionKicker}>Monitor</Text>
                <View style={[styles.statusPill, { borderColor: statusColor }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>

              <View style={styles.quickStats}>
                <View style={styles.metricTile}>
                  <Text style={styles.metricLabel}>Captured</Text>
                  <Text style={styles.metricValue}>{transfers.length}</Text>
                </View>
                <View style={styles.metricTile}>
                  <Text style={styles.metricLabel}>Visible</Text>
                  <Text style={styles.metricValue}>{filteredTransfers.length}</Text>
                </View>
                <View style={styles.metricTile}>
                  <Text style={styles.metricLabel}>Rate</Text>
                  <Text style={styles.metricValue}>{currentRate.toFixed(2)}/s</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.actionDeck}>
            <View style={styles.sendPanel}>
              <View style={styles.sendPanelHeader}>
                <View>
                  <Text style={styles.sectionKicker}>Test path</Text>
                </View>
                <Text style={styles.sendHint}>Amount auto-steps after send</Text>
              </View>

              <View style={styles.amountRow}>
                <TouchableOpacity style={styles.amountButton} onPress={() => adjustBonkAmount(-1)}>
                  <Text style={styles.amountButtonText}>-1</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.amountButtonSmall} onPress={() => adjustBonkAmount(-0.01)}>
                  <Text style={styles.amountButtonText}>-.01</Text>
                </TouchableOpacity>
                <View style={styles.amountReadout}>
                  <Text style={styles.amountText}>{bonkAmount.toFixed(2)}</Text>
                  <Text style={styles.amountUnit}>BONK token</Text>
                </View>
                <TouchableOpacity style={styles.amountButtonSmall} onPress={() => adjustBonkAmount(0.01)}>
                  <Text style={styles.amountButtonText}>+.01</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.amountButton} onPress={() => adjustBonkAmount(1)}>
                  <Text style={styles.amountButtonText}>+1</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.sendBonkButton, isSendingBonk && styles.sendBonkButtonDisabled]}
                onPress={handleSendBonk}
                disabled={isSendingBonk}
              >
                {isSendingBonk ? (
                  <ActivityIndicator size="small" color="#070812" />
                ) : (
                  <Text style={styles.sendBonkButtonText}>Send test transfer</Text>
                )}
              </TouchableOpacity>

              {bonkError && (
                <View style={styles.bonkErrorBar}>
                  <Text style={styles.bonkErrorText}>{bonkError}</Text>
                </View>
              )}
              {lastBonkSignature && (
                <TouchableOpacity
                  style={styles.bonkSuccessBar}
                  onPress={() => Linking.openURL(`https://solscan.io/tx/${lastBonkSignature}`)}
                >
                  <Text style={styles.bonkSuccessText}>
                    Sent {lastBonkSignature.slice(0, 8)}...{lastBonkSignature.slice(-8)}. Open Solscan
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.opsPanel}>
              <Text style={styles.sectionKicker}>Ops</Text>
              <View style={styles.controlRow}>
                {isMonitoring ? (
                  <>
                    <TouchableOpacity
                      style={[styles.controlButton, isPaused && styles.controlButtonActive]}
                      onPress={togglePause}
                    >
                      <Text style={styles.controlButtonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.controlButton, styles.stopButton]}
                      onPress={stopMonitoring}
                    >
                      <Text style={styles.controlButtonText}>Stop</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.controlButton, styles.restartButton]}
                    onPress={restartMonitoring}
                  >
                    <Text style={styles.controlButtonText}>Restart</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.linkGrid}>
                {GRAFANA_URL && (
                  <TouchableOpacity onPress={openGrafana} style={styles.linkButton}>
                    <Text style={styles.linkButtonText}>📊 Backend metrics</Text>
                  </TouchableOpacity>
                )}
                {GRAFANA_E2E_URL && (
                  <TouchableOpacity onPress={openE2eGrafana} style={styles.linkButton}>
                    <Text style={styles.linkButtonText}>⏱ E2E metrics</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.authorLink}
                  onPress={() => Linking.openURL('https://www.linkedin.com/in/pietro-cloud-engineer/')}
                >
                  <Text style={styles.authorText}>Pietro's Website</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {isRetrying && (
          <View style={styles.retryBanner}>
            <ActivityIndicator size="small" color="#fbbf24" style={styles.retrySpinner} />
            <Text style={styles.retryBannerText}>
              Reconnecting, attempt {retryCount}/{MAX_RETRIES}
            </Text>
          </View>
        )}

        <View style={styles.feedPanel}>
          <View style={styles.feedHeader}>
            <View style={styles.feedTitleGroup}>
              <Text style={styles.listTitle}>
                {isMonitoring ? 'Live transfers' : 'Captured transfers'}
              </Text>
              <Text style={styles.listSubtitle}>
                {addressFilter.trim()
                  ? `${filteredTransfers.length} matching ${transfers.length} total`
                  : isMonitoring
                    ? 'Newest rows stream in at top through SSE. Pull to snapshot-refresh.'
                    : 'Monitoring stopped. Pull down or restart to resume.'}
              </Text>
            </View>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.compactFilterInput}
                value={addressFilter}
                onChangeText={setAddressFilter}
                placeholder="Filter address"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {addressFilter.trim() && (
                <TouchableOpacity
                  style={styles.compactClearButton}
                  onPress={() => setAddressFilter('')}
                >
                  <Text style={styles.compactClearButtonText}>x</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {transfers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No transfers yet</Text>
              <Text style={styles.emptyText}>
                Send a Solana test transfer or wait for the indexer feed to push the next transfer.
              </Text>
            </View>
          ) : (
            <View style={styles.txList}>
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
        </View>
      </ScrollView>

      <Modal
        visible={selectedPipelineStep !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPipelineStep(null)}
      >
        <TouchableOpacity
          style={styles.pipelineModalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedPipelineStep(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.pipelineModalCard}>
            {selectedPipelineStep && (
              <>
                <Text style={styles.pipelineModalKicker}>Pipeline step</Text>
                <Text style={styles.pipelineModalTitle}>
                  {selectedPipelineStep.title} / {selectedPipelineStep.detail}
                </Text>
                <Text style={styles.pipelineModalLabel}>What it is</Text>
                <Text style={styles.pipelineModalText}>{selectedPipelineStep.summary}</Text>
                <Text style={styles.pipelineModalLabel}>How it works</Text>
                <Text style={styles.pipelineModalText}>{selectedPipelineStep.how}</Text>
                <TouchableOpacity
                  style={styles.pipelineModalButton}
                  onPress={() => setSelectedPipelineStep(null)}
                >
                  <Text style={styles.pipelineModalButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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

      <View style={styles.txAmountRow}>
        <Text style={styles.txAmount}>{formatAmount(transfer.amount, transfer.decimals)}</Text>
        <TouchableOpacity
          onPress={() => Linking.openURL('https://coinmarketcap.com/currencies/bonk/')}
          style={styles.tokenLink}
        >
          <Text style={styles.tokenLinkText}>{tokenSymbol}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => Linking.openURL(`https://solscan.io/tx/${transfer.signature}`)}
        style={styles.txSignatureMain}
      >
        <Text style={styles.txSignatureText}>{formatSignature(transfer.signature)}</Text>
      </TouchableOpacity>

      <View style={styles.txRoute}>
        <View style={styles.txAddressBlock}>
          <Text style={styles.txAddressLabel}>From</Text>
          <Text style={styles.txAddress}>{formatAddress(transfer.from_address)}</Text>
        </View>
        <Text style={styles.txArrow}>{'->'}</Text>
        <View style={styles.txAddressBlock}>
          <Text style={styles.txAddressLabel}>To</Text>
          <Text style={styles.txAddress}>{formatAddress(transfer.to_address)}</Text>
        </View>
      </View>

      <View style={styles.txMeta}>
        <Text style={styles.txMetaItem}>Slot {transfer.slot.toLocaleString()}</Text>
        <Text style={styles.txMetaItem}>Solscan</Text>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070812',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#070812',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#cbd5e1',
    fontWeight: '700',
  },
  loadingElapsed: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#a78bfa',
    fontFamily: 'monospace',
  },
  slowLoadingWarning: {
    marginTop: 12,
    fontSize: 14,
    color: '#fbbf24',
    fontWeight: '700',
  },
  loadingHint: {
    marginTop: 16,
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  retrySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#94a3b8',
  },
  retryingTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    color: '#fbbf24',
    marginBottom: 8,
  },
  retryingText: {
    fontSize: 16,
    color: '#fbbf24',
    marginBottom: 8,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fb7185',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  mainScroll: {
    flex: 1,
  },
  pageContent: {
    width: '100%',
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
  topRail: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  titleCluster: {
    flex: 3,
    minWidth: 260,
    gap: 6,
    justifyContent: 'flex-start',
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
  heroSubtitle: {
    maxWidth: 560,
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  pipelineFlow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 8,
  },
  pipelineStep: {
    width: 74,
    minHeight: 58,
    borderColor: '#283548',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pipelineStepTitle: {
    color: '#f8fafc',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  pipelineStepDetail: {
    marginTop: 2,
    color: '#94a3b8',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  pipelineModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 8, 18, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  pipelineModalCard: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#0f172a',
    borderColor: '#25324a',
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.35,
    shadowRadius: 34,
  },
  pipelineModalKicker: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  pipelineModalTitle: {
    marginTop: 4,
    color: '#f8fafc',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  pipelineModalLabel: {
    marginTop: 16,
    marginBottom: 5,
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  pipelineModalText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  pipelineModalButton: {
    marginTop: 18,
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
  },
  pipelineModalButtonText: {
    color: '#f8fafc',
    fontSize: 13,
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
  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  quickStats: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 6,
  },
  monitorPanel: {
    flex: 2,
    minWidth: 260,
    backgroundColor: '#111827',
    borderColor: '#283548',
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    gap: 10,
  },
  monitorPanelWide: {
    maxWidth: '40%',
  },
  monitorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricTile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#070812',
    borderColor: '#263244',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  metricValue: {
    marginTop: 2,
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  actionDeck: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sendPanel: {
    flex: 3,
    minWidth: 300,
    backgroundColor: '#111827',
    borderColor: '#283548',
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    gap: 10,
  },
  opsPanel: {
    flex: 2,
    minWidth: 260,
    backgroundColor: '#111827',
    borderColor: '#283548',
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    gap: 10,
  },
  sendPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  sectionKicker: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  sendTitle: {
    marginTop: 2,
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
  },
  sendHint: {
    color: '#64748b',
    fontSize: 10,
    textAlign: 'right',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  amountButton: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 13,
  },
  amountButtonSmall: {
    backgroundColor: '#172033',
    borderColor: '#2c3a50',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderRadius: 13,
  },
  amountButtonText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
  },
  amountReadout: {
    minWidth: 104,
    flexGrow: 1,
    backgroundColor: '#070812',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
  },
  amountText: {
    color: '#f8fafc',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  amountUnit: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  sendBonkButton: {
    backgroundColor: '#facc15',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  sendBonkButtonDisabled: {
    backgroundColor: '#475569',
  },
  sendBonkButtonText: {
    color: '#070812',
    fontSize: 14,
    fontWeight: '900',
  },
  bonkErrorBar: {
    backgroundColor: '#3f1220',
    borderColor: '#fb7185',
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  bonkErrorText: {
    color: '#fecdd3',
    fontSize: 12,
    textAlign: 'center',
  },
  bonkSuccessBar: {
    backgroundColor: '#052e2b',
    borderColor: '#2dd4bf',
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  bonkSuccessText: {
    color: '#ccfbf1',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  controlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  controlButton: {
    flex: 1,
    minWidth: 96,
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  stopButton: {
    backgroundColor: '#3f1220',
    borderColor: '#fb7185',
  },
  restartButton: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  controlButtonText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
  linkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkButton: {
    flexGrow: 1,
    minWidth: 116,
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButtonText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800',
  },
  authorLink: {
    flexGrow: 1,
    minWidth: 96,
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800',
  },
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2f250b',
    borderColor: '#fbbf24',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  retrySpinner: {
    marginRight: 8,
  },
  retryBannerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fde68a',
  },
  feedPanel: {
    backgroundColor: '#0f172a',
    borderColor: '#25324a',
    borderWidth: 1,
    borderRadius: 28,
    padding: 14,
    gap: 12,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  feedTitleGroup: {
    flex: 1,
    minWidth: 260,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#f8fafc',
    marginBottom: 3,
  },
  listSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  searchContainer: {
    minWidth: 220,
    maxWidth: 340,
    flexGrow: 1,
    position: 'relative',
  },
  compactFilterInput: {
    backgroundColor: '#070812',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    paddingRight: 40,
    fontSize: 13,
    color: '#f8fafc',
    fontFamily: 'monospace',
  },
  compactClearButton: {
    position: 'absolute',
    right: 10,
    top: 9,
    backgroundColor: '#1e293b',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactClearButtonText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '900',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 58,
    backgroundColor: '#0b1220',
    borderColor: '#25324a',
    borderWidth: 1,
    borderRadius: 22,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#f8fafc',
    marginBottom: 8,
  },
  emptyText: {
    maxWidth: 420,
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  txList: {
    gap: 10,
  },
  txCard: {
    backgroundColor: '#101827',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#263244',
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  txBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#24194f',
    borderColor: '#6d5dfc',
    borderWidth: 1,
  },
  txBadgeText: {
    color: '#ddd6fe',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  txTime: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  txAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 8,
  },
  txAmount: {
    fontSize: 21,
    fontWeight: '900',
    color: '#34d399',
    fontFamily: 'monospace',
  },
  tokenLink: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#062c27',
    borderColor: '#14b8a6',
    borderWidth: 1,
  },
  tokenLinkText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#99f6e4',
  },
  txSignatureMain: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  txSignatureText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#a5b4fc',
    fontFamily: 'monospace',
    letterSpacing: 0.2,
  },
  txRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  txAddressBlock: {
    flex: 1,
    minWidth: 110,
    backgroundColor: '#0b1220',
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  txAddressLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  txAddress: {
    marginTop: 3,
    fontSize: 12,
    color: '#cbd5e1',
    fontFamily: 'monospace',
    fontWeight: '800',
  },
  txArrow: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '900',
  },
  txMeta: {
    borderTopWidth: 1,
    borderTopColor: '#25324a',
    paddingTop: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  txMetaItem: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'monospace',
    fontWeight: '800',
  },
});
