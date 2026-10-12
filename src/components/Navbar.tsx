import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Rocket,
  Sun,
  Moon,
  Star,
  Wallet,
  TrendingUp,
  Palette,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { formatSol } from '../utils/bondingCurve';
import { formatSolanaAddress } from '../utils/solana';
import { UserRole } from '../types';

export const Navbar: React.FC<{ searchTerm: string; setSearchTerm: (s: string) => void }> = ({
  searchTerm,
  setSearchTerm,
}) => {
  const {
    wallet,
    currentRole,
    switchRoleAndWallet,
    setIsLaunchModalOpen,
    setIsWalletModalOpen,
    setIsInvestorHubOpen,
    setIsCreatorStudioOpen,
    setIsAdminConsoleOpen,
    isPhantomConnected,
    phantomPublicKey,
    setIsSolanaDevSuiteOpen,
    themeMode,
    toggleThemeMode,
    watchlist,
    isWatchlistFilterActive,
    setIsWatchlistFilterActive,
  } = useApp();

  const roleStyles = {
    investor: {
      label: 'Inversor',
      icon: TrendingUp,
      badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      openModal: () => setIsInvestorHubOpen(true),
    },
    creator: {
      label: 'Creador',
      icon: Palette,
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      openModal: () => setIsCreatorStudioOpen(true),
    },
    admin: {
      label: 'Admin',
      icon: ShieldAlert,
      badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      openModal: () => setIsAdminConsoleOpen(true),
    },
  }[currentRole];

  const RoleIcon = roleStyles.icon;

  return (
    <header className="sticky top-0 z-40 bg-[#07090e]/95 dark:bg-[#07090e]/95 light:bg-white/95 backdrop-blur-md border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 transition-colors">
      {/* Sleek Live Activity Ticker Bar */}
      <div className="bg-slate-950/90 dark:bg-slate-950/90 light:bg-slate-100 border-b border-slate-900 dark:border-slate-900 light:border-slate-200 py-1 px-4 text-[11px] font-mono flex items-center justify-between overflow-x-auto text-slate-400 dark:text-slate-400 light:text-slate-600 gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 dark:text-emerald-400 light:text-emerald-600 font-bold uppercase tracking-wider">
            Solana Devnet · Live Bonding Curve
          </span>
        </div>
        <div className="flex items-center gap-6 overflow-hidden whitespace-nowrap text-xs">
          <span className="text-slate-300 dark:text-slate-300 light:text-slate-700">
            0x8a..f2 aportó <strong className="text-emerald-400">1.5 SOL</strong> en <strong className="text-white dark:text-white light:text-slate-900">$NEXUS</strong>
          </span>
          <span className="text-slate-300 dark:text-slate-300 light:text-slate-700">
            ⚡ @DegenInvestor inyectó <strong className="text-amber-400">3M Tokens OpenRouter</strong> a @elena_builds
          </span>
          <span className="text-slate-300 dark:text-slate-300 light:text-slate-700">
            🔥 <strong className="text-white dark:text-white light:text-slate-900">$SWARM</strong> alcanzó <strong className="text-cyan-400">71.2%</strong> de la curva
          </span>
        </div>
        <div className="shrink-0 text-slate-500 text-[10px] hidden md:block">
          1 SOL = $165.00 USD
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-4">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 p-[1.5px] shadow-lg shadow-emerald-500/20 shrink-0">
            <div className="w-full h-full bg-[#07090e] dark:bg-[#07090e] light:bg-white rounded-[10px] flex items-center justify-center font-mono font-black text-emerald-400 text-sm">
              ⚡
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-white dark:text-white light:text-slate-900 font-mono">
                PROMPT<span className="text-emerald-400">PUMP</span>
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PoC.fun
              </span>
            </div>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="flex-1 max-w-md mx-2 hidden md:block">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por prompt, ticker ($NEXUS), o creador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/80 dark:bg-slate-900/80 light:bg-slate-100 border border-slate-800 dark:border-slate-800 light:border-slate-300 rounded-xl pl-8 pr-4 py-2 text-xs text-slate-200 dark:text-slate-200 light:text-slate-800 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
        </div>

        {/* Action Controls Cluster */}
        <div className="flex items-center gap-2">
          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleThemeMode}
            title={themeMode === 'dark' ? 'Cambiar a Pantalla Clara' : 'Cambiar a Modo Oscuro'}
            className="p-2 rounded-xl bg-slate-900/80 dark:bg-slate-900/80 light:bg-slate-100 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 dark:border-slate-800 light:border-slate-300 transition cursor-pointer active:scale-95"
          >
            {themeMode === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500" />
            )}
          </button>

          {/* Watchlist Quick Button */}
          <button
            onClick={() => setIsWatchlistFilterActive(!isWatchlistFilterActive)}
            title={isWatchlistFilterActive ? 'Mostrar todos los PoCs' : 'Filtrar por Mi Watchlist'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold transition cursor-pointer active:scale-95 ${
              isWatchlistFilterActive
                ? 'bg-amber-400 text-black border-amber-400 shadow-sm shadow-amber-400/25'
                : 'bg-slate-900/80 dark:bg-slate-900/80 light:bg-slate-100 hover:bg-slate-800 text-slate-300 dark:text-slate-300 light:text-slate-700 hover:text-amber-400 border-slate-800 dark:border-slate-800 light:border-slate-300'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${isWatchlistFilterActive ? 'fill-black text-black' : 'text-amber-400 fill-amber-400/30'}`} />
            <span className="hidden sm:inline">Watchlist</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                isWatchlistFilterActive ? 'bg-black/20 text-black' : 'bg-amber-400/20 text-amber-300 dark:text-amber-300 light:text-amber-800'
              }`}
            >
              {watchlist.length}
            </span>
          </button>

          {/* Role Perspective Quick Selector */}
          <div className="hidden lg:flex items-center bg-slate-900/80 dark:bg-slate-900/80 light:bg-slate-100 border border-slate-800 dark:border-slate-800 light:border-slate-300 rounded-xl p-0.5 text-xs font-mono">
            <button
              onClick={roleStyles.openModal}
              title={`Punto de Vista Actual: ${roleStyles.label}`}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-bold border transition cursor-pointer ${roleStyles.badgeColor}`}
            >
              <RoleIcon className="w-3.5 h-3.5" />
              <span>{roleStyles.label}</span>
            </button>
            <select
              value={currentRole}
              onChange={(e) => switchRoleAndWallet(e.target.value as UserRole)}
              className="bg-transparent text-slate-400 dark:text-slate-400 light:text-slate-600 px-1.5 py-1 text-xs cursor-pointer focus:outline-none border-l border-slate-800 dark:border-slate-800 light:border-slate-300"
            >
              <option value="investor" className="bg-slate-900 text-cyan-300">Inversor</option>
              <option value="creator" className="bg-slate-900 text-emerald-300">Creador</option>
              <option value="admin" className="bg-slate-900 text-purple-300">Admin</option>
            </select>
          </div>

          {/* Web3 Wallet & Solana Balance */}
          <button
            onClick={() => setIsWalletModalOpen(true)}
            title="Abrir Gestor de Billetera Solana Web3"
            className="flex items-center gap-1.5 bg-slate-900/90 dark:bg-slate-900/90 light:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-800 light:hover:bg-slate-200 border border-slate-800 dark:border-slate-800 light:border-slate-300 px-3 py-1.5 rounded-xl text-xs font-mono transition cursor-pointer active:scale-95"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xs:inline text-slate-400">SOL:</span>
            <span className="font-extrabold text-emerald-400 dark:text-emerald-400 light:text-emerald-600">
              {formatSol(wallet.solBalance)}
            </span>
          </button>

          {/* Launch New PoC Primary CTA */}
          <button
            onClick={() => setIsLaunchModalOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-3.5 py-2 rounded-xl transition shadow-lg shadow-emerald-500/25 active:scale-95 cursor-pointer shrink-0"
          >
            <Rocket className="w-3.5 h-3.5 fill-black" />
            <span className="hidden sm:inline">Lanzar</span>
            <span>PoC</span>
          </button>
        </div>
      </div>
    </header>
  );
};
