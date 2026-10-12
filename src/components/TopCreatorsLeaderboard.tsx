import React, { useState, useMemo } from 'react';
import { PoC } from '../types';
import { useApp } from '../context/AppContext';
import { formatSol, formatUsd, SOL_USD_RATE } from '../utils/bondingCurve';
import { shortenAddress, getSolanaExplorerUrl } from '../utils/solana';
import {
  Trophy,
  Medal,
  Crown,
  TrendingUp,
  Flame,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Search,
  Zap,
  BarChart3,
  Layers,
  Rocket,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';

export interface CreatorLeaderboardEntry {
  handle: string;
  name: string;
  avatar: string;
  address: string;
  graduatedCount: number;
  pocs: PoC[];
  totalVolumeSol: number;
  totalSolPooled: number;
  totalMarketCapUsd: number;
  topPoC: PoC;
}

interface TopCreatorsLeaderboardProps {
  onSelectCreator?: (creatorHandle: string) => void;
  selectedCreatorFilter?: string | null;
  onClearCreatorFilter?: () => void;
  onLaunchPoC?: () => void;
  className?: string;
}

type SortMetric = 'volume' | 'pooled' | 'pocs';

export const TopCreatorsLeaderboard: React.FC<TopCreatorsLeaderboardProps> = ({
  onSelectCreator,
  selectedCreatorFilter,
  onClearCreatorFilter,
  onLaunchPoC,
  className = '',
}) => {
  const { pocs, setActivePoC, setGlobalNotification, solanaCluster } = useApp();
  const [sortMetric, setSortMetric] = useState<SortMetric>('volume');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Group all PoCs by creator and calculate metrics
  const rankedCreators = useMemo(() => {
    const creatorMap = new Map<string, {
      handle: string;
      name: string;
      avatar: string;
      address: string;
      graduatedCount: number;
      pocs: PoC[];
      totalVolumeSol: number;
      totalSolPooled: number;
      totalMarketCapUsd: number;
    }>();

    pocs.forEach((poc) => {
      const key = poc.creator.handle || poc.creator.address || poc.creator.name;
      const existing = creatorMap.get(key);

      const graduatedInPlatform = (poc.isGraduated || poc.bondingCurveProgress >= 100) ? 1 : 0;

      if (!existing) {
        creatorMap.set(key, {
          handle: poc.creator.handle,
          name: poc.creator.name,
          avatar: poc.creator.avatar,
          address: poc.creator.address,
          graduatedCount: (poc.creator.graduatedCount || 0) + graduatedInPlatform,
          pocs: [poc],
          totalVolumeSol: poc.volume24hSol,
          totalSolPooled: poc.currentSolPooled,
          totalMarketCapUsd: poc.marketCapUsd,
        });
      } else {
        existing.pocs.push(poc);
        existing.totalVolumeSol += poc.volume24hSol;
        existing.totalSolPooled += poc.currentSolPooled;
        existing.totalMarketCapUsd += poc.marketCapUsd;
        existing.graduatedCount += graduatedInPlatform;
        if (poc.creator.graduatedCount && poc.creator.graduatedCount > existing.graduatedCount) {
          existing.graduatedCount = poc.creator.graduatedCount + (poc.isGraduated ? 1 : 0);
        }
      }
    });

    // Convert map to array and sort
    const entries: CreatorLeaderboardEntry[] = Array.from(creatorMap.values()).map((c) => {
      // Find top PoC by volume or progress
      const topPoC = [...c.pocs].sort((a, b) => b.volume24hSol - a.volume24hSol)[0] || c.pocs[0];
      return {
        ...c,
        topPoC,
      };
    });

    // Sort according to chosen metric
    entries.sort((a, b) => {
      if (sortMetric === 'volume') {
        return b.totalVolumeSol - a.totalVolumeSol;
      }
      if (sortMetric === 'pooled') {
        return b.totalSolPooled - a.totalSolPooled;
      }
      return b.pocs.length - a.pocs.length;
    });

    return entries;
  }, [pocs, sortMetric]);

  // Filter creators by search query if any
  const filteredCreators = useMemo(() => {
    if (!searchQuery.trim()) return rankedCreators;
    const q = searchQuery.toLowerCase().trim();
    return rankedCreators.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.handle.toLowerCase().includes(q) ||
        c.pocs.some((p) => p.ticker.toLowerCase().includes(q) || p.title.toLowerCase().includes(q))
    );
  }, [rankedCreators, searchQuery]);

  const displayedCreators = isExpanded ? filteredCreators : filteredCreators.slice(0, 5);

  const handleCopy = async (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setGlobalNotification(`📋 Wallet copiada: ${shortenAddress(address)}`);
      setTimeout(() => {
        setCopiedAddress(null);
        setGlobalNotification(null);
      }, 2500);
    } catch {
      setGlobalNotification('No se pudo copiar la dirección');
    }
  };

  const getRankBadge = (rankIndex: number) => {
    if (rankIndex === 0) {
      return (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-300 text-black flex items-center justify-center font-black text-xs shadow-md shadow-amber-500/30 ring-1 ring-amber-300">
          <Crown className="w-4 h-4 fill-black" />
        </div>
      );
    }
    if (rankIndex === 1) {
      return (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-slate-300 to-slate-100 text-slate-900 flex items-center justify-center font-black text-xs shadow-md shadow-slate-400/20 ring-1 ring-slate-200">
          <Medal className="w-4 h-4 text-slate-800" />
        </div>
      );
    }
    if (rankIndex === 2) {
      return (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-700 to-amber-500 text-white flex items-center justify-center font-black text-xs shadow-md shadow-amber-700/30 ring-1 ring-amber-400">
          <Medal className="w-4 h-4 text-amber-200" />
        </div>
      );
    }
    return (
      <div className="w-7 h-7 rounded-lg bg-slate-900/90 dark:bg-slate-900/90 light:bg-slate-100 border border-slate-800 dark:border-slate-800 light:border-slate-200 text-slate-400 flex items-center justify-center font-mono font-bold text-xs">
        #{rankIndex + 1}
      </div>
    );
  };

  return (
    <div
      className={`bg-[#0a0e17] dark:bg-[#0a0e17] light:bg-white border border-slate-800/90 dark:border-slate-800/90 light:border-slate-200 rounded-2xl shadow-xl overflow-hidden transition-all ${className}`}
    >
      {/* Widget Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 bg-gradient-to-b from-amber-500/5 via-slate-900/40 to-transparent">
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <Trophy className="w-5 h-5 text-amber-400 fill-amber-400/20" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-bold text-white dark:text-white light:text-slate-900 tracking-tight">
                  Top Creadores
                </h3>
                <span className="text-[10px] bg-amber-500/15 text-amber-300 font-mono font-bold px-1.5 py-0.5 rounded border border-amber-500/30">
                  LEADERBOARD
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 light:text-slate-500">
                Ranking por volumen generado en Bonding Curve
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>En vivo</span>
          </div>
        </div>

        {/* Selected Creator Active Filter Banner */}
        {selectedCreatorFilter && (
          <div className="mt-2.5 p-2 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between text-xs animate-fadeIn">
            <div className="flex items-center gap-1.5 text-amber-300 font-medium truncate">
              <Filter className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span className="truncate">
                Filtrando por <strong>{selectedCreatorFilter}</strong>
              </span>
            </div>
            {onClearCreatorFilter && (
              <button
                onClick={onClearCreatorFilter}
                className="text-amber-300 hover:text-white text-[11px] font-mono underline hover:no-underline shrink-0 ml-2 cursor-pointer font-bold"
              >
                Limpiar filtro
              </button>
            )}
          </div>
        )}

        {/* Metrics Sort Tabs */}
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-800/60 dark:border-slate-800/60 light:border-slate-200">
          <button
            onClick={() => setSortMetric('volume')}
            className={`flex-1 text-[11px] font-mono py-1 px-2 rounded-lg transition text-center font-semibold cursor-pointer ${
              sortMetric === 'volume'
                ? 'bg-amber-400 text-black shadow-sm font-bold'
                : 'bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 text-slate-400 hover:text-white dark:hover:text-white light:hover:text-slate-900'
            }`}
            title="Ordenar por volumen total de trading 24h generado en SOL"
          >
            🔥 Volumen 24h
          </button>
          <button
            onClick={() => setSortMetric('pooled')}
            className={`flex-1 text-[11px] font-mono py-1 px-2 rounded-lg transition text-center font-semibold cursor-pointer ${
              sortMetric === 'pooled'
                ? 'bg-amber-400 text-black shadow-sm font-bold'
                : 'bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 text-slate-400 hover:text-white dark:hover:text-white light:hover:text-slate-900'
            }`}
            title="Ordenar por total de SOL acumulado en las bonding curves"
          >
            💧 SOL Pooled
          </button>
          <button
            onClick={() => setSortMetric('pocs')}
            className={`flex-1 text-[11px] font-mono py-1 px-2 rounded-lg transition text-center font-semibold cursor-pointer ${
              sortMetric === 'pocs'
                ? 'bg-amber-400 text-black shadow-sm font-bold'
                : 'bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 text-slate-400 hover:text-white dark:hover:text-white light:hover:text-slate-900'
            }`}
            title="Ordenar por cantidad de PoCs lanzados"
          >
            🚀 PoCs
          </button>
        </div>

        {/* Search bar inside widget if expanded */}
        {isExpanded && (
          <div className="relative mt-2.5">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar creador o ticker..."
              className="w-full bg-slate-900/90 dark:bg-slate-900/90 light:bg-slate-50 border border-slate-800 dark:border-slate-800 light:border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white dark:text-white light:text-slate-900 placeholder-slate-500 focus:outline-none focus:border-amber-400/80 transition"
            />
          </div>
        )}
      </div>

      {/* Creators List */}
      <div className="divide-y divide-slate-800/60 dark:divide-slate-800/60 light:divide-slate-200">
        {displayedCreators.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No se encontraron creadores con ese criterio.
          </div>
        ) : (
          displayedCreators.map((creator, index) => {
            const isSelected = selectedCreatorFilter === creator.handle;
            const isTop3 = index < 3;

            return (
              <div
                key={creator.handle || creator.address}
                className={`p-3.5 sm:p-4 transition-all duration-200 hover:bg-slate-900/40 dark:hover:bg-slate-900/40 light:hover:bg-slate-50 flex flex-col gap-2.5 ${
                  isSelected
                    ? 'bg-amber-500/10 dark:bg-amber-500/10 light:bg-amber-50/80 border-l-4 border-l-amber-400'
                    : isTop3
                    ? 'bg-slate-950/20'
                    : ''
                }`}
              >
                {/* Creator Rank & Primary Info */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Rank Number / Crown */}
                    <div className="shrink-0">{getRankBadge(index)}</div>

                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <img
                        src={creator.avatar}
                        alt={creator.name}
                        className="w-9 h-9 rounded-full object-cover border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 shadow-sm"
                      />
                      {creator.graduatedCount > 0 && (
                        <span
                          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[9px] shadow-sm"
                          title={`${creator.graduatedCount} PoCs Graduados a Raydium`}
                        >
                          ✓
                        </span>
                      )}
                    </div>

                    {/* Name & Handle */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-xs sm:text-sm text-white dark:text-white light:text-slate-900 truncate">
                          {creator.name}
                        </span>
                        {creator.graduatedCount >= 3 && (
                          <span title="Creador Alpha Verificado">
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-400 light:text-slate-500 font-mono">
                        <span className="truncate">{creator.handle}</span>
                        <span>•</span>
                        <span className="text-slate-500 truncate" title={creator.address}>
                          {shortenAddress(creator.address, 3, 3)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleCopy(creator.address, e)}
                          title="Copiar wallet Solana"
                          className="text-slate-500 hover:text-amber-400 transition cursor-pointer"
                        >
                          {copiedAddress === creator.address ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Volume Metric Display */}
                  <div className="text-right shrink-0 font-mono">
                    <div className="flex items-center justify-end gap-1 text-emerald-400 font-extrabold text-xs sm:text-sm">
                      <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                      <span>{formatSol(creator.totalVolumeSol, 1)} SOL</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {formatUsd(creator.totalVolumeSol * SOL_USD_RATE)}
                    </div>
                  </div>
                </div>

                {/* Sub-row: Launched PoC badges & Quick Actions */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/40 dark:border-slate-800/40 light:border-slate-100 text-[11px]">
                  {/* Launched PoCs pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar min-w-0">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider shrink-0">
                      PoCs ({creator.pocs.length}):
                    </span>
                    {creator.pocs.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePoC(p);
                        }}
                        title={`Ver ${p.title} (${p.ticker}) - ${p.bondingCurveProgress.toFixed(1)}%`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/90 dark:bg-slate-900/90 light:bg-slate-100 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/40 font-mono text-[10px] transition shrink-0 cursor-pointer"
                      >
                        <span className="font-bold">{p.ticker}</span>
                        <span className="text-emerald-400 text-[9px]">
                          {p.bondingCurveProgress.toFixed(0)}%
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Filter by Creator Button */}
                  {onSelectCreator && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isSelected && onClearCreatorFilter) {
                          onClearCreatorFilter();
                        } else {
                          onSelectCreator(creator.handle);
                        }
                      }}
                      className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition flex items-center gap-1 shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-black shadow-sm'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                      }`}
                      title={isSelected ? 'Quitar filtro de creador' : 'Filtrar marketplace por este creador'}
                    >
                      <span>{isSelected ? 'Filtrado' : 'Ver PoCs'}</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Micro stat bar: Sol Pooled & Raydium Graduations */}
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                  <span className="flex items-center gap-1">
                    <span>💧 Total Pooled:</span>
                    <strong className="text-slate-300 dark:text-slate-300 light:text-slate-700">
                      {formatSol(creator.totalSolPooled, 1)} SOL
                    </strong>
                  </span>
                  {creator.graduatedCount > 0 && (
                    <span className="text-cyan-400 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>{creator.graduatedCount} Graduados Raydium</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Widget Footer: Expand / Collapse & Call to Action */}
      <div className="p-3 sm:p-4 bg-slate-950/60 dark:bg-slate-950/60 light:bg-slate-50 border-t border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-mono text-slate-400 hover:text-white dark:hover:text-white light:hover:text-slate-900 flex items-center gap-1 transition cursor-pointer font-semibold"
          >
            <span>{isExpanded ? 'Ver Menos (Top 5)' : `Ver Todos (${filteredCreators.length})`}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <span className="text-[10px] text-slate-500 font-mono">
            Actualización en tiempo real
          </span>
        </div>

        {/* Promote Launching PoC to Compete */}
        {onLaunchPoC && (
          <button
            type="button"
            onClick={onLaunchPoC}
            className="w-full bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-cyan-500/20 hover:from-amber-500/30 hover:to-emerald-500/30 border border-amber-500/30 hover:border-amber-400/60 text-amber-300 hover:text-amber-200 text-xs font-bold py-2 px-3 rounded-xl transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95"
          >
            <Rocket className="w-3.5 h-3.5 text-amber-400" />
            <span>Lanzar PoC para entrar al Leaderboard</span>
          </button>
        )}
      </div>
    </div>
  );
};
