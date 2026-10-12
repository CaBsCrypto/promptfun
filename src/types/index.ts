export type Category = 
  | 'All'
  | 'Autonomous Agents'
  | 'DeFi & Trading'
  | 'Creative AI'
  | 'DevTools'
  | 'Cyberpunk & Gaming'
  | 'Micro-SaaS';

export type UserRole = 'investor' | 'creator' | 'admin';

export interface PromptVersion {
  version: string;
  prompt: string;
  timestamp: number;
  changelog: string[];
  author: string;
  commitMessage?: string;
}

export type TradeType = 'buy' | 'sell' | 'injection';

export interface Trade {
  id: string;
  pocId: string;
  type: TradeType;
  user: {
    address: string;
    name: string;
    avatar: string;
  };
  solAmount: number;
  tokenAmount: number;
  tokenPrice: number;
  timestamp: number;
  txHash: string;
}

export interface WalletTransfer {
  id: string;
  type: 'send' | 'receive' | 'airdrop' | 'claim_royalties';
  recipientOrSender: string;
  amountSol: number;
  timestamp: number;
  txHash: string;
  note?: string;
}

export interface Comment {
  id: string;
  pocId: string;
  user: {
    address: string;
    name: string;
    avatar: string;
  };
  text: string;
  timestamp: number;
  likes: number;
  isPromptSuggestion?: boolean;
}

export interface PoC {
  id: string;
  title: string;
  ticker: string;
  tagline: string;
  description: string;
  category: string;
  creator: {
    name: string;
    handle: string;
    avatar: string;
    address: string;
    graduatedCount?: number;
    badges?: string[];
  };
  createdAt: number;
  // Bonding curve & Market metrics
  bondingCurveProgress: number; // 0 to 100%
  targetMarketCapSol: number; // e.g. 85 SOL for graduation (~$13,600)
  currentSolPooled: number;
  tokensSold: number;
  totalSupply: number; // usually 1,000,000,000 tokens
  tokenPriceSol: number; // current price in SOL
  marketCapSol: number;
  marketCapUsd: number;
  volume24hSol: number;
  priceChange24h: number;
  isGraduated: boolean;
  isTradingPaused?: boolean;
  isFeatured?: boolean;
  holdersCount: number;
  mintAddress?: string; // Solana SPL Token Mint Address
  
  // Prompting & PoC Deliverables
  prompt: string;
  promptHistory: PromptVersion[];
  runnableHtml: string;
  problemSolved: string;
  features: string[];
  techStack: string[];
  iterationIdeas: string[];
  
  // OpenRouter AI Fuel Pool & Sponsorships
  openRouterFuel?: OpenRouterFuelPool;
  openRouterSponsorships?: OpenRouterSponsorship[];

  // Dynamic Activity
  trades: Trade[];
  comments: Comment[];
}

export type ThemeMode = 'dark' | 'light';

export interface OpenRouterModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextLength: number;
  costPer1mPromptTokensUsd: number;
  costPer1mCompletionTokensUsd: number;
  badge?: string;
  speed: 'Ultra Fast' | 'Fast' | 'Deep Reasoning';
  category: 'Reasoning' | 'Coding' | 'General';
}

export interface OpenRouterFuelPool {
  totalTokensRemaining: number;
  totalTokensSponsored: number;
  creditsUsd: number;
  activeModel: string;
  apiKeyConfigured?: boolean;
  apiKeyMasked?: string;
  sponsorsCount: number;
  totalPromptsExecuted: number;
}

export interface OpenRouterSponsorship {
  id: string;
  pocId: string;
  pocTitle: string;
  pocTicker: string;
  creatorName: string;
  sponsorAddress: string;
  sponsorName: string;
  sponsorRole: UserRole;
  tierTitle: string;
  tokensAmount: number;
  costUsd: number;
  costSol: number;
  targetModel: string;
  message?: string;
  timestamp: number;
  txHash: string;
}

export interface OpenRouterTier {
  id: string;
  title: string;
  subtitle: string;
  tokens: number;
  costUsd: number;
  costSol: number;
  icon: string;
  popular?: boolean;
  badge?: string;
  promptEquivalent: string;
}

export interface UserHolding {
  pocId: string;
  tokenAmount: number;
  totalInvestedSol: number;
  averageBuyPriceSol: number;
}

export interface QuickBuyPreference {
  enabled: boolean;
  solAmount: number; // default 1.0 SOL
  maxSlippagePercent: number; // default 5%
  autoApprove: boolean; // skip confirmation dialogs
}

export interface UserWallet {
  address: string;
  name: string;
  role: UserRole;
  solBalance: number;
  holdings: Record<string, UserHolding>;
  tradeHistory: Trade[];
  transfersHistory: WalletTransfer[];
  walletType?: 'simulated' | 'phantom';
  phantomConnected?: boolean;
  privateKeySimulated?: string;
  seedPhraseSimulated?: string;
  creatorRoyaltiesSol?: number;
  openRouterTokensSponsorships?: OpenRouterSponsorship[];
  openRouterApiKey?: string;
  openRouterCreditsUsd?: number;
  quickBuyPreference?: QuickBuyPreference;
}

export interface ProtocolConfig {
  protocolFeePercent: number; // e.g. 1.0%
  creatorFeePercent: number; // e.g. 0.5%
  graduationTargetSol: number; // e.g. 85 SOL
  protocolTreasurySol: number; // accumulated protocol fees
  isGlobalTradingPaused: boolean;
  openRouterPlatformPoolTokens?: number;
}

export interface PoCAlertConfig {
  pocId: string;
  enabled: boolean;
  milestones: {
    at25: boolean;
    at50: boolean;
    at75: boolean;
    at90: boolean;
    at100: boolean;
    whaleBuys: boolean;
    promptUpdates: boolean;
  };
}

export type ToastType =
  | 'milestone_25'
  | 'milestone_50'
  | 'milestone_75'
  | 'milestone_90'
  | 'milestone_100'
  | 'whale_buy'
  | 'prompt_update'
  | 'trade_success'
  | 'openrouter_fuel'
  | 'info'
  | 'error';

export interface ToastNotification {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  pocId?: string;
  pocTicker?: string;
  pocTitle?: string;
  pocAvatar?: string;
  percentage?: number;
  solPooled?: number;
  solAmount?: number;
  tokensAmount?: number;
  timestamp: number;
  durationMs?: number;
}

