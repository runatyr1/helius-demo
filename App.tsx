import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Modal, Animated, Linking, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Drawer } from 'react-native-drawer-layout';
import LiveBalanceScreen from './src/screens/LiveBalanceScreen';
import TransactionHistoryScreen from './src/screens/TransactionHistoryScreen-disabled';
import TransactionHistorySimScreen from './src/screens/TransactionHistorySimScreen';
import NetworkHealthScreen from './src/screens/NetworkHealthScreen';
import EngChallengeScreen from './src/screens/EngChallengeScreen';

export default function App() {
  const { width: screenWidth } = useWindowDimensions();
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

        {/* Disabled - Intermittent connection issues, needs troubleshooting
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
        */}

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

  const headerHorizontalPadding = screenWidth > 500 ? screenWidth * 0.1 : 14;

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
        <View
          style={[
            styles.header,
            {
              paddingLeft: headerHorizontalPadding,
              paddingRight: headerHorizontalPadding,
            },
          ]}
        >
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
    backgroundColor: '#070812',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#070812',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#25324a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 3,
  },
  menuButton: {
    paddingVertical: 6,
    paddingRight: 10,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    fontSize: 20,
    color: '#f8fafc',
    lineHeight: 22,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#f8fafc',
    letterSpacing: -0.2,
  },
  infoIconButton: {
    marginLeft: 8,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIcon: {
    fontSize: 18,
    color: '#38bdf8',
    textShadowColor: '#38bdf8',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderRadius: 22,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#25324a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#f8fafc',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 22,
    marginBottom: 20,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCloseButton: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    flex: 1,
  },
  modalDocsButton: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  content: {
    flex: 1,
  },
  drawer: {
    backgroundColor: '#070812',
    width: 280,
  },
  drawerContainer: {
    flex: 1,
  },
  drawerHeader: {
    backgroundColor: '#0f172a',
    borderBottomColor: '#25324a',
    borderBottomWidth: 1,
    padding: 20,
    paddingTop: 36,
  },
  drawerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#f8fafc',
    marginBottom: 4,
  },
  drawerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  drawerMenu: {
    flex: 1,
    padding: 12,
    gap: 8,
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#263244',
    backgroundColor: '#111827',
  },
  menuItemActive: {
    backgroundColor: '#181f35',
    borderColor: '#6d5dfc',
  },
  menuItemText: {
    fontSize: 14,
    color: '#cbd5e1',
    fontWeight: '700',
  },
  menuItemTextActive: {
    color: '#ddd6fe',
    fontWeight: '900',
  },
  drawerFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#25324a',
  },
  footerText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
});
