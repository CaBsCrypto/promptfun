import React, { useState, useEffect, useRef } from 'react';
import { PoC, Trade } from '../types';
import { useApp } from '../context/AppContext';
import {
  Play,
  TrendingUp,
  Users,
  Sparkles,
  Zap,
  CheckCircle2,
  Share2,
  Check,
  Star,
  ArrowLeftRight,
} from 'lucide-react';
import { formatSol, formatUsd } from '../utils/bondingCurve';
import { formatTokenCount } from '../utils/openrouter';
import { MiniSparkline } from './MiniSparkline';
import { SocialSentimentGauge } from './SocialSentimentGauge';

export const PoCCard: React.FC<{ poc: PoC }> = ({ poc }) => {
  const {
    setActivePoC,
    buyTokens,
    setGlobalNotification,
    openFuelModal,
    isWatched,
    toggleWatchlist,
    openCompareModal,
  } = useApp();

  const [isQuickBuying, setIsQuickBuying] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Price-pump animation state
  const [isPumping, setIsPumping] = useState(false);
  const [pumpTrade, setPumpTrade] = useState<Trade | null>(null);
  const [pumpKey, setPumpKey] = useState(0);

  const prevLatestTradeIdRef = useRef<string | null>(poc.trades?.[0]?.id || null);
  const prevTradesCountRef = useRef<number>(poc.trades?.length || 0);
  const prevSolPooledRef = useRef<number>(poc.currentSolPooled);
  const isInitialMountRef = useRef<boolean>(true);
  const pumpTimeoutRef = useRef<any>(null);

  // Detect whenever a new transaction is recorded for this specific PoC
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevLatestTradeIdRef.current = poc.trades?.[0]?.id || null;
      prevTradesCountRef.current = poc.trades?.length || 0;
      prevSolPooledRef.current = poc.currentSolPooled;
      return;
    }

    const latestTrade = poc.trades?.[0];
    const latestTradeId = latestTrade?.id || null;
    const currentTradesCount = poc.trades?.length || 0;

    // Check if a new transaction was recorded:
    // 1. New trade ID at the head of the trades array
    // 2. Count of trades increased
    // 3. Current pooled SOL increased noticeably
    const hasNewTradeRecord =
      Boolean(latestTradeId) &&
      (latestTradeId !== prevLatestTradeIdRef.current || currentTradesCount > prevTradesCountRef.current);
    const hasLiquidityPump = poc.currentSolPooled > prevSolPooledRef.current + 0.0001;

    if (hasNewTradeRecord || hasLiquidityPump) {
      if (pumpTimeoutRef.current) {
        clearTimeout(pumpTimeoutRef.current);
      }
      setPumpTrade(latestTrade || null);
      setIsPumping(true);
      setPumpKey((prev) => prev + 1);

      pumpTimeoutRef.current = setTimeout(() => {
        setIsPumping(false);
      }, 1700);
    }

    prevLatestTradeIdRef.current = latestTradeId;
    prevTradesCountRef.current = currentTradesCount;
    prevSolPooledRef.current = poc.currentSolPooled;
  }, [poc.trades, poc.currentSolPooled]);

  useEffect(() => {
    return () => {
      if (pumpTimeoutRef.current) {
        clearTimeout(pumpTimeoutRef.current);
      }
    };
  }, []);

  const isGraduated = poc.isGraduated || poc.bondingCurveProgress >= 100;
  const watched = isWatched(poc.id);

  const handleQuickBuy = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsQuickBuying(true);

    // Instant optimistic price-pump flash animation
    setIsPumping(true);
    setPumpTrade({
      id: 'tx-opt-' + Date.now(),
      pocId: poc.id,
      type: 'buy',
      user: {
        address: 'Tú',
        name: 'Tú',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      },
      solAmount: 0.2,
      tokenAmount: 0,
      tokenPrice: poc.tokenPriceSol,
      timestamp: Date.now(),
      txHash: 'APE-0.2',
    });
    setPumpKey((prev) => prev + 1);
    if (pumpTimeoutRef.current) clearTimeout(pumpTimeoutRef.current);
    pumpTimeoutRef.current = setTimeout(() => setIsPumping(false), 1700);

    buyTokens(poc.id, 0.2, 5);
    setTimeout(() => setIsQuickBuying(false), 800);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}${window.location.pathname}?poc=${poc.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${poc.title} (${poc.ticker}) on PromptPump`,
          text: `Check out this AI-prompted Proof of Concept: "${poc.prompt.slice(0, 80)}..."`,
          url: shareUrl,
        });
        setGlobalNotification(`🔗 Shared ${poc.ticker}!`);
        setTimeout(() => setGlobalNotification(null), 3500);
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setGlobalNotification(`🔗 Link copied to clipboard for ${poc.ticker}!`);
      setTimeout(() => {
        setIsCopied(false);
        setGlobalNotification(null);
      }, 2500);
    } catch {
      setGlobalNotification(`Could not copy URL`);
    }
  };

  return (
    <div
      onClick={() => setActivePoC(poc)}
      className={`group relative bg-[#0a0e17] dark:bg-[#0a0e17] light:bg-white border rounded-2xl p-4 sm:p-5 transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden ${
        isPumping
          ? 'border-emerald-500/80 ring-2 ring-emerald-400/50 shadow-2xl shadow-emerald-500/25 scale-[1.01]'
          : 'border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 hover:border-slate-700 dark:hover:border-slate-700 light:hover:border-slate-300 hover:shadow-2xl hover:shadow-cyan-950/20 dark:hover:shadow-cyan-950/20 light:hover:shadow-slate-200'
      }`}
    >
      {/* Subtle Price-Pump Green Flash Overlay */}
      {isPumping && (
        <div
          key={`price-pump-overlay-${pumpKey}`}
          className="pointer-events-none absolute inset-0 z-20 rounded-2xl overflow-hidden animate-price-pump"
        >
          {/* Ambient Green Flash Gradient Wash */}
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/20 via-emerald-400/10 to-transparent mix-blend-screen" />

          {/* Radial Center Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(16,185,129,0.3)_0%,rgba(5,150,105,0.08)_50%,transparent_80%)]" />

          {/* Glowing Neon Border Ring Aura */}
          <div className="absolute inset-0 rounded-2xl border-2 border-emerald-400/80 shadow-[inset_0_0_24px_rgba(16,185,129,0.35),0_0_30px_rgba(16,185,129,0.3)] animate-price-pump-ring" />

          {/* Subtle Floating Price-Pump Micro Badge */}
          <div className="absolute top-3 right-3 animate-pump-badge">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/95 border border-emerald-400/80 shadow-xl shadow-emerald-950/80 text-emerald-300 font-mono text-[10px] font-extrabold backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span>
                {pumpTrade?.type === 'injection'
                  ? `+${formatSol(pumpTrade.solAmount, 1)} SOL INY`
                  : pumpTrade?.type === 'sell'
                  ? `-${formatSol(pumpTrade.solAmount, 2)} SOL TX`
                  : `+${formatSol(pumpTrade?.solAmount || 0.2, 1)} SOL PUMP!`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Header: Creator info & Quick Action Toolbar */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          {/* Creator Profile */}
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={poc.creator.avatar}
              alt={poc.creator.name}
              className="w-8 h-8 rounded-full border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 object-cover shrink-0"
            />
            <div className="min-w-0 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200 dark:text-slate-200 light:text-slate-900 truncate">
                <span className="truncate">{poc.creator.name}</span>
                {poc.creator.graduatedCount && poc.creator.graduatedCount > 0 && (
                  <span title="Graduated Creator">
                    <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0" />
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 font-mono truncate">
                {poc.creator.handle}
              </div>
            </div>
          </div>

          {/* Top Actions: Category & Utilities (Watchlist, Compare, Share) */}
          <div className="flex items-center gap-1 shrink-0">
            {isGraduated ? (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30">
                GRADUATED
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 dark:text-slate-400 light:text-slate-500 font-mono hidden sm:inline">
                {poc.category}
              </span>
            )}

            {/* Watchlist Star Toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleWatchlist(poc.id);
              }}
              title={watched ? 'Remove from My Watchlist' : 'Add to My Watchlist'}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                watched
                  ? 'bg-amber-400/20 text-amber-400 border-amber-400/40 shadow-sm shadow-amber-400/20'
                  : 'bg-slate-900/80 dark:bg-slate-900/80 light:bg-slate-100 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border-slate-800 dark:border-slate-800 light:border-slate-300'
              }`}
            >
              <Star
                className={`w-3.5 h-3.5 transition-transform ${
                  watched ? 'fill-amber-400 text-amber-400 scale-110' : ''
                }`}
              />
            </button>

            {/* Split-View Compare */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openCompareModal(poc.id);
              }}
              title={`Compare ${poc.ticker} side-by-side (Split-View)`}
              className="p-1.5 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-300 bg-slate-900/80 dark:bg-slate-900/80 light:bg-slate-100 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition cursor-pointer flex items-center justify-center active:scale-95"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>

            {/* Share Button */}
            <button
              type="button"
              onClick={handleShare}
              title="Share PoC (Direct URL)"
              className="p-1.5 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-300 bg-slate-900/80 dark:bg-slate-900/80 light:bg-slate-100 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer flex items-center justify-center active:scale-95"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Project Title & Ticker Badge */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-bold text-base text-white dark:text-white light:text-slate-900 group-hover:text-emerald-400 dark:group-hover:text-emerald-400 light:group-hover:text-emerald-600 transition truncate">
              {poc.title}
            </h3>
            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 dark:text-emerald-400 light:text-emerald-700 border border-emerald-500/30 shrink-0">
              ${poc.ticker}
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-600 line-clamp-2 leading-relaxed">
            {poc.tagline}
          </p>
        </div>

        {/* Active Prompt Code Snippet */}
        <div className="bg-black/60 dark:bg-black/60 light:bg-slate-50 border border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 rounded-xl p-2.5 font-mono text-[11px] text-slate-300 dark:text-slate-300 light:text-slate-700">
          <div className="flex items-center justify-between text-slate-500 text-[10px] mb-1">
            <span className="flex items-center gap-1 text-emerald-400 dark:text-emerald-400 light:text-emerald-600 font-semibold">
              <Sparkles className="w-3 h-3" />
              <span>Prompt {poc.promptHistory[poc.promptHistory.length - 1]?.version || 'v1.0'}</span>
            </span>
            <span>{poc.promptHistory.length} iteration{poc.promptHistory.length > 1 ? 's' : ''}</span>
          </div>
          <p className="line-clamp-2 italic text-slate-300 dark:text-slate-300 light:text-slate-700">
            "{poc.prompt}"
          </p>
        </div>

        {/* AI Compute Engine & Quick Fuel Bar */}
        <div className="flex items-center justify-between bg-slate-950/60 dark:bg-slate-950/60 light:bg-slate-100/80 border border-slate-800/60 dark:border-slate-800/60 light:border-slate-200 rounded-xl px-3 py-1.5 text-[11px] font-mono">
          <div className="flex items-center gap-1.5 text-amber-300 dark:text-amber-300 light:text-amber-800 font-semibold truncate">
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
            <span className="truncate">
              {formatTokenCount(poc.openRouterFuel?.totalTokensRemaining || 2500000)} AI Tokens
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openFuelModal(poc);
            }}
            title="Inyectar tokens OpenRouter a este creador"
            className="text-[10px] text-amber-400 dark:text-amber-300 light:text-amber-800 hover:text-white bg-amber-400/10 hover:bg-amber-400/30 border border-amber-400/30 px-2 py-0.5 rounded transition cursor-pointer font-bold shrink-0"
          >
            + Inyectar
          </button>
        </div>

        {/* Mini Sparkline Chart */}
        <MiniSparkline poc={poc} />

        {/* Real-time Social Sentiment Gauge */}
        <SocialSentimentGauge poc={poc} />
      </div>

      {/* Card Footer: Bonding Curve Progress, Metrics, and Action Buttons */}
      <div className="mt-4 pt-3.5 border-t border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 space-y-3">
        {/* Bonding Curve Bar */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
            <span className="text-slate-400 dark:text-slate-400 light:text-slate-500 flex items-center gap-1.5">
              <span>Curva de Graduación</span>
              {isPumping && (
                <span className="inline-flex items-center text-[9px] text-emerald-300 font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 animate-pulse">
                  ⚡ PUMP
                </span>
              )}
            </span>
            <span
              className={`font-bold transition-all duration-300 ${
                isPumping
                  ? 'text-emerald-300 font-extrabold scale-110 drop-shadow-[0_0_10px_rgba(52,211,153,0.9)]'
                  : 'text-emerald-400 dark:text-emerald-400 light:text-emerald-600'
              }`}
            >
              {poc.bondingCurveProgress.toFixed(1)}%
            </span>
          </div>
          <div
            className={`w-full bg-slate-950 dark:bg-slate-950 light:bg-slate-200 rounded-full h-2 overflow-hidden border transition-all duration-300 ${
              isPumping
                ? 'border-emerald-400/80 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                : 'border-slate-800 dark:border-slate-800 light:border-slate-300'
            }`}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isPumping ? 'brightness-125 saturate-150 shadow-[0_0_12px_rgba(52,211,153,0.8)]' : ''
              } ${
                isGraduated
                  ? 'bg-gradient-to-r from-amber-400 to-emerald-400'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400'
              }`}
              style={{ width: `${Math.min(100, poc.bondingCurveProgress)}%` }}
            />
          </div>
        </div>

        {/* Financial Metrics Strip */}
        <div className="grid grid-cols-3 gap-2 bg-slate-950/80 dark:bg-slate-950/80 light:bg-slate-100/80 p-2.5 rounded-xl border border-slate-900 dark:border-slate-900 light:border-slate-200 text-center font-mono text-xs">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">Market Cap</span>
            <span className="text-white dark:text-white light:text-slate-900 font-bold">
              {formatUsd(poc.marketCapUsd)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">Vol 24h</span>
            <span className="text-slate-200 dark:text-slate-200 light:text-slate-700 font-semibold">
              {formatSol(poc.volume24hSol, 1)} SOL
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">Holders</span>
            <span className="text-slate-200 dark:text-slate-200 light:text-slate-700 font-semibold flex items-center justify-center gap-1">
              <Users className="w-3 h-3 text-slate-400" />
              {poc.holdersCount}
            </span>
          </div>
        </div>

        {/* Clean Interactive Action Buttons */}
        <div className="grid grid-cols-12 gap-2 pt-1">
          {/* Primary Action: Play / Inspect PoC */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActivePoC(poc);
            }}
            className="col-span-6 bg-slate-800 hover:bg-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 light:bg-slate-900 light:hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-700 dark:border-slate-700 light:border-slate-900 shadow-sm active:scale-95 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Probar PoC</span>
          </button>

          {/* Secondary Action: Fuel AI Compute */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openFuelModal(poc);
            }}
            title="Patrocinar tokens OpenRouter para acelerar el desarrollo del prompt"
            className="col-span-3 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 dark:text-amber-300 light:text-amber-800 border border-amber-400/30 hover:border-amber-400 font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>Fuel</span>
          </button>

          {/* Quick Buy: Ape 0.2 SOL */}
          <button
            type="button"
            onClick={handleQuickBuy}
            disabled={isQuickBuying}
            title="Compra rápida de 0.2 SOL en la curva de vinculación"
            className="col-span-3 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/40 font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{isQuickBuying ? '...' : 'Ape 0.2'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
