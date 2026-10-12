import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Sparkles, Rocket, Zap, Check, AlertCircle, Wand2 } from 'lucide-react';
import { Category } from '../types';

const PROMPT_PRESETS = [
  {
    title: 'Autonomous Multi-Agent Escrow',
    ticker: '$ESCROW',
    category: 'Autonomous Agents',
    prompt: 'Create a smart AI escrow dashboard with simulated multi-signature dispute resolution, automated milestone payouts, and live audit telemetry.',
  },
  {
    title: 'HyperLiquid Volatility Radar',
    ticker: '$RADAR',
    category: 'DeFi & Trading',
    prompt: 'Build a real-time decentralized perp trading heatmap with liquidations feed, funding rate gauges, and mock 1-click hedge triggers.',
  },
  {
    title: 'Neural Canvas Vector Studio',
    ticker: '$CANVAS',
    category: 'Creative AI',
    prompt: 'Build an interactive in-browser generative canvas where users draw glowing neon lines with simulated physics and export to SVG.',
  },
  {
    title: 'Zero-Knowledge Proof Verifier',
    ticker: '$ZKPROOF',
    category: 'DevTools',
    prompt: 'Create a visual zero-knowledge proof verification pipeline demonstrating private token balance attestation without revealing wallet balances.',
  },
];

export const LaunchPoCModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { wallet, createPoC } = useApp();

  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [ticker, setTicker] = useState('');
  const [category, setCategory] = useState<string>('Autonomous Agents');
  const [initialBuySol, setInitialBuySol] = useState('0.2');

  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const applyPreset = (preset: (typeof PROMPT_PRESETS)[0]) => {
    setTitle(preset.title);
    setTicker(preset.ticker);
    setCategory(preset.category);
    setPrompt(preset.prompt);
  };

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setErrorMsg('Please enter a prompt describing your Proof of Concept.');
      return;
    }

    const buyAmt = parseFloat(initialBuySol) || 0;
    if (buyAmt > 0 && wallet.solBalance < buyAmt) {
      setErrorMsg(`Insufficient SOL in wallet (${wallet.solBalance.toFixed(2)} SOL available). Claim faucet or reduce buy.`);
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setLoadingStep(1);

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 1200);

    try {
      await createPoC({
        prompt: prompt.trim(),
        title: title.trim() || undefined,
        ticker: ticker.trim() || undefined,
        category,
        initialBuySol: buyAmt,
      });

      clearInterval(stepInterval);
      onClose();
    } catch (err: any) {
      clearInterval(stepInterval);
      setIsGenerating(false);
      setErrorMsg(err.message || 'Failed to generate PoC with Gemini');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0c1017] border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Rocket className="w-4 h-4 fill-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <span>Prompt & Launch PoC</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                  Bonding Curve Ready
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Type your prompt instructions. Gemini 3.8 Flash will generate the interactive working demo.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isGenerating}
            className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Loading State Overlay */}
        {isGenerating ? (
          <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-emerald-400 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-emerald-400 text-xl font-bold">
                ⚡
              </div>
            </div>

            <div className="space-y-2 max-w-md">
              <h3 className="text-base font-bold text-white font-mono">
                Prompting & Synthesizing Proof of Concept...
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Gemini 3.8 Flash is authoring code, designing architecture, and launching your bonding curve.
              </p>
            </div>

            {/* Step checklist */}
            <div className="w-full max-w-sm space-y-2 text-xs font-mono text-left bg-slate-950/80 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400">
                <Check className="w-4 h-4" />
                <span>1. Parsing prompt thesis with Gemini 3.8 Flash</span>
              </div>
              <div className={`flex items-center gap-2 ${loadingStep >= 2 ? 'text-emerald-400' : 'text-slate-500'}`}>
                {loadingStep >= 2 ? <Check className="w-4 h-4" /> : <span className="w-4 h-4 text-center">○</span>}
                <span>2. Generating interactive working HTML sandbox</span>
              </div>
              <div className={`flex items-center gap-2 ${loadingStep >= 3 ? 'text-emerald-400' : 'text-slate-500'}`}>
                {loadingStep >= 3 ? <Check className="w-4 h-4" /> : <span className="w-4 h-4 text-center">○</span>}
                <span>3. Formulating tokenomics & target market cap</span>
              </div>
              <div className={`flex items-center gap-2 ${loadingStep >= 4 ? 'text-emerald-400' : 'text-slate-500'}`}>
                {loadingStep >= 4 ? <Check className="w-4 h-4" /> : <span className="w-4 h-4 text-center">○</span>}
                <span>4. Deploying bonding curve to live feed</span>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleLaunch} className="space-y-4">
            {/* Quick Inspiration Presets */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Quick Prompt Inspiration (Click to prefill)</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {PROMPT_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 p-2 rounded-lg text-left text-[11px] font-mono transition"
                  >
                    <span className="font-bold text-white block truncate">{p.title}</span>
                    <span className="text-[10px] text-emerald-400">{p.ticker}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Textarea */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                PoC Specification Prompt <span className="text-emerald-400">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what your Proof of Concept does... e.g. A decentralized autonomous AI agent that monitors token liquidity pool imbalances with live audio alerts and visual depth chart."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono resize-none leading-relaxed"
              />
            </div>

            {/* Optional Title & Ticker & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  PoC Name (Optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Auto-generated if empty"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Ticker (Optional)
                </label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="$TICKER"
                  maxLength={7}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="Autonomous Agents">Autonomous Agents</option>
                  <option value="DeFi & Trading">DeFi & Trading</option>
                  <option value="Creative AI">Creative AI</option>
                  <option value="DevTools">DevTools</option>
                  <option value="Cyberpunk & Gaming">Cyberpunk & Gaming</option>
                  <option value="Micro-SaaS">Micro-SaaS</option>
                </select>
              </div>
            </div>

            {/* Initial Dev Buy */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-slate-200 block">Initial Dev Buy (Optional)</span>
                <span className="text-[11px] text-slate-400">
                  Buy first tokens on your bonding curve before public aping (Wallet: {wallet.solBalance.toFixed(2)} SOL)
                </span>
              </div>
              <div className="flex items-center gap-1.5 w-32 shrink-0">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={initialBuySol}
                  onChange={(e) => setInitialBuySol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs font-mono text-slate-400">SOL</span>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 p-3 rounded-xl border border-rose-800">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Submit CTA */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 hover:from-emerald-400 hover:to-cyan-300 text-black font-extrabold text-sm py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 cursor-pointer"
            >
              <Rocket className="w-4 h-4 fill-black" />
              <span>Prompt & Launch to Bonding Curve 🚀</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
