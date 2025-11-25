# Helius Live Balance - Solana Streaming Demo

A React Native (Expo) application demonstrating real-time Solana account balance tracking using Helius Standard WebSockets API.

## Features

- ✅ Real-time balance updates via WebSocket streaming
- ✅ Historical balance change timeline
- ✅ Clean UI with drawer navigation
- ✅ Cross-platform (Web, iOS, Android)
- ✅ TypeScript for type safety

## Tech Stack

- **Framework:** Expo (React Native)
- **Language:** TypeScript
- **Solana SDK:** @solana/web3.js
- **Streaming:** Helius Standard WebSockets (accountSubscribe)
- **UI:** React Native components

## Prerequisites

1. Node.js (v18+ recommended)
2. npm or yarn
3. Helius API key (free tier works)

## Setup

1. **Get Helius API Key:**
   - Sign up at https://dashboard.helius.dev
   - Copy your API key

2. **Configure Environment:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env`:
   ```env
   EXPO_PUBLIC_HELIUS_API_KEY=your_actual_api_key_here
   ```

3. **Install Dependencies:**
   ```bash
   npm install
   ```

## Running the App

### Web (Recommended for local testing)
```bash
npm run web
```
Then open http://localhost:8081 in your browser.

### Android
```bash
npm run android
```
Requires Android Studio and emulator or physical device.

### iOS
```bash
npm run ios
```
Requires macOS and Xcode.

## How It Works

### Architecture

```
User Input (Wallet Address)
    ↓
Initial HTTP Request (getBalance) via Helius RPC
    ↓
WebSocket Connection (accountSubscribe)
    ↓
Real-time Updates → UI Update → History Log
```

### WebSocket Flow

1. **Initial Connection:**
   - Connect to `wss://mainnet.helius-rpc.com/?api-key=YOUR_KEY`

2. **Account Subscribe:**
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "accountSubscribe",
     "params": [
       "WALLET_ADDRESS",
       { "encoding": "jsonParsed", "commitment": "confirmed" }
     ]
   }
   ```

3. **Receive Updates:**
   - Every time account state changes (transactions, staking, etc.)
   - Notification includes: lamports, slot, account data

4. **Display:**
   - Current balance (large card)
   - Historical timeline (scrollable list)

## Project Structure

```
helius-live-balance/
├── src/
│   ├── components/
│   │   └── BalanceHistory.tsx    # Historical updates timeline
│   ├── screens/
│   │   └── LiveBalanceScreen.tsx # Main streaming screen
│   ├── services/
│   │   └── helius.ts             # Helius API integration
│   └── types/
│       └── index.ts              # TypeScript types
├── App.tsx                       # Main app with drawer navigation
├── .env.example                  # Environment template
└── README.md
```

## Testing the Demo

### Using a Known Active Wallet

For best demo experience, use a wallet that receives frequent transactions:

**Example Active Wallets (Mainnet):**
- Phantom Treasury: `F7QPaNoGPM31XcrZxUYw2YL2Py9y7KvJCR8aXDfrgLfN`
- Jupiter Program: `JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB`
- Raydium AMM: `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8`

### Manual Testing

1. Start the app
2. Enter a wallet address
3. Click "Start Streaming"
4. Watch for updates:
   - Initial balance loads immediately
   - Real-time updates appear as transactions occur
   - Historical timeline builds up

### Trigger Updates (for testing)

To see updates in real-time:
- Send SOL to/from the monitored wallet
- Stake/unstake SOL
- Execute any transaction that changes account balance

## API Limits (Free Tier)

- Standard WebSockets: ✅ **Included in free tier**
- Rate limits: Check Helius dashboard
- No enhanced filtering (requires Business+ plan)

## Future Enhancements

- [ ] Add more streaming examples (transaction monitoring, program logs)
- [ ] Implement Enhanced WebSockets (when available)
- [ ] Add LaserStream example (when available)
- [ ] Chart visualization for balance changes
- [ ] Multi-account monitoring
- [ ] Export history to CSV

## Troubleshooting

**"EXPO_PUBLIC_HELIUS_API_KEY is not set" error:**
- Ensure `.env` file exists in project root
- Restart development server after creating `.env`

**WebSocket connection fails:**
- Verify API key is correct
- Check network connectivity
- Check browser console for WebSocket errors

**No balance updates appearing:**
- Use an active wallet with frequent transactions
- Try a well-known protocol address
- Check browser console for WebSocket messages

## Resources

- [Helius Docs](https://docs.helius.dev)
- [Helius Dashboard](https://dashboard.helius.dev)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Expo Documentation](https://docs.expo.dev)

## License

MIT

## Author

Pietro - Helius Platform Engineer Demo
