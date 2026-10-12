import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  Wallet,
  Zap,
  Check,
  Copy,
  ExternalLink,
  Terminal,
  Layers,
  Activity,
  Cpu,
  RefreshCw,
  AlertCircle,
  Code2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  SOLANA_CLUSTERS,
  SolanaCluster,
  PROMPT_PUMP_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  formatSolanaAddress,
  getSolanaExplorerUrl,
  createSolanaConnection,
} from '../utils/solana';
import { formatSol, formatUsd } from '../utils/bondingCurve';

export const SolanaDevSuiteModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const {
    wallet,
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
    setGlobalNotification,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'phantom' | 'cluster' | 'faucet' | 'programs' | 'cli'>('phantom');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRequestingAirdrop, setIsRequestingAirdrop] = useState(false);
  const [isConnectingPhantom, setIsConnectingPhantom] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(customRpcUrl);
  const [rpcPing, setRpcPing] = useState<{ pingMs: number; slot: number; status: 'online' | 'checking' | 'error' }>({
    pingMs: 28,
    slot: 295482011,
    status: 'checking',
  });

  // Check RPC latency when cluster changes
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    const testRpc = async () => {
      setRpcPing((prev) => ({ ...prev, status: 'checking' }));
      const start = performance.now();
      try {
        const connection = createSolanaConnection(solanaCluster, customRpcUrl);
        const slot = await connection.getSlot('confirmed');
        const elapsed = Math.round(performance.now() - start);
        if (!isCancelled) {
          setRpcPing({
            pingMs: elapsed,
            slot,
            status: 'online',
          });
        }
      } catch (err) {
        if (!isCancelled) {
          setRpcPing({
            pingMs: 0,
            slot: 0,
            status: 'error',
          });
        }
      }
    };
    testRpc();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, solanaCluster, customRpcUrl]);

  if (!isOpen) return null;

  const copyToClipboard = async (text: string, label: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyId);
      setGlobalNotification(`📋 Copied ${label} to clipboard!`);
      setTimeout(() => {
        setCopiedKey(null);
        setGlobalNotification(null);
      }, 3000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const handleConnectPhantom = async () => {
    setIsConnectingPhantom(true);
    await connectPhantom();
    setIsConnectingPhantom(false);
  };

  const handleAirdrop = async () => {
    setIsRequestingAirdrop(true);
    await requestSolanaAirdrop();
    setIsRequestingAirdrop(false);
  };

  const currentClusterConfig = SOLANA_CLUSTERS[solanaCluster];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-[#0b0e14] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-mono">
        {/* Header with Solana gradient */}
        <div className="bg-[#080b10] px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Solana Logo Icon */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#9945FF] to-[#14F195] p-0.5 shadow-lg shadow-purple-950/40 shrink-0">
              <div className="w-full h-full bg-[#0b0e14] rounded-[10px] flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 397 311" fill="none">
                  <path
                    d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"
                    fill="url(#solana_grad_a)"
                  />
                  <path
                    d="M64.6 3.8C67 1.4 70.3 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"
                    fill="url(#solana_grad_b)"
                  />
                  <path
                    d="M333.3 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.7c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"
                    fill="url(#solana_grad_c)"
                  />
                  <defs>
                    <linearGradient id="solana_grad_a" x1="6.5" y1="274.6" x2="395.8" y2="274.6" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#00FFA3" />
                      <stop offset="1" stopColor="#DC1FFF" />
                    </linearGradient>
                    <linearGradient id="solana_grad_b" x1="6.5" y1="40.5" x2="395.8" y2="40.5" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#00FFA3" />
                      <stop offset="1" stopColor="#DC1FFF" />
                    </linearGradient>
                    <linearGradient id="solana_grad_c" x1="6.7" y1="157.1" x2="396" y2="157.1" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#DC1FFF" />
                      <stop offset="1" stopColor="#00FFA3" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Solana Development Suite</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {currentClusterConfig.name}
                </span>
                {isPhantomConnected && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ab9ff2]/15 text-[#ab9ff2] border border-[#ab9ff2]/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ab9ff2] animate-pulse"></span>
                    <span>Phantom Connected</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Solana Web3, Phantom Wallet Connection, Anchor Program IDL, and Devnet Airdrop Tools
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-4 bg-[#090c12] border-b border-slate-800 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('phantom')}
            className={`flex items-center gap-2 px-3 py-2.5 font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'phantom'
                ? 'border-[#ab9ff2] text-[#ab9ff2]'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Phantom Wallet</span>
          </button>

          <button
            onClick={() => setActiveTab('cluster')}
            className={`flex items-center gap-2 px-3 py-2.5 font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'cluster'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Solana Cluster & RPC</span>
          </button>

          <button
            onClick={() => setActiveTab('faucet')}
            className={`flex items-center gap-2 px-3 py-2.5 font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'faucet'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Devnet Faucet (+1 SOL)</span>
          </button>

          <button
            onClick={() => setActiveTab('programs')}
            className={`flex items-center gap-2 px-3 py-2.5 font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'programs'
                ? 'border-purple-400 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Programs & IDL</span>
          </button>

          <button
            onClick={() => setActiveTab('cli')}
            className={`flex items-center gap-2 px-3 py-2.5 font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'cli'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Solana CLI Guide</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: PHANTOM WALLET */}
          {activeTab === 'phantom' && (
            <div className="space-y-4">
              {/* Phantom Status Banner */}
              <div className="bg-gradient-to-r from-[#ab9ff2]/10 via-[#512da8]/15 to-transparent border border-[#ab9ff2]/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-[#512da8] flex items-center justify-center text-white shadow-lg shadow-purple-950/50 shrink-0">
                    {/* Phantom Ghost Icon */}
                    <svg className="w-7 h-7" viewBox="0 0 128 128" fill="none">
                      <path
                        d="M112.5 63.8C112.5 35.2 89.3 12 60.7 12 32.1 12 8.9 35.2 8.9 63.8c0 23.3 15.3 43 36.6 49.6v-14c0-3.3 2.7-6 6-6s6 2.7 6 6v14.6c1.1.2 2.1.3 3.2.3 1.1 0 2.1-.1 3.2-.3v-14.6c0-3.3 2.7-6 6-6s6 2.7 6 6v14c21.3-6.6 36.6-26.3 36.6-49.6z"
                        fill="#fff"
                      />
                      <circle cx="43.5" cy="57" r="6" fill="#512da8" />
                      <circle cx="77.5" cy="57" r="6" fill="#512da8" />
                    </svg>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Phantom Wallet for Solana</span>
                      {isPhantomInstalled ? (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                          EXTENSION DETECTED
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
                          NOT DETECTED
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {isPhantomConnected
                        ? `Connected with Phantom (${formatSolanaAddress(phantomPublicKey || '')})`
                        : 'Connect Phantom to sign live Solana transactions and deploy AI PoCs.'}
                    </p>
                  </div>
                </div>

                {/* Connect / Disconnect Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {isPhantomConnected ? (
                    <button
                      onClick={disconnectPhantom}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
                    >
                      Disconnect Phantom
                    </button>
                  ) : isPhantomInstalled ? (
                    <button
                      onClick={handleConnectPhantom}
                      disabled={isConnectingPhantom}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ab9ff2] to-[#8a76e6] hover:brightness-110 text-slate-950 text-xs font-extrabold shadow-lg shadow-purple-900/30 transition active:scale-95 cursor-pointer flex items-center gap-2"
                    >
                      <Wallet className="w-4 h-4 text-slate-950" />
                      <span>{isConnectingPhantom ? 'Connecting...' : 'Connect Phantom'}</span>
                    </button>
                  ) : (
                    <a
                      href="https://phantom.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 rounded-xl bg-[#512da8] hover:bg-[#6236cc] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md"
                    >
                      <span>Install Phantom</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Wallet Details Card */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 uppercase tracking-wider font-semibold">
                    Active Solana Account
                  </span>
                  <span className="text-slate-400">
                    Mode: <strong className={isPhantomConnected ? 'text-[#ab9ff2]' : 'text-emerald-400'}>
                      {isPhantomConnected ? 'Phantom Hardware/Browser' : 'Simulated Devnet Keypair'}
                    </strong>
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-500 block uppercase">Public Key (Base58)</span>
                    <span className="text-xs font-bold text-white break-all select-all">
                      {wallet.address}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => copyToClipboard(wallet.address, 'Public Key', 'pubkey')}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {copiedKey === 'pubkey' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Address</span>
                        </>
                      )}
                    </button>

                    <a
                      href={getSolanaExplorerUrl(wallet.address, 'address', solanaCluster)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-cyan-400 transition"
                      title="Inspect on Solana Explorer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Balances Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block uppercase">SOL Balance</span>
                    <span className="text-emerald-400 font-bold text-sm">{formatSol(wallet.solBalance)} SOL</span>
                    <span className="text-[10px] text-slate-500 block">{formatUsd(wallet.solBalance * 165)}</span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block uppercase">Token Holdings</span>
                    <span className="text-white font-bold text-sm">{Object.keys(wallet.holdings).length} PoCs</span>
                    <span className="text-[10px] text-slate-500 block">Bonding curve shares</span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block uppercase">Total Trades</span>
                    <span className="text-cyan-400 font-bold text-sm">{wallet.tradeHistory.length} TXs</span>
                    <span className="text-[10px] text-slate-500 block">On-chain activity</span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block uppercase">Target Network</span>
                    <span className="text-purple-400 font-bold text-sm capitalize">{solanaCluster}</span>
                    <span className="text-[10px] text-slate-500 block">Confirmed</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SOLANA CLUSTER & RPC */}
          {activeTab === 'cluster' && (
            <div className="space-y-4">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Select Solana Cluster Environment
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['devnet', 'testnet', 'mainnet-beta'] as SolanaCluster[]).map((clusterId) => {
                    const cfg = SOLANA_CLUSTERS[clusterId];
                    const isSelected = solanaCluster === clusterId;
                    return (
                      <div
                        key={clusterId}
                        onClick={() => setSolanaCluster(clusterId)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/20'
                            : 'bg-slate-950/60 hover:bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-white text-xs">{cfg.name}</span>
                            {isSelected && (
                              <span className="text-[9px] bg-emerald-500 text-black font-extrabold px-1.5 py-0.5 rounded">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-2">
                            {clusterId === 'devnet' && 'Fast free test environment with faucet support. Ideal for development.'}
                            {clusterId === 'testnet' && 'Stress test cluster simulating validator releases.'}
                            {clusterId === 'mainnet-beta' && 'Production Solana network with real SOL capital and Raydium pools.'}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono mt-2 truncate">
                          {cfg.endpoint}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RPC Node Telemetry */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider">
                    RPC Endpoint Connection Status
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-emerald-400 font-bold">{rpcPing.status.toUpperCase()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Cluster RPC URL</span>
                    <span className="text-slate-200 font-mono text-[11px] truncate block">
                      {currentClusterConfig.endpoint}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Roundtrip Latency</span>
                    <span className="text-emerald-400 font-bold font-mono">
                      {rpcPing.status === 'checking' ? 'Pinging...' : `${rpcPing.pingMs} ms`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Current Slot</span>
                    <span className="text-white font-mono font-bold">
                      {rpcPing.slot ? `#${rpcPing.slot.toLocaleString()}` : 'Syncing...'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DEVNET FAUCET */}
          {activeTab === 'faucet' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-cyan-950/40 via-emerald-950/20 to-transparent border border-cyan-500/30 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                    <Zap className="w-5 h-5 fill-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Solana Devnet Airdrop Faucet</h3>
                    <p className="text-xs text-slate-300">
                      Request real 1.00 SOL directly on the Solana Devnet via Web3 RPC
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Calls <code className="text-cyan-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">connection.requestAirdrop(pubkey, 1_000_000_000)</code> on the configured Solana Devnet cluster. You can immediately use this balance to ape into new prompt PoCs or trade on the bonding curves.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={handleAirdrop}
                    disabled={isRequestingAirdrop}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-black font-extrabold text-xs transition shadow-lg shadow-cyan-950/40 flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {isRequestingAirdrop ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-black" />
                        <span>Requesting Validator Airdrop...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-black" />
                        <span>Request +1.00 SOL Airdrop</span>
                      </>
                    )}
                  </button>

                  <span className="text-xs text-slate-400">
                    Current Balance: <strong className="text-emerald-400">{formatSol(wallet.solBalance)} SOL</strong>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PROGRAMS & IDL */}
          {activeTab === 'programs' && (
            <div className="space-y-4">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span>On-Chain Solana Programs (Anchor Architecture)</span>
                </h3>

                <div className="space-y-2">
                  {[
                    {
                      name: 'PromptPump Bonding Curve Program',
                      id: PROMPT_PUMP_PROGRAM_ID,
                      desc: 'Handles bonding curve minting, automated pricing math, and Raydium graduation',
                      key: 'promptpump_prog',
                    },
                    {
                      name: 'Solana SPL Token Program',
                      id: TOKEN_PROGRAM_ID,
                      desc: 'Standard Solana Token Mint Program for all PoC SPL tokens',
                      key: 'spl_prog',
                    },
                    {
                      name: 'Associated Token Account Program (ATA)',
                      id: ASSOCIATED_TOKEN_PROGRAM_ID,
                      desc: 'Derives deterministic token account PDAs for holders',
                      key: 'ata_prog',
                    },
                    {
                      name: 'Solana System Program',
                      id: SYSTEM_PROGRAM_ID,
                      desc: 'Native SOL transfers and account initialization',
                      key: 'sys_prog',
                    },
                  ].map((prog) => (
                    <div
                      key={prog.key}
                      className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <span className="font-bold text-white text-xs">{prog.name}</span>
                        <p className="text-[11px] text-slate-400">{prog.desc}</p>
                        <span className="text-[10px] text-purple-400 font-mono block select-all">
                          {prog.id}
                        </span>
                      </div>

                      <button
                        onClick={() => copyToClipboard(prog.id, prog.name, prog.key)}
                        className="self-start sm:self-center px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {copiedKey === prog.key ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedKey === prog.key ? 'Copied' : 'Copy ID'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CLI GUIDE */}
          {activeTab === 'cli' && (
            <div className="space-y-4">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <span>Solana CLI & Developer Commands</span>
                </h3>
                <p className="text-xs text-slate-300">
                  Ready-to-use terminal commands to interact with this application via the official Solana CLI and Anchor framework:
                </p>

                <div className="space-y-3">
                  {[
                    {
                      label: '1. Set CLI Cluster to Devnet',
                      cmd: `solana config set --url https://api.devnet.solana.com`,
                    },
                    {
                      label: '2. Request Airdrop to your Active Address',
                      cmd: `solana airdrop 2 ${wallet.address}`,
                    },
                    {
                      label: '3. Inspect On-Chain Account State',
                      cmd: `solana account ${wallet.address}`,
                    },
                    {
                      label: '4. Build & Deploy Anchor Bonding Curve Program',
                      cmd: `anchor build && anchor deploy --provider.cluster devnet`,
                    },
                  ].map((item, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{item.label}</span>
                        <button
                          onClick={() => copyToClipboard(item.cmd, item.label, `cmd-${idx}`)}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === `cmd-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === `cmd-${idx}` ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <pre className="text-xs text-emerald-400 font-mono bg-black/60 p-2.5 rounded-lg border border-slate-900 overflow-x-auto select-all">
                        {item.cmd}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#080b10] px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Solana Web3 Engine Ready</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs transition cursor-pointer"
          >
            Close Suite
          </button>
        </div>
      </div>
    </div>
  );
};
