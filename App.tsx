import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Modal, Animated, Linking } from 'react-native';
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
  const [showSimInfoTooltip, setShowSimInfoTooltip] = useState(false);

  // Blinking animation for info icon
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, []);

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
            selectedScreen === 'TransactionHistorySim' && styles.menuItemActive
          ]}
          onPress={() => navigateTo('TransactionHistorySim')}
        >
          <Text style={[
            styles.menuItemText,
            selectedScreen === 'TransactionHistorySim' && styles.menuItemTextActive
          ]}>
            🔄 Transaction History (Simulated)
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

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            setOpen(false);
            Linking.openURL('https://runatyr.dev/');
          }}
        >
          <Text style={styles.menuItemText}>
            📕 Go to Blog
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
               selectedScreen === 'TransactionHistorySim' ? 'Transaction History (Simulated)' :
               selectedScreen === 'NetworkHealth' ? 'Network Health' :
               selectedScreen}
            </Text>
            {selectedScreen === 'EngChallenge' && (
              <TouchableOpacity
                onPress={() => setShowInfoTooltip(true)}
                style={styles.infoIconButton}
              >
                <Animated.Text style={[styles.infoIcon, { opacity: blinkAnim }]}>ⓘ</Animated.Text>
              </TouchableOpacity>
            )}
            {selectedScreen === 'TransactionHistorySim' && (
              <TouchableOpacity
                onPress={() => setShowSimInfoTooltip(true)}
                style={styles.infoIconButton}
              >
                <Animated.Text style={[styles.infoIcon, { opacity: blinkAnim }]}>ⓘ</Animated.Text>
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
              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={[styles.modalCloseButton, styles.modalDocsButton]}
                  onPress={() => {
                    setShowInfoTooltip(false);
                    Linking.openURL('https://runatyr.dev/projects/solana-token-transaction-indexer/');
                  }}
                >
                  <Text style={styles.modalCloseText}>Go to Docs</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowInfoTooltip(false)}
                >
                  <Text style={styles.modalCloseText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={showSimInfoTooltip}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSimInfoTooltip(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowSimInfoTooltip(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>ℹ️ Data Pipeline Demo</Text>
              <Text style={styles.modalText}>
                This demonstrates a full data pipeline with simulated Solana-like transactions. The backend includes a transaction generator (producer), Kafka message queue, PostgreSQL database (consumer), and REST API — all running on Kubernetes. This app streams data from that pipeline in real-time.
                {'\n\n'}
                A maximum of 1,000 transactions are displayed; once reached, new transactions replace older ones.
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowSimInfoTooltip(false)}
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
    fontSize: 22,
    color: '#00FFFF',
    textShadowColor: '#00FFFF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
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
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCloseButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  modalDocsButton: {
    backgroundColor: '#10b981',
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
