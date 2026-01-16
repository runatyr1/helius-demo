// Helius Engineering Challenge - Token Indexer API Client

const ENG_CHALLENGE_ENDPOINT = process.env.EXPO_PUBLIC_ENG_CHALLENGE_ENDPOINT || '';
const ENG_CHALLENGE_API_KEY = process.env.EXPO_PUBLIC_ENG_CHALLENGE_API_KEY || '';

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
  const requestStart = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  console.log(`[API ${requestId}] Starting request at ${new Date().toISOString()}`);

  if (!ENG_CHALLENGE_ENDPOINT) {
    console.error(`[API ${requestId}] ✗ Endpoint not configured`);
    throw new Error('Eng Challenge endpoint not configured');
  }

  const url = `${ENG_CHALLENGE_ENDPOINT}/api/transfers?limit=${limit}&offset=${offset}`;
  console.log(`[API ${requestId}] URL: ${url}`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add API key if configured
  if (ENG_CHALLENGE_API_KEY) {
    headers['x-api-key'] = ENG_CHALLENGE_API_KEY;
    console.log(`[API ${requestId}] Using API key: ${ENG_CHALLENGE_API_KEY.substring(0, 8)}...`);
  } else {
    console.log(`[API ${requestId}] No API key configured`);
  }

  console.log(`[API ${requestId}] Starting fetch...`);
  const fetchStart = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const fetchDuration = Date.now() - fetchStart;
    console.log(`[API ${requestId}] Fetch completed in ${fetchDuration}ms - Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`[API ${requestId}] ✗ HTTP error: ${response.status} ${response.statusText}`);
      const parseStart = Date.now();
      const error = await response.json().catch(() => ({ error: 'Failed to fetch' }));
      const parseDuration = Date.now() - parseStart;
      console.error(`[API ${requestId}] Error response parsed in ${parseDuration}ms:`, error);
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(`[API ${requestId}] Parsing response JSON...`);
    const parseStart = Date.now();
    const data = await response.json();
    const parseDuration = Date.now() - parseStart;

    const totalDuration = Date.now() - requestStart;
    console.log(`[API ${requestId}] ✓ Response parsed in ${parseDuration}ms`);
    console.log(`[API ${requestId}] ✓ Total request: ${totalDuration}ms (Fetch: ${fetchDuration}ms, Parse: ${parseDuration}ms)`);
    console.log(`[API ${requestId}] Retrieved ${data.transfers?.length || 0} transfers`);

    return data;
  } catch (error: any) {
    const totalDuration = Date.now() - requestStart;
    console.error(`[API ${requestId}] ✗ Request failed after ${totalDuration}ms:`, error.message);
    throw error;
  }
};
