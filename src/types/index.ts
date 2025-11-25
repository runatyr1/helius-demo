export interface BalanceUpdate {
  timestamp: number;
  balance: number;
  lamports: number;
  slot?: number;
}

export interface AccountInfo {
  lamports: number;
  owner: string;
  executable: boolean;
  rentEpoch: number;
  data: string | Buffer;
}

export interface WebSocketAccountUpdate {
  jsonrpc: string;
  method: string;
  params: {
    result: {
      context: {
        slot: number;
      };
      value: AccountInfo | null;
    };
    subscription: number;
  };
}
