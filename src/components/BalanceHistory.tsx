import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BalanceUpdate } from '../types';
import { lamportsToSol } from '../services/helius';

interface BalanceHistoryProps {
  updates: BalanceUpdate[];
}

export default function BalanceHistory({ updates }: BalanceHistoryProps) {
  if (updates.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No balance updates yet</Text>
        <Text style={styles.emptySubtext}>
          Waiting for account activity...
        </Text>
      </View>
    );
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatBalance = (balance: number) => {
    return balance.toFixed(9);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Balance History</Text>
      <View style={styles.updateList}>
        {updates
          .slice()
          .reverse()
          .map((update, index) => (
            <View key={`${update.timestamp}-${index}`} style={styles.updateItem}>
              <View style={styles.updateHeader}>
                <Text style={styles.updateTime}>{formatTime(update.timestamp)}</Text>
                {update.slot && (
                  <Text style={styles.updateSlot}>Slot: {update.slot}</Text>
                )}
              </View>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Balance:</Text>
                <Text style={styles.balanceValue}>
                  {formatBalance(update.balance)} SOL
                </Text>
              </View>
              <Text style={styles.lamports}>{update.lamports.toLocaleString()} lamports</Text>
            </View>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f172a',
    borderColor: '#25324a',
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#f8fafc',
  },
  updateList: {
    gap: 10,
  },
  updateItem: {
    backgroundColor: '#101827',
    borderColor: '#263244',
    borderWidth: 1,
    padding: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 1,
  },
  updateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  updateTime: {
    fontSize: 13,
    fontWeight: '800',
    color: '#a5b4fc',
    fontFamily: 'monospace',
  },
  updateSlot: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '900',
    marginRight: 8,
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#f8fafc',
    fontFamily: 'monospace',
  },
  lamports: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  emptyContainer: {
    backgroundColor: '#0f172a',
    borderColor: '#25324a',
    borderWidth: 1,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#f8fafc',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
