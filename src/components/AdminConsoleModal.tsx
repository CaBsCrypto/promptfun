import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  ShieldAlert,
  Sliders,
  DollarSign,
  AlertTriangle,
  Play,
  Pause,
  Award,
  Zap,
  Coins,
  RefreshCw,
  TrendingUp,
  Layers,
  Sparkles,
  Check,
} from 'lucide-react';
import { formatSol, formatUsd, SOL_USD_RATE } from '../utils/bondingCurve';
import { formatTokenCount } from '../utils/openrouter';

export const AdminConsoleModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    protocolConfig,
    updateProtocolConfig,
    pocs,
    togglePoCTradingPause,
    togglePoCFeatured,
    forceGraduatePoC,
    injectPlatformLiquidity,
    airdropAllHolders,
    setActivePoC,
    claimFaucetAmount,
    replenishPlatformOpenRouterPool,
  } = useApp();

  const [targetSolInput, setTargetSolInput] = useState(protocolConfig.graduationTargetSol);
  const [protocolFeeInput, setProtocolFeeInput] = useState(protocolConfig.protocolFeePercent);
  const [creatorFeeInput, setCreatorFeeInput] = useState(protocolConfig.creatorFeePercent);
  const [selectedPocForLiquidity, setSelectedPocForLiquidity] = useState(pocs[0]?.id || '');
  const [liquidityAmountInput, setLiquidityAmountInput] = useState(5.0);
  const [massAirdropAmount, setMassAirdropAmount] = useState(1.0);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Global calculations
  const totalVolumeGlobalSol = pocs.reduce((acc, p) => acc + p.volume24hSol, 0);
  const totalTvlSol = pocs.reduce((acc, p) => acc + p.currentSolPooled, 0);
  const totalGraduatedCount = pocs.filter((p) => p.isGraduated || p.bondingCurveProgress >= 100).length;

  const handleSaveParams = (e: React.FormEvent) => {
    e.preventDefault();
    updateProtocolConfig({
      graduationTargetSol: targetSolInput,
      protocolFeePercent: protocolFeeInput,
      creatorFeePercent: creatorFeeInput,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleInjectLiquidity = () => {
    if (!selectedPocForLiquidity || liquidityAmountInput <= 0) return;
    injectPlatformLiquidity(selectedPocForLiquidity, liquidityAmountInput);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto font-sans">
      <div className="relative w-full max-w-4xl bg-[#0c0d16] border border-purple-500/40 rounded-3xl shadow-2xl p-5 sm:p-6 text-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-mono">
                  Punto de Vista del Administrador (Gobernanza)
                </h2>
                <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full font-bold">
                  MASTER PROTOCOL ROOT
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Control de tesorería, parámetros económicos, circuit breakers y moderación de curvas.
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

        {/* Global Protocol Analytics HUD */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 font-mono text-xs">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
              Tesorería del Protocolo
            </span>
            <span className="text-xl font-bold text-purple-400">
              {formatSol(protocolConfig.protocolTreasurySol)} SOL
            </span>
            <span className="text-[11px] text-slate-400 block">
              ≈ {formatUsd(protocolConfig.protocolTreasurySol * SOL_USD_RATE)}
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
              TVL en Curvas (SOL Bloqueado)
            </span>
            <span className="text-xl font-bold text-emerald-400">
              {formatSol(totalTvlSol)} SOL
            </span>
            <span className="text-[11px] text-slate-400 block">
              En {pocs.length} pools de bonding
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
              Volumen Global 24h
            </span>
            <span className="text-xl font-bold text-cyan-400">
              {formatSol(totalVolumeGlobalSol)} SOL
            </span>
            <span className="text-[11px] text-slate-400 block">
              Comercio continuo
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
              PoCs Graduados a DEX
            </span>
            <span className="text-xl font-bold text-amber-400">
              {totalGraduatedCount} / {pocs.length}
            </span>
            <span className="text-[11px] text-slate-400 block">
              Liquidez transferida a Raydium
            </span>
          </div>
        </div>

        {/* Global Circuit Breaker Toggle */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${protocolConfig.isGlobalTradingPaused ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'}`}></div>
            <div>
              <span className="font-bold text-white block">
                Circuit Breaker Global: {protocolConfig.isGlobalTradingPaused ? 'PAUSADO 🛑' : 'ACTIVO / OPERATIVO 🟢'}
              </span>
              <span className="text-slate-400 text-[11px]">
                {protocolConfig.isGlobalTradingPaused
                  ? 'Todas las operaciones de compra y venta en la plataforma están detenidas.'
                  : 'El mercado está abierto y procesando transacciones en tiempo real.'}
              </span>
            </div>
          </div>

          <button
            onClick={() =>
              updateProtocolConfig({
                isGlobalTradingPaused: !protocolConfig.isGlobalTradingPaused,
              })
            }
            className={`px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${
              protocolConfig.isGlobalTradingPaused
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                : 'bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40'
            }`}
          >
            {protocolConfig.isGlobalTradingPaused ? 'Reanudar Mercado Global' : 'Activar Pausa de Emergencia'}
          </button>
        </div>

        {/* Scrollable Admin Panels */}
        <div className="flex-1 overflow-y-auto space-y-5 min-h-0 pr-1 font-mono text-xs">
          {/* PANEL 1: ECONOMIC PARAMETERS */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white uppercase tracking-wider text-xs flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <span>Parámetros Económicos del Protocolo</span>
              </h3>
              {saveSuccess && (
                <span className="text-emerald-400 flex items-center gap-1 text-xs">
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardado</span>
                </span>
              )}
            </div>

            <form onSubmit={handleSaveParams} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Objetivo de Graduación (SOL):</label>
                <input
                  type="number"
                  step="1"
                  value={targetSolInput}
                  onChange={(e) => setTargetSolInput(parseFloat(e.target.value) || 85)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Estándar: 85 SOL (~$14,000)</span>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Tarifa del Protocolo (%):</label>
                <input
                  type="number"
                  step="0.1"
                  value={protocolFeeInput}
                  onChange={(e) => setProtocolFeeInput(parseFloat(e.target.value) || 1.0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Destinado a la tesorería admin</span>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Regalía del Creador (%):</label>
                <input
                  type="number"
                  step="0.1"
                  value={creatorFeeInput}
                  onChange={(e) => setCreatorFeeInput(parseFloat(e.target.value) || 0.5)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Acreditado a cada creador</span>
              </div>

              <div className="sm:col-span-3 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-black font-extrabold text-xs transition cursor-pointer shadow-md"
                >
                  Actualizar Parámetros del Protocolo
                </button>
              </div>
            </form>
          </div>

          {/* PANEL 2: POC MODERATION & CURVE MANAGEMENT */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <h3 className="font-bold text-white uppercase tracking-wider text-xs flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Moderación y Control de Curvas Individuales</span>
            </h3>

            <div className="space-y-2">
              {pocs.map((poc) => (
                <div
                  key={poc.id}
                  className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{poc.title}</span>
                      <span className="text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded">
                        {poc.ticker}
                      </span>
                      {poc.isTradingPaused && (
                        <span className="text-rose-400 bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          PAUSADO
                        </span>
                      )}
                      {poc.isFeatured && (
                        <span className="text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          DESTACADO
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 text-[11px] block">
                      Creador: {poc.creator.name} • Curva: {poc.bondingCurveProgress.toFixed(1)}% • Sol: {poc.currentSolPooled.toFixed(2)} SOL
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => togglePoCTradingPause(poc.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        poc.isTradingPaused
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {poc.isTradingPaused ? 'Reanudar' : 'Pausar'}
                    </button>

                    <button
                      onClick={() => togglePoCFeatured(poc.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        poc.isFeatured
                          ? 'bg-amber-500 text-black'
                          : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                      }`}
                    >
                      {poc.isFeatured ? '★ Destacado' : '☆ Destacar'}
                    </button>

                    <button
                      onClick={() => forceGraduatePoC(poc.id)}
                      disabled={poc.bondingCurveProgress >= 100}
                      className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/30 to-emerald-500/30 hover:brightness-125 border border-purple-500/40 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-40"
                    >
                      Forzar Graduación
                    </button>

                    <button
                      onClick={() => {
                        setActivePoC(poc);
                        onClose();
                      }}
                      className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px]"
                    >
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PANEL 3: LIQUIDITY INJECTION & COMMUNITY AIRDROP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Liquidity Injector */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5 uppercase">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span>Inyector de Liquidez Admin</span>
              </h4>
              <p className="text-slate-400 text-[11px] font-sans">
                Añade liquidez directa desde el tesoro para impulsar cualquier curva de vinculación.
              </p>

              <div>
                <label className="text-slate-400 text-[11px] block mb-1">PoC Objetivo:</label>
                <select
                  value={selectedPocForLiquidity}
                  onChange={(e) => setSelectedPocForLiquidity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs"
                >
                  {pocs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.ticker})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 text-[11px] block mb-1">Monto en SOL:</label>
                <input
                  type="number"
                  step="1"
                  value={liquidityAmountInput}
                  onChange={(e) => setLiquidityAmountInput(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs"
                />
              </div>

              <button
                onClick={handleInjectLiquidity}
                className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition cursor-pointer"
              >
                Inyectar +{liquidityAmountInput} SOL de Liquidez
              </button>
            </div>

            {/* Mass Airdrop Dispenser */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5 uppercase">
                <Coins className="w-4 h-4 text-purple-400" />
                <span>Airdrop de Recompensa a Holders</span>
              </h4>
              <p className="text-slate-400 text-[11px] font-sans">
                Envía recompensas en SOL a todos los participantes e inversores activos de la plataforma.
              </p>

              <div>
                <label className="text-slate-400 text-[11px] block mb-1">SOL por Usuario:</label>
                <input
                  type="number"
                  step="0.5"
                  value={massAirdropAmount}
                  onChange={(e) => setMassAirdropAmount(parseFloat(e.target.value) || 1.0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                Fondeado automáticamente desde la tesorería de tarifas acumuladas.
              </div>

              <button
                onClick={() => airdropAllHolders(massAirdropAmount)}
                className="w-full py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-black font-extrabold text-xs transition cursor-pointer"
              >
                Distribuir Airdrop Masivo ({massAirdropAmount} SOL)
              </button>
            </div>

            {/* OpenRouter Protocol Reserve Subsidies */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5 uppercase text-amber-300">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>Reserva de Tokens OpenRouter (Protocolo)</span>
              </h4>
              <p className="text-slate-400 text-[11px] font-sans">
                Pool central de créditos OpenRouter para subsidiar a nuevos desarrolladores e incentivar streams de baicodeo en vivo.
              </p>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Tokens Disponibles</span>
                  <span className="font-extrabold text-amber-400 text-base">
                    {formatTokenCount(protocolConfig.openRouterPlatformPoolTokens || 50_000_000)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase">Subsidio por PoC</span>
                  <span className="font-bold text-white">1,000,000 Tokens</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => replenishPlatformOpenRouterPool(10_000_000)}
                  className="flex-1 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 font-bold text-xs transition cursor-pointer"
                >
                  +10M Tokens
                </button>
                <button
                  type="button"
                  onClick={() => replenishPlatformOpenRouterPool(25_000_000)}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-black font-extrabold text-xs transition cursor-pointer shadow-md"
                >
                  +25M Tokens
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
