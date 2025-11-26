import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const HELIUS_API_KEY = process.env.EXPO_PUBLIC_HELIUS_API_KEY || '';

export const getHeliusHttpUrl = (): string => {
  if (!HELIUS_API_KEY) {
    throw new Error('EXPO_PUBLIC_HELIUS_API_KEY is not set in .env file');
  }
  return `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
};

export const getHeliusWsUrl = (): string => {
  if (!HELIUS_API_KEY) {
    throw new Error('EXPO_PUBLIC_HELIUS_API_KEY is not set in .env file');
  }
  return `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
};

export const createConnection = (): Connection => {
  return new Connection(getHeliusHttpUrl(), {
    commitment: 'confirmed',
  });
};

export const lamportsToSol = (lamports: number): number => {
  return lamports / LAMPORTS_PER_SOL;
};

export const validateSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

export const getCurrentBalance = async (
  connection: Connection,
  address: string
): Promise<number> => {
  const publicKey = new PublicKey(address);
  const balance = await connection.getBalance(publicKey);
  return balance;
};

export interface HeliusTransaction {
  signature: string;
  timestamp: number;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  slot: number;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    mint: string;
    tokenAmount: number;
  }>;
  description?: string;
}

export const getTransactionsForAddress = async (
  address: string,
  limit: number = 10
): Promise<HeliusTransaction[]> => {
  const url = getHeliusHttpUrl();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'helius-tx-history',
      method: 'getTransactionsForAddress',
      params: {
        address,
        limit,
      },
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'Failed to fetch transactions');
  }

  return data.result || [];
};

// Network Health Types
export interface NetworkHealth {
  health: string;
}

export interface EpochInfo {
  absoluteSlot: number;
  blockHeight: number;
  epoch: number;
  slotIndex: number;
  slotsInEpoch: number;
  transactionCount: number;
}

export interface PerformanceSample {
  slot: number;
  numTransactions: number;
  numSlots: number;
  samplePeriodSecs: number;
}

export interface SolanaVersion {
  'solana-core': string;
  'feature-set': number;
}

// Network Health API Methods
export const getNetworkHealth = async (): Promise<string> => {
  const connection = createConnection();
  const response = await fetch(connection.rpcEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getHealth',
    }),
  });
  const data = await response.json();
  return data.result || 'ok';
};

export const getBlockHeight = async (): Promise<number> => {
  const connection = createConnection();
  return await connection.getBlockHeight();
};

export const getEpochInfo = async (): Promise<EpochInfo> => {
  const connection = createConnection();
  return await connection.getEpochInfo();
};

export const getRecentPerformanceSamples = async (limit: number = 10): Promise<PerformanceSample[]> => {
  const connection = createConnection();
  const response = await fetch(connection.rpcEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getRecentPerformanceSamples',
      params: [limit],
    }),
  });
  const data = await response.json();
  return data.result || [];
};

export const getSolanaVersion = async (): Promise<SolanaVersion> => {
  const connection = createConnection();
  const response = await fetch(connection.rpcEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getVersion',
    }),
  });
  const data = await response.json();
  return data.result || { 'solana-core': 'unknown', 'feature-set': 0 };
};
