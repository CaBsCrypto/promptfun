import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PoC, OpenRouterModel } from '../types';
import {
  OPENROUTER_MODELS,
  OPENROUTER_FUEL_TIERS,
  formatTokenCount,
  getOpenRouterModel,
} from '../utils/openrouter';
import { formatSol, SOL_USD_RATE } from '../utils/bondingCurve';
import {
  X,
  Zap,
  Sparkles,
  Cpu,
  Coins,
  Send,
  CheckCircle,
  ExternalLink,
  MessageSquare,
  Users,
  Flame,
  Award,
} from 'lucide-react';

interface OpenRouterFuelModalProps {
  poc: PoC;
  onClose: () => void;
}

export const OpenRouterFuelModal: React.FC<OpenRouterFuelModalProps> = ({ poc, onClose }) => {
  const {
    wallet,
    currentRole,
    injectOpenRouterTokens,
    updatePoCOpenRouterModel,
  } = useApp();

  const [selectedTierId, setSelectedTierId] = useState<string>('tier-vibe-master');
  const [customSol, setCustomSol] = useState<string>('0.05');
  const [useCustom, setUseCustom] = useState<boolean>(false);
  const [selectedModelId, setSelectedModelId] = useState<string>(
    poc.openRouterFuel?.activeModel || 'anthropic/claude-3.7-sonnet'
  );
  const [message, setMessage] = useState<string>('¡Excelente baicodeo! Aquí tienes combustible de IA para seguir iterando en vivo 🚀');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successTx, setSuccessTx] = useState<string | null>(null);

  const activeModel: OpenRouterModel = getOpenRouterModel(selectedModelId);
  const selectedTier = OPENROUTER_FUEL_TIERS.find((t) => t.id === selectedTierId) || OPENROUTER_FUEL_TIERS[2];

  // Calculate tokens & SOL
  const costSol = useCustom ? Math.max(0.005, parseFloat(customSol) || 0) : selectedTier.costSol;
  const tokensToInject = useCustom
    ? Math.floor((costSol * SOL_USD_RATE) / 0.0000075) // estimated ~133k tokens per dollar
    : selectedTier.tokens;
  const costUsd = +(costSol * SOL_USD_RATE).toFixed(2);

  const canAfford = wallet.solBalance >= costSol;

  const handleInject = async () => {
    if (!canAfford || costSol <= 0) return;
    setIsSubmitting(true);
    try {
      const tierTitle = useCustom ? `Personalizado (${formatTokenCount(tokensToInject)} Tokens)` : selectedTier.title;
      const res = await injectOpenRouterTokens(
        poc.id,
        tokensToInject,
        costSol,
        tierTitle,
        message,
        selectedModelId
      );
      if (res.success && res.txHash) {
        setSuccessTx(res.txHash);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId);
    if (currentRole === 'creator' || currentRole === 'admin') {
      updatePoCOpenRouterModel(poc.id, modelId);
    }
  };

  const fuelPool = poc.openRouterFuel || {
    totalTokensRemaining: 2_500_000,
    totalTokensSponsored: 6_000_000,
    creditsUsd: 25.0,
    activeModel: 'anthropic/claude-3.7-sonnet',
    sponsorsCount: 14,
    totalPromptsExecuted: 32,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div
        className="relative w-full max-w-2xl bg-slate-900 dark:bg-slate-900 light:bg-white text-slate-100 dark:text-slate-100 light:text-slate-900 border border-slate-700/80 dark:border-slate-800 light:border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-auto transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Gradient */}
        <div className="bg-gradient-to-r from-emerald-600/30 via-cyan-600/20 to-purple-600/30 dark:from-emerald-950/40 dark:via-cyan-950/30 dark:to-purple-950/40 light:from-emerald-50 light:via-cyan-50 light:to-purple-50 p-4 sm:p-5 border-b border-slate-800 dark:border-slate-800 light:border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-400 to-cyan-400 p-0.5 shadow-md shadow-emerald-500/20 shrink-0">
              <div className="w-full h-full bg-[#0b0e14] dark:bg-[#0b0e14] light:bg-white rounded-[10px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-emerald-400 fill-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white dark:text-white light:text-slate-900">
                  Inyectar Tokens OpenRouter
                </h3>
                <span className="text-[10px] uppercase font-mono font-bold bg-cyan-500/20 text-cyan-300 dark:text-cyan-300 light:text-cyan-700 border border-cyan-500/40 px-2 py-0.5 rounded-full">
                  AI Fueling
                </span>
              </div>
              <p className="text-xs text-slate-300 dark:text-slate-400 light:text-slate-600 font-mono">
                Patrocina tokens de IA para que el programador siga baicodeando en vivo
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 dark:hover:bg-slate-800 light:hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {successTx ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mx-auto flex items-center justify-center">
                <CheckCircle className="w-9 h-9" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-extrabold text-white dark:text-white light:text-slate-900">
                  ¡Tokens OpenRouter Inyectados!
                </h4>
                <p className="text-xs text-slate-300 dark:text-slate-300 light:text-slate-600 max-w-md mx-auto">
                  Has enviado <strong className="text-emerald-400">{formatTokenCount(tokensToInject)} Tokens</strong> ({costSol.toFixed(3)} SOL) directamente al pool de <strong className="text-cyan-400">{poc.creator.name}</strong> para acelerar el desarrollo de <strong className="text-white dark:text-white light:text-slate-900">{poc.ticker}</strong>.
                </p>
              </div>

              <div className="bg-slate-950/80 dark:bg-slate-950/80 light:bg-slate-100 border border-slate-800 dark:border-slate-800 light:border-slate-300 rounded-xl p-3 font-mono text-xs max-w-md mx-auto">
                <span className="text-slate-400 block text-[10px]">Hash de Transacción Solana:</span>
                <span className="text-emerald-400 font-bold break-all">{successTx}</span>
              </div>

              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => setSuccessTx(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  Inyectar Más Tokens
                </button>
                <button
                  onClick={onClose}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-5 py-2 rounded-xl transition cursor-pointer"
                >
                  Volver al Stream
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Creator & PoC Status Banner */}
              <div className="bg-slate-950/70 dark:bg-slate-950/70 light:bg-slate-50 border border-slate-800 dark:border-slate-800 light:border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={poc.creator.avatar}
                    alt={poc.creator.name}
                    className="w-12 h-12 rounded-full border-2 border-emerald-400/70 object-cover"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-300 dark:text-slate-300 light:text-slate-700">
                        Baicodeando:
                      </span>
                      <h4 className="font-bold text-sm text-white dark:text-white light:text-slate-900">
                        {poc.creator.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {poc.creator.handle}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      PoC: <strong className="text-cyan-400">{poc.title}</strong>{' '}
                      <span className="text-emerald-400 font-bold">({poc.ticker})</span>
                    </p>
                  </div>
                </div>

                {/* Current Fuel Gauge */}
                <div className="text-left sm:text-right bg-slate-900/90 dark:bg-slate-900/90 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-300 rounded-xl p-2.5 px-3">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">
                    Tokens Restantes en Pool
                  </span>
                  <div className="flex items-center gap-1.5 sm:justify-end">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span className="font-mono font-extrabold text-sm text-emerald-400">
                      {formatTokenCount(fuelPool.totalTokensRemaining)} Tokens
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 block">
                    ~${fuelPool.creditsUsd.toFixed(2)} USD • {fuelPool.sponsorsCount} Mecenas
                  </span>
                </div>
              </div>

              {/* Model Selection Bar */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-300 dark:text-slate-300 light:text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Modelo de IA a Alimentar en OpenRouter:</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {activeModel.speed} • Contexto {activeModel.contextLength.toLocaleString()} tokens
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {OPENROUTER_MODELS.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => handleModelChange(model.id)}
                      className={`p-2.5 rounded-xl border text-left transition flex items-start justify-between cursor-pointer ${
                        selectedModelId === model.id
                          ? 'bg-cyan-500/15 border-cyan-500 text-white dark:text-white light:text-slate-900 shadow-sm'
                          : 'bg-slate-950/60 dark:bg-slate-950/60 light:bg-slate-50 border-slate-800 dark:border-slate-800 light:border-slate-200 text-slate-300 dark:text-slate-400 light:text-slate-600 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs">{model.name}</span>
                          {model.badge && (
                            <span className="text-[9px] bg-slate-800 dark:bg-slate-800 light:bg-slate-200 text-cyan-300 dark:text-cyan-300 light:text-cyan-800 px-1.5 py-0.2 rounded font-mono">
                              {model.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 light:text-slate-500 line-clamp-1 mt-0.5">
                          {model.provider} • {model.category}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold shrink-0 ml-1">
                        ${model.costPer1mPromptTokensUsd}/1M
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fuel Packs Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-200 dark:text-slate-200 light:text-slate-800 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Selecciona el Pack de Tokens:</span>
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setUseCustom(false)}
                      className={`text-[11px] px-2 py-0.5 rounded transition ${
                        !useCustom
                          ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Packs Fijos
                    </button>
                    <button
                      onClick={() => setUseCustom(true)}
                      className={`text-[11px] px-2 py-0.5 rounded transition ${
                        useCustom
                          ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Cantidad Libre
                    </button>
                  </div>
                </div>

                {!useCustom ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {OPENROUTER_FUEL_TIERS.map((tier) => (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setSelectedTierId(tier.id)}
                        className={`relative p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          selectedTierId === tier.id
                            ? 'bg-emerald-500/10 dark:bg-emerald-950/30 light:bg-emerald-50/70 border-emerald-500 text-white dark:text-white light:text-slate-900 shadow-md shadow-emerald-500/10'
                            : 'bg-slate-950/60 dark:bg-slate-950/60 light:bg-slate-50 border-slate-800 dark:border-slate-800 light:border-slate-200 text-slate-300 dark:text-slate-400 light:text-slate-600 hover:border-slate-700'
                        }`}
                      >
                        {tier.popular && (
                          <span className="absolute -top-2 right-3 text-[9px] font-mono font-extrabold uppercase bg-emerald-500 text-black px-2 py-0.5 rounded-full shadow-sm">
                            Popular
                          </span>
                        )}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs flex items-center gap-1.5">
                              <span>{tier.icon}</span>
                              <span>{tier.title}</span>
                            </span>
                            <span className="font-mono text-xs font-extrabold text-emerald-400">
                              {formatTokenCount(tier.tokens)}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-400 light:text-slate-600 line-clamp-1">
                            {tier.subtitle}
                          </p>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-800 dark:border-slate-800 light:border-slate-200 flex items-center justify-between text-[11px] font-mono">
                          <span className="text-slate-400 text-[10px]">{tier.promptEquivalent}</span>
                          <span className="text-white dark:text-white light:text-slate-900 font-bold">
                            {tier.costSol} SOL <span className="text-slate-500 text-[10px]">(${tier.costUsd})</span>
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-950/70 dark:bg-slate-950/70 light:bg-slate-50 border border-slate-800 dark:border-slate-800 light:border-slate-200 rounded-xl p-3.5 space-y-3">
                    <label className="text-xs font-mono text-slate-300 dark:text-slate-300 light:text-slate-700 block">
                      Introduce la cantidad en SOL a convertir a Tokens OpenRouter:
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.005"
                          value={customSol}
                          onChange={(e) => setCustomSol(e.target.value)}
                          className="w-full bg-slate-900 dark:bg-slate-900 light:bg-white border border-slate-700 dark:border-slate-700 light:border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-white dark:text-white light:text-slate-900 focus:outline-none focus:border-emerald-500"
                          placeholder="0.05"
                        />
                        <span className="absolute right-3 top-2 text-xs font-mono text-slate-400">SOL</span>
                      </div>
                      <div className="text-right font-mono text-xs">
                        <span className="text-emerald-400 font-bold block">
                          ~{formatTokenCount(tokensToInject)} Tokens
                        </span>
                        <span className="text-[10px] text-slate-400">(${costUsd} USD)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Encouragement Message to the Streamer */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-300 dark:text-slate-300 light:text-slate-700 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Mensaje de Ánimo para el Streamer en Vivo:</span>
                </label>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="¡Vamos con ese hotfix en vivo!"
                  className="w-full bg-slate-950/80 dark:bg-slate-950/80 light:bg-slate-50 border border-slate-800 dark:border-slate-800 light:border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-white dark:text-white light:text-slate-900 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                  maxLength={120}
                />
                <span className="text-[10px] text-slate-500 font-mono block">
                  Aparecerá en el chat en vivo del PoC y en la alerta en pantalla de la arena.
                </span>
              </div>

              {/* Action Bar */}
              <div className="bg-slate-950 dark:bg-slate-950 light:bg-slate-100 border border-slate-800 dark:border-slate-800 light:border-slate-300 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Saldo en tu Billetera:</span>
                    <strong className="text-white dark:text-white light:text-slate-900">
                      {formatSol(wallet.solBalance)} SOL
                    </strong>
                  </div>
                  {!canAfford && (
                    <span className="text-[11px] text-rose-400 font-bold block mt-0.5">
                      ⚠️ Saldo insuficiente. Reclama en el Faucet primero.
                    </span>
                  )}
                </div>

                <button
                  onClick={handleInject}
                  disabled={!canAfford || isSubmitting || costSol <= 0}
                  className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-cyan-400 hover:from-emerald-400 hover:to-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-extrabold text-xs px-6 py-2.5 rounded-xl transition shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-black" />
                  <span>
                    {isSubmitting
                      ? 'Inyectando Tokens...'
                      : `Inyectar ${formatTokenCount(tokensToInject)} Tokens (${costSol.toFixed(3)} SOL)`}
                  </span>
                </button>
              </div>

              {/* Recent OpenRouter Sponsors for this PoC */}
              {poc.openRouterSponsorships && poc.openRouterSponsorships.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800 dark:border-slate-800 light:border-slate-200">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span className="flex items-center gap-1 text-cyan-400 font-bold">
                      <Users className="w-3.5 h-3.5" />
                      <span>Mecenas de IA de {poc.ticker}</span>
                    </span>
                    <span>{poc.openRouterSponsorships.length} aportaciones</span>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {poc.openRouterSponsorships.map((sp) => (
                      <div
                        key={sp.id}
                        className="bg-slate-950/60 dark:bg-slate-950/60 light:bg-slate-50 border border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 rounded-lg p-2 flex items-center justify-between text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400">⚡</span>
                          <div>
                            <span className="text-white dark:text-white light:text-slate-900 font-bold">
                              {sp.sponsorName}
                            </span>
                            {sp.message && (
                              <p className="text-[10px] text-slate-400 dark:text-slate-400 light:text-slate-500 italic line-clamp-1">
                                "{sp.message}"
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-emerald-400 font-bold">
                            +{formatTokenCount(sp.tokensAmount)}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {sp.costSol} SOL
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
