import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Backend proxy URL (API key is kept server-side)
const HELIUS_PROXY_URL = process.env.EXPO_PUBLIC_HELIUS_PROXY_URL || '';

const getProxyUrl = (): string => {
  if (!HELIUS_PROXY_URL) {
    throw new Error('EXPO_PUBLIC_HELIUS_PROXY_URL is not set in .env file');
  }
  return HELIUS_PROXY_URL;
};

// Generic RPC call via proxy
const proxyRpcCall = async (method: string, params: unknown[] | object = []): Promise<unknown> => {
  const response = await fetch(`${getProxyUrl()}/api/helius/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'RPC error');
  }
  return data.result;
};

// Connection that uses proxy (for @solana/web3.js compatibility)
export const createConnection = (): Connection => {
  // Use proxy endpoint as RPC URL - Connection will POST to it
  return new Connection(`${getProxyUrl()}/api/helius/rpc`, {
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
  const response = await fetch(`${getProxyUrl()}/api/helius/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, limit }),
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
  const result = await proxyRpcCall('getHealth');
  return (result as string) || 'ok';
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
  const result = await proxyRpcCall('getRecentPerformanceSamples', [limit]);
  return (result as PerformanceSample[]) || [];
};

export const getSolanaVersion = async (): Promise<SolanaVersion> => {
  const result = await proxyRpcCall('getVersion');
  return (result as SolanaVersion) || { 'solana-core': 'unknown', 'feature-set': 0 };
};

// === Helius API Demo (Simulated Transactions) ===

const API_DEMO_ENDPOINT = process.env.EXPO_PUBLIC_API_DEMO_ENDPOINT || '';
const API_DEMO_KEY = process.env.EXPO_PUBLIC_API_DEMO_KEY || '';

export interface SimulatedTransaction {
  signature: string;
  slot: number;
  block_time: number;
  fee: number;
  success: boolean;
  timestamp: string;
  data: {
    accounts: string[];
    instructions: Array<{
      program_id: string;
      data: string;
    }>;
    recent_blockhash: string;
  };
}

export interface SimulatedTransactionsResponse {
  count: number;
  limit: number;
  offset: number;
  transactions: SimulatedTransaction[];
}

export const getSimulatedTransactions = async (
  limit: number = 100,
  offset: number = 0
): Promise<SimulatedTransactionsResponse> => {
  if (!API_DEMO_ENDPOINT || !API_DEMO_KEY) {
    throw new Error('API Demo endpoint or key not configured');
  }

  const url = `${API_DEMO_ENDPOINT}/transactions?limit=${limit}&offset=${offset}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': API_DEMO_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch' }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
};
