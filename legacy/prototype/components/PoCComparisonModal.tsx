import React, { useState } from 'react';
import {
  X,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Zap,
  Users,
  CheckCircle2,
  BarChart3,
  Flame,
  Star,
  Activity,
  Trophy,
  Play,
  Share2,
  Check,
  ChevronDown,
  Search,
} from 'lucide-react';
import { PoC } from '../types';
import { useApp } from '../context/AppContext';
import { formatSol, formatUsd, formatTokens } from '../utils/bondingCurve';
import { calculateSocialSentiment } from '../utils/sentiment';
import { formatTokenCount } from '../utils/openrouter';
import { MiniSparkline } from './MiniSparkline';

interface PoCComparisonModalProps {
  onClose: () => void;
}

export const PoCComparisonModal: React.FC<PoCComparisonModalProps> = ({ onClose }) => {
  const {
    pocs,
    comparePoCIds,
    setComparePoC,
    swapComparePoCs,
    setActivePoC,
    openFuelModal,
    isWatched,
    toggleWatchlist,
  } = useApp();

  const [searchLeft, setSearchLeft] = useState('');
  const [searchRight, setSearchRight] = useState('');
  const [isSelectingLeft, setIsSelectingLeft] = useState(false);
  const [isSelectingRight, setIsSelectingRight] = useState(false);
  const [copiedPocId, setCopiedPocId] = useState<string | null>(null);

  // Retrieve current two PoCs
  const poc1 = pocs.find((p) => p.id === comparePoCIds[0]) || pocs[0] || null;
  const poc2 =
    pocs.find((p) => p.id === comparePoCIds[1]) ||
    pocs.find((p) => p.id !== poc1?.id) ||
    pocs[1] ||
    null;

  if (!poc1 || !poc2) return null;

  const sentiment1 = calculateSocialSentiment(poc1);
  const sentiment2 = calculateSocialSentiment(poc2);

  // Compare metrics to calculate leaders
  const curveLeader =
    poc1.bondingCurveProgress > poc2.bondingCurveProgress
      ? poc1
      : poc2.bondingCurveProgress > poc1.bondingCurveProgress
      ? poc2
      : null;

  const volumeLeader =
    poc1.volume24hSol > poc2.volume24hSol
      ? poc1
      : poc2.volume24hSol > poc1.volume24hSol
      ? poc2
      : null;

  const sentimentLeader =
    sentiment1.score > sentiment2.score
      ? poc1
      : sentiment2.score > sentiment1.score
      ? poc2
      : null;

  const holdersLeader =
    poc1.holdersCount > poc2.holdersCount
      ? poc1
      : poc2.holdersCount > poc1.holdersCount
      ? poc2
      : null;

  const priceGainLeader =
    poc1.priceChange24h > poc2.priceChange24h
      ? poc1
      : poc2.priceChange24h > poc1.priceChange24h
      ? poc2
      : null;

  const handleShare = (poc: PoC) => {
    const url = `${window.location.origin}${window.location.pathname}?poc=${poc.id}`;
    navigator.clipboard.writeText(url);
    setCopiedPocId(poc.id);
    setTimeout(() => setCopiedPocId(null), 2000);
  };

  const filteredPocsLeft = pocs.filter(
    (p) =>
      p.id !== poc2.id &&
      (p.title.toLowerCase().includes(searchLeft.toLowerCase()) ||
        p.ticker.toLowerCase().includes(searchLeft.toLowerCase()) ||
        p.category.toLowerCase().includes(searchLeft.toLowerCase()))
  );

  const filteredPocsRight = pocs.filter(
    (p) =>
      p.id !== poc1.id &&
      (p.title.toLowerCase().includes(searchRight.toLowerCase()) ||
        p.ticker.toLowerCase().includes(searchRight.toLowerCase()) ||
        p.category.toLowerCase().includes(searchRight.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl my-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="px-5 py-4 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-indigo-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <ArrowLeftRight className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  <span>PoC Head-to-Head Split-View</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                    Live Compare
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Compare bonding curve performance, 24h volume, viral sentiment, and AI fuel side-by-side
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={swapComparePoCs}
              title="Intercambiar lados de comparación"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 text-xs font-mono font-bold transition active:scale-95 cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Swap Sides</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-white transition active:scale-95 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Alpha Leaderboard Summary Banner */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/20 rounded-2xl p-3 sm:p-4 shadow-inner">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 font-mono">
                Head-to-Head Alpha Radar
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {/* Curve Progress Leader */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 block font-mono">Curve Progress</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs font-black text-cyan-400">
                    {curveLeader ? `$${curveLeader.ticker}` : 'Tied'}
                  </span>
                  {curveLeader && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({curveLeader.bondingCurveProgress.toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>

              {/* 24h Volume Leader */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 block font-mono">24h Volume</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs font-black text-emerald-400">
                    {volumeLeader ? `$${volumeLeader.ticker}` : 'Tied'}
                  </span>
                  {volumeLeader && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({formatSol(volumeLeader.volume24hSol, 1)} SOL)
                    </span>
                  )}
                </div>
              </div>

              {/* Social Sentiment Leader */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 block font-mono">Social Virality</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs font-black text-amber-400">
                    {sentimentLeader ? `$${sentimentLeader.ticker}` : 'Tied'}
                  </span>
                  {sentimentLeader && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({sentimentLeader.id === poc1.id ? sentiment1.score : sentiment2.score}/100)
                    </span>
                  )}
                </div>
              </div>

              {/* Holders Leader */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 block font-mono">Token Holders</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs font-black text-indigo-400">
                    {holdersLeader ? `$${holdersLeader.ticker}` : 'Tied'}
                  </span>
                  {holdersLeader && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({holdersLeader.holdersCount})
                    </span>
                  )}
                </div>
              </div>

              {/* Price Momentum Leader */}
              <div className="col-span-2 sm:col-span-1 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 block font-mono">24h Gain</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs font-black text-lime-400">
                    {priceGainLeader ? `$${priceGainLeader.ticker}` : 'Tied'}
                  </span>
                  {priceGainLeader && (
                    <span className="text-[10px] text-emerald-400 font-mono">
                      (+{priceGainLeader.priceChange24h.toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Side-by-Side Dual Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            {/* Center VS Badge on Desktop */}
            <div className="hidden md:flex absolute left-1/2 top-14 -translate-x-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-slate-950 border-2 border-cyan-500/50 items-center justify-center font-mono font-black text-xs text-cyan-400 shadow-xl shadow-cyan-500/20">
              VS
            </div>

            {/* Left Column (PoC 1) */}
            <div className="space-y-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 sm:p-5">
              {/* Header & Selector */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                    Primary Candidate (Slot A)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleWatchlist(poc1.id)}
                      title={isWatched(poc1.id) ? 'Remove from Watchlist' : 'Add to Watchlist'}
                      className={`p-1.5 rounded-lg border transition cursor-pointer ${
                        isWatched(poc1.id)
                          ? 'bg-amber-400/20 border-amber-400 text-amber-400'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-amber-400'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${isWatched(poc1.id) ? 'fill-amber-400' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleShare(poc1)}
                      title="Copy PoC Link"
                      className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      {copiedPocId === poc1.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Dropdown Selector */}
                <div className="relative">
                  <button
                    onClick={() => setIsSelectingLeft(!isSelectingLeft)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-left transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-mono font-bold text-xs text-cyan-400 shrink-0">
                        ${poc1.ticker.slice(0, 3)}
                      </div>
                      <div className="truncate">
                        <div className="text-sm font-bold text-white truncate">{poc1.title}</div>
                        <div className="text-[11px] text-cyan-400 font-mono font-bold">${poc1.ticker}</div>
                      </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>

                  {/* Dropdown Menu */}
                  {isSelectingLeft && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-30 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 max-h-60 overflow-y-auto space-y-1">
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search candidate..."
                          value={searchLeft}
                          onChange={(e) => setSearchLeft(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      {filteredPocsLeft.map((candidate) => (
                        <button
                          key={candidate.id}
                          onClick={() => {
                            setComparePoC(0, candidate.id);
                            setIsSelectingLeft(false);
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                        >
                          <span className="truncate font-semibold">{candidate.title}</span>
                          <span className="font-mono text-cyan-400 font-bold ml-2 shrink-0">${candidate.ticker}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tagline & Badge */}
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {poc1.tagline}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
                    {poc1.category}
                  </span>
                  {poc1.isGraduated ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Raydium DEX Graduated
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                      Bonding Curve Active
                    </span>
                  )}
                </div>
              </div>

              {/* Sparkline & Price Metric */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Price & Trend</span>
                  <span className={`text-xs font-mono font-bold flex items-center gap-1 ${poc1.priceChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {poc1.priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {poc1.priceChange24h >= 0 ? '+' : ''}{poc1.priceChange24h.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <div className="text-base font-black font-mono text-white">
                    {formatSol(poc1.tokenPriceSol, 6)} SOL
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Mkt Cap: {formatUsd(poc1.marketCapUsd)}
                  </div>
                </div>
                <div className="pt-1">
                  <MiniSparkline poc={poc1} />
                </div>
              </div>

              {/* Bonding Curve Section */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Bonding Curve Metrics</span>
                  </div>
                  <span className="text-xs font-mono font-black text-cyan-400">
                    {poc1.bondingCurveProgress.toFixed(1)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(5, poc1.bondingCurveProgress))}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">SOL Pooled</span>
                    <span className="font-bold text-white">{formatSol(poc1.currentSolPooled, 2)} / {poc1.targetMarketCapSol} SOL</span>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">Tokens In Curve</span>
                    <span className="font-bold text-white">{formatTokens(poc1.tokensSold)}</span>
                  </div>
                </div>
              </div>

              {/* Volume & Social Sentiment */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>Social Virality & Volume</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {sentiment1.emoji} {sentiment1.score}/100
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">24h Volume</span>
                    <span className="font-bold text-emerald-400">{formatSol(poc1.volume24hSol, 2)} SOL</span>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">Holders</span>
                    <span className="font-bold text-indigo-400">{poc1.holdersCount} Wallets</span>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">Twitter / X 24h</span>
                    <span className="font-bold text-white">{sentiment1.twitterMetrics.mentions24h} Mentions</span>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">Sentiment Ratio</span>
                    <span className="font-bold text-cyan-400">{sentiment1.twitterMetrics.bullishTweetsPercent}% Bullish</span>
                  </div>
                </div>
              </div>

              {/* AI Compute Engine */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-2">
                <div className="truncate">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span>OpenRouter AI Engine</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 truncate block mt-0.5">
                    {poc1.openRouterFuel?.activeModel || 'anthropic/claude-3.5-sonnet'}
                  </span>
                </div>
                <button
                  onClick={() => openFuelModal(poc1)}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/40 text-amber-300 font-mono text-xs font-bold transition active:scale-95 cursor-pointer shrink-0"
                >
                  ⚡ Fuel PoC
                </button>
              </div>

              {/* Column Actions */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    onClose();
                    setActivePoC(poc1);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Activity className="w-3.5 h-3.5" />
                  Trade & Full Overview
                </button>
              </div>
            </div>

            {/* Right Column (PoC 2) */}
            <div className="space-y-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 sm:p-5">
              {/* Header & Selector */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                    Competitor Candidate (Slot B)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleWatchlist(poc2.id)}
                      title={isWatched(poc2.id) ? 'Remove from Watchlist' : 'Add to Watchlist'}
                      className={`p-1.5 rounded-lg border transition cursor-pointer ${
                        isWatched(poc2.id)
                          ? 'bg-amber-400/20 border-amber-400 text-amber-400'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-amber-400'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${isWatched(poc2.id) ? 'fill-amber-400' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleShare(poc2)}
                      title="Copy PoC Link"
                      className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      {copiedPocId === poc2.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Dropdown Selector */}
                <div className="relative">
                  <button
                    onClick={() => setIsSelectingRight(!isSelectingRight)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/40 text-left transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center font-mono font-bold text-xs text-purple-400 shrink-0">
                        ${poc2.ticker.slice(0, 3)}
                      </div>
                      <div className="truncate">
                        <div className="text-sm font-bold text-white truncate">{poc2.title}</div>
                        <div className="text-[11px] text-purple-400 font-mono font-bold">${poc2.ticker}</div>
                      </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>

                  {/* Dropdown Menu */}
                  {isSelectingRight && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-30 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 max-h-60 overflow-y-auto space-y-1">
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search candidate..."
                          value={searchRight}
                          onChange={(e) => setSearchRight(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      {filteredPocsRight.map((candidate) => (
                        <button
                          key={candidate.id}
                          onClick={() => {
                            setComparePoC(1, candidate.id);
                            setIsSelectingRight(false);
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                        >
                          <span className="truncate font-semibold">{candidate.title}</span>
                          <span className="font-mono text-purple-400 font-bold ml-2 shrink-0">${candidate.ticker}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tagline & Badge */}
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {poc2.tagline}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
                    {poc2.category}
                  </span>
                  {poc2.isGraduated ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Raydium DEX Graduated
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                      Bonding Curve Active
                    </span>
                  )}
                </div>
              </div>

              {/* Sparkline & Price Metric */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Price & Trend</span>
                  <span className={`text-xs font-mono font-bold flex items-center gap-1 ${poc2.priceChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {poc2.priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {poc2.priceChange24h >= 0 ? '+' : ''}{poc2.priceChange24h.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <div className="text-base font-black font-mono text-white">
                    {formatSol(poc2.tokenPriceSol, 6)} SOL
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Mkt Cap: {formatUsd(poc2.marketCapUsd)}
                  </div>
                </div>
                <div className="pt-1">
                  <MiniSparkline poc={poc2} />
                </div>
              </div>

              {/* Bonding Curve Section */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                    <span>Bonding Curve Metrics</span>
                  </div>
                  <span className="text-xs font-mono font-black text-purple-400">
                    {poc2.bondingCurveProgress.toFixed(1)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(5, poc2.bondingCurveProgress))}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">SOL Pooled</span>
                    <span className="font-bold text-white">{formatSol(poc2.currentSolPooled, 2)} / {poc2.targetMarketCapSol} SOL</span>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">Tokens In Curve</span>
                    <span className="font-bold text-white">{formatTokens(poc2.tokensSold)}</span>
                  </div>
                </div>
              </div>

              {/* Volume & Social Sentiment */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>Social Virality & Volume</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {sentiment2.emoji} {sentiment2.score}/100
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">24h Volume</span>
                    <span className="font-bold text-emerald-400">{formatSol(poc2.volume24hSol, 2)} SOL</span>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">Holders</span>
                    <span className="font-bold text-indigo-400">{poc2.holdersCount} Wallets</span>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">Twitter / X 24h</span>
                    <span className="font-bold text-white">{sentiment2.twitterMetrics.mentions24h} Mentions</span>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">Sentiment Ratio</span>
                    <span className="font-bold text-purple-400">{sentiment2.twitterMetrics.bullishTweetsPercent}% Bullish</span>
                  </div>
                </div>
              </div>

              {/* AI Compute Engine */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-2">
                <div className="truncate">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span>OpenRouter AI Engine</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 truncate block mt-0.5">
                    {poc2.openRouterFuel?.activeModel || 'meta-llama/llama-3.1-70b-instruct'}
                  </span>
                </div>
                <button
                  onClick={() => openFuelModal(poc2)}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/40 text-amber-300 font-mono text-xs font-bold transition active:scale-95 cursor-pointer shrink-0"
                >
                  ⚡ Fuel PoC
                </button>
              </div>

              {/* Column Actions */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    onClose();
                    setActivePoC(poc2);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Activity className="w-3.5 h-3.5" />
                  Trade & Full Overview
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px]">Real-time Solana Bonding Curve Oracle Sync active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition cursor-pointer text-xs"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
