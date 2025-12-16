// Helius Engineering Challenge - Token Indexer API Client

const ENG_CHALLENGE_ENDPOINT = process.env.EXPO_PUBLIC_ENG_CHALLENGE_ENDPOINT || '';

export interface TokenTransfer {
  signature: string;
  slot: number;
  block_time: string;
  mint: string;
  from_address: string;
  to_address: string;
  amount: string;
  decimals: number;
  created_at: string;
}

export interface TokenTransfersResponse {
  count: number;
  limit: number;
  offset: number;
  transfers: TokenTransfer[];
}

export const getTokenTransfers = async (
  limit: number = 100,
  offset: number = 0
): Promise<TokenTransfersResponse> => {
  if (!ENG_CHALLENGE_ENDPOINT) {
    throw new Error('Eng Challenge endpoint not configured');
  }

  const url = `${ENG_CHALLENGE_ENDPOINT}/api/transfers?limit=${limit}&offset=${offset}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch' }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
};
