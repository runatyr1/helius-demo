import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Drawer } from 'react-native-drawer-layout';
import LiveBalanceScreen from './src/screens/LiveBalanceScreen';
import TransactionHistoryScreen from './src/screens/TransactionHistoryScreen';
import NetworkHealthScreen from './src/screens/NetworkHealthScreen';

export default function App() {
  const [open, setOpen] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState('LiveBalance');

  const navigateTo = (screen: string) => {
    setSelectedScreen(screen);
    setOpen(false);
  };

  const DrawerContent = () => (
    <SafeAreaView style={styles.drawerContainer}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerTitle}>Helius Demo</Text>
        <Text style={styles.drawerSubtitle}>Solana Streaming</Text>
      </View>

      <View style={styles.drawerMenu}>
        <TouchableOpacity
          style={[
            styles.menuItem,
            selectedScreen === 'LiveBalance' && styles.menuItemActive
          ]}
          onPress={() => navigateTo('LiveBalance')}
        >
          <Text style={[
            styles.menuItemText,
            selectedScreen === 'LiveBalance' && styles.menuItemTextActive
          ]}>
            📊 Live Balance
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.menuItem,
            selectedScreen === 'TransactionHistory' && styles.menuItemActive
          ]}
          onPress={() => navigateTo('TransactionHistory')}
        >
          <Text style={[
            styles.menuItemText,
            selectedScreen === 'TransactionHistory' && styles.menuItemTextActive
          ]}>
            📜 Transaction History (Paid)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.menuItem,
            selectedScreen === 'NetworkHealth' && styles.menuItemActive
          ]}
          onPress={() => navigateTo('NetworkHealth')}
        >
          <Text style={[
            styles.menuItemText,
            selectedScreen === 'NetworkHealth' && styles.menuItemTextActive
          ]}>
            🌐 Network Health
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.drawerFooter}>
        <Text style={styles.footerText}>Powered by Helius</Text>
      </View>
    </SafeAreaView>
  );

  const renderScreen = () => {
    switch (selectedScreen) {
      case 'LiveBalance':
        return <LiveBalanceScreen />;
      case 'TransactionHistory':
        return <TransactionHistoryScreen />;
      case 'NetworkHealth':
        return <NetworkHealthScreen />;
      default:
        return <LiveBalanceScreen />;
    }
  };

  return (
    <Drawer
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      drawerType="front"
      renderDrawerContent={DrawerContent}
      drawerStyle={styles.drawer}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setOpen(!open)} style={styles.menuButton}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {selectedScreen === 'LiveBalance' ? 'Live Balance' :
             selectedScreen === 'TransactionHistory' ? 'Transaction History' :
             selectedScreen === 'NetworkHealth' ? 'Network Health' :
             selectedScreen}
          </Text>
        </View>

        <View style={styles.content}>
          {renderScreen()}
        </View>

        <StatusBar style="dark" />
      </SafeAreaView>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuButton: {
    padding: 8,
    marginRight: 8,
  },
  menuIcon: {
    fontSize: 24,
    color: '#333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  drawer: {
    backgroundColor: '#fff',
    width: 280,
  },
  drawerContainer: {
    flex: 1,
  },
  drawerHeader: {
    backgroundColor: '#6366f1',
    padding: 24,
    paddingTop: 40,
  },
  drawerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  drawerSubtitle: {
    fontSize: 14,
    color: '#e0e7ff',
  },
  drawerMenu: {
    flex: 1,
    paddingTop: 16,
  },
  menuItem: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  menuItemActive: {
    backgroundColor: '#f0f0f0',
    borderLeftColor: '#6366f1',
  },
  menuItemText: {
    fontSize: 16,
    color: '#666',
  },
  menuItemTextActive: {
    color: '#6366f1',
    fontWeight: '600',
  },
  drawerFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
