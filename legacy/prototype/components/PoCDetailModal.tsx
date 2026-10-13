import React, { useState } from 'react';
import { PoC } from '../types';
import { useApp } from '../context/AppContext';
import {
  X,
  Play,
  Sparkles,
  RotateCcw,
  Maximize2,
  ExternalLink,
  Send,
  MessageSquare,
  TrendingUp,
  ShieldCheck,
  Zap,
  CheckCircle,
  CheckCircle2,
  HelpCircle,
  Clock,
  Layers,
  Flame,
  Users,
  Share2,
  Bell,
  BellRing,
  Copy,
  Check,
  Star,
  ArrowLeftRight,
} from 'lucide-react';
import {
  calculateTokensForSol,
  calculateSolForTokens,
  formatSol,
  formatTokens,
  formatUsd,
  TARGET_SOL,
} from '../utils/bondingCurve';
import { TopHoldersSection } from './TopHoldersSection';
import { RecentActivityTicker } from './RecentActivityTicker';
import { MilestoneAlertsModal } from './MilestoneAlertsModal';
import { SocialSentimentWidget } from './SocialSentimentWidget';
import { TradeHistoryTable } from './TradeHistoryTable';
import { formatSolanaAddress, getSolanaExplorerUrl } from '../utils/solana';
import { formatTokenCount } from '../utils/openrouter';

export const PoCDetailModal: React.FC<{ poc: PoC; onClose: () => void }> = ({ poc, onClose }) => {
  const {
    pocs,
    wallet,
    buyTokens,
    sellTokens,
    iteratePoC,
    addComment,
    setGlobalNotification,
    alerts,
    toggleAlerts,
    solanaCluster,
    openFuelModal,
    isWatched,
    toggleWatchlist,
    openCompareModal,
  } = useApp();

  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [isCreatorAddressCopied, setIsCreatorAddressCopied] = useState(false);
  const currentAlertConfig = alerts[poc.id];
  const isAlertsActive = currentAlertConfig?.enabled || false;

  const handleCopyCreatorAddress = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(poc.creator.address);
      setIsCreatorAddressCopied(true);
      setGlobalNotification(`📋 Copied creator Solana wallet address: ${poc.creator.address}`);
      setTimeout(() => {
        setIsCreatorAddressCopied(false);
        setGlobalNotification(null);
      }, 3500);
    } catch (err) {
      console.error('Failed to copy creator address', err);
    }
  };

  // Verified creator: graduated more than 3 PoCs to the bonding curve
  const graduatedInPlatform = pocs.filter(
    (p) =>
      (p.creator.handle === poc.creator.handle || p.creator.address === poc.creator.address) &&
      (p.isGraduated || p.bondingCurveProgress >= 100)
  ).length;
  const totalGraduated = (poc.creator.graduatedCount || 0) + graduatedInPlatform;
  const isVerifiedCreator = totalGraduated > 3;

  // Tabs on left
  const [activeLeftTab, setActiveLeftTab] = useState<'sandbox' | 'prompt' | 'holders' | 'trades' | 'specs' | 'history' | 'sentiment'>('sandbox');

  // Tabs on right
  const [activeRightTab, setActiveRightTab] = useState<'trade' | 'trades' | 'holders' | 'trollbox' | 'bounties'>('trade');

  // Trade terminal state
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [solAmountInput, setSolAmountInput] = useState<string>('0.5');
  const [tokenAmountInput, setTokenAmountInput] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(5);
  const [tradeFeedback, setTradeFeedback] = useState<{ message: string; isError: boolean } | null>(null);
  const [isTrading, setIsTrading] = useState<boolean>(false);

  // Prompt iteration state
  const [iterationPrompt, setIterationPrompt] = useState<string>('');
  const [isIterating, setIsIterating] = useState<boolean>(false);
  const [iterationError, setIterationError] = useState<string | null>(null);

  // Trollbox input state
  const [commentInput, setCommentInput] = useState<string>('');
  const [isSuggestionCheck, setIsSuggestionCheck] = useState<boolean>(false);

  // Iframe sandbox refresh key
  const [iframeKey, setIframeKey] = useState<number>(1);
  const [isFullscreenSandbox, setIsFullscreenSandbox] = useState<boolean>(false);

  // User holdings for this PoC
  const userHolding = wallet.holdings[poc.id];
  const userTokenBalance = userHolding ? userHolding.tokenAmount : 0;

  // Real-time calculations for swap
  const solNum = parseFloat(solAmountInput) || 0;
  const tokenNum = parseFloat(tokenAmountInput) || 0;

  const buyCalculation = calculateTokensForSol(poc.currentSolPooled, solNum);
  const sellCalculation = calculateSolForTokens(poc.currentSolPooled, tokenNum);

  // Execute Buy
  const handleBuy = () => {
    if (solNum <= 0) return;
    setIsTrading(true);
    setTradeFeedback(null);

    const result = buyTokens(poc.id, solNum, slippage);
    setIsTrading(false);

    if (result.success) {
      setTradeFeedback({
        message: `Success! Received ${formatTokens(result.tokensOut || 0)} ${poc.ticker}`,
        isError: false,
      });
    } else {
      setTradeFeedback({ message: result.message, isError: true });
    }
  };

  // Execute Sell
  const handleSell = () => {
    if (tokenNum <= 0) return;
    setIsTrading(true);
    setTradeFeedback(null);

    const result = sellTokens(poc.id, tokenNum, slippage);
    setIsTrading(false);

    if (result.success) {
      setTradeFeedback({
        message: `Success! Sold tokens for ${formatSol(result.solOut || 0)} SOL`,
        isError: false,
      });
      setTokenAmountInput('');
    } else {
      setTradeFeedback({ message: result.message, isError: true });
    }
  };

  // Execute Prompt Iteration (Calls Gemini API via iteratePoC)
  const handleIteratePrompt = async (promptToUse?: string) => {
    const text = promptToUse || iterationPrompt;
    if (!text.trim()) return;

    setIsIterating(true);
    setIterationError(null);

    try {
      await iteratePoC(poc.id, text.trim());
      setIterationPrompt('');
      setActiveLeftTab('sandbox');
      setIframeKey((prev) => prev + 1);
    } catch (err: any) {
      setIterationError(err.message || 'Failed to iterate prompt with Gemini.');
    } finally {
      setIsIterating(false);
    }
  };

  // Send Trollbox message
  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    addComment(poc.id, commentInput.trim(), isSuggestionCheck);
    setCommentInput('');
    setIsSuggestionCheck(false);
  };

  // Copy/Share unique link for this PoC
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?poc=${poc.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${poc.title} (${poc.ticker}) on PromptPump`,
          text: `Check out this AI Proof-of-Concept: "${poc.prompt.slice(0, 90)}..."`,
          url: shareUrl,
        });
        setGlobalNotification(`🔗 Shared ${poc.ticker}!`);
        setTimeout(() => setGlobalNotification(null), 3500);
        return;
      } catch (e) {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setGlobalNotification(`🔗 Unique URL copied! Link to ${poc.title} (${poc.ticker})`);
      setTimeout(() => setGlobalNotification(null), 3500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const isGraduated = poc.bondingCurveProgress >= 100 || poc.isGraduated;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-7xl max-h-[94vh] bg-[#0c1017] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Top Header */}
        <div className="bg-[#090d14] px-4 sm:px-6 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-xl shadow">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-mono">{poc.title}</h2>
                <span className="font-mono font-extrabold text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {poc.ticker}
                </span>
                <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-mono">
                  {poc.category}
                </span>
                {isGraduated && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-bold font-mono">
                    🎓 GRADUATED TO MAINNET
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span>By {poc.creator.name} ({poc.creator.handle})</span>
                  {isVerifiedCreator && (
                    <span
                      title={`Verified Creator: ${totalGraduated} PoCs graduated to bonding curve`}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 text-[9px] font-mono font-bold tracking-tight shadow-sm shadow-cyan-500/10"
                    >
                      <CheckCircle2 className="w-2.5 h-2.5 text-cyan-400 fill-cyan-400/20" />
                      <span>Verified Creator</span>
                    </span>
                  )}
                </span>
                <span>•</span>

                {/* Copy Creator Address Button */}
                <button
                  type="button"
                  onClick={handleCopyCreatorAddress}
                  title={`Copy full Solana creator wallet address: ${poc.creator.address}`}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-mono transition cursor-pointer active:scale-95 ${
                    isCreatorAddressCopied
                      ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/60 shadow-sm shadow-emerald-500/20'
                      : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border-slate-700/80 hover:border-cyan-500/40'
                  }`}
                >
                  {isCreatorAddressCopied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400" />
                  )}
                  <span>{isCreatorAddressCopied ? 'Copied Address!' : `Copy Creator: ${formatSolanaAddress(poc.creator.address)}`}</span>
                </button>

                <a
                  href={getSolanaExplorerUrl(poc.creator.address, 'address', solanaCluster)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View Creator on Solana Explorer"
                  className="p-1 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition border border-slate-800"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>

                <span>•</span>
                <span className="font-mono text-emerald-400">{poc.holdersCount} Backers</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openFuelModal(poc)}
              title="Inyectar Tokens OpenRouter a este creador para acelerar su código en vivo"
              className="flex items-center gap-1.5 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/40 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer shadow-sm active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="hidden md:inline">Tokens OpenRouter:</span>
              <span>{formatTokenCount(poc.openRouterFuel?.totalTokensRemaining || 2500000)}</span>
            </button>

            <button
              onClick={() => setIsAlertsModalOpen(true)}
              title={isAlertsActive ? 'Bonding Curve Milestone Alerts are active' : 'Subscribe to price milestone alerts'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition cursor-pointer border ${
                isAlertsActive
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {isAlertsActive ? (
                <BellRing className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              ) : (
                <Bell className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className="hidden sm:inline">Alerts</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold ${
                  isAlertsActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isAlertsActive ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Watchlist Toggle */}
            <button
              onClick={() => toggleWatchlist(poc.id)}
              title={isWatched(poc.id) ? 'Remove from My Watchlist' : 'Add to My Watchlist'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition cursor-pointer border active:scale-95 ${
                isWatched(poc.id)
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 shadow-sm shadow-amber-400/20 ring-1 ring-amber-400/30'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-amber-400'
              }`}
            >
              <Star
                className={`w-3.5 h-3.5 transition-transform ${
                  isWatched(poc.id) ? 'fill-amber-400 text-amber-400 scale-110' : 'text-slate-400'
                }`}
              />
              <span className="hidden sm:inline">{isWatched(poc.id) ? 'Watched' : 'Watch'}</span>
            </button>

            {/* Split-View Compare Button */}
            <button
              onClick={() => openCompareModal(poc.id)}
              title="Compare this PoC with another (Split-View Mode)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition cursor-pointer border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-white active:scale-95"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">Compare</span>
            </button>

            <button
              onClick={handleShare}
              title="Share PoC (Copy direct URL)"
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-mono transition cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Share PoC</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Real-time Recent Activity Scrolling Ticker */}
        <RecentActivityTicker poc={poc} />

        {/* Modal Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto min-h-0">
          {/* Left Column: Sandbox & Prompt Studio (7 Cols) */}
          <div className="lg:col-span-7 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col p-4 sm:p-5 space-y-4">
            {/* Left Tabs */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => setActiveLeftTab('sandbox')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeLeftTab === 'sandbox'
                      ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Play className={`w-3.5 h-3.5 ${activeLeftTab === 'sandbox' ? 'fill-black' : ''}`} />
                  <span>Live Sandbox Demo</span>
                </button>

                <button
                  onClick={() => setActiveLeftTab('prompt')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeLeftTab === 'prompt'
                      ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Iterate Prompt (AI)</span>
                </button>

                <button
                  onClick={() => setActiveLeftTab('specs')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeLeftTab === 'specs'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Specs</span>
                </button>

                <button
                  onClick={() => setActiveLeftTab('holders')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeLeftTab === 'holders'
                      ? 'bg-amber-400 text-black font-bold shadow-md shadow-amber-400/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Top Holders</span>
                </button>

                <button
                  onClick={() => setActiveLeftTab('trades')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeLeftTab === 'trades'
                      ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-black font-extrabold shadow-md shadow-emerald-400/20'
                      : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-900'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Historial de Trades ({poc.trades?.length || 0})</span>
                </button>

                <button
                  onClick={() => setActiveLeftTab('history')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeLeftTab === 'history'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>History ({poc.promptHistory.length})</span>
                </button>

                <button
                  onClick={() => setActiveLeftTab('sentiment')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeLeftTab === 'sentiment'
                      ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <span className="font-bold text-xs">𝕏</span>
                  <span>Social Sentiment</span>
                </button>
              </div>

              {/* Sandbox controls */}
              {activeLeftTab === 'sandbox' && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIframeKey((k) => k + 1)}
                    title="Reload Sandbox"
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsFullscreenSandbox(!isFullscreenSandbox)}
                    title="Toggle Enlarged View"
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* TAB CONTENT: Live Sandbox */}
            {activeLeftTab === 'sandbox' && (
              <div className="space-y-3 flex-1 flex flex-col">
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col flex-1 shadow-inner relative">
                  {/* Sandbox Toolbar */}
                  <div className="bg-[#080b11] px-3 py-1.5 border-b border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="text-white font-semibold">PoC Virtual Machine Sandbox</span>
                      <span className="text-slate-600">|</span>
                      <span className="text-emerald-400">
                        Version {poc.promptHistory[poc.promptHistory.length - 1]?.version || 'v1.0'}
                      </span>
                    </div>
                    <span className="text-slate-400 text-[10px]">
                      Runs in Isolated DOM
                    </span>
                  </div>

                  {/* Sandboxed Iframe */}
                  <div className={`w-full bg-[#05070a] ${isFullscreenSandbox ? 'h-[580px]' : 'h-[360px] sm:h-[400px]'} transition-all duration-300`}>
                    <iframe
                      key={iframeKey}
                      srcDoc={poc.runnableHtml}
                      title={poc.title}
                      sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
                      className="w-full h-full border-0"
                    />
                  </div>
                </div>

                {/* Active Prompt Info Box under sandbox */}
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-xs font-mono">
                  <div className="flex items-center justify-between text-slate-400 mb-1 text-[11px]">
                    <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Active Prompt Codebase
                    </span>
                    <button
                      onClick={() => setActiveLeftTab('prompt')}
                      className="text-cyan-400 hover:text-cyan-300 underline"
                    >
                      Iterate with new prompt →
                    </button>
                  </div>
                  <p className="text-slate-300 bg-black/60 p-2.5 rounded-lg border border-slate-900">
                    "{poc.prompt}"
                  </p>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Prompt Iteration Studio */}
            {activeLeftTab === 'prompt' && (
              <div className="space-y-4 flex-1">
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span>Prompter Studio: Upgrade {poc.ticker}</span>
                    </h3>
                    <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                      Powered by Gemini 3.8 Flash
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mb-3">
                    As an investor or creator, you can submit new prompt instructions to evolve this Proof of Concept. The AI will immediately re-synthesize the interactive sandbox code!
                  </p>

                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      value={iterationPrompt}
                      onChange={(e) => setIterationPrompt(e.target.value)}
                      placeholder="e.g. Add real-time visual sound frequency graphs, optimize transaction speed benchmark, or implement dark cyber theme..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono resize-none"
                    />

                    {iterationError && (
                      <div className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded-lg border border-rose-800/60">
                        {iterationError}
                      </div>
                    )}

                    <button
                      onClick={() => handleIteratePrompt()}
                      disabled={isIterating || !iterationPrompt.trim()}
                      className="w-full bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-black font-extrabold text-xs py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {isIterating ? (
                        <>
                          <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                          <span>Gemini is Synthesizing New Version...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 fill-black" />
                          <span>Deploy Prompt Iteration ({poc.promptHistory[poc.promptHistory.length - 1]?.version || 'v1.0'} → v{(poc.promptHistory.length + 0.1).toFixed(1)})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Suggested prompt ideas */}
                {poc.iterationIdeas && poc.iterationIdeas.length > 0 && (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Suggested Prompt Directions (1-Click Deploy)
                    </h4>
                    <div className="space-y-2">
                      {poc.iterationIdeas.map((idea, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleIteratePrompt(idea)}
                          className="bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/50 p-2.5 rounded-lg text-xs font-mono text-slate-200 cursor-pointer transition flex items-center justify-between group"
                        >
                          <span className="truncate pr-2">✨ {idea}</span>
                          <span className="text-[10px] text-cyan-400 font-bold shrink-0 opacity-80 group-hover:opacity-100">
                            Apply →
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Specs & Problem Solved */}
            {activeLeftTab === 'specs' && (
              <div className="space-y-4 flex-1">
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Problem Solved
                    </h4>
                    <p className="text-xs text-slate-200 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
                      {poc.problemSolved}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Key Proof-of-Concept Features
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {poc.features.map((feat, i) => (
                        <div key={i} className="flex items-start gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs text-slate-300">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Tech Stack & Runtime
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {poc.techStack.map((tech, i) => (
                        <span key={i} className="text-xs font-mono bg-slate-950 border border-slate-800 text-cyan-300 px-2.5 py-1 rounded-md">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Creator On-Chain Solana Identity Card */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Creator On-Chain Solana Profile
                    </h4>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={poc.creator.avatar}
                            alt={poc.creator.name}
                            className="w-9 h-9 rounded-full object-cover border border-slate-700"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-xs">{poc.creator.name}</span>
                              {isVerifiedCreator && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] font-bold">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-cyan-400" />
                                  <span>Verified</span>
                                </span>
                              )}
                            </div>
                            <span className="text-slate-400 font-mono text-[11px]">{poc.creator.handle}</span>
                          </div>
                        </div>

                        <span className="text-[10px] text-slate-400 font-mono">
                          Graduated: <strong className="text-cyan-400">{totalGraduated} PoCs</strong>
                        </span>
                      </div>

                      <div className="bg-black/60 p-2.5 rounded-lg border border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="overflow-hidden">
                          <span className="text-[10px] text-slate-500 block uppercase">Solana Creator Address</span>
                          <span className="font-mono text-white text-[11px] truncate block select-all">
                            {poc.creator.address}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={handleCopyCreatorAddress}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                          >
                            {isCreatorAddressCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400 font-bold">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                <span>Copy Creator Address</span>
                              </>
                            )}
                          </button>

                          <a
                            href={getSolanaExplorerUrl(poc.creator.address, 'address', solanaCluster)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-cyan-400 transition"
                            title="Solana Explorer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: History */}
            {activeLeftTab === 'history' && (
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[460px]">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Changelog & Prompt Evolution
                </h4>
                {poc.promptHistory.slice().reverse().map((entry, idx) => (
                  <div key={idx} className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-800">
                      <span className="font-bold text-emerald-400">{entry.version}</span>
                      <span className="text-slate-400">{entry.author} • {new Date(entry.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-300 italic bg-black/50 p-2 rounded border border-slate-900">
                      "{entry.prompt}"
                    </p>
                    {entry.changelog && (
                      <ul className="list-disc list-inside text-slate-400 space-y-0.5 text-[11px]">
                        {entry.changelog.map((ch, i) => (
                          <li key={i}>{ch}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* TAB CONTENT: Top Holders */}
            {activeLeftTab === 'holders' && (
              <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px]">
                <TopHoldersSection poc={poc} />
              </div>
            )}

            {/* TAB CONTENT: Trade History Table */}
            {activeLeftTab === 'trades' && (
              <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px] pr-1">
                <TradeHistoryTable poc={poc} />
              </div>
            )}

            {/* TAB CONTENT: Social Sentiment & Twitter / X Engagement */}
            {activeLeftTab === 'sentiment' && (
              <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px]">
                <SocialSentimentWidget poc={poc} />
              </div>
            )}
          </div>

          {/* Right Column: Bonding Curve & Swap Terminal & Trollbox (5 Cols) */}
          <div className="lg:col-span-5 p-4 sm:p-5 flex flex-col justify-between space-y-4 bg-[#090d14]/70">
            {/* Bonding Curve HUD */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider font-semibold block">
                    Bonding Curve Progress
                  </span>
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    {poc.bondingCurveProgress.toFixed(1)}%
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider font-semibold block">
                    Graduation Target
                  </span>
                  <span className="text-xs font-mono font-bold text-white">
                    {TARGET_SOL} SOL ({formatUsd(TARGET_SOL * 165)})
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-cyan-400 to-amber-300 h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, poc.bondingCurveProgress)}%` }}
                ></div>
              </div>

              <p className="text-[11px] text-slate-400 leading-tight">
                When the bonding curve hits 100% ({TARGET_SOL} SOL), all liquidity migrates to Raydium and the PoC code gets automatically deployed to the Production Incubator!
              </p>

              {/* Milestone Alerts Quick Toggle Strip */}
              <div className="bg-slate-950/90 rounded-xl p-2.5 border border-slate-800/80 flex items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${isAlertsActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    {isAlertsActive ? <BellRing className="w-3.5 h-3.5 animate-pulse" /> : <Bell className="w-3.5 h-3.5" />}
                  </div>
                  <div className="leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-bold text-[11px]">Milestone Alerts</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold ${isAlertsActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                        {isAlertsActive ? 'SUBSCRIBED' : 'MUTED'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {isAlertsActive ? 'Notifying on 25%, 50%, 75%, 90%, 100%' : 'Subscribe to real-time price alerts'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAlerts(poc.id)}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                      isAlertsActive ? 'bg-emerald-500' : 'bg-slate-800 border border-slate-700'
                    }`}
                    title={isAlertsActive ? 'Turn off alerts' : 'Turn on milestone alerts'}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                        isAlertsActive ? 'left-5 bg-black' : 'left-1'
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAlertsModalOpen(true)}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-semibold cursor-pointer"
                  >
                    Configure
                  </button>
                </div>
              </div>

              {/* Quick stats row */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-2 border-t border-slate-800">
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-900">
                  <span className="text-[10px] text-slate-400 block">Pooled SOL</span>
                  <span className="text-white font-bold">{formatSol(poc.currentSolPooled)}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-900">
                  <span className="text-[10px] text-slate-400 block">Market Cap</span>
                  <span className="text-emerald-400 font-bold">{formatUsd(poc.marketCapUsd)}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-900">
                  <span className="text-[10px] text-slate-400 block">Price / Token</span>
                  <span className="text-slate-300 font-bold text-[10px]">{formatSol(poc.tokenPriceSol, 8)}</span>
                </div>
              </div>
            </div>

            {/* Switchable Tabs for Trade / Holders / Trollbox */}
            <div className="flex border-b border-slate-800 text-xs font-mono">
              <button
                onClick={() => setActiveRightTab('trade')}
                className={`flex-1 py-2 font-bold transition border-b-2 cursor-pointer ${
                  activeRightTab === 'trade'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                SWAP
              </button>
              <button
                onClick={() => setActiveRightTab('holders')}
                className={`flex-1 py-2 font-bold transition border-b-2 cursor-pointer ${
                  activeRightTab === 'holders'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                TOP HOLDERS
              </button>
              <button
                onClick={() => setActiveRightTab('trades')}
                className={`flex-1 py-2 font-bold transition border-b-2 cursor-pointer ${
                  activeRightTab === 'trades'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                TRADES ({poc.trades?.length || 0})
              </button>
              <button
                onClick={() => setActiveRightTab('trollbox')}
                className={`flex-1 py-2 font-bold transition border-b-2 cursor-pointer ${
                  activeRightTab === 'trollbox'
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                CHAT ({poc.comments.length})
              </button>
            </div>

            {/* TAB: SWAP TERMINAL */}
            {activeRightTab === 'trade' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4">
                {poc.isTradingPaused && (
                  <div className="bg-rose-950/80 border border-rose-500/60 p-3 rounded-xl text-rose-200 text-xs font-mono flex items-center gap-2">
                    <span>🛑</span>
                    <span>COMERCIO PAUSADO: Operaciones detenidas temporalmente por el Administrador.</span>
                  </div>
                )}

                {/* Buy / Sell Toggle */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setTradeMode('buy')}
                    className={`py-2 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                      tradeMode === 'buy'
                        ? 'bg-emerald-500 text-black shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    BUY {poc.ticker}
                  </button>
                  <button
                    onClick={() => setTradeMode('sell')}
                    className={`py-2 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                      tradeMode === 'sell'
                        ? 'bg-rose-500 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    SELL {poc.ticker}
                  </button>
                </div>

                {/* User Holding Info */}
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Your Holdings:</span>
                  <span className="text-white font-bold">
                    {formatTokens(userTokenBalance)} {poc.ticker}{' '}
                    {userTokenBalance > 0 && `(~$${(userTokenBalance * poc.tokenPriceSol * 165).toFixed(2)})`}
                  </span>
                </div>

                {/* Input Area */}
                {tradeMode === 'buy' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Amount in SOL</span>
                      <span>Wallet: {formatSol(wallet.solBalance)} SOL</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0.01"
                        value={solAmountInput}
                        onChange={(e) => setSolAmountInput(e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-base font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                      />
                      <span className="absolute right-4 top-3.5 text-xs font-mono font-bold text-slate-400">
                        SOL
                      </span>
                    </div>

                    {/* Quick SOL preset buttons */}
                    <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
                      {['0.1', '0.5', '1.0', '2.5'].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setSolAmountInput(amt)}
                          className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 py-1.5 rounded-lg transition"
                        >
                          {amt} SOL
                        </button>
                      ))}
                    </div>

                    {/* Output estimation */}
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 text-xs font-mono space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span>You will receive:</span>
                        <span className="text-emerald-400 font-bold">
                          ≈ {formatTokens(buyCalculation.tokensOut)} {poc.ticker}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400 text-[10px]">
                        <span>Price Impact:</span>
                        <span className={buyCalculation.priceImpactPercent > 5 ? 'text-amber-400' : 'text-slate-400'}>
                          {buyCalculation.priceImpactPercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleBuy}
                      disabled={isTrading || solNum <= 0 || wallet.solBalance < solNum || poc.isTradingPaused}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {poc.isTradingPaused
                        ? 'TRADING PAUSED BY ADMIN'
                        : wallet.solBalance < solNum
                        ? 'INSUFFICIENT SOL BALANCE'
                        : `APE ${solAmountInput || '0'} SOL INTO ${poc.ticker}`}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Amount in Tokens</span>
                      <span>Avail: {formatTokens(userTokenBalance)}</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={tokenAmountInput}
                        onChange={(e) => setTokenAmountInput(e.target.value)}
                        placeholder="0"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-base font-mono font-bold text-white focus:outline-none focus:border-rose-500"
                      />
                      <span className="absolute right-4 top-3.5 text-xs font-mono font-bold text-slate-400">
                        {poc.ticker}
                      </span>
                    </div>

                    {/* Quick percentage buttons */}
                    <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
                      {[0.25, 0.5, 0.75, 1.0].map((frac) => (
                        <button
                          key={frac}
                          onClick={() => setTokenAmountInput(Math.floor(userTokenBalance * frac).toString())}
                          className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 py-1.5 rounded-lg transition"
                        >
                          {frac * 100}%
                        </button>
                      ))}
                    </div>

                    {/* Output estimation */}
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 text-xs font-mono space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span>You will receive:</span>
                        <span className="text-white font-bold">
                          ≈ {formatSol(sellCalculation.solOut)} SOL ({formatUsd(sellCalculation.solOut * 165)})
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleSell}
                      disabled={isTrading || tokenNum <= 0 || userTokenBalance < tokenNum || poc.isTradingPaused}
                      className="w-full bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm py-3.5 rounded-xl transition shadow-lg shadow-rose-950 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {poc.isTradingPaused
                        ? 'TRADING PAUSED BY ADMIN'
                        : userTokenBalance < tokenNum
                        ? 'NOT ENOUGH TOKENS'
                        : `SELL ${poc.ticker}`}
                    </button>
                  </div>
                )}

                {/* Slippage tolerance selector */}
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/80">
                  <span>Slippage Tolerance:</span>
                  <div className="flex gap-1">
                    {[1, 5, 15, 25].map((slip) => (
                      <button
                        key={slip}
                        onClick={() => setSlippage(slip)}
                        className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                          slippage === slip
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold'
                            : 'bg-slate-950 text-slate-400 hover:text-white'
                        }`}
                      >
                        {slip}%
                      </button>
                    ))}
                  </div>
                </div>

                {tradeFeedback && (
                  <div
                    className={`text-xs p-2.5 rounded-lg font-mono ${
                      tradeFeedback.isError
                        ? 'bg-rose-950/60 border border-rose-800 text-rose-300'
                        : 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                    }`}
                  >
                    {tradeFeedback.message}
                  </div>
                )}
              </div>
            )}

            {/* TAB: TOP HOLDERS */}
            {activeRightTab === 'holders' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex-1 overflow-y-auto max-h-[460px]">
                <TopHoldersSection poc={poc} />
              </div>
            )}

            {/* TAB: TRADE HISTORY TABLE */}
            {activeRightTab === 'trades' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex-1 overflow-y-auto max-h-[460px]">
                <TradeHistoryTable poc={poc} />
              </div>
            )}

            {/* TAB: TROLLBOX & TRADES */}
            {activeRightTab === 'trollbox' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex-1 flex flex-col justify-between space-y-3">
                <div className="h-64 overflow-y-auto space-y-2 pr-1 text-xs">
                  {/* Recent trades stream */}
                  <div className="border-b border-slate-800 pb-2 mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                        Live Trades Stream
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveRightTab('trades')}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono underline cursor-pointer"
                      >
                        Ver Historial Completo →
                      </button>
                    </div>
                    {poc.trades && poc.trades.length > 0 ? (
                      poc.trades.slice(0, 3).map((tr) => (
                        <div key={tr.id} className="flex items-center justify-between font-mono text-[11px] py-1 border-b border-slate-900/60">
                          <span
                            className={
                              tr.type === 'injection'
                                ? 'text-amber-300 font-bold'
                                : tr.type === 'buy'
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }
                          >
                            {tr.type === 'injection'
                              ? '💉 INYECCIÓN'
                              : tr.type === 'buy'
                              ? '🟢 BUY'
                              : '🔴 SELL'}{' '}
                            {formatSol(tr.solAmount)} SOL
                          </span>
                          <span className="text-slate-400">{tr.user.name}</span>
                          <span className="text-slate-500 text-[10px]">{new Date(tr.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-[11px] text-slate-500 font-mono">No recent trades yet. Be the first to ape!</div>
                    )}
                  </div>

                  {/* Chat messages */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                      Community Chat & Prompt Suggestions
                    </span>
                    {poc.comments.map((cm) => (
                      <div key={cm.id} className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-200">{cm.user.name}</span>
                          {cm.isPromptSuggestion && (
                            <span className="text-[9px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 px-1.5 py-0.5 rounded font-mono">
                              💡 Prompt Suggestion
                            </span>
                          )}
                        </div>
                        <p className="text-slate-300 text-xs">{cm.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Send chat message input */}
                <form onSubmit={handleSendComment} className="pt-2 border-t border-slate-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <input
                      type="checkbox"
                      id="promptSugCheck"
                      checked={isSuggestionCheck}
                      onChange={(e) => setIsSuggestionCheck(e.target.checked)}
                      className="accent-cyan-400"
                    />
                    <label htmlFor="promptSugCheck" className="cursor-pointer">
                      Mark as Prompt Suggestion for the Prompter
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Comment or suggest a prompt upgrade..."
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 text-xs px-3 py-2 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <button
                      type="submit"
                      className="bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bonding Curve Milestone Alerts Modal */}
      <MilestoneAlertsModal
        poc={poc}
        isOpen={isAlertsModalOpen}
        onClose={() => setIsAlertsModalOpen(false)}
      />
    </div>
  );
};
