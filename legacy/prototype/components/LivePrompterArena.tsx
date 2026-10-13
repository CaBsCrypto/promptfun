import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Terminal, Eye, Play, Zap, Sparkles } from 'lucide-react';
import { formatTokenCount } from '../utils/openrouter';

const LIVE_STREAM_PROMPTS = [
  {
    prompter: 'Elena Rostova (@elena_builds)',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    pocId: 'poc-nexus-ide',
    pocTicker: '$NEXUS',
    pocTitle: 'NexusFlow Studio',
    promptText: 'Implement WebAssembly JIT compiler pass with SIMD vectorization to speed up consensus validation by 4x...',
    status: 'Compilando Sandbox en Vivo',
    curve: '88.4%',
    model: 'Claude 3.7 Sonnet',
  },
  {
    prompter: 'Dr. Marcus Vance (@vance_ai)',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    pocId: 'poc-swarm-mind',
    pocTicker: '$SWARM',
    pocTitle: 'SwarmMind Arena',
    promptText: 'Add automated on-chain arbitrage circuit breaker with third-party validator quorum threshold at 75%...',
    status: 'Sintetizando Pesos & Razonamiento',
    curve: '71.2%',
    model: 'DeepSeek R1',
  },
];

export const LivePrompterArena: React.FC = () => {
  const { pocs, setActivePoC, setIsLaunchModalOpen, openFuelModal } = useApp();
  const [currentStreamIndex, setCurrentStreamIndex] = useState(0);
  const [typedChars, setTypedChars] = useState(0);

  const stream = LIVE_STREAM_PROMPTS[currentStreamIndex];
  const targetPoC = pocs.find((p) => p.id === stream.pocId) || pocs[0];

  const fuelPool = targetPoC?.openRouterFuel || {
    totalTokensRemaining: 3_450_000,
    totalTokensSponsored: 8_200_000,
    creditsUsd: 34.50,
    activeModel: 'anthropic/claude-3.7-sonnet',
    sponsorsCount: 38,
    totalPromptsExecuted: 42,
  };

  // Simulating live prompter keystrokes
  useEffect(() => {
    setTypedChars(0);
    const interval = setInterval(() => {
      setTypedChars((prev) => {
        if (prev >= stream.promptText.length) {
          return prev;
        }
        return prev + 1;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [currentStreamIndex, stream.promptText]);

  // Rotate featured prompters every 20s
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStreamIndex((prev) => (prev + 1) % LIVE_STREAM_PROMPTS.length);
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#090d16] dark:bg-[#090d16] light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200 p-4 sm:p-5 shadow-xl transition-colors">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200 dark:text-slate-200 light:text-slate-900">
            Live Prompter Arena
          </span>
          <span className="text-slate-600 dark:text-slate-600 light:text-slate-300">·</span>
          <span className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-500 hidden sm:inline">
            Desarrollo en vivo asistido por IA · Alimenta el compute con OpenRouter o invierte en su curva
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5 text-emerald-400 dark:text-emerald-400 light:text-emerald-700 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            <Eye className="w-3.5 h-3.5" />
            <span>1,429 espectadores</span>
          </span>
        </div>
      </div>

      {/* Live Prompter Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* Left: Prompter Profile & Live Prompt Terminal */}
        <div className="lg:col-span-8 space-y-3.5">
          {/* Prompter header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={stream.avatar}
                alt={stream.prompter}
                className="w-10 h-10 rounded-full border border-emerald-400/80 object-cover shadow-sm"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white dark:text-white light:text-slate-900">{stream.prompter}</h3>
                  <span className="bg-emerald-500/15 text-emerald-400 dark:text-emerald-400 light:text-emerald-700 text-[10px] font-mono font-semibold px-2 py-0.5 rounded border border-emerald-500/25">
                    Transmitiendo
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  Proyecto: <strong className="text-cyan-400">{stream.pocTitle}</strong> ({stream.pocTicker})
                </p>
              </div>
            </div>

            {/* OpenRouter Live Fuel Gauge */}
            <div className="flex items-center gap-2.5 bg-slate-950/80 dark:bg-slate-950/80 light:bg-slate-100 border border-slate-800 dark:border-slate-800 light:border-slate-200 rounded-xl px-3 py-1.5 font-mono text-xs">
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block uppercase">
                  Tokens Restantes
                </span>
                <span className="text-xs font-extrabold text-amber-300 dark:text-amber-300 light:text-amber-800">
                  {formatTokenCount(fuelPool.totalTokensRemaining)}
                </span>
              </div>
              <button
                onClick={() => targetPoC && openFuelModal(targetPoC)}
                title="Inyectar tokens OpenRouter a este creador"
                className="bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 dark:text-amber-300 light:text-amber-800 border border-amber-400/30 text-xs font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>+ Inyectar</span>
              </button>
            </div>
          </div>

          {/* Live Prompt Keystroke Terminal */}
          <div className="bg-black/90 dark:bg-black/90 light:bg-slate-950 border border-slate-800/90 rounded-xl p-3.5 sm:p-4 font-mono text-xs shadow-inner">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Terminal className="w-3.5 h-3.5" />
                <span>live_prompt_stream.log</span>
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <span>Motor:</span>
                <strong className="text-cyan-300">{stream.model}</strong>
              </span>
            </div>

            <div className="min-h-[50px] text-slate-200 leading-relaxed font-mono flex items-start gap-2">
              <span className="text-emerald-400 font-bold select-none">&gt;</span>
              <p className="flex-1">
                {stream.promptText.slice(0, typedChars)}
                <span className="inline-block w-2 h-4 bg-emerald-400 ml-0.5 align-middle animate-pulse"></span>
              </p>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-900 flex items-center justify-between text-[11px]">
              <span className="text-cyan-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                <span>{stream.status}</span>
              </span>
              <span className="text-slate-500 font-mono text-[10px]">
                Consumo: ~42k tokens / iteración
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Action & Ape CTA Card */}
        <div className="lg:col-span-4 bg-slate-950/70 dark:bg-slate-950/70 light:bg-slate-100/90 border border-slate-800 dark:border-slate-800 light:border-slate-200 rounded-xl p-4 space-y-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-500 uppercase font-mono tracking-wider font-semibold text-[10px]">
                PoC en Streaming
              </span>
              <span className="text-emerald-400 font-bold font-mono">{stream.pocTicker}</span>
            </div>
            <h4 className="text-white dark:text-white light:text-slate-900 font-bold text-sm">{stream.pocTitle}</h4>
            <p className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-600 line-clamp-2 mt-1">
              {targetPoC?.description || 'Motor de generación autónoma de software e inferencia IA en vivo.'}
            </p>
          </div>

          {/* Bonding curve preview bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-slate-400">Progreso a Raydium</span>
              <span className="text-emerald-400 font-bold">{targetPoC?.bondingCurveProgress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-900 dark:bg-slate-900 light:bg-slate-200 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${targetPoC?.bondingCurveProgress || 50}%` }}
              ></div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            <button
              onClick={() => setActivePoC(targetPoC)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>Probar e Invertir ({stream.pocTicker})</span>
            </button>

            <button
              onClick={() => targetPoC && openFuelModal(targetPoC)}
              className="w-full bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 dark:text-amber-300 light:text-amber-800 border border-amber-400/30 font-bold text-xs py-2 rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Inyectar Tokens OpenRouter</span>
            </button>

            <button
              onClick={() => setIsLaunchModalOpen(true)}
              className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 light:bg-white light:hover:bg-slate-50 text-slate-300 dark:text-slate-300 light:text-slate-700 font-medium text-xs py-2 rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-800 dark:border-slate-800 light:border-slate-300 active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Lanzar Mi Propio PoC</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
