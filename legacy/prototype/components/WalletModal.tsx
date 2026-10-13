import React, { useState } from 'react';
import { useApp, PRESET_WALLETS } from '../context/AppContext';
import {
  X,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Eye,
  EyeOff,
  Coins,
  Send,
  RefreshCw,
  QrCode,
  Layers,
  Sparkles,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { formatSol, formatUsd, SOL_USD_RATE } from '../utils/bondingCurve';
import { getSolanaExplorerUrl, formatSolanaAddress } from '../utils/solana';
import { UserRole } from '../types';

export const WalletModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    wallet,
    currentRole,
    switchPresetWallet,
    generateNewWallet,
    sendSolTransfer,
    claimFaucetAmount,
    requestSolanaAirdrop,
    connectPhantom,
    disconnectPhantom,
    isPhantomConnected,
    isPhantomInstalled,
    solanaCluster,
    setGlobalNotification,
    setIsPortfolioOpen,
    setIsCreatorStudioOpen,
    setIsAdminConsoleOpen,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'balance' | 'accounts' | 'send' | 'faucet' | 'security' | 'history'>('balance');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Send SOL form state
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendNote, setSendNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyId);
      setGlobalNotification(`📋 ${label} copiado al portapapeles!`);
      setTimeout(() => {
        setCopiedKey(null);
        setGlobalNotification(null);
      }, 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendSol = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError(null);
    const amt = parseFloat(sendAmount);
    if (isNaN(amt) || amt <= 0) {
      setSendError('Ingresa un monto válido en SOL');
      return;
    }
    if (!sendRecipient || sendRecipient.trim().length < 8) {
      setSendError('Ingresa una dirección de destino válida');
      return;
    }

    setIsSending(true);
    const res = await sendSolTransfer(sendRecipient.trim(), amt, sendNote);
    setIsSending(false);

    if (res.success) {
      setSendAmount('');
      setSendRecipient('');
      setSendNote('');
      setActiveTab('history');
    } else {
      setSendError(res.message);
    }
  };

  // Role badges & details
  const roleDisplay = {
    investor: {
      label: 'Inversor Degen',
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      icon: '📈',
    },
    creator: {
      label: 'Creador de PoCs',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      icon: '🎨',
    },
    admin: {
      label: 'Administrador del Protocolo',
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      icon: '👔',
    },
  }[wallet.role || currentRole] || {
    label: 'Usuario Web3',
    color: 'text-slate-300 bg-slate-800 border-slate-700',
    icon: '⚡',
  };

  // SVG QR Code representation for Solana address
  const qrSvgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=solana:${wallet.address}&color=10-230-140&bgcolor=11-14-20`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0b0e14] border border-slate-800 rounded-3xl shadow-2xl text-slate-100 flex flex-col max-h-[92vh] overflow-hidden font-sans">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-800/90 bg-[#080b10] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-400 p-0.5 shadow-lg shadow-emerald-500/20 shrink-0">
              <div className="w-full h-full bg-[#0b0e14] rounded-[14px] flex items-center justify-center text-emerald-400 font-bold">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-white font-mono tracking-tight">
                  Billetera Solana Web3
                </h2>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${roleDisplay.color}`}>
                  <span>{roleDisplay.icon}</span>
                  <span>{roleDisplay.label}</span>
                </span>
                {isPhantomConnected && (
                  <span className="text-[10px] font-mono bg-[#ab9ff2]/20 text-[#ab9ff2] border border-[#ab9ff2]/40 px-2 py-0.5 rounded-full font-bold">
                    Phantom Live
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {formatSolanaAddress(wallet.address)} • Cluster Solana {solanaCluster}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-4 bg-[#090d14] border-b border-slate-800/80 overflow-x-auto text-xs font-mono">
          {[
            { id: 'balance', label: 'Mi Balance', icon: Coins },
            { id: 'accounts', label: 'Cambiar Perfil', icon: Users },
            { id: 'send', label: 'Enviar SOL', icon: Send },
            { id: 'faucet', label: 'Faucet (+SOL)', icon: ArrowDownLeft },
            { id: 'security', label: 'Claves & Seguridad', icon: Shield },
            { id: 'history', label: 'Historial', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-3 font-semibold transition border-b-2 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: BALANCE & CARD */}
          {activeTab === 'balance' && (
            <div className="space-y-4">
              {/* Virtual Glassmorphic Web3 Card */}
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#0f172a] to-emerald-950/40 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl">
                <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-4">
                  <span className="flex items-center gap-1.5 uppercase font-bold tracking-wider text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    Solana Keypair Wallet
                  </span>
                  <span className="text-[11px] bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700">
                    {wallet.name}
                  </span>
                </div>

                <div className="space-y-1 mb-6">
                  <span className="text-xs text-slate-400 font-mono">Saldo Disponible:</span>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
                      {formatSol(wallet.solBalance)} <span className="text-emerald-400 text-2xl">SOL</span>
                    </h3>
                  </div>
                  <span className="text-sm font-mono text-slate-400 block">
                    ≈ {formatUsd(wallet.solBalance * SOL_USD_RATE)} USD
                  </span>
                </div>

                {/* Address Pill + Copy + QR */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 font-mono text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Dirección Pública (Base58)</span>
                    <span className="text-slate-200 font-bold break-all select-all text-[11px]">
                      {wallet.address}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => copyToClipboard(wallet.address, 'Dirección pública', 'wallet_addr')}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center gap-1 text-[11px] transition cursor-pointer"
                    >
                      {copiedKey === 'wallet_addr' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setShowQrModal(!showQrModal)}
                      className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                      title="Ver Código QR"
                    >
                      <QrCode className="w-4 h-4 text-emerald-400" />
                    </button>

                    <a
                      href={getSolanaExplorerUrl(wallet.address, 'address', solanaCluster)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-cyan-400 transition"
                      title="Ver en Solana Explorer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>

              {/* QR Code Reveal Panel */}
              {showQrModal && (
                <div className="bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-4 flex flex-col items-center justify-center space-y-3 animate-in fade-in">
                  <span className="text-xs font-mono font-bold text-emerald-400 uppercase">
                    Código QR para Recibir SOL
                  </span>
                  <div className="p-3 bg-white rounded-2xl shadow-xl">
                    <img
                      src={qrSvgUrl}
                      alt="Solana Address QR"
                      className="w-40 h-40 object-contain"
                    />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 text-center max-w-sm">
                    Escanea para transferir SOL directamente desde tu billetera móvil o monedero Solana.
                  </span>
                </div>
              )}

              {/* Quick Actions HUD */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                <button
                  onClick={() => setActiveTab('send')}
                  className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition">
                    <Send className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white">Enviar SOL</span>
                </button>

                <button
                  onClick={() => setActiveTab('faucet')}
                  className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition">
                    <Coins className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white">+5 SOL Faucet</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    setIsPortfolioOpen(true);
                  }}
                  className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white">Ver Tokens ({Object.keys(wallet.holdings).length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('accounts')}
                  className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white">Cambiar Rol</span>
                </button>
              </div>

              {/* Creator Royalties Banner if any */}
              {(wallet.creatorRoyaltiesSol || 0) > 0 && (
                <div className="bg-gradient-to-r from-emerald-950/60 to-cyan-950/50 border border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 block">
                      Regalías de Creador Disponibles
                    </span>
                    <span className="text-lg font-bold font-mono text-white">
                      +{wallet.creatorRoyaltiesSol?.toFixed(3)} SOL
                    </span>
                    <span className="text-[11px] text-slate-400 block font-mono">
                      Acumuladas del 0.5% de transacciones en tus PoCs creados
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      setIsCreatorStudioOpen(true);
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-3.5 py-2 rounded-xl transition font-mono cursor-pointer"
                  >
                    Ir al Creator Studio
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SWITCH ACCOUNTS & ROLES */}
          {activeTab === 'accounts' && (
            <div className="space-y-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Seleccionar Cuenta y Punto de Vista</span>
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  Cambia instantáneamente de perfil para experimentar PromptPump desde la perspectiva de <strong>Inversor</strong>, <strong>Creador</strong> o <strong>Administrador</strong>, o conecta tu billetera Phantom real.
                </p>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    role: 'investor' as UserRole,
                    title: 'Punto de Vista: Inversor (Degen)',
                    name: 'DegenInvestor.sol',
                    desc: 'Portafolio activo con participaciones en PoCs, seguimiento de ROI y alertas de curvas.',
                    sol: PRESET_WALLETS.investor.solBalance,
                    badge: 'Modo Inversor',
                    badgeColor: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
                  },
                  {
                    role: 'creator' as UserRole,
                    title: 'Punto de Vista: Creador (Elena Rostova)',
                    name: 'Elena Rostova (@elena_builds)',
                    desc: 'Creadora de NexusFlow. Acceso a terminal de iteración con Gemini y cobro de regalías.',
                    sol: PRESET_WALLETS.creator.solBalance,
                    badge: 'Modo Creador',
                    badgeColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
                  },
                  {
                    role: 'admin' as UserRole,
                    title: 'Punto de Vista: Administrador del Protocolo',
                    name: 'PromptPump Protocol Master',
                    desc: 'Poderes de gobernanza, tesorería de tarifas, moderación y pausa de trading.',
                    sol: PRESET_WALLETS.admin.solBalance,
                    badge: 'Modo Administrador',
                    badgeColor: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
                  },
                ].map((account) => {
                  const isCurrent = wallet.role === account.role && !isPhantomConnected;
                  return (
                    <div
                      key={account.role}
                      onClick={() => switchPresetWallet(account.role)}
                      className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-slate-900 border-emerald-500/80 shadow-lg shadow-emerald-950/30'
                          : 'bg-slate-950/70 hover:bg-slate-900/80 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white font-mono">{account.title}</h4>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${account.badgeColor}`}>
                            {account.badge}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] bg-emerald-500 text-black font-extrabold px-1.5 py-0.5 rounded font-mono">
                              ACTIVO
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-sans">{account.desc}</p>
                        <span className="text-[11px] font-mono text-slate-500 block">
                          Identidad: {account.name}
                        </span>
                      </div>

                      <div className="text-left sm:text-right font-mono text-xs shrink-0">
                        <span className="text-emerald-400 font-bold block">{formatSol(account.sol)} SOL</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            switchPresetWallet(account.role);
                          }}
                          className={`mt-1 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                            isCurrent
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 hover:bg-slate-700 text-white'
                          }`}
                        >
                          {isCurrent ? 'Perfil en Uso' : 'Seleccionar'}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Option to generate fresh new wallet */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs font-mono">
                  <div>
                    <span className="font-bold text-white block">Generar Nueva Billetera Aleatoria</span>
                    <span className="text-slate-400 text-[11px]">Crea un par de claves Solana desde cero con airdrop inicial.</span>
                  </div>
                  <button
                    onClick={generateNewWallet}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Crear Keypair</span>
                  </button>
                </div>

                {/* Option to connect real Phantom */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-[#512da8]/15 border border-[#ab9ff2]/30 p-3.5 rounded-2xl text-xs font-mono">
                  <div>
                    <span className="font-bold text-[#ab9ff2] block">Billetera Phantom (Extensión Real)</span>
                    <span className="text-slate-300 text-[11px]">
                      {isPhantomConnected
                        ? `Conectado con ${formatSolanaAddress(wallet.address)}`
                        : 'Firma transacciones directamente desde tu navegador con Phantom.'}
                    </span>
                  </div>

                  {isPhantomConnected ? (
                    <button
                      onClick={disconnectPhantom}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                    >
                      Desconectar
                    </button>
                  ) : (
                    <button
                      onClick={connectPhantom}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ab9ff2] to-[#8a76e6] text-slate-950 text-xs font-extrabold shadow-md transition cursor-pointer active:scale-95"
                    >
                      Conectar Phantom
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ENVIAR SOL */}
          {activeTab === 'send' && (
            <div className="space-y-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-400" />
                  <span>Transferir SOL en la Red</span>
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  Envía tokens nativos de Solana a cualquier dirección de billetera pública en la red.
                </p>
              </div>

              {sendError && (
                <div className="bg-rose-950/60 border border-rose-500/50 p-3 rounded-xl text-rose-200 text-xs font-mono">
                  ❌ {sendError}
                </div>
              )}

              <form onSubmit={handleSendSol} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Dirección de Destino (Base58):</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 7XqP3sKwA9F7y2bN6p4Kk1m8Zv9Ym2xLq5Q1n4W2e1Rt"
                    value={sendRecipient}
                    onChange={(e) => setSendRecipient(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs"
                  />
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                    <span>Predefinidos:</span>
                    <button
                      type="button"
                      onClick={() => setSendRecipient(PRESET_WALLETS.creator.address)}
                      className="text-emerald-400 hover:underline cursor-pointer"
                    >
                      Creador Elena
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setSendRecipient(PRESET_WALLETS.admin.address)}
                      className="text-purple-400 hover:underline cursor-pointer"
                    >
                      Admin Protocolo
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-400">Monto a Enviar (SOL):</label>
                    <span className="text-[11px] text-slate-400">
                      Disponible: <strong className="text-emerald-400">{formatSol(wallet.solBalance)} SOL</strong>
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.5"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setSendAmount(Math.max(0, wallet.solBalance - 0.005).toFixed(3))}
                      className="absolute right-2 top-2 px-2 py-1 rounded bg-slate-900 text-emerald-400 text-[10px] font-bold border border-slate-700"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Nota o Referencia (Opcional):</label>
                  <input
                    type="text"
                    placeholder="Ej. Inversión inicial o aporte de desarrollo"
                    value={sendNote}
                    onChange={(e) => setSendNote(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Tarifa estimada de red:</span>
                    <span className="text-white">~0.0005 SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tiempo de confirmación:</span>
                    <span className="text-emerald-400">Inmediato (Solana Devnet)</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-extrabold text-xs transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                      <span>Firmando Transacción...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 fill-black" />
                      <span>Confirmar y Enviar SOL</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: FAUCET & AIRDROPS */}
          {activeTab === 'faucet' && (
            <div className="space-y-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-cyan-400" />
                  <span>Dispensador Faucet de Solana Devnet</span>
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  Recarga tu saldo para probar compras y ventas en las curvas de vinculación de los PoCs.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                {[
                  { amount: 2.0, label: '+2.00 SOL', desc: 'Recarga rápida para micro-trades' },
                  { amount: 5.0, label: '+5.00 SOL', desc: 'Bolsa estándar para ape in en PoCs' },
                  { amount: 15.0, label: '+15.00 SOL', desc: 'Saldo ballena para pruebas de graduación' },
                ].map((tier) => (
                  <div
                    key={tier.amount}
                    className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <span className="text-lg font-bold text-emerald-400 block">{tier.label}</span>
                      <p className="text-[11px] text-slate-400 font-sans mt-0.5">{tier.desc}</p>
                    </div>
                    <button
                      onClick={() => claimFaucetAmount(tier.amount)}
                      className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs transition cursor-pointer"
                    >
                      Acreditar Faucet
                    </button>
                  </div>
                ))}
              </div>

              {/* On-chain devnet RPC airdrop */}
              <div className="bg-gradient-to-r from-purple-950/40 via-cyan-950/30 to-transparent border border-purple-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
                <div>
                  <h4 className="font-bold text-white">Solicitar Airdrop On-Chain con RPC</h4>
                  <p className="text-[11px] text-slate-300 font-sans">
                    Llama al validador oficial de Solana Devnet con tu dirección activa.
                  </p>
                </div>
                <button
                  onClick={() => requestSolanaAirdrop()}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-400 text-black font-extrabold text-xs transition shadow-md cursor-pointer shrink-0"
                >
                  Request Devnet Airdrop
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: SEGURIDAD & CLAVES */}
          {activeTab === 'security' && (
            <div className="space-y-4 font-mono text-xs">
              <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-amber-300">Gestión de Claves Criptográficas</h4>
                  <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                    Las claves simuladas de este entorno representan el par de claves públicas y privadas en formato estándar de Solana. Nunca compartas tu frase semilla real.
                  </p>
                </div>
              </div>

              {/* Private Key Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 uppercase text-[10px] font-bold">Clave Privada (Base58)</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      {showPrivateKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPrivateKey ? 'Ocultar' : 'Revelar'}</span>
                    </button>
                    {showPrivateKey && (
                      <button
                        onClick={() => copyToClipboard(wallet.privateKeySimulated || '5KxyzKeySolana', 'Clave privada', 'priv_key')}
                        className="text-emerald-400 hover:underline text-[11px] cursor-pointer"
                      >
                        Copiar
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 break-all select-all text-slate-300">
                  {showPrivateKey ? wallet.privateKeySimulated || '5Kxyz...SimulatedPrivateSolanaKey' : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                </div>
              </div>

              {/* Seed Phrase Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 uppercase text-[10px] font-bold">Frase Semilla Mnemónica (12 Palabras)</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowSeedPhrase(!showSeedPhrase)}
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      {showSeedPhrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showSeedPhrase ? 'Ocultar' : 'Revelar'}</span>
                    </button>
                    {showSeedPhrase && (
                      <button
                        onClick={() => copyToClipboard(wallet.seedPhraseSimulated || '', 'Frase semilla', 'seed_phrase')}
                        className="text-emerald-400 hover:underline text-[11px] cursor-pointer"
                      >
                        Copiar
                      </button>
                    )}
                  </div>
                </div>

                {showSeedPhrase ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                    {(wallet.seedPhraseSimulated || 'venture galaxy radar solana prompt matrix neon crypto agent surge blast dynamic')
                      .split(' ')
                      .map((word, idx) => (
                        <div key={idx} className="bg-slate-950 px-2 py-1 rounded border border-slate-800 text-[11px] flex items-center gap-1.5">
                          <span className="text-slate-500 text-[9px]">{idx + 1}.</span>
                          <span className="text-white font-semibold">{word}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 text-center text-slate-500">
                    Frase mnemónica oculta por seguridad. Pulsa "Revelar" para ver las 12 palabras.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: HISTORIAL DE TRANSACCIONES */}
          {activeTab === 'history' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 uppercase font-semibold text-[10px]">
                  Libro Contable de Billetera ({wallet.transfersHistory?.length || 0} transferencias, {wallet.tradeHistory?.length || 0} trades)
                </span>
              </div>

              {(!wallet.transfersHistory || wallet.transfersHistory.length === 0) &&
              (!wallet.tradeHistory || wallet.tradeHistory.length === 0) ? (
                <div className="bg-slate-950 p-8 rounded-2xl border border-slate-900 text-center text-slate-500">
                  No hay transacciones registradas aún en esta billetera.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {/* Transfers */}
                  {wallet.transfersHistory?.map((tr) => (
                    <div
                      key={tr.id}
                      className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                            tr.type === 'send'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {tr.type === 'send' ? '↗' : '↙'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white uppercase text-[11px]">
                              {tr.type === 'send' ? 'Envío de SOL' : tr.type === 'claim_royalties' ? 'Cobro Regalías' : 'Recepción / Faucet'}
                            </span>
                            <span className="text-[10px] text-slate-500">{new Date(tr.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate max-w-[200px]">
                            {tr.recipientOrSender}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`font-bold block ${
                            tr.type === 'send' ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {tr.type === 'send' ? '-' : '+'}{formatSol(tr.amountSol)} SOL
                        </span>
                        <span className="text-[9px] text-slate-500">TX: {tr.txHash.slice(0, 8)}...</span>
                      </div>
                    </div>
                  ))}

                  {/* Trades */}
                  {wallet.tradeHistory?.map((tr) => (
                    <div
                      key={tr.id}
                      className="bg-slate-950/70 p-3 rounded-xl border border-slate-900 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{tr.type === 'buy' ? '🟢' : '🔴'}</span>
                        <div>
                          <span className="font-bold text-white uppercase text-[11px]">
                            {tr.type === 'buy' ? 'Compra en Curva' : 'Venta en Curva'}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {tr.pocId} • {new Date(tr.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <span className={tr.type === 'buy' ? 'text-emerald-400 font-bold block' : 'text-rose-400 font-bold block'}>
                          {tr.type === 'buy' ? '-' : '+'}{formatSol(tr.solAmount)} SOL
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {tr.tokenAmount > 1_000_000 ? (tr.tokenAmount / 1_000_000).toFixed(1) + 'M' : Math.floor(tr.tokenAmount)} tokens
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-[#080b10] flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Billetera activa en Solana {solanaCluster}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs transition cursor-pointer"
          >
            Cerrar Billetera
          </button>
        </div>
      </div>
    </div>
  );
};
