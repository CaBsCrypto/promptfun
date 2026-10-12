import {
  Connection,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';

export type SolanaCluster = 'devnet' | 'testnet' | 'mainnet-beta' | 'custom';

export interface ClusterConfig {
  name: string;
  id: SolanaCluster;
  endpoint: string;
  explorerSuffix: string;
}

export const SOLANA_CLUSTERS: Record<SolanaCluster, ClusterConfig> = {
  devnet: {
    name: 'Solana Devnet',
    id: 'devnet',
    endpoint: 'https://api.devnet.solana.com',
    explorerSuffix: '?cluster=devnet',
  },
  testnet: {
    name: 'Solana Testnet',
    id: 'testnet',
    endpoint: 'https://api.testnet.solana.com',
    explorerSuffix: '?cluster=testnet',
  },
  'mainnet-beta': {
    name: 'Solana Mainnet Beta',
    id: 'mainnet-beta',
    endpoint: 'https://api.mainnet-beta.solana.com',
    explorerSuffix: '',
  },
  custom: {
    name: 'Custom RPC',
    id: 'custom',
    endpoint: 'http://127.0.0.1:8899',
    explorerSuffix: '?cluster=custom',
  },
};

// PromptPump Bonding Curve Program ID (Anchor Rust Program on Solana)
export const PROMPT_PUMP_PROGRAM_ID = 'PromptPump111111111111111111111111111111111';
export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
export const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';

// Phantom window interface
export interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: {
    toString: () => string;
    toBase58: () => string;
  };
  isConnected?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{
    publicKey: { toString: () => string; toBase58: () => string };
  }>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
  signAndSendTransaction: (
    tx: Transaction,
    opts?: any
  ) => Promise<{ signature: string }>;
  signMessage: (
    message: Uint8Array,
    display?: string
  ) => Promise<{ signature: Uint8Array; publicKey: any }>;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback: (...args: any[]) => void) => void;
}

/**
 * Checks if Phantom is injected in the browser window
 */
export const getPhantomProvider = (): PhantomProvider | null => {
  if (typeof window !== 'undefined') {
    const solana = (window as any).solana;
    if (solana?.isPhantom) {
      return solana as PhantomProvider;
    }
  }
  return null;
};

/**
 * Creates a Solana Web3 Connection instance for the selected cluster
 */
export const createSolanaConnection = (
  cluster: SolanaCluster = 'devnet',
  customUrl?: string
): Connection => {
  const url = customUrl || SOLANA_CLUSTERS[cluster]?.endpoint || clusterApiUrl('devnet');
  return new Connection(url, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 30000,
  });
};

/**
 * Shortens a Solana Base58 address for UI display (e.g. 7XqP...9Ym2)
 */
export const formatSolanaAddress = (
  address: string,
  start: number = 4,
  end: number = 4
): string => {
  if (!address) return '';
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

export const shortenAddress = formatSolanaAddress;

/**
 * Generates Solana Explorer link for addresses, transactions, or blocks
 */
export const getSolanaExplorerUrl = (
  value: string,
  type: 'address' | 'tx' | 'block' = 'address',
  cluster: SolanaCluster = 'devnet'
): string => {
  const suffix = SOLANA_CLUSTERS[cluster]?.explorerSuffix || '';
  return `https://explorer.solana.com/${type}/${value}${suffix}`;
};

/**
 * Validates a Solana Base58 address string
 */
export const isValidSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};
