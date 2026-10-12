import React, { useState, useMemo, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { RolePerspectiveBanner } from './components/RolePerspectiveBanner';
import { LivePrompterArena } from './components/LivePrompterArena';
import { PoCCard } from './components/PoCCard';
import { PoCDetailModal } from './components/PoCDetailModal';
import { LaunchPoCModal } from './components/LaunchPoCModal';
import { PortfolioModal } from './components/PortfolioModal';
import { SolanaDevSuiteModal } from './components/SolanaDevSuiteModal';
import { WalletModal } from './components/WalletModal';
import { InvestorHubModal } from './components/InvestorHubModal';
import { CreatorStudioModal } from './components/CreatorStudioModal';
import { AdminConsoleModal } from './components/AdminConsoleModal';
import { OpenRouterFuelModal } from './components/OpenRouterFuelModal';
import { PoCComparisonModal } from './components/PoCComparisonModal';
import { ToastNotificationContainer } from './components/ToastNotificationContainer';
import { TopCreatorsLeaderboard } from './components/TopCreatorsLeaderboard';
import { Category } from './types';
import { Sparkles, Flame, TrendingUp, Filter, Rocket, Trophy, Play, Star, ArrowLeftRight, Zap } from 'lucide-react';
import { formatSol, formatUsd } from './utils/bondingCurve';

const CATEGORIES: Category[] = [
  'All',
  'Autonomous Agents',
  'DeFi & Trading',
  'Creative AI',
  'DevTools',
  'Cyberpunk & Gaming',
  'Micro-SaaS',
];

function MainContent() {
  const {
    pocs,
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
    isFuelModalOpen,
    fuelModalPoC,
    closeFuelModal,
    globalNotification,
    watchlist,
    isWatched,
    isWatchlistFilterActive,
    setIsWatchlistFilterActive,
    isCompareModalOpen,
    openCompareModal,
    closeCompareModal,
    simulateLiveTrade,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [selectedCreatorFilter, setSelectedCreatorFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'trending' | 'curve' | 'newest' | 'volume'>('curve');

  // Deep-linking: Automatically open PoC detail view if ?poc= parameter is in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('poc') || (window.location.hash ? window.location.hash.replace('#', '') : null);
    if (targetId) {
      const matched = pocs.find((p) => p.id === targetId);
      if (matched && (!activePoC || activePoC.id !== targetId)) {
        setActivePoC(matched);
      }
    }
  }, [pocs]);

  // Keep browser URL address updated when activePoC changes or closes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activePoC) {
      if (params.get('poc') !== activePoC.id) {
        params.set('poc', activePoC.id);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({ pocId: activePoC.id }, '', newUrl);
      }
    } else {
      if (params.has('poc')) {
        params.delete('poc');
        const search = params.toString();
        const newUrl = search ? `${window.location.pathname}?${search}` : window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [activePoC]);

  // Filter and sort PoCs
  const filteredPocs = useMemo(() => {
    return pocs
      .filter((p) => {
        const matchesWatchlist = !isWatchlistFilterActive || isWatched(p.id);
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        const matchesCreator =
          !selectedCreatorFilter ||
          p.creator.handle.toLowerCase() === selectedCreatorFilter.toLowerCase() ||
          p.creator.name.toLowerCase() === selectedCreatorFilter.toLowerCase() ||
          p.creator.address === selectedCreatorFilter;
        const query = searchTerm.toLowerCase();
        const matchesSearch =
          !query ||
          p.title.toLowerCase().includes(query) ||
          p.ticker.toLowerCase().includes(query) ||
          p.prompt.toLowerCase().includes(query) ||
          p.creator.name.toLowerCase().includes(query);
        return matchesWatchlist && matchesCategory && matchesCreator && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'curve') {
          return b.bondingCurveProgress - a.bondingCurveProgress;
        }
        if (sortBy === 'trending') {
          return b.priceChange24h - a.priceChange24h;
        }
        if (sortBy === 'volume') {
          return b.volume24hSol - a.volume24hSol;
        }
        return b.createdAt - a.createdAt;
      });
  }, [pocs, selectedCategory, searchTerm, sortBy]);

  // King of the Hill (highest bonding curve progress)
  const kingOfTheHill = useMemo(() => {
    return [...pocs].sort((a, b) => b.bondingCurveProgress - a.bondingCurveProgress)[0];
  }, [pocs]);

  return (
    <div className="min-h-screen bg-[#07090e] dark:bg-[#07090e] light:bg-[#f8fafc] text-slate-100 dark:text-slate-100 light:text-slate-900 flex flex-col font-sans selection:bg-emerald-500 selection:text-black transition-colors">
      {/* Real-Time Toast Notification System */}
      <ToastNotificationContainer />

      {/* Navbar */}
      <Navbar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        {/* Role Perspective Switcher Banner */}
        <RolePerspectiveBanner />

        {/* Live Prompter Arena Hero */}
        <LivePrompterArena />

        {/* King of the Hill Spotlight */}
        {kingOfTheHill && (
          <div
            onClick={() => setActivePoC(kingOfTheHill)}
            className="group relative overflow-hidden bg-gradient-to-r from-amber-950/30 via-slate-900/90 to-emerald-950/30 dark:from-amber-950/30 dark:via-slate-900/90 dark:to-emerald-950/30 light:from-amber-50/80 light:via-white light:to-emerald-50/80 border border-amber-500/30 dark:border-amber-500/30 light:border-amber-300 hover:border-amber-400/60 rounded-2xl p-4 sm:p-5 transition-all shadow-xl cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/25 shrink-0">
                👑
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 fill-amber-400" />
                    King of the Hill
                  </span>
                  <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-mono font-bold">
                    {kingOfTheHill.bondingCurveProgress.toFixed(1)}% to Raydium
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white dark:text-white light:text-slate-900 group-hover:text-amber-300 transition">
                  {kingOfTheHill.title} <span className="font-mono text-emerald-400">(${kingOfTheHill.ticker})</span>
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-600 line-clamp-1 max-w-xl">
                  {kingOfTheHill.tagline}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end shrink-0">
              <div className="text-left md:text-right font-mono text-xs">
                <span className="text-[10px] text-slate-500 uppercase block">Market Cap</span>
                <span className="text-white dark:text-white light:text-slate-900 font-bold text-sm">
                  {formatUsd(kingOfTheHill.marketCapUsd)}
                </span>
                <span className="text-emerald-400 block text-[11px] font-semibold">
                  +{kingOfTheHill.priceChange24h.toFixed(1)}% 24h
                </span>
              </div>

              <button className="bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-amber-400/20 group-hover:scale-105 active:scale-95 cursor-pointer shrink-0">
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>Probar PoC</span>
              </button>
            </div>
          </div>
        )}

        {/* Filter and Category Navigation */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Category pills & My Watchlist Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {/* My Watchlist Filter Pill */}
              <button
                onClick={() => setIsWatchlistFilterActive(!isWatchlistFilterActive)}
                className={`text-xs font-mono font-bold px-3 py-1.5 rounded-xl transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 ${
                  isWatchlistFilterActive
                    ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/25 ring-2 ring-amber-400/50'
                    : 'bg-slate-900/90 dark:bg-slate-900/90 light:bg-white text-amber-300/90 hover:text-amber-200 hover:bg-slate-800 border border-amber-500/30'
                }`}
                title={isWatchlistFilterActive ? 'Show all marketplace PoCs' : 'Filter marketplace by My Watchlist'}
              >
                <Star className={`w-3.5 h-3.5 ${isWatchlistFilterActive ? 'fill-black text-black' : 'fill-amber-400/60 text-amber-400'}`} />
                <span>Mi Watchlist</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    isWatchlistFilterActive ? 'bg-black/20 text-black' : 'bg-amber-400/20 text-amber-300'
                  }`}
                >
                  {watchlist.length}
                </span>
              </button>

              <div className="h-4 w-[1px] bg-slate-800 dark:bg-slate-800 light:bg-slate-300 mx-1 shrink-0" />

              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-xs font-mono font-semibold px-3 py-1.5 rounded-xl transition whitespace-nowrap cursor-pointer active:scale-95 ${
                    selectedCategory === cat
                      ? 'bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/20'
                      : 'bg-slate-900/90 dark:bg-slate-900/90 light:bg-white text-slate-400 hover:text-white dark:hover:text-white light:hover:text-slate-900 hover:bg-slate-800 border border-slate-800 dark:border-slate-800 light:border-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Actions: Split-View Mode & Sort */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Split-View Mode Compare Button */}
              <button
                onClick={() => openCompareModal()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold transition shadow-sm active:scale-95 cursor-pointer"
                title="Abrir Modo Split-View: Compara dos PoCs lado a lado"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Comparar Split-View</span>
              </button>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-slate-500 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Orden:</span>
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-900 dark:bg-slate-900 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-300 text-slate-200 dark:text-slate-200 light:text-slate-800 text-xs px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="curve">Curva de Graduación (%)</option>
                  <option value="trending">Ganadores 24h (%)</option>
                  <option value="volume">Volumen 24h (SOL)</option>
                  <option value="newest">Recién Minteados</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* PoC Cards Marketplace Section & Sidebar */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                Mostrando <strong className="text-white dark:text-white light:text-slate-900">{filteredPocs.length}</strong>{' '}
                {isWatchlistFilterActive ? 'en Watchlist' : ''}
                {selectedCreatorFilter ? `de ${selectedCreatorFilter}` : ''} Proof-of-Concepts
              </span>
              {isWatchlistFilterActive && (
                <span className="inline-flex items-center gap-1.5 bg-amber-400/15 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-md text-[10px] font-bold">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  <span>Watchlist</span>
                  <button
                    onClick={() => setIsWatchlistFilterActive(false)}
                    title="Quitar filtro de Watchlist"
                    className="ml-1 text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Quitar
                  </button>
                </span>
              )}
              {selectedCreatorFilter && (
                <span className="inline-flex items-center gap-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md text-[10px] font-bold">
                  <Trophy className="w-2.5 h-2.5 text-amber-400" />
                  <span>Creador: {selectedCreatorFilter}</span>
                  <button
                    onClick={() => setSelectedCreatorFilter(null)}
                    title="Quitar filtro de creador"
                    className="ml-1 text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              )}
              {searchTerm && (
                <span className="inline-flex items-center gap-1 bg-slate-800/80 px-2 py-0.5 rounded-md text-[10px] text-slate-300">
                  <span>Búsqueda: "{searchTerm}"</span>
                  <button
                    onClick={() => setSearchTerm('')}
                    className="ml-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => simulateLiveTrade()}
                title="Disparar un price-pump simulado en un PoC aleatorio para observar la animación verde"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition cursor-pointer active:scale-95 shadow-sm"
              >
                <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                <span>Simular Pump</span>
              </button>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Runtime Sandbox Activo
              </span>
            </div>
          </div>

          {/* Marketplace Layout: PoCs Grid + Marketplace Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Main PoCs Column */}
            <div className="lg:col-span-8 xl:col-span-8">
              {filteredPocs.length === 0 ? (
                <div className="bg-[#0a0e17] dark:bg-[#0a0e17] light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200 rounded-2xl p-10 text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 dark:bg-slate-900 light:bg-slate-100 border border-slate-800 dark:border-slate-800 light:border-slate-200 mx-auto flex items-center justify-center text-3xl">
                    {isWatchlistFilterActive ? '⭐' : selectedCreatorFilter ? '🏆' : '🔎'}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white dark:text-white light:text-slate-900">
                      {isWatchlistFilterActive
                        ? 'No hay Proof-of-Concepts en tu Watchlist'
                        : selectedCreatorFilter
                        ? `No se encontraron PoCs de ${selectedCreatorFilter}`
                        : 'No se encontraron PoCs con ese criterio'}
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-600 max-w-md mx-auto">
                      {isWatchlistFilterActive
                        ? 'Haz clic en el ícono de estrella ⭐ en cualquier PoC para agregarlo a tu lista personalizada.'
                        : 'Prueba restableciendo los filtros para ver todos los PoCs de la plataforma.'}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        setIsWatchlistFilterActive(false);
                        setSelectedCategory('All');
                        setSelectedCreatorFilter(null);
                        setSearchTerm('');
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
                    >
                      Restablecer Filtros
                    </button>
                    <button
                      onClick={() => setIsLaunchModalOpen(true)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer"
                    >
                      Lanzar Nuevo PoC
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  {filteredPocs.map((poc) => (
                    <PoCCard key={poc.id} poc={poc} />
                  ))}
                </div>
              )}
            </div>

            {/* Marketplace Sidebar: Top Creators Leaderboard */}
            <aside className="lg:col-span-4 xl:col-span-4 space-y-6">
              <TopCreatorsLeaderboard
                onSelectCreator={(handle) => setSelectedCreatorFilter(handle)}
                selectedCreatorFilter={selectedCreatorFilter}
                onClearCreatorFilter={() => setSelectedCreatorFilter(null)}
                onLaunchPoC={() => setIsLaunchModalOpen(true)}
              />
            </aside>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#080b10] py-6 px-4 sm:px-6 text-xs text-slate-500 font-mono mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">⚡ PROMPTPUMP</span>
            <span>• Proof-of-Concept Launchpad on Solana Bonding Curve</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Engine: Gemini 3.8 Flash</span>
            <span>•</span>
            <span>Target Cap: 85 SOL Graduation</span>
            <span>•</span>
            <span className="text-emerald-400">● 100% In-Browser PoC Verification</span>
          </div>
        </div>
      </footer>

      {/* Active PoC Detail Modal */}
      {activePoC && (
        <PoCDetailModal poc={activePoC} onClose={() => setActivePoC(null)} />
      )}

      {/* Launch New PoC Modal */}
      {isLaunchModalOpen && (
        <LaunchPoCModal onClose={() => setIsLaunchModalOpen(false)} />
      )}

      {/* Portfolio & Wallet Modal */}
      {isPortfolioOpen && (
        <PortfolioModal onClose={() => setIsPortfolioOpen(false)} />
      )}

      {/* Solana Development Suite & Phantom Modal */}
      <SolanaDevSuiteModal
        isOpen={isSolanaDevSuiteOpen}
        onClose={() => setIsSolanaDevSuiteOpen(false)}
      />

      {/* Web3 Wallet Manager Modal */}
      {isWalletModalOpen && (
        <WalletModal onClose={() => setIsWalletModalOpen(false)} />
      )}

      {/* Investor Hub Modal */}
      {isInvestorHubOpen && (
        <InvestorHubModal onClose={() => setIsInvestorHubOpen(false)} />
      )}

      {/* Creator Studio Modal */}
      {isCreatorStudioOpen && (
        <CreatorStudioModal onClose={() => setIsCreatorStudioOpen(false)} />
      )}

      {/* Admin Governance Console Modal */}
      {isAdminConsoleOpen && (
        <AdminConsoleModal onClose={() => setIsAdminConsoleOpen(false)} />
      )}

      {/* OpenRouter AI Token Fuel & Sponsorship Modal */}
      {isFuelModalOpen && fuelModalPoC && (
        <OpenRouterFuelModal poc={fuelModalPoC} onClose={closeFuelModal} />
      )}

      {/* PoC Head-to-Head Split-View Comparison Modal */}
      {isCompareModalOpen && (
        <PoCComparisonModal onClose={closeCompareModal} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
