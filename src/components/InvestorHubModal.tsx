import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  TrendingUp,
  TrendingDown,
  PieChart,
  Zap,
  Play,
  ArrowUpRight,
  Shield,
  Coins,
  Bell,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { formatSol, formatTokens, formatUsd, SOL_USD_RATE } from '../utils/bondingCurve';
import { formatTokenCount } from '../utils/openrouter';

export const InvestorHubModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    wallet,
    pocs,
    setActivePoC,
    buyTokens,
    sellTokens,
    claimFaucet,
    setIsWalletModalOpen,
    openFuelModal,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'positions' | 'radar' | 'openrouter' | 'calculator'>('positions');

  // Calculate portfolio totals
  let totalHoldingsValueSol = 0;
  let totalInvestedSol = 0;

  const positions = Object.values(wallet.holdings)
    .filter((h) => h.tokenAmount > 0)
    .map((holding) => {
      const poc = pocs.find((p) => p.id === holding.pocId);
      const currentTokenPrice = poc ? poc.tokenPriceSol : 0;
      const currentValSol = holding.tokenAmount * currentTokenPrice;
      const pnlSol = currentValSol - holding.totalInvestedSol;
      const pnlPercent = holding.totalInvestedSol > 0 ? (pnlSol / holding.totalInvestedSol) * 100 : 0;

      totalHoldingsValueSol += currentValSol;
      totalInvestedSol += holding.totalInvestedSol;

      return {
        ...holding,
        poc,
        currentValSol,
        pnlSol,
        pnlPercent,
      };
    });

  const totalPortfolioSol = wallet.solBalance + totalHoldingsValueSol;
  const totalPnlSol = totalHoldingsValueSol - totalInvestedSol;
  const totalPnlPercent = totalInvestedSol > 0 ? (totalPnlSol / totalInvestedSol) * 100 : 0;

  // Radar of high velocity bonding curve PoCs
  const nearGraduationPocs = [...pocs]
    .sort((a, b) => b.bondingCurveProgress - a.bondingCurveProgress)
    .slice(0, 4);

  // Calculator simulation state
  const [calcSolInput, setCalcSolInput] = useState(1.0);
  const [calcTargetGraduationMult, setCalcTargetGraduationMult] = useState(3.5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto font-sans">
      <div className="relative w-full max-w-4xl bg-[#0c1017] border border-cyan-500/40 rounded-3xl shadow-2xl p-5 sm:p-6 text-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header with Investor badge */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-mono">
                  Punto de Vista del Inversor
                </h2>
                <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full font-bold">
                  MODO DEGEN
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Portafolio de activos, rentabilidad de curvas de vinculación y radar de graduación a Raydium.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                setIsWalletModalOpen(true);
              }}
              className="hidden sm:flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-mono transition cursor-pointer"
            >
              <span>Ver Billetera</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Portfolio HUD */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 font-mono">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              Valor Total del Portafolio
            </span>
            <span className="text-lg sm:text-xl font-bold text-white">
              {formatSol(totalPortfolioSol)} SOL
            </span>
            <span className="text-xs text-slate-400 block">
              ≈ {formatUsd(totalPortfolioSol * SOL_USD_RATE)}
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              Saldo Líquido en SOL
            </span>
            <span className="text-lg sm:text-xl font-bold text-cyan-400">
              {formatSol(wallet.solBalance)} SOL
            </span>
            <span className="text-xs text-slate-400 block">
              Disponible para trading
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              Inversión en Curvas
            </span>
            <span className="text-lg sm:text-xl font-bold text-white">
              {formatSol(totalHoldingsValueSol)} SOL
            </span>
            <span className="text-xs text-slate-400 block">
              En {positions.length} proyectos PoC
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              PnL No Realizado
            </span>
            <div className={`flex items-center gap-1 text-lg sm:text-xl font-bold ${totalPnlSol >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalPnlSol >= 0 ? '+' : ''}{formatSol(totalPnlSol)} SOL
            </div>
            <span className={`text-xs font-semibold ${totalPnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(1)}% ROI
            </span>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-4 text-xs font-mono">
          <button
            onClick={() => setActiveSubTab('positions')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              activeSubTab === 'positions'
                ? 'bg-cyan-500 text-black'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            Mis Posiciones ({positions.length})
          </button>

          <button
            onClick={() => setActiveSubTab('radar')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              activeSubTab === 'radar'
                ? 'bg-cyan-500 text-black'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            Radar de Curvas & Graduación
          </button>

          <button
            onClick={() => setActiveSubTab('openrouter')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'openrouter'
                ? 'bg-amber-400 text-black'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Tokens OpenRouter ({wallet.openRouterTokensSponsorships?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('calculator')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              activeSubTab === 'calculator'
                ? 'bg-cyan-500 text-black'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            Calculadora de Retornos
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1">
          {/* TAB 1: POSITIONS */}
          {activeSubTab === 'positions' && (
            <div className="space-y-3">
              {positions.length === 0 ? (
                <div className="bg-slate-950/80 border border-slate-900 rounded-2xl p-10 text-center space-y-3">
                  <span className="text-4xl block">📈</span>
                  <h4 className="text-base font-bold text-white font-mono">
                    No tienes tokens de PoCs en tu portafolio
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Explora los PoCs de la comunidad y realiza tu primera inversión en la curva de vinculación.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      claimFaucet();
                    }}
                    className="bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs px-4 py-2 rounded-xl transition font-mono"
                  >
                    Recargar +5 SOL con Faucet
                  </button>
                </div>
              ) : (
                positions.map((item) => {
                  if (!item.poc) return null;
                  return (
                    <div
                      key={item.pocId}
                      className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold font-mono text-base">
                          ⚡
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white font-mono">{item.poc.title}</h4>
                            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                              {item.poc.ticker}
                            </span>
                            {item.poc.bondingCurveProgress >= 100 && (
                              <span className="text-[10px] font-mono bg-emerald-500 text-black font-extrabold px-1.5 py-0.5 rounded">
                                GRADUADO A RAYDIUM
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-1">
                            <span>Tokens: {formatTokens(item.tokenAmount)}</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-bold">
                              Progreso Curva: {item.poc.bondingCurveProgress.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right actions & PnL */}
                      <div className="flex items-center justify-between md:justify-end gap-4 font-mono text-xs">
                        <div className="text-left md:text-right">
                          <span className="text-white font-bold block">{formatSol(item.currentValSol)} SOL</span>
                          <span className={`text-[11px] font-bold ${item.pnlSol >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {item.pnlSol >= 0 ? '+' : ''}{item.pnlSol.toFixed(3)} SOL ({item.pnlPercent >= 0 ? '+' : ''}{item.pnlPercent.toFixed(1)}%)
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setActivePoC(item.poc!);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center gap-1 transition cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Probar</span>
                          </button>

                          <button
                            onClick={() => buyTokens(item.poc!.id, 0.5, 5)}
                            className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black border border-cyan-500/40 font-bold transition cursor-pointer"
                          >
                            +0.5 SOL
                          </button>

                          <button
                            onClick={() => sellTokens(item.poc!.id, Math.floor(item.tokenAmount * 0.5), 5)}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 font-bold transition cursor-pointer"
                          >
                            Vender 50%
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: RADAR DE GRADUACIÓN */}
          {activeSubTab === 'radar' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="bg-slate-900/40 border border-slate-800 p-3 rounded-2xl">
                <span className="text-slate-400 block">
                  Los PoCs que alcanzan <strong>85 SOL</strong> en la curva se gradúan a Raydium DEX con liquidez bloqueada para siempre.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {nearGraduationPocs.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setActivePoC(p);
                      onClose();
                    }}
                    className="bg-slate-950 p-4 rounded-2xl border border-slate-800 hover:border-cyan-500/50 transition cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{p.title}</span>
                        <span className="text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded text-[11px]">
                          {p.ticker}
                        </span>
                      </div>
                      <span className="text-emerald-400 font-bold">
                        {p.bondingCurveProgress.toFixed(1)}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                        style={{ width: `${Math.min(100, p.bondingCurveProgress)}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>SOL Reunidos: {p.currentSolPooled.toFixed(1)} / 85 SOL</span>
                      <span>Cap: {formatUsd(p.marketCapUsd)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: RETORNOS & CALCULADORA */}
          {activeSubTab === 'calculator' && (
            <div className="space-y-4 font-mono text-xs">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-white text-sm">Simulador de Retorno de Graduación</h4>
                <p className="text-slate-400 font-sans text-xs">
                  Estima el valor de tus tokens una vez que un PoC alcanza el 100% de la curva y el pool de liquidez es inyectado en Raydium.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 block mb-1">Monto a Invertir (SOL):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={calcSolInput}
                      onChange={(e) => setCalcSolInput(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Multiplicador Estimado Post-Raydium:</label>
                    <select
                      value={calcTargetGraduationMult}
                      onChange={(e) => setCalcTargetGraduationMult(parseFloat(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="2.0">2.0x (Conservador)</option>
                      <option value="3.5">3.5x (Graduación Normal)</option>
                      <option value="7.0">7.0x (Alta Tracción Viral)</option>
                      <option value="15.0">15.0x (King of the Hill Masivo)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Retorno Estimado en SOL:</span>
                    <span className="text-xl font-bold text-emerald-400">
                      {(calcSolInput * calcTargetGraduationMult).toFixed(2)} SOL
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-slate-400 text-[11px] block">Ganancia Neta (USD):</span>
                    <span className="text-lg font-bold text-white">
                      +{formatUsd((calcSolInput * calcTargetGraduationMult - calcSolInput) * SOL_USD_RATE)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OPENROUTER AI PATRONAGE */}
          {activeSubTab === 'openrouter' && (
            <div className="space-y-4 font-mono text-xs">
              <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-cyan-950/40 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⚡</span>
                    <h4 className="text-sm font-bold text-white">
                      Patronato de IA: Inyecciones de Tokens OpenRouter
                    </h4>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 max-w-xl">
                    Apoya el baicodeo en vivo comprando tokens de inferencia OpenRouter para los desarrolladores. Cada token financia iteraciones de modelos avanzados como Claude 3.7 Sonnet y DeepSeek R1.
                  </p>
                </div>

                <div className="text-right shrink-0 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">Tokens Patrocinados</span>
                  <span className="text-base font-extrabold text-amber-400">
                    {formatTokenCount(
                      (wallet.openRouterTokensSponsorships || []).reduce((acc, s) => acc + s.tokensAmount, 0)
                    )}
                  </span>
                </div>
              </div>

              {/* History of sponsorships */}
              <div className="space-y-2">
                <span className="text-slate-400 font-bold uppercase text-[10px] block">
                  Mis Inyecciones Realizadas ({wallet.openRouterTokensSponsorships?.length || 0})
                </span>

                {!wallet.openRouterTokensSponsorships || wallet.openRouterTokensSponsorships.length === 0 ? (
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
                    <span className="text-3xl block">⚡</span>
                    <p className="text-slate-300 font-bold">Aún no has inyectado tokens OpenRouter a creadores</p>
                    <p className="text-slate-400 text-xs max-w-md mx-auto">
                      Ve a la arena de streaming o a la tarjeta de cualquier PoC y haz clic en "Inyectar Tokens OpenRouter" para acelerar su desarrollo en vivo.
                    </p>
                    <button
                      onClick={() => {
                        onClose();
                        const p = pocs[0];
                        if (p) openFuelModal(p);
                      }}
                      className="bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                    >
                      Inyectar Tokens a Elena Rostova ($NEXUS)
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {wallet.openRouterTokensSponsorships.map((sp) => (
                      <div
                        key={sp.id}
                        className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center font-bold">
                            ⚡
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{sp.pocTitle} ({sp.pocTicker})</span>
                              <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/30">
                                {sp.targetModel.split('/')[1] || sp.targetModel}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              Creador: {sp.creatorName} • Pack: {sp.tierTitle}
                            </span>
                            {sp.message && (
                              <p className="text-[10px] text-slate-300 italic mt-0.5">
                                "{sp.message}"
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-emerald-400 font-bold block">
                            +{formatTokenCount(sp.tokensAmount)} Tokens
                          </span>
                          <span className="text-slate-500 text-[10px]">
                            {sp.costSol} SOL (${sp.costUsd})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
