import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {
  validateSolanaAddress,
  getTransactionsForAddress,
  lamportsToSol,
  HeliusTransaction,
} from '../services/helius';

export default function TransactionHistoryScreen() {
  const [address, setAddress] = useState('');
  const [transactions, setTransactions] = useState<HeliusTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchTransactions = async (isRefresh = false) => {
    if (!address.trim()) {
      Alert.alert('Error', 'Please enter a Solana address');
      return;
    }

    if (!validateSolanaAddress(address)) {
      Alert.alert('Error', 'Invalid Solana address');
      return;
    }

    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const txs = await getTransactionsForAddress(address, 20);
      setTransactions(txs);
      setHasSearched(true);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      Alert.alert('Error', error.message || 'Failed to fetch transactions');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleSearch = () => {
    fetchTransactions(false);
  };

  const handleRefresh = () => {
    fetchTransactions(true);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSignature = (sig: string) => {
    return `${sig.slice(0, 8)}...${sig.slice(-8)}`;
  };

  const getTransactionSummary = (tx: HeliusTransaction) => {
    // Check for native SOL transfers
    if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
      const transfer = tx.nativeTransfers[0];
      const amount = lamportsToSol(transfer.amount);
      const isSender = transfer.fromUserAccount === address;

      return {
        type: isSender ? 'Sent' : 'Received',
        amount: `${isSender ? '-' : '+'}${amount.toFixed(4)} SOL`,
        color: isSender ? '#ef4444' : '#10b981',
      };
    }

    // Check for token transfers
    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      const transfer = tx.tokenTransfers[0];
      const isSender = transfer.fromUserAccount === address;

      return {
        type: isSender ? 'Token Sent' : 'Token Received',
        amount: `${transfer.tokenAmount} tokens`,
        color: isSender ? '#ef4444' : '#10b981',
      };
    }

    // Fallback to type from API
    return {
      type: tx.type || 'Transaction',
      amount: `Fee: ${lamportsToSol(tx.fee).toFixed(6)} SOL`,
      color: '#6366f1',
    };
  };

  const renderTransaction = (tx: HeliusTransaction) => {
    const summary = getTransactionSummary(tx);

    return (
      <View key={tx.signature} style={styles.txCard}>
        <View style={styles.txHeader}>
          <View style={[styles.txBadge, { backgroundColor: summary.color }]}>
            <Text style={styles.txBadgeText}>{summary.type}</Text>
          </View>
          <Text style={styles.txTime}>{formatTimestamp(tx.timestamp)}</Text>
        </View>

        <View style={styles.txAmount}>
          <Text style={[styles.txAmountText, { color: summary.color }]}>
            {summary.amount}
          </Text>
        </View>

        {tx.description && (
          <Text style={styles.txDescription}>{tx.description}</Text>
        )}

        <View style={styles.txFooter}>
          <Text style={styles.txSignature}>
            Signature: {formatSignature(tx.signature)}
          </Text>
          <Text style={styles.txSlot}>Slot: {tx.slot.toLocaleString()}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputSection}>
        <Text style={styles.label}>Solana Wallet Address</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="Enter wallet address"
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSearch}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {hasSearched ? 'Search Again' : 'Get Transactions'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            enabled={hasSearched}
          />
        }
      >
        {!hasSearched ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📜</Text>
            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
            <Text style={styles.emptyText}>
              Enter a wallet address above to view transaction history
            </Text>
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>No Transactions Found</Text>
            <Text style={styles.emptyText}>
              This address has no transaction history
            </Text>
          </View>
        ) : (
          <View style={styles.txList}>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>
                Recent Transactions ({transactions.length})
              </Text>
              <Text style={styles.listSubtitle}>
                Pull to refresh
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
  buttonText: {
    color: '#fff',
    fontSize: 16,
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
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
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
    color: '#333',
    marginBottom: 4,
  },
  listSubtitle: {
    fontSize: 12,
    color: '#999',
  },
  txCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  txBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  txBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  txTime: {
    fontSize: 12,
    color: '#999',
  },
  txAmount: {
    marginBottom: 8,
  },
  txAmountText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  txDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  txFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
    marginTop: 8,
  },
  txSignature: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  txSlot: {
    fontSize: 11,
    color: '#999',
  },
});
