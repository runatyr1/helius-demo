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
