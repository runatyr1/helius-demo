import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
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
      <ScrollView style={styles.scrollView}>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  scrollView: {
    flex: 1,
  },
  updateItem: {
    backgroundColor: '#2d2d2d',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#818cf8',
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
  },
  updateTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a5b4fc',
  },
  updateSlot: {
    fontSize: 12,
    color: '#808080',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#b0b0b0',
    marginRight: 8,
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f5f5f5',
  },
  lamports: {
    fontSize: 12,
    color: '#808080',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#808080',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
