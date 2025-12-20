import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Drawer } from 'react-native-drawer-layout';
import LiveBalanceScreen from './src/screens/LiveBalanceScreen';
import TransactionHistoryScreen from './src/screens/TransactionHistoryScreen-disabled';
import TransactionHistorySimScreen from './src/screens/TransactionHistorySimScreen';
import NetworkHealthScreen from './src/screens/NetworkHealthScreen';
import EngChallengeScreen from './src/screens/EngChallengeScreen';

export default function App() {
  const [open, setOpen] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState('EngChallenge');
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);

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
            selectedScreen === 'EngChallenge' && styles.menuItemActive
          ]}
          onPress={() => navigateTo('EngChallenge')}
        >
          <Text style={[
            styles.menuItemText,
            selectedScreen === 'EngChallenge' && styles.menuItemTextActive
          ]}>
            🪙 Helius Eng Challenge
          </Text>
        </TouchableOpacity>

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

        {/* Disabled - Transaction History (Paid) requires paid API key
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
        */}

        <TouchableOpacity
          style={[
            styles.menuItem,
            selectedScreen === 'TransactionHistorySim' && styles.menuItemActive
          ]}
          onPress={() => navigateTo('TransactionHistorySim')}
        >
          <Text style={[
            styles.menuItemText,
            selectedScreen === 'TransactionHistorySim' && styles.menuItemTextActive
          ]}>
            🔄 Transaction History (Sim)
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
      case 'EngChallenge':
        return <EngChallengeScreen />;
      case 'LiveBalance':
        return <LiveBalanceScreen />;
      case 'TransactionHistory':
        return <TransactionHistoryScreen />;
      case 'TransactionHistorySim':
        return <TransactionHistorySimScreen />;
      case 'NetworkHealth':
        return <NetworkHealthScreen />;
      default:
        return <EngChallengeScreen />;
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
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              {selectedScreen === 'EngChallenge' ? 'Helius Eng Challenge' :
               selectedScreen === 'LiveBalance' ? 'Live Balance' :
               selectedScreen === 'TransactionHistory' ? 'Transaction History' :
               selectedScreen === 'TransactionHistorySim' ? 'Transaction History (Sim)' :
               selectedScreen === 'NetworkHealth' ? 'Network Health' :
               selectedScreen}
            </Text>
            {selectedScreen === 'EngChallenge' && (
              <TouchableOpacity
                onPress={() => setShowInfoTooltip(true)}
                style={styles.infoIconButton}
              >
                <Text style={styles.infoIcon}>ⓘ</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.content}>
          {renderScreen()}
        </View>

        <Modal
          visible={showInfoTooltip}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowInfoTooltip(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowInfoTooltip(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>ℹ️ How It Works</Text>
              <Text style={styles.modalText}>
                Monitoring BONK token transactions. There are a few transactions per minute involving BONK, to confirm this works feel free to buy a little BONK and your transaction should appear here in ~3 seconds
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowInfoTooltip(false)}
              >
                <Text style={styles.modalCloseText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <StatusBar style="light" />
      </SafeAreaView>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d2d',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  menuButton: {
    padding: 8,
    marginRight: 8,
  },
  menuIcon: {
    fontSize: 24,
    color: '#e0e0e0',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f5f5f5',
  },
  infoIconButton: {
    marginLeft: 8,
    padding: 4,
  },
  infoIcon: {
    fontSize: 18,
    color: '#6366f1',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#2d2d2d',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#404040',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f5f5f5',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    color: '#e0e0e0',
    lineHeight: 22,
    marginBottom: 20,
  },
  modalCloseButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  drawer: {
    backgroundColor: '#2d2d2d',
    width: 280,
  },
  drawerContainer: {
    flex: 1,
  },
  drawerHeader: {
    backgroundColor: '#4f46e5',
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
    color: '#c7d2fe',
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
    backgroundColor: '#3d3d3d',
    borderLeftColor: '#818cf8',
  },
  menuItemText: {
    fontSize: 16,
    color: '#b0b0b0',
  },
  menuItemTextActive: {
    color: '#a5b4fc',
    fontWeight: '600',
  },
  drawerFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#404040',
  },
  footerText: {
    fontSize: 12,
    color: '#808080',
    textAlign: 'center',
  },
});
