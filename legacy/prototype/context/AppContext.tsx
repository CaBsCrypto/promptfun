import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  PoC,
  UserWallet,
  Trade,
  Comment,
  PoCAlertConfig,
  UserRole,
  WalletTransfer,
  ProtocolConfig,
  ToastNotification,
  ToastType,
  ThemeMode,
  OpenRouterFuelPool,
  OpenRouterSponsorship,
  QuickBuyPreference,
} from '../types';
import { SEED_POCS } from '../data/seedPocs';
import {
  calculateTokensForSol,
  calculateSolForTokens,
  TARGET_SOL,
  SOL_USD_RATE,
} from '../utils/bondingCurve';
import {
  createDefaultFuelPool,
  formatTokenCount,
  OPENROUTER_MODELS,
} from '../utils/openrouter';
import {
  SolanaCluster,
  getPhantomProvider,
  createSolanaConnection,
  SOLANA_CLUSTERS,
} from '../utils/solana';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Subtle harmonic audio synthesizer for milestone alerts
function playNotificationChime(frequency: number = 880, type: OscillatorType = 'sine') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(frequency * 1.4, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}


export const DEFAULT_ALERT_MILESTONES = {
  at25: true,
  at50: true,
  at75: true,
  at90: true,
  at100: true,
  whaleBuys: true,
  promptUpdates: true,
};

export const PRESET_WALLETS: Record<UserRole, UserWallet> = {
  investor: {
    address: '8X9p3mKwA9F7y2bN6p4Kk1m8Zv9Ym2xLq5Q1n4W2e1Rt',
    name: 'DegenInvestor.sol',
    role: 'investor',
    solBalance: 14.5,
    holdings: {
      'poc-nexus-ide': {
        pocId: 'poc-nexus-ide',
        tokenAmount: 48_500_000,
        totalInvestedSol: 2.5,
        averageBuyPriceSol: 0.0000000515,
      },
      'poc-swarm-arbitrage': {
        pocId: 'poc-swarm-arbitrage',
        tokenAmount: 65_000_000,
        totalInvestedSol: 1.8,
        averageBuyPriceSol: 0.0000000277,
      },
    },
    tradeHistory: [
      {
        id: 'tx-seed-1',
        pocId: 'poc-nexus-ide',
        type: 'buy',
        user: {
          address: '8X9p3mKwA9F7y2bN6p4Kk1m8Zv9Ym2xLq5Q1n4W2e1Rt',
          name: 'DegenInvestor.sol',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
        },
        solAmount: 2.5,
        tokenAmount: 48_500_000,
        tokenPrice: 0.0000000515,
        timestamp: Date.now() - 1000 * 60 * 120,
        txHash: '5KqM...8Z2p',
      },
    ],
    transfersHistory: [
      {
        id: 'tr-seed-1',
        type: 'airdrop',
        recipientOrSender: 'Solana Devnet Faucet',
        amountSol: 15.0,
        timestamp: Date.now() - 1000 * 60 * 240,
        txHash: '4NxR...9Y1q',
        note: 'Genesis Devnet Faucet Airdrop',
      },
    ],
    walletType: 'simulated',
    privateKeySimulated: '4rT7yK9pL2mW8vQ1xN5jB3cV6dF8gH2jK4mP7sT9wX1z5nQ3',
    seedPhraseSimulated: 'venture galaxy radar solana prompt matrix neon crypto agent surge blast dynamic',
    creatorRoyaltiesSol: 0,
  },
  creator: {
    address: '7XqP3sKwA9F7y2bN6p4Kk1m8Zv9Ym2xLq5Q1n4W2e1Rt',
    name: 'Elena Rostova (@elena_builds)',
    role: 'creator',
    solBalance: 8.45,
    holdings: {
      'poc-nexus-ide': {
        pocId: 'poc-nexus-ide',
        tokenAmount: 30_000_000,
        totalInvestedSol: 1.0,
        averageBuyPriceSol: 0.0000000333,
      },
    },
    tradeHistory: [
      {
        id: 'tx-seed-cr1',
        pocId: 'poc-nexus-ide',
        type: 'buy',
        user: {
          address: '7XqP3sKwA9F7y2bN6p4Kk1m8Zv9Ym2xLq5Q1n4W2e1Rt',
          name: 'Elena Rostova',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        },
        solAmount: 1.0,
        tokenAmount: 30_000_000,
        tokenPrice: 0.0000000333,
        timestamp: Date.now() - 1000 * 60 * 60 * 18,
        txHash: '7NxK...1W8m',
      },
    ],
    transfersHistory: [
      {
        id: 'tr-seed-cr1',
        type: 'claim_royalties',
        recipientOrSender: 'PromptPump Bonding Curve Pool',
        amountSol: 1.85,
        timestamp: Date.now() - 1000 * 60 * 60 * 4,
        txHash: '8YpL...3M4k',
        note: 'Bonding Curve 0.5% Royalties Claim',
      },
    ],
    walletType: 'simulated',
    privateKeySimulated: '9kL2mW8vQ1xN5jB3cV6dF8gH2jK4mP7sT9wX1z4rT7yK2pL8',
    seedPhraseSimulated: 'artist cyber code prompt builder creative neural studio terminal matrix flame deploy',
    creatorRoyaltiesSol: 3.42,
  },
  admin: {
    address: 'Adm1nPumpMasterKey999solxYm2xLq5Q1n4W2e1Rt',
    name: 'PromptPump Protocol Master',
    role: 'admin',
    solBalance: 42.0,
    holdings: {},
    tradeHistory: [],
    transfersHistory: [
      {
        id: 'tr-admin-1',
        type: 'receive',
        recipientOrSender: 'Platform Protocol Fee Pool',
        amountSol: 12.5,
        timestamp: Date.now() - 1000 * 60 * 60 * 12,
        txHash: '9ZqP...4K2m',
        note: '1.0% Protocol Trading Fee Collection',
      },
    ],
    walletType: 'simulated',
    privateKeySimulated: '7sT9wX1z4rT7yK9pL2mW8vQ1xN5jB3cV6dF8gH2jK4mP6vN2',
    seedPhraseSimulated: 'governance master authority ledger circuit treasury validator kernel security protocol sentinel admin',
    creatorRoyaltiesSol: 0,
  },
};

interface AppContextType {
  pocs: PoC[];
  wallet: UserWallet;
  activePoC: PoC | null;
  setActivePoC: (poc: PoC | null) => void;

  // View Modals & Panels
  isLaunchModalOpen: boolean;
  setIsLaunchModalOpen: (open: boolean) => void;
  isPortfolioOpen: boolean;
  setIsPortfolioOpen: (open: boolean) => void;
  isSolanaDevSuiteOpen: boolean;
  setIsSolanaDevSuiteOpen: (open: boolean) => void;

  // Role Perspective Modals
  isWalletModalOpen: boolean;
  setIsWalletModalOpen: (open: boolean) => void;
  isInvestorHubOpen: boolean;
  setIsInvestorHubOpen: (open: boolean) => void;
  isCreatorStudioOpen: boolean;
  setIsCreatorStudioOpen: (open: boolean) => void;
  isAdminConsoleOpen: boolean;
  setIsAdminConsoleOpen: (open: boolean) => void;

  // Current Perspective
  currentRole: UserRole;
  setCurrentRole: (r: UserRole) => void;
  switchRoleAndWallet: (role: UserRole) => void;

  // Trading & PoC actions
  buyTokens: (pocId: string, solAmount: number, slippagePercent: number) => { success: boolean; message: string; tokensOut?: number };
  sellTokens: (pocId: string, tokenAmount: number, slippagePercent: number) => { success: boolean; message: string; solOut?: number };
  quickBuyTokens: (pocId: string, solAmountOverride?: number) => { success: boolean; message: string; tokensOut?: number };
  updateQuickBuyPreference: (prefs: Partial<QuickBuyPreference>) => void;
  simulateLiveTrade: (pocId?: string) => void;
  createPoC: (data: { prompt: string; title?: string; ticker?: string; category: string; initialBuySol?: number }) => Promise<PoC>;
  iteratePoC: (pocId: string, newPrompt: string) => Promise<PoC>;
  addComment: (pocId: string, text: string, isPromptSuggestion?: boolean) => void;

  // Wallet operations
  claimFaucet: () => void;
  claimFaucetAmount: (amount: number) => void;
  sendSolTransfer: (recipient: string, amount: number, note?: string) => Promise<{ success: boolean; message: string; txHash?: string }>;
  claimCreatorRoyalties: () => void;
  generateNewWallet: () => void;
  switchPresetWallet: (preset: UserRole) => void;

  // Notifications & Alerts
  globalNotification: string | null;
  setGlobalNotification: (msg: string | null) => void;
  toasts: ToastNotification[];
  addToast: (toast: Omit<ToastNotification, 'id' | 'timestamp'>) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
  triggerMilestoneAlert: (poc: PoC, milestone: 25 | 50 | 75 | 90 | 100) => void;
  alerts: Record<string, PoCAlertConfig>;
  toggleAlerts: (pocId: string, enabled?: boolean) => void;
  updateAlertConfig: (pocId: string, config: PoCAlertConfig) => void;
  triggerTestAlert: (poc: PoC) => void;

  // Solana & Phantom Suite
  solanaCluster: SolanaCluster;
  setSolanaCluster: (c: SolanaCluster) => void;
  customRpcUrl: string;
  setCustomRpcUrl: (u: string) => void;
  isPhantomInstalled: boolean;
  isPhantomConnected: boolean;
  phantomPublicKey: string | null;
  connectPhantom: () => Promise<boolean>;
  disconnectPhantom: () => Promise<void>;
  requestSolanaAirdrop: (targetAddress?: string) => Promise<{ success: boolean; message: string; signature?: string }>;

  // Theme Mode (Pantalla Clara / Modo Oscuro)
  themeMode: ThemeMode;
  toggleThemeMode: () => void;
  setThemeMode: (mode: ThemeMode) => void;

  // OpenRouter AI Fueling & Sponsorship
  isFuelModalOpen: boolean;
  fuelModalPoC: PoC | null;
  openFuelModal: (poc: PoC) => void;
  closeFuelModal: () => void;
  injectOpenRouterTokens: (
    pocId: string,
    tokens: number,
    costSol: number,
    tierTitle: string,
    message?: string,
    modelId?: string
  ) => Promise<{ success: boolean; message: string; txHash?: string }>;
  updatePoCOpenRouterModel: (pocId: string, modelId: string) => void;
  setCreatorOpenRouterApiKey: (apiKey: string) => void;
  replenishPlatformOpenRouterPool: (tokensAmount: number) => void;

  // Protocol Admin Governance
  protocolConfig: ProtocolConfig;
  updateProtocolConfig: (cfg: Partial<ProtocolConfig>) => void;
  togglePoCTradingPause: (pocId: string) => void;
  togglePoCFeatured: (pocId: string) => void;
  forceGraduatePoC: (pocId: string) => void;
  injectPlatformLiquidity: (pocId: string, solAmount: number) => void;
  airdropAllHolders: (amountSolPerHolder: number) => void;

  // Watchlist (Saved in local storage)
  watchlist: string[];
  isWatched: (pocId: string) => boolean;
  toggleWatchlist: (pocId: string) => void;
  clearWatchlist: () => void;
  isWatchlistFilterActive: boolean;
  setIsWatchlistFilterActive: (active: boolean) => void;

  // Split-View / Side-by-Side PoC Comparison
  isCompareModalOpen: boolean;
  comparePoCIds: [string | null, string | null];
  openCompareModal: (poc1Id?: string, poc2Id?: string) => void;
  closeCompareModal: () => void;
  setComparePoC: (slot: 0 | 1, pocId: string | null) => void;
  swapComparePoCs: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY_POCS = 'promptpump_pocs_v2';
const STORAGE_KEY_WALLET = 'promptpump_wallet_v2';
const STORAGE_KEY_ALERTS = 'promptpump_alerts_v2';
const STORAGE_KEY_ROLE = 'promptpump_role_v2';
const STORAGE_KEY_PROTOCOL = 'promptpump_protocol_v2';
const STORAGE_KEY_THEME = 'promptpump_theme_v2';
const STORAGE_KEY_WATCHLIST = 'promptpump_watchlist_v2';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme Mode (Pantalla Clara / Modo Oscuro)
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_THEME, themeMode);
      if (themeMode === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
      }
    } catch {}
  }, [themeMode]);

  const toggleThemeMode = () => {
    setThemeModeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };
  // Load saved PoCs or seed
  const [pocs, setPocs] = useState<PoC[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POCS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved pocs', e);
    }
    return SEED_POCS;
  });

  // Current Perspective Role
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ROLE);
      if (saved && (saved === 'investor' || saved === 'creator' || saved === 'admin')) {
        return saved as UserRole;
      }
    } catch {}
    return 'investor';
  });

  // Load wallet or default preset
  const [wallet, setWallet] = useState<UserWallet>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WALLET);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.address && parsed.solBalance !== undefined) {
          return {
            ...PRESET_WALLETS[currentRole || 'investor'],
            ...parsed,
          };
        }
      }
    } catch (e) {
      console.error('Failed to parse saved wallet', e);
    }
    return PRESET_WALLETS[currentRole || 'investor'];
  });

  // Protocol config state
  const [protocolConfig, setProtocolConfig] = useState<ProtocolConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROTOCOL);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      protocolFeePercent: 1.0,
      creatorFeePercent: 0.5,
      graduationTargetSol: 85,
      protocolTreasurySol: 18.65,
      isGlobalTradingPaused: false,
    };
  });

  // Modals
  const [activePoC, setActivePoC] = useState<PoC | null>(null);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [isPortfolioOpen, setIsPortfolioOpen] = useState(false);
  const [isSolanaDevSuiteOpen, setIsSolanaDevSuiteOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isInvestorHubOpen, setIsInvestorHubOpen] = useState(false);
  const [isCreatorStudioOpen, setIsCreatorStudioOpen] = useState(false);
  const [isAdminConsoleOpen, setIsAdminConsoleOpen] = useState(false);
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [fuelModalPoC, setFuelModalPoC] = useState<PoC | null>(null);

  const openFuelModal = (poc: PoC) => {
    setFuelModalPoC(poc);
    setIsFuelModalOpen(true);
  };

  const closeFuelModal = () => {
    setIsFuelModalOpen(false);
    setFuelModalPoC(null);
  };

  // Split-View / PoC Comparison Modal State
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [comparePoCIds, setComparePoCIds] = useState<[string | null, string | null]>([null, null]);

  const openCompareModal = (poc1Id?: string, poc2Id?: string) => {
    let first = poc1Id || null;
    let second = poc2Id || null;

    if (!first && pocs.length > 0) {
      first = pocs[0].id;
    }
    if (!second && pocs.length > 1) {
      second = pocs.find((p) => p.id !== first)?.id || pocs[1].id;
    }

    setComparePoCIds([first, second]);
    setIsCompareModalOpen(true);
  };

  const closeCompareModal = () => {
    setIsCompareModalOpen(false);
  };

  const setComparePoC = (slot: 0 | 1, pocId: string | null) => {
    setComparePoCIds((prev) => {
      const next: [string | null, string | null] = [...prev];
      next[slot] = pocId;
      return next;
    });
  };

  const swapComparePoCs = () => {
    setComparePoCIds(([p1, p2]) => [p2, p1]);
  };

  const [globalNotification, setGlobalNotificationState] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Solana & Phantom Suite State
  const [solanaCluster, setSolanaCluster] = useState<SolanaCluster>('devnet');
  const [customRpcUrl, setCustomRpcUrl] = useState<string>('https://api.devnet.solana.com');
  const [isPhantomInstalled, setIsPhantomInstalled] = useState<boolean>(false);
  const [isPhantomConnected, setIsPhantomConnected] = useState<boolean>(false);
  const [phantomPublicKey, setPhantomPublicKey] = useState<string | null>(null);

  // Load saved alerts
  const [alerts, setAlerts] = useState<Record<string, PoCAlertConfig>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ALERTS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_POCS, JSON.stringify(pocs));
    } catch {}
  }, [pocs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WALLET, JSON.stringify(wallet));
    } catch {}
  }, [wallet]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(alerts));
    } catch {}
  }, [alerts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ROLE, currentRole);
    } catch {}
  }, [currentRole]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROTOCOL, JSON.stringify(protocolConfig));
    } catch {}
  }, [protocolConfig]);

  // Check Phantom availability and set up listeners
  useEffect(() => {
    const provider = getPhantomProvider();
    setIsPhantomInstalled(!!provider);

    if (provider) {
      provider
        .connect({ onlyIfTrusted: true })
        .then((res) => {
          if (res?.publicKey) {
            const pkStr = res.publicKey.toString();
            setPhantomPublicKey(pkStr);
            setIsPhantomConnected(true);
            setWallet((prev) => ({
              ...prev,
              address: pkStr,
              name: 'Phantom User',
              walletType: 'phantom',
              phantomConnected: true,
            }));
          }
        })
        .catch(() => {});

      const handleConnect = (pubKey: any) => {
        const pk = pubKey?.toString() || provider.publicKey?.toString();
        if (pk) {
          setPhantomPublicKey(pk);
          setIsPhantomConnected(true);
          setWallet((prev) => ({
            ...prev,
            address: pk,
            name: 'Phantom User',
            walletType: 'phantom',
            phantomConnected: true,
          }));
        }
      };

      const handleDisconnect = () => {
        setIsPhantomConnected(false);
        setPhantomPublicKey(null);
        setWallet(PRESET_WALLETS[currentRole]);
      };

      provider.on('connect', handleConnect);
      provider.on('disconnect', handleDisconnect);

      return () => {
        try {
          provider.off('connect', handleConnect);
          provider.off('disconnect', handleDisconnect);
        } catch {}
      };
    }
  }, [currentRole]);

  // Switch role and update identity
  const switchRoleAndWallet = (role: UserRole) => {
    setCurrentRole(role);
    const targetPreset = PRESET_WALLETS[role];
    setWallet((prev) => ({
      ...targetPreset,
      tradeHistory: [...(prev.tradeHistory || []), ...(targetPreset.tradeHistory || [])],
      transfersHistory: [...(prev.transfersHistory || []), ...(targetPreset.transfersHistory || [])],
    }));

    const roleTitles = {
      investor: '📈 Modo Inversor activado (Trading & Portafolio)',
      creator: '🎨 Modo Creador activado (Proyectos, Prompts & Regalías)',
      admin: '👔 Modo Administrador activado (Gobernanza & Protocolo)',
    };
    setGlobalNotification(roleTitles[role]);
    setTimeout(() => setGlobalNotification(null), 4000);
  };

  const switchPresetWallet = (preset: UserRole) => {
    switchRoleAndWallet(preset);
  };

  const generateNewWallet = () => {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let randAddr = '';
    for (let i = 0; i < 44; i++) randAddr += chars.charAt(Math.floor(Math.random() * chars.length));

    const words = ['cyber', 'prompt', 'quantum', 'solana', 'glitch', 'neon', 'matrix', 'alpha', 'orbit', 'nexus', 'pulse', 'token'];
    const newSeed = Array.from({ length: 12 }, () => words[Math.floor(Math.random() * words.length)]).join(' ');

    const newW: UserWallet = {
      address: randAddr,
      name: `SolanaKey-${randAddr.slice(0, 4)}`,
      role: currentRole,
      solBalance: 5.0,
      holdings: {},
      tradeHistory: [],
      transfersHistory: [
        {
          id: 'tr-' + Date.now(),
          type: 'airdrop',
          recipientOrSender: 'PromptPump Faucet Dispenser',
          amountSol: 5.0,
          timestamp: Date.now(),
          txHash: randAddr.slice(0, 10).toUpperCase(),
          note: 'Initial Keypair Faucet Bounty',
        },
      ],
      walletType: 'simulated',
      privateKeySimulated: '5K' + randAddr.slice(2, 42),
      seedPhraseSimulated: newSeed,
      creatorRoyaltiesSol: 0,
    };

    setWallet(newW);
    setGlobalNotification(`✨ Billetera generada! Nueva dirección Solana: ${randAddr.slice(0, 4)}...${randAddr.slice(-4)}`);
    setTimeout(() => setGlobalNotification(null), 4500);
  };

  // Phantom connect
  const connectPhantom = async (): Promise<boolean> => {
    const provider = getPhantomProvider();
    if (!provider) {
      if (typeof window !== 'undefined') window.open('https://phantom.app/', '_blank');
      setGlobalNotification('👻 Phantom no detectado. Abriendo phantom.app...');
      setTimeout(() => setGlobalNotification(null), 4000);
      return false;
    }

    try {
      setGlobalNotification('👻 Conectando Phantom en Solana...');
      const res = await provider.connect();
      const pubkey = res.publicKey.toString();
      setPhantomPublicKey(pubkey);
      setIsPhantomConnected(true);

      try {
        const connection = createSolanaConnection(solanaCluster, customRpcUrl);
        const lamports = await connection.getBalance(new PublicKey(pubkey));
        const liveSol = lamports / LAMPORTS_PER_SOL;
        setWallet((prev) => ({
          ...prev,
          address: pubkey,
          name: 'Phantom User',
          solBalance: liveSol > 0 ? liveSol : prev.solBalance,
          walletType: 'phantom',
          phantomConnected: true,
        }));
      } catch {
        setWallet((prev) => ({
          ...prev,
          address: pubkey,
          name: 'Phantom User',
          walletType: 'phantom',
          phantomConnected: true,
        }));
      }

      setGlobalNotification(`⚡ Phantom conectado: ${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`);
      setTimeout(() => setGlobalNotification(null), 4000);
      return true;
    } catch (err: any) {
      setGlobalNotification(`❌ Conexión Phantom cancelada: ${err.message || 'Rechazado'}`);
      setTimeout(() => setGlobalNotification(null), 4000);
      return false;
    }
  };

  const disconnectPhantom = async () => {
    const provider = getPhantomProvider();
    if (provider) {
      try {
        await provider.disconnect();
      } catch {}
    }
    setIsPhantomConnected(false);
    setPhantomPublicKey(null);
    setWallet(PRESET_WALLETS[currentRole]);
    setGlobalNotification('🔌 Desconectado de Phantom. Se restauró la billetera simulada.');
    setTimeout(() => setGlobalNotification(null), 4000);
  };

  // Airdrop
  const requestSolanaAirdrop = async (targetAddress?: string) => {
    const addr = targetAddress || (isPhantomConnected && phantomPublicKey ? phantomPublicKey : wallet.address);
    setGlobalNotification(`⏳ Solicitando airdrop de 1.00 SOL en Solana ${solanaCluster}...`);
    try {
      const connection = createSolanaConnection(solanaCluster, customRpcUrl);
      const pubkey = new PublicKey(addr);
      const sig = await connection.requestAirdrop(pubkey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, 'confirmed');

      const lamports = await connection.getBalance(pubkey);
      const newBal = lamports / LAMPORTS_PER_SOL;
      setWallet((prev) => ({
        ...prev,
        solBalance: newBal,
      }));
      setGlobalNotification(`🪂 Airdrop confirmado en Solana ${solanaCluster}! +1.00 SOL.`);
      setTimeout(() => setGlobalNotification(null), 5000);
      return { success: true, message: 'Airdrop confirmado', signature: sig };
    } catch (err: any) {
      setWallet((prev) => ({
        ...prev,
        solBalance: prev.solBalance + 1.0,
      }));
      setGlobalNotification(`🚰 Faucet Solana: +1.00 SOL acreditado en billetera!`);
      setTimeout(() => setGlobalNotification(null), 5000);
      return { success: true, message: 'Credited 1 SOL' };
    }
  };

  const claimFaucet = () => claimFaucetAmount(5.0);

  const claimFaucetAmount = (amount: number) => {
    const transfer: WalletTransfer = {
      id: 'tr-faucet-' + Date.now(),
      type: 'airdrop',
      recipientOrSender: 'Solana Devnet Validator Faucet',
      amountSol: amount,
      timestamp: Date.now(),
      txHash: (Math.random().toString(36).slice(2, 8) + '...' + Math.random().toString(36).slice(2, 6)).toUpperCase(),
      note: 'Manual Faucet Claim',
    };

    setWallet((prev) => ({
      ...prev,
      solBalance: prev.solBalance + amount,
      transfersHistory: [transfer, ...(prev.transfersHistory || [])],
    }));
    setGlobalNotification(`🚰 +${amount.toFixed(2)} SOL recibidos desde el Faucet!`);
    setTimeout(() => setGlobalNotification(null), 3500);
  };

  // Send SOL transfer
  const sendSolTransfer = async (
    recipient: string,
    amount: number,
    note?: string
  ): Promise<{ success: boolean; message: string; txHash?: string }> => {
    if (!recipient || recipient.trim().length < 10) {
      return { success: false, message: 'Dirección de destino de Solana inválida' };
    }
    if (amount <= 0) {
      return { success: false, message: 'El monto en SOL debe ser mayor a 0' };
    }
    const feeSol = 0.0005;
    if (wallet.solBalance < amount + feeSol) {
      return {
        success: false,
        message: `Saldo insuficiente. Tienes ${wallet.solBalance.toFixed(3)} SOL, necesitas ${(amount + feeSol).toFixed(3)} SOL (incluye 0.0005 SOL de tarifa de red).`,
      };
    }

    const txHash = (Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 8)).toUpperCase();
    const newTransfer: WalletTransfer = {
      id: 'send-' + Date.now(),
      type: 'send',
      recipientOrSender: recipient.trim(),
      amountSol: amount,
      timestamp: Date.now(),
      txHash,
      note: note || 'Transferencia de SOL en la red',
    };

    setWallet((prev) => ({
      ...prev,
      solBalance: prev.solBalance - (amount + feeSol),
      transfersHistory: [newTransfer, ...(prev.transfersHistory || [])],
    }));

    setGlobalNotification(`💸 Transferencia completada: ${amount.toFixed(3)} SOL enviados a ${recipient.slice(0, 4)}...${recipient.slice(-4)}`);
    setTimeout(() => setGlobalNotification(null), 4500);

    return { success: true, message: 'Transferencia realizada con éxito', txHash };
  };

  // Claim Creator Royalties
  const claimCreatorRoyalties = () => {
    const claimable = wallet.creatorRoyaltiesSol || 0;
    if (claimable <= 0) {
      setGlobalNotification('⚠️ No tienes regalías de creador acumuladas para reclamar en este momento.');
      setTimeout(() => setGlobalNotification(null), 3500);
      return;
    }

    const transfer: WalletTransfer = {
      id: 'claim-' + Date.now(),
      type: 'claim_royalties',
      recipientOrSender: 'Bonding Curve Creator Fee Vault (0.5%)',
      amountSol: claimable,
      timestamp: Date.now(),
      txHash: (Math.random().toString(36).slice(2, 8) + '...' + Math.random().toString(36).slice(2, 6)).toUpperCase(),
      note: 'Cobro de regalías por volumen de PoCs creados',
    };

    setWallet((prev) => ({
      ...prev,
      solBalance: prev.solBalance + claimable,
      creatorRoyaltiesSol: 0,
      transfersHistory: [transfer, ...(prev.transfersHistory || [])],
    }));

    setGlobalNotification(`💰 ¡Regalías de creador reclamadas! +${claimable.toFixed(3)} SOL añadidos a tu saldo líquido.`);
    setTimeout(() => setGlobalNotification(null), 4500);
  };

  // Alert handlers
  const toggleAlerts = (pocId: string, enabled?: boolean) => {
    setAlerts((prev) => {
      const existing = prev[pocId];
      const isNowEnabled = enabled !== undefined ? enabled : !existing?.enabled;
      const nextConfig: PoCAlertConfig = {
        pocId,
        enabled: isNowEnabled,
        milestones: existing ? existing.milestones : { ...DEFAULT_ALERT_MILESTONES },
      };
      const poc = pocs.find((p) => p.id === pocId);
      if (isNowEnabled) {
        setGlobalNotification(`🔔 Alertas activadas para ${poc?.ticker || 'este PoC'}!`);
      } else {
        setGlobalNotification(`🔕 Alertas silenciadas para ${poc?.ticker || 'este PoC'}.`);
      }
      setTimeout(() => setGlobalNotification(null), 3500);
      return { ...prev, [pocId]: nextConfig };
    });
  };

  // Real-time Toast Notifications & Milestone Alert Handlers
  const addToast = (toastData: Omit<ToastNotification, 'id' | 'timestamp'>): string => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const newToast: ToastNotification = {
      ...toastData,
      id,
      timestamp: Date.now(),
      durationMs: toastData.durationMs || (toastData.type.startsWith('milestone') ? 8000 : 5000),
    };

    if (toastData.type === 'milestone_100') {
      playNotificationChime(1046, 'triangle');
    } else if (toastData.type === 'milestone_90') {
      playNotificationChime(880, 'sine');
    } else if (toastData.type === 'milestone_75') {
      playNotificationChime(784, 'sine');
    } else if (toastData.type === 'milestone_50') {
      playNotificationChime(660, 'sine');
    } else if (toastData.type === 'milestone_25') {
      playNotificationChime(550, 'sine');
    }

    setToasts((prev) => [newToast, ...prev.slice(0, 4)]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, newToast.durationMs);

    return id;
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const clearAllToasts = () => {
    setToasts([]);
  };

  const setGlobalNotification = (msg: string | null) => {
    setGlobalNotificationState(msg);
    if (msg) {
      addToast({
        type: 'info',
        title: 'PromptPump Alert',
        message: msg,
        durationMs: 4000,
      });
    }
  };

  const triggerMilestoneAlert = (poc: PoC, milestone: 25 | 50 | 75 | 90 | 100) => {
    const solTarget = protocolConfig.graduationTargetSol || TARGET_SOL;
    const solPooled = (milestone / 100) * solTarget;

    const alertDetails = {
      25: {
        type: 'milestone_25' as ToastType,
        title: '🎯 25% Curva de Vinculación Alcanzada!',
        message: `¡${poc.title} (${poc.ticker}) cruzó el 25% de la curva con ${solPooled.toFixed(1)} SOL acumulados! Fuerte impulso inicial.`,
      },
      50: {
        type: 'milestone_50' as ToastType,
        title: '⚡ 50% Medio Camino a Raydium!',
        message: `¡${poc.title} (${poc.ticker}) superó la mitad de la curva (${solPooled.toFixed(1)} SOL). La graduación está a la vista!`,
      },
      75: {
        type: 'milestone_75' as ToastType,
        title: '🔥 75% Alerta de Alta Velocidad!',
        message: `¡${poc.title} (${poc.ticker}) entró en zona de alta velocidad con ${solPooled.toFixed(1)} SOL! Fuerte presión compradora.`,
      },
      90: {
        type: 'milestone_90' as ToastType,
        title: '👑 90% Pre-Graduación King of the Hill!',
        message: `¡${poc.title} (${poc.ticker}) alcanzó el 90% (${solPooled.toFixed(1)} SOL)! Último tramo antes del lanzamiento en Raydium.`,
      },
      100: {
        type: 'milestone_100' as ToastType,
        title: '🎉 100% GRADUACIÓN COMPLETA! Migrando a Raydium DEX!',
        message: `¡${poc.title} (${poc.ticker}) completó la curva con ${solTarget} SOL! Liquidez transferida y bloqueada en Raydium.`,
      },
    }[milestone];

    addToast({
      type: alertDetails.type,
      title: alertDetails.title,
      message: alertDetails.message,
      pocId: poc.id,
      pocTicker: poc.ticker,
      pocTitle: poc.title,
      pocAvatar: poc.creator.avatar,
      percentage: milestone,
      solPooled,
      durationMs: milestone === 100 ? 12000 : 8000,
    });
  };

  const updateAlertConfig = (pocId: string, config: PoCAlertConfig) => {
    setAlerts((prev) => ({ ...prev, [pocId]: config }));
    const poc = pocs.find((p) => p.id === pocId);
    setGlobalNotification(`🔔 Hitos de alerta configurados para ${poc?.ticker || 'PoC'}`);
    setTimeout(() => setGlobalNotification(null), 3500);
  };

  const triggerTestAlert = (poc: PoC) => {
    triggerMilestoneAlert(poc, 75);
  };

  // User-specific Watchlist (persisted in local storage)
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WATCHLIST);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved watchlist', e);
    }
    return ['poc-nexus-ide'];
  });

  const [isWatchlistFilterActive, setIsWatchlistFilterActive] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WATCHLIST, JSON.stringify(watchlist));
    } catch (e) {
      console.error('Failed to save watchlist to localStorage', e);
    }
  }, [watchlist]);

  const isWatched = (pocId: string): boolean => {
    return watchlist.includes(pocId);
  };

  const toggleWatchlist = (pocId: string) => {
    setWatchlist((prev) => {
      const exists = prev.includes(pocId);
      const targetPoc = pocs.find((p) => p.id === pocId);
      const ticker = targetPoc?.ticker || '$POC';

      if (exists) {
        addToast({
          type: 'info',
          title: 'Removed from Watchlist',
          message: `${ticker} was removed from your watchlist.`,
          durationMs: 3500,
        });
        return prev.filter((id) => id !== pocId);
      } else {
        addToast({
          type: 'trade_success',
          title: '⭐ Added to Watchlist!',
          message: `${ticker} (${targetPoc?.title || ''}) added to your personal watchlist.`,
          durationMs: 4000,
        });
        return [...prev, pocId];
      }
    });
  };

  const clearWatchlist = () => {
    setWatchlist([]);
  };

  // OpenRouter AI Token Fueling & Sponsorship
  const injectOpenRouterTokens = async (
    pocId: string,
    tokens: number,
    costSol: number,
    tierTitle: string,
    message?: string,
    modelId?: string
  ): Promise<{ success: boolean; message: string; txHash?: string }> => {
    if (wallet.solBalance < costSol) {
      return {
        success: false,
        message: `Saldo insuficiente en tu billetera. Necesitas ${costSol.toFixed(3)} SOL y tienes ${wallet.solBalance.toFixed(3)} SOL.`,
      };
    }

    const targetPoC = pocs.find((p) => p.id === pocId);
    if (!targetPoC) {
      return { success: false, message: 'PoC no encontrado' };
    }

    const txHash = (Math.random().toString(36).slice(2, 8) + '...' + Math.random().toString(36).slice(2, 6)).toUpperCase();
    const costUsd = +(costSol * SOL_USD_RATE).toFixed(2);
    const chosenModel = modelId || targetPoC.openRouterFuel?.activeModel || 'anthropic/claude-3.7-sonnet';

    const newSponsorship: OpenRouterSponsorship = {
      id: 'sp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      pocId,
      pocTitle: targetPoC.title,
      pocTicker: targetPoC.ticker,
      creatorName: targetPoC.creator.name,
      sponsorAddress: wallet.address,
      sponsorName: wallet.name,
      sponsorRole: currentRole,
      tierTitle,
      tokensAmount: tokens,
      costUsd,
      costSol,
      targetModel: chosenModel,
      message: message || undefined,
      timestamp: Date.now(),
      txHash,
    };

    // Update target PoC fuel pool
    const currentFuel = targetPoC.openRouterFuel || createDefaultFuelPool(1_000_000);
    const updatedFuel: OpenRouterFuelPool = {
      ...currentFuel,
      totalTokensRemaining: currentFuel.totalTokensRemaining + tokens,
      totalTokensSponsored: currentFuel.totalTokensSponsored + tokens,
      creditsUsd: +(currentFuel.creditsUsd + costUsd).toFixed(2),
      sponsorsCount: currentFuel.sponsorsCount + 1,
      activeModel: chosenModel,
    };

    const newComment: Comment = {
      id: 'c-or-' + Date.now(),
      pocId,
      user: {
        address: wallet.address,
        name: wallet.name,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      },
      text: `⚡ Inyectó ${formatTokenCount(tokens)} Tokens OpenRouter (${tierTitle}): "${message || '¡A tope con el baicodeo en vivo!'}"`,
      timestamp: Date.now(),
      likes: 5,
      isPromptSuggestion: false,
    };

    const updatedPoC: PoC = {
      ...targetPoC,
      openRouterFuel: updatedFuel,
      openRouterSponsorships: [newSponsorship, ...(targetPoC.openRouterSponsorships || [])],
      comments: [newComment, ...targetPoC.comments],
    };

    setPocs((prev) => prev.map((p) => (p.id === pocId ? updatedPoC : p)));

    // Update active PoC if currently viewed
    if (activePoC?.id === pocId) {
      setActivePoC(updatedPoC);
    }

    // Update Wallet transfers & sponsorships
    const transfer: WalletTransfer = {
      id: 'tr-or-' + Date.now(),
      type: 'send',
      recipientOrSender: `OpenRouter Fuel: ${targetPoC.creator.name} (${targetPoC.ticker})`,
      amountSol: costSol,
      timestamp: Date.now(),
      txHash,
      note: `Patrocinio OpenRouter ${formatTokenCount(tokens)} tokens`,
    };

    setWallet((prev) => ({
      ...prev,
      solBalance: +(prev.solBalance - costSol).toFixed(4),
      transfersHistory: [transfer, ...(prev.transfersHistory || [])],
      openRouterTokensSponsorships: [newSponsorship, ...(prev.openRouterTokensSponsorships || [])],
    }));

    // Trigger toast & audio alert
    playNotificationChime(880, 'triangle');
    addToast({
      type: 'openrouter_fuel',
      title: '⚡ ¡Inyección de Tokens OpenRouter Exitosa!',
      message: `Aportaste ${formatTokenCount(tokens)} tokens ($${costUsd.toFixed(2)}) a ${targetPoC.creator.name} para su PoC ${targetPoC.ticker}`,
      pocId,
      pocTicker: targetPoC.ticker,
      pocTitle: targetPoC.title,
      solAmount: costSol,
      tokensAmount: tokens,
      durationMs: 7000,
    });

    return {
      success: true,
      message: `¡Inyectados ${formatTokenCount(tokens)} tokens OpenRouter con éxito!`,
      txHash,
    };
  };

  const updatePoCOpenRouterModel = (pocId: string, modelId: string) => {
    setPocs((prev) =>
      prev.map((p) => {
        if (p.id !== pocId) return p;
        const fuel = p.openRouterFuel || createDefaultFuelPool();
        return {
          ...p,
          openRouterFuel: {
            ...fuel,
            activeModel: modelId,
          },
        };
      })
    );
    if (activePoC?.id === pocId) {
      setActivePoC((prev) =>
        prev
          ? {
              ...prev,
              openRouterFuel: {
                ...(prev.openRouterFuel || createDefaultFuelPool()),
                activeModel: modelId,
              },
            }
          : null
      );
    }
    const model = OPENROUTER_MODELS.find((m) => m.id === modelId);
    setGlobalNotification(`🤖 Modelo OpenRouter cambiado a ${model?.name || modelId}`);
    setTimeout(() => setGlobalNotification(null), 3500);
  };

  const setCreatorOpenRouterApiKey = (apiKey: string) => {
    setWallet((prev) => ({
      ...prev,
      openRouterApiKey: apiKey,
    }));
    setGlobalNotification('🔑 Clave API de OpenRouter vinculada exitosamente.');
    setTimeout(() => setGlobalNotification(null), 3500);
  };

  const replenishPlatformOpenRouterPool = (tokensAmount: number) => {
    setProtocolConfig((prev) => ({
      ...prev,
      openRouterPlatformPoolTokens: (prev.openRouterPlatformPoolTokens || 50_000_000) + tokensAmount,
    }));
    setGlobalNotification(`⚡ Reserva de Tokens OpenRouter reabastecida: +${formatTokenCount(tokensAmount)}`);
    setTimeout(() => setGlobalNotification(null), 3500);
  };

  // Keep activePoC updated with any changes in pocs list
  useEffect(() => {
    if (activePoC) {
      const updated = pocs.find((p) => p.id === activePoC.id);
      if (updated) setActivePoC(updated);
    }
  }, [pocs]);

  // Buy Tokens on Bonding Curve
  const buyTokens = (pocId: string, solAmount: number, slippagePercent: number) => {
    if (protocolConfig.isGlobalTradingPaused) {
      return { success: false, message: 'El comercio global está pausado temporalmente por el Administrador.' };
    }
    if (solAmount <= 0) {
      return { success: false, message: 'La cantidad de SOL debe ser mayor a 0' };
    }
    if (wallet.solBalance < solAmount) {
      return { success: false, message: 'Saldo de SOL insuficiente en la billetera. Utiliza el Faucet para recargar.' };
    }

    const targetPoC = pocs.find((p) => p.id === pocId);
    if (!targetPoC) return { success: false, message: 'PoC no encontrado' };

    if (targetPoC.isTradingPaused) {
      return { success: false, message: `El comercio en ${targetPoC.ticker} ha sido pausado por moderación.` };
    }

    const { tokensOut, newSolPooled, newPriceSol, priceImpactPercent } = calculateTokensForSol(
      targetPoC.currentSolPooled,
      solAmount
    );

    if (priceImpactPercent > slippagePercent && slippagePercent !== 25) {
      return {
        success: false,
        message: `Tolerancia de deslizamiento superada: Impacto es ${priceImpactPercent.toFixed(1)}%, tu límite es ${slippagePercent}%`,
      };
    }

    // Protocol & Creator fee calculation
    const protocolFee = (solAmount * protocolConfig.protocolFeePercent) / 100;
    const creatorFee = (solAmount * protocolConfig.creatorFeePercent) / 100;

    // Credit platform treasury
    setProtocolConfig((prev) => ({
      ...prev,
      protocolTreasurySol: prev.protocolTreasurySol + protocolFee,
    }));

    // If current wallet is the creator of this PoC, credit royalties
    if (targetPoC.creator.address === wallet.address || targetPoC.creator.handle === wallet.name) {
      setWallet((prev) => ({
        ...prev,
        creatorRoyaltiesSol: (prev.creatorRoyaltiesSol || 0) + creatorFee,
      }));
    }

    const prevProgress = targetPoC.bondingCurveProgress;
    const newTokensSold = targetPoC.tokensSold + tokensOut;
    const newProgress = Math.min(100, (newSolPooled / protocolConfig.graduationTargetSol) * 100);
    const isNowGraduated = newProgress >= 100 || targetPoC.isGraduated;

    // Real-time major milestone checks (broadcasts toast alert to users)
    if (prevProgress < 25 && newProgress >= 25) {
      triggerMilestoneAlert(targetPoC, 25);
    } else if (prevProgress < 50 && newProgress >= 50) {
      triggerMilestoneAlert(targetPoC, 50);
    } else if (prevProgress < 75 && newProgress >= 75) {
      triggerMilestoneAlert(targetPoC, 75);
    } else if (prevProgress < 90 && newProgress >= 90) {
      triggerMilestoneAlert(targetPoC, 90);
    } else if (prevProgress < 100 && newProgress >= 100) {
      triggerMilestoneAlert(targetPoC, 100);
    }

    // Whale buy alert
    if (solAmount >= 1.0) {
      addToast({
        type: 'whale_buy',
        title: '🐋 Alerta de Compra Ballena!',
        message: `${wallet.name} compró ${tokensOut > 1_000_000 ? (tokensOut / 1_000_000).toFixed(2) + 'M' : Math.floor(tokensOut)} ${targetPoC.ticker} por ${solAmount} SOL!`,
        pocId: targetPoC.id,
        pocTicker: targetPoC.ticker,
        pocTitle: targetPoC.title,
        solAmount,
        durationMs: 7000,
      });
    }

    const newTrade: Trade = {
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      pocId,
      type: 'buy',
      user: {
        address: wallet.address,
        name: wallet.name,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      },
      solAmount,
      tokenAmount: tokensOut,
      tokenPrice: newPriceSol,
      timestamp: Date.now(),
      txHash: (Math.random().toString(36).slice(2, 8) + '...' + Math.random().toString(36).slice(2, 6)).toUpperCase(),
    };

    const updatedPoC: PoC = {
      ...targetPoC,
      currentSolPooled: newSolPooled,
      tokensSold: newTokensSold,
      bondingCurveProgress: newProgress,
      tokenPriceSol: newPriceSol,
      marketCapSol: newPriceSol * targetPoC.totalSupply,
      marketCapUsd: newPriceSol * targetPoC.totalSupply * SOL_USD_RATE,
      volume24hSol: targetPoC.volume24hSol + solAmount,
      priceChange24h: targetPoC.priceChange24h + solAmount * 2.5,
      isGraduated: isNowGraduated,
      holdersCount: targetPoC.holdersCount + (wallet.holdings[pocId] ? 0 : 1),
      trades: [newTrade, ...targetPoC.trades],
    };

    setPocs((prev) => prev.map((p) => (p.id === pocId ? updatedPoC : p)));
    setActivePoC((prev) => (prev && prev.id === pocId ? updatedPoC : prev));

    // Update Wallet
    const currentHolding = wallet.holdings[pocId] || {
      pocId,
      tokenAmount: 0,
      totalInvestedSol: 0,
      averageBuyPriceSol: 0,
    };

    const nextTokenAmount = currentHolding.tokenAmount + tokensOut;
    const nextTotalInvested = currentHolding.totalInvestedSol + solAmount;
    const nextAvgPrice = nextTotalInvested / (nextTokenAmount || 1);

    setWallet((prev) => ({
      ...prev,
      solBalance: prev.solBalance - solAmount,
      holdings: {
        ...prev.holdings,
        [pocId]: {
          pocId,
          tokenAmount: nextTokenAmount,
          totalInvestedSol: nextTotalInvested,
          averageBuyPriceSol: nextAvgPrice,
        },
      },
      tradeHistory: [newTrade, ...(prev.tradeHistory || [])],
    }));

    setGlobalNotification(`🟢 Compraste ${tokensOut > 1_000_000 ? (tokensOut / 1_000_000).toFixed(2) + 'M' : Math.floor(tokensOut)} ${targetPoC.ticker} por ${solAmount} SOL!`);
    setTimeout(() => setGlobalNotification(null), 4000);

    return { success: true, message: 'Operación ejecutada con éxito', tokensOut };
  };

  // Sell Tokens
  const sellTokens = (pocId: string, tokenAmount: number, slippagePercent: number) => {
    if (protocolConfig.isGlobalTradingPaused) {
      return { success: false, message: 'El comercio global está en pausa temporal.' };
    }
    const currentHolding = wallet.holdings[pocId];
    if (!currentHolding || currentHolding.tokenAmount < tokenAmount) {
      return { success: false, message: 'Saldo de tokens insuficiente para vender' };
    }

    const targetPoC = pocs.find((p) => p.id === pocId);
    if (!targetPoC) return { success: false, message: 'PoC no encontrado' };

    if (targetPoC.isTradingPaused) {
      return { success: false, message: 'El comercio en este token está pausado.' };
    }

    const { solOut, newSolPooled, newPriceSol, priceImpactPercent } = calculateSolForTokens(
      targetPoC.currentSolPooled,
      tokenAmount
    );

    if (priceImpactPercent > slippagePercent && slippagePercent !== 25) {
      return {
        success: false,
        message: `Deslizamiento excedido: Impacto es ${priceImpactPercent.toFixed(1)}%`,
      };
    }

    const newTokensSold = Math.max(0, targetPoC.tokensSold - tokenAmount);
    const newProgress = Math.min(100, Math.max(0, (newSolPooled / protocolConfig.graduationTargetSol) * 100));

    const newTrade: Trade = {
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      pocId,
      type: 'sell',
      user: {
        address: wallet.address,
        name: wallet.name,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      },
      solAmount: solOut,
      tokenAmount,
      tokenPrice: newPriceSol,
      timestamp: Date.now(),
      txHash: (Math.random().toString(36).slice(2, 8) + '...' + Math.random().toString(36).slice(2, 6)).toUpperCase(),
    };

    const updatedPoC: PoC = {
      ...targetPoC,
      currentSolPooled: newSolPooled,
      tokensSold: newTokensSold,
      bondingCurveProgress: newProgress,
      tokenPriceSol: newPriceSol,
      marketCapSol: newPriceSol * targetPoC.totalSupply,
      marketCapUsd: newPriceSol * targetPoC.totalSupply * SOL_USD_RATE,
      volume24hSol: targetPoC.volume24hSol + solOut,
      trades: [newTrade, ...targetPoC.trades],
    };

    setPocs((prev) => prev.map((p) => (p.id === pocId ? updatedPoC : p)));
    setActivePoC((prev) => (prev && prev.id === pocId ? updatedPoC : prev));

    const remainingTokens = currentHolding.tokenAmount - tokenAmount;
    const updatedHoldings = { ...wallet.holdings };

    if (remainingTokens <= 1) {
      delete updatedHoldings[pocId];
    } else {
      updatedHoldings[pocId] = {
        ...currentHolding,
        tokenAmount: remainingTokens,
      };
    }

    setWallet((prev) => ({
      ...prev,
      solBalance: prev.solBalance + solOut,
      holdings: updatedHoldings,
      tradeHistory: [newTrade, ...(prev.tradeHistory || [])],
    }));

    setGlobalNotification(`🔴 Vendiste ${tokenAmount > 1_000_000 ? (tokenAmount / 1_000_000).toFixed(2) + 'M' : Math.floor(tokenAmount)} ${targetPoC.ticker} por ${solOut.toFixed(3)} SOL`);
    setTimeout(() => setGlobalNotification(null), 4000);

    return { success: true, message: 'Venta realizada con éxito', solOut };
  };

  // Simulate a live transaction on a target or random PoC (triggers price-pump animation across the marketplace)
  const simulateLiveTrade = (targetPocId?: string) => {
    setPocs((prev) => {
      if (prev.length === 0) return prev;
      const target = targetPocId
        ? prev.find((p) => p.id === targetPocId) || prev[0]
        : prev[Math.floor(Math.random() * prev.length)];
      if (!target || target.isTradingPaused) return prev;

      const solAmount = Number((0.08 + Math.random() * 0.35).toFixed(2));
      const { tokensOut, newSolPooled, newPriceSol } = calculateTokensForSol(target.currentSolPooled, solAmount);
      const newProgress = Math.min(100, (newSolPooled / protocolConfig.graduationTargetSol) * 100);

      const simulatedTraders = [
        { name: 'SolWhale', handle: '3Kx...82M', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' },
        { name: 'DegenSniper', handle: '7Rm...94P', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100' },
        { name: 'AlphaSeeker', handle: '5Rm...91P', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' },
        { name: 'PumpChad', handle: '9Qz...14K', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
        { name: 'SolBot_V2', handle: '2Lx...67B', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100' },
      ];
      const trader = simulatedTraders[Math.floor(Math.random() * simulatedTraders.length)];

      const simTrade: Trade = {
        id: 'tx-sim-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        pocId: target.id,
        type: 'buy',
        user: {
          address: trader.handle,
          name: trader.name,
          avatar: trader.avatar,
        },
        solAmount,
        tokenAmount: tokensOut,
        tokenPrice: newPriceSol,
        timestamp: Date.now(),
        txHash: (Math.random().toString(36).slice(2, 8) + '...' + Math.random().toString(36).slice(2, 6)).toUpperCase(),
      };

      const updatedPoC: PoC = {
        ...target,
        currentSolPooled: newSolPooled,
        tokensSold: target.tokensSold + tokensOut,
        bondingCurveProgress: newProgress,
        tokenPriceSol: newPriceSol,
        marketCapSol: newPriceSol * target.totalSupply,
        marketCapUsd: newPriceSol * target.totalSupply * SOL_USD_RATE,
        volume24hSol: target.volume24hSol + solAmount,
        priceChange24h: target.priceChange24h + solAmount * 2.2,
        isGraduated: newProgress >= 100 || target.isGraduated,
        trades: [simTrade, ...(target.trades || [])],
      };

      setActivePoC((curr) => (curr && curr.id === target.id ? updatedPoC : curr));

      return prev.map((p) => (p.id === target.id ? updatedPoC : p));
    });
  };

  // Periodic ambient live trades to keep marketplace dynamic with organic pumps
  useEffect(() => {
    const interval = setInterval(() => {
      if (!protocolConfig.isGlobalTradingPaused) {
        simulateLiveTrade();
      }
    }, 24000);
    return () => clearInterval(interval);
  }, [protocolConfig.isGlobalTradingPaused]);

  // Launch PoC
  const createPoC = async (data: {
    prompt: string;
    title?: string;
    ticker?: string;
    category: string;
    initialBuySol?: number;
  }): Promise<PoC> => {
    const res = await fetch('/api/generate-poc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: data.prompt,
        title: data.title,
        ticker: data.ticker,
        category: data.category,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Fallo al generar el PoC con Gemini');
    }

    const generated = await res.json();
    const initialSol = data.initialBuySol && data.initialBuySol > 0 ? data.initialBuySol : 0.5;

    const newPoC: PoC = {
      id: 'poc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      title: generated.title || data.title || 'Apex PoC',
      ticker: (generated.ticker || data.ticker || '$APEX').toUpperCase(),
      tagline: generated.tagline || 'Proof of Concept generado mediante prompts interactivos.',
      description: generated.description || 'PoC autónomo generado directamente con especificaciones de prompt.',
      category: generated.category || data.category || 'AI Technology',
      creator: {
        name: wallet.name,
        handle: wallet.name.startsWith('@') ? wallet.name : '@' + wallet.name.toLowerCase().replace(/\s+/g, '_'),
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
        address: wallet.address,
      },
      createdAt: Date.now(),
      bondingCurveProgress: 4.5,
      targetMarketCapSol: protocolConfig.graduationTargetSol,
      currentSolPooled: initialSol,
      tokensSold: 35_000_000,
      totalSupply: 1_000_000_000,
      tokenPriceSol: 0.000000035,
      marketCapSol: 35.0,
      marketCapUsd: 35.0 * SOL_USD_RATE,
      volume24hSol: initialSol,
      priceChange24h: 12.5,
      isGraduated: false,
      holdersCount: 1,
      prompt: data.prompt,
      promptHistory: [
        {
          version: 'v1.0',
          prompt: data.prompt,
          timestamp: Date.now(),
          changelog: ['Prompt inicial desplegado en la curva de vinculación', 'Sandbox interactivo sintetizado con Gemini'],
          author: wallet.name,
        },
      ],
      runnableHtml: generated.runnableHtml,
      problemSolved: generated.problemSolved || 'Demuestra ejecución instantánea de software generado por IA.',
      features: generated.features || ['Sandbox interactivo en vivo', 'Curva de vinculación integrada'],
      techStack: generated.techStack || ['Gemini Flash', 'HTML5 Sandbox', 'Tailwind CSS'],
      iterationIdeas: generated.iterationIdeas || ['Añadir telemetría en tiempo real', 'Mejorar interfaz gráfica'],
      trades: [],
      comments: [
        {
          id: 'c-init',
          pocId: 'new',
          user: {
            address: wallet.address,
            name: wallet.name,
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
          },
          text: `🚀 ¡Acabo de crear y lanzar ${generated.title || 'este PoC'}! Pruébalo en vivo arriba y entra temprano en la curva.`,
          timestamp: Date.now(),
          likes: 3,
        },
      ],
      openRouterFuel: createDefaultFuelPool(1_000_000),
      openRouterSponsorships: [],
    };

    if (data.initialBuySol && data.initialBuySol > 0 && wallet.solBalance >= data.initialBuySol) {
      setWallet((prev) => ({
        ...prev,
        solBalance: prev.solBalance - data.initialBuySol!,
        holdings: {
          ...prev.holdings,
          [newPoC.id]: {
            pocId: newPoC.id,
            tokenAmount: 35_000_000,
            totalInvestedSol: data.initialBuySol!,
            averageBuyPriceSol: data.initialBuySol! / 35_000_000,
          },
        },
      }));
    }

    setPocs((prev) => [newPoC, ...prev]);
    setActivePoC(newPoC);
    setGlobalNotification(`🎉 ¡PoC lanzado exitosamente! ${newPoC.title} (${newPoC.ticker})`);
    setTimeout(() => setGlobalNotification(null), 5000);

    return newPoC;
  };

  // Iterate an existing PoC with a new prompt
  const iteratePoC = async (pocId: string, newPrompt: string): Promise<PoC> => {
    const target = pocs.find((p) => p.id === pocId);
    if (!target) throw new Error('PoC no encontrado');

    const res = await fetch('/api/iterate-poc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentHtml: target.runnableHtml,
        currentPrompt: target.prompt,
        newPrompt,
        title: target.title,
        version: target.promptHistory[target.promptHistory.length - 1]?.version || 'v1.0',
      }),
    });

    if (!res.ok) throw new Error('Error al iterar el PoC');

    const result = await res.json();
    const newVersion = result.newVersion || `v${(target.promptHistory.length + 1).toFixed(1)}`;

    const newHistoryEntry = {
      version: newVersion,
      prompt: newPrompt,
      timestamp: Date.now(),
      changelog: result.changelog || [`Iteración de prompt: ${newPrompt}`],
      author: wallet.name,
      commitMessage: result.commitMessage,
    };

    // Calculate token consumption from OpenRouter fuel pool
    const tokensUsed = Math.floor(35_000 + Math.random() * 25_000);
    const curFuel = target.openRouterFuel || createDefaultFuelPool(1_000_000);
    const remainingTokens = Math.max(0, curFuel.totalTokensRemaining - tokensUsed);
    const updatedFuel: OpenRouterFuelPool = {
      ...curFuel,
      totalTokensRemaining: remainingTokens,
      totalPromptsExecuted: curFuel.totalPromptsExecuted + 1,
    };

    const updatedPoC: PoC = {
      ...target,
      prompt: newPrompt,
      runnableHtml: result.updatedHtml || target.runnableHtml,
      promptHistory: [...target.promptHistory, newHistoryEntry],
      priceChange24h: target.priceChange24h + 8.5,
      openRouterFuel: updatedFuel,
    };

    setPocs((prev) => prev.map((p) => (p.id === pocId ? updatedPoC : p)));
    setActivePoC(updatedPoC);

    if (remainingTokens < 200_000) {
      setGlobalNotification(`⚠️ ¡Combustible OpenRouter bajo (${formatTokenCount(remainingTokens)} tokens)! Los espectadores pueden inyectar tokens para seguir baicodeando.`);
    } else {
      setGlobalNotification(`✨ ¡Versión ${newVersion} desplegada! Consumidos ${formatTokenCount(tokensUsed)} tokens OpenRouter.`);
    }
    setTimeout(() => setGlobalNotification(null), 4500);

    return updatedPoC;
  };

  const addComment = (pocId: string, text: string, isPromptSuggestion: boolean = false) => {
    const comment: Comment = {
      id: 'c-' + Date.now(),
      pocId,
      user: {
        address: wallet.address,
        name: wallet.name,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      },
      text,
      timestamp: Date.now(),
      likes: 0,
      isPromptSuggestion,
    };

    setPocs((prev) =>
      prev.map((p) => (p.id === pocId ? { ...p, comments: [comment, ...p.comments] } : p))
    );
  };

  // Admin Governance Actions
  const updateProtocolConfig = (cfg: Partial<ProtocolConfig>) => {
    setProtocolConfig((prev) => ({ ...prev, ...cfg }));
    setGlobalNotification('⚙️ Parámetros del protocolo actualizados por el Administrador.');
    setTimeout(() => setGlobalNotification(null), 3500);
  };

  const togglePoCTradingPause = (pocId: string) => {
    setPocs((prev) =>
      prev.map((p) => {
        if (p.id === pocId) {
          const paused = !p.isTradingPaused;
          setGlobalNotification(paused ? `🛑 Comercio en ${p.ticker} pausado.` : `▶️ Comercio en ${p.ticker} reanudado.`);
          setTimeout(() => setGlobalNotification(null), 3500);
          return { ...p, isTradingPaused: paused };
        }
        return p;
      })
    );
  };

  const togglePoCFeatured = (pocId: string) => {
    setPocs((prev) =>
      prev.map((p) => {
        if (p.id === pocId) {
          const featured = !p.isFeatured;
          setGlobalNotification(featured ? `⭐ ${p.ticker} fijado como Destacado.` : `Removido de Destacados: ${p.ticker}`);
          setTimeout(() => setGlobalNotification(null), 3500);
          return { ...p, isFeatured: featured };
        }
        return p;
      })
    );
  };

  const forceGraduatePoC = (pocId: string) => {
    setPocs((prev) =>
      prev.map((p) => {
        if (p.id === pocId) {
          triggerMilestoneAlert(p, 100);
          return {
            ...p,
            bondingCurveProgress: 100,
            isGraduated: true,
            currentSolPooled: protocolConfig.graduationTargetSol,
          };
        }
        return p;
      })
    );
  };

  const injectPlatformLiquidity = (pocId: string, solAmount: number) => {
    setPocs((prev) =>
      prev.map((p) => {
        if (p.id === pocId) {
          const prevProgress = p.bondingCurveProgress;
          const newSol = p.currentSolPooled + solAmount;
          const newProgress = Math.min(100, (newSol / protocolConfig.graduationTargetSol) * 100);

          if (prevProgress < 25 && newProgress >= 25) triggerMilestoneAlert(p, 25);
          else if (prevProgress < 50 && newProgress >= 50) triggerMilestoneAlert(p, 50);
          else if (prevProgress < 75 && newProgress >= 75) triggerMilestoneAlert(p, 75);
          else if (prevProgress < 90 && newProgress >= 90) triggerMilestoneAlert(p, 90);
          else if (prevProgress < 100 && newProgress >= 100) triggerMilestoneAlert(p, 100);

          addToast({
            type: 'info',
            title: '💉 Liquidez Inyectada',
            message: `Administrador inyectó +${solAmount} SOL en ${p.ticker}. Nueva curva: ${newProgress.toFixed(1)}%`,
            pocId: p.id,
            pocTicker: p.ticker,
            durationMs: 5000,
          });

          const injectionTrade: Trade = {
            id: 'inj-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            pocId: p.id,
            type: 'injection',
            user: {
              address: 'Admin...Treasury',
              name: 'Admin Treasury',
              avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100',
            },
            solAmount,
            tokenAmount: 0,
            tokenPrice: p.tokenPriceSol,
            timestamp: Date.now(),
            txHash: (Math.random().toString(36).slice(2, 8) + '...' + Math.random().toString(36).slice(2, 6)).toUpperCase(),
          };

          return {
            ...p,
            currentSolPooled: newSol,
            bondingCurveProgress: newProgress,
            isGraduated: newProgress >= 100,
            volume24hSol: p.volume24hSol + solAmount,
            trades: [injectionTrade, ...(p.trades || [])],
          };
        }
        return p;
      })
    );

    setActivePoC((prev) => {
      if (prev && prev.id === pocId) {
        const newSol = prev.currentSolPooled + solAmount;
        const newProgress = Math.min(100, (newSol / protocolConfig.graduationTargetSol) * 100);
        const injTrade: Trade = {
          id: 'inj-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          pocId: prev.id,
          type: 'injection',
          user: {
            address: 'Admin...Treasury',
            name: 'Protocol Treasury',
            avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100',
          },
          solAmount,
          tokenAmount: 0,
          tokenPrice: prev.tokenPriceSol,
          timestamp: Date.now(),
          txHash: 'INJ...' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        };
        return {
          ...prev,
          currentSolPooled: newSol,
          bondingCurveProgress: newProgress,
          isGraduated: newProgress >= 100,
          volume24hSol: prev.volume24hSol + solAmount,
          trades: [injTrade, ...(prev.trades || [])],
        };
      }
      return prev;
    });
  };

  const airdropAllHolders = (amountSolPerHolder: number) => {
    setWallet((prev) => ({
      ...prev,
      solBalance: prev.solBalance + amountSolPerHolder,
    }));
    setGlobalNotification(`🪂 Airdrop masivo del Administrador: +${amountSolPerHolder} SOL distribuidos a todos los usuarios!`);
    setTimeout(() => setGlobalNotification(null), 4500);
  };

  return (
    <AppContext.Provider
      value={{
        pocs,
        wallet,
        activePoC,
        setActivePoC,
        isLaunchModalOpen,
        setIsLaunchModalOpen,
        isPortfolioOpen,
        setIsPortfolioOpen,
        isSolanaDevSuiteOpen,
        setIsSolanaDevSuiteOpen,
        isWalletModalOpen,
        setIsWalletModalOpen,
        isInvestorHubOpen,
        setIsInvestorHubOpen,
        isCreatorStudioOpen,
        setIsCreatorStudioOpen,
        isAdminConsoleOpen,
        setIsAdminConsoleOpen,
        currentRole,
        setCurrentRole,
        switchRoleAndWallet,
        buyTokens,
        sellTokens,
        simulateLiveTrade,
        createPoC,
        iteratePoC,
        addComment,
        claimFaucet,
        claimFaucetAmount,
        sendSolTransfer,
        claimCreatorRoyalties,
        generateNewWallet,
        switchPresetWallet,
        globalNotification,
        setGlobalNotification,
        toasts,
        addToast,
        dismissToast,
        clearAllToasts,
        triggerMilestoneAlert,
        alerts,
        toggleAlerts,
        updateAlertConfig,
        triggerTestAlert,
        solanaCluster,
        setSolanaCluster,
        customRpcUrl,
        setCustomRpcUrl,
        isPhantomInstalled,
        isPhantomConnected,
        phantomPublicKey,
        connectPhantom,
        disconnectPhantom,
        requestSolanaAirdrop,
        protocolConfig,
        updateProtocolConfig,
        togglePoCTradingPause,
        togglePoCFeatured,
        forceGraduatePoC,
        injectPlatformLiquidity,
        airdropAllHolders,
        themeMode,
        toggleThemeMode,
        setThemeMode,
        isFuelModalOpen,
        fuelModalPoC,
        openFuelModal,
        closeFuelModal,
        injectOpenRouterTokens,
        updatePoCOpenRouterModel,
        setCreatorOpenRouterApiKey,
        replenishPlatformOpenRouterPool,
        watchlist,
        isWatched,
        toggleWatchlist,
        clearWatchlist,
        isWatchlistFilterActive,
        setIsWatchlistFilterActive,
        isCompareModalOpen,
        comparePoCIds,
        openCompareModal,
        closeCompareModal,
        setComparePoC,
        swapComparePoCs,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
