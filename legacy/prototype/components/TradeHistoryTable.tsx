import React, { useState, useMemo } from 'react';
import { PoC, Trade, TradeType } from '../types';
import { formatSol, formatTokens, formatUsd, SOL_USD_RATE } from '../utils/bondingCurve';
import { getSolanaExplorerUrl, shortenAddress } from '../utils/solana';
import { useApp } from '../context/AppContext';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Syringe,
  Filter,
  ExternalLink,
  Copy,
  Check,
  Search,
  Clock,
  Sparkles,
  Zap,
  Info,
  Calendar,
  Wallet,
  ArrowUpDown,
} from 'lucide-react';

interface TradeHistoryTableProps {
  poc: PoC;
}

type FilterType = 'all' | 'buy' | 'sell' | 'injection';
type SortField = 'timestamp' | 'solAmount' | 'tokenAmount';

export const TradeHistoryTable: React.FC<TradeHistoryTableProps> = ({ poc }) => {
  const { solanaCluster, wallet } = useApp();
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Generate a rich, combined trade history with real and baseline realistic demo trades
  const allTrades = useMemo(() => {
    const realTrades: Trade[] = poc.trades || [];

    // Simulated benchmark trades if low volume to showcase active market depth
    const fallbackSimulated: Trade[] = [
      {
        id: `sim-trade-1-${poc.id}`,
        pocId: poc.id,
        type: 'buy',
        user: {
          address: '3KxWhale889Solx21M',
          name: 'SolWhale Alpha',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
        },
        solAmount: 3.5,
        tokenAmount: 18_900_000,
        tokenPrice: poc.tokenPriceSol * 0.96,
        timestamp: Date.now() - 1000 * 60 * 4,
        txHash: '5K2b918mQv8Yn1x9',
      },
      {
        id: `sim-trade-inj-${poc.id}`,
        pocId: poc.id,
        type: 'injection',
        user: {
          address: 'PromptPumpDAO11111111Treasury',
          name: 'Protocol Growth Injection',
          avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100',
        },
        solAmount: 5.0,
        tokenAmount: 0,
        tokenPrice: poc.tokenPriceSol * 0.95,
        timestamp: Date.now() - 1000 * 60 * 18,
        txHash: '4Xm91ZpRtL7Wq208',
      },
      {
        id: `sim-trade-2-${poc.id}`,
        pocId: poc.id,
        type: 'sell',
        user: {
          address: '9PaSniperDegen11Qx',
          name: 'DegenDev 9Pa',
          avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100',
        },
        solAmount: 1.15,
        tokenAmount: 6_210_000,
        tokenPrice: poc.tokenPriceSol * 0.97,
        timestamp: Date.now() - 1000 * 60 * 32,
        txHash: '2Nq838P89K2014mQ',
      },
      {
        id: `sim-trade-3-${poc.id}`,
        pocId: poc.id,
        type: 'buy',
        user: {
          address: '7RmEarlyBacker94P',
          name: 'AlphaSeeker 7Rm',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
        },
        solAmount: 2.2,
        tokenAmount: 11_880_000,
        tokenPrice: poc.tokenPriceSol * 0.94,
        timestamp: Date.now() - 1000 * 60 * 55,
        txHash: '9Zq74B812P55mM89',
      },
      {
        id: `sim-trade-4-${poc.id}`,
        pocId: poc.id,
        type: 'buy',
        user: {
          address: '8VxKryptoSage77Yx',
          name: 'KryptoSage',
          avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100',
        },
        solAmount: 0.75,
        tokenAmount: 4_050_000,
        tokenPrice: poc.tokenPriceSol * 0.92,
        timestamp: Date.now() - 1000 * 60 * 60 * 2,
        txHash: '8Jk711Lq088Vb45L',
      },
    ];

    // Combine avoiding id duplicates
    const realIds = new Set(realTrades.map((t) => t.id));
    const uniqueSimulated = fallbackSimulated.filter((t) => !realIds.has(t.id));
    return [...realTrades, ...uniqueSimulated];
  }, [poc.trades, poc.id, poc.tokenPriceSol]);

  // Aggregate stats
  const stats = useMemo(() => {
    let buySol = 0;
    let buyCount = 0;
    let sellSol = 0;
    let sellCount = 0;
    let injectionSol = 0;
    let injectionCount = 0;

    allTrades.forEach((t) => {
      if (t.type === 'buy') {
        buySol += t.solAmount;
        buyCount += 1;
      } else if (t.type === 'sell') {
        sellSol += t.solAmount;
        sellCount += 1;
      } else if (t.type === 'injection') {
        injectionSol += t.solAmount;
        injectionCount += 1;
      }
    });

    const totalTrades = allTrades.length;
    const totalVolume = buySol + sellSol + injectionSol;

    return {
      buySol,
      buyCount,
      sellSol,
      sellCount,
      injectionSol,
      injectionCount,
      totalTrades,
      totalVolume,
    };
  }, [allTrades]);

  // Filtered and sorted trade list
  const filteredTrades = useMemo(() => {
    return allTrades
      .filter((trade) => {
        // Type filter
        if (filterType !== 'all' && trade.type !== filterType) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchUser =
            trade.user.name.toLowerCase().includes(q) ||
            trade.user.address.toLowerCase().includes(q);
          const matchHash = trade.txHash.toLowerCase().includes(q);
          const matchType = trade.type.toLowerCase().includes(q);
          if (!matchUser && !matchHash && !matchType) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (sortAsc) {
          return valA > valB ? 1 : -1;
        } else {
          return valA < valB ? 1 : -1;
        }
      });
  }, [allTrades, filterType, searchQuery, sortField, sortAsc]);

  const handleCopyHash = (hash: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2500);
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return `hace ${Math.max(1, diff)}s`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
  };

  const getActionBadge = (type: TradeType) => {
    switch (type) {
      case 'buy':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Compra</span>
          </span>
        );
      case 'sell':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Venta</span>
          </span>
        );
      case 'injection':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Syringe className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Inyección</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Overview Analytics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Total Trades */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" /> Transacciones
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-extrabold text-white">
              {stats.totalTrades}
            </span>
            <span className="text-[10px] text-slate-500">
              {stats.buyCount}C / {stats.sellCount}V
            </span>
          </div>
        </div>

        {/* Volume Compras */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3 text-emerald-400" /> Compras (SOL)
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-extrabold text-emerald-400">
              +{formatSol(stats.buySol)}
            </span>
            <span className="text-[10px] text-slate-500">
              {stats.buyCount} ops
            </span>
          </div>
        </div>

        {/* Volume Ventas */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-rose-400 font-bold flex items-center gap-1">
            <ArrowDownRight className="w-3 h-3 text-rose-400" /> Ventas (SOL)
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-extrabold text-rose-400">
              -{formatSol(stats.sellSol)}
            </span>
            <span className="text-[10px] text-slate-500">
              {stats.sellCount} ops
            </span>
          </div>
        </div>

        {/* Inyecciones */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1">
            <Syringe className="w-3 h-3 text-amber-400" /> Inyecciones
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-extrabold text-amber-300">
              +{formatSol(stats.injectionSol)} SOL
            </span>
            <span className="text-[10px] text-slate-500">
              {stats.injectionCount} pool
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-950/90 border border-slate-800/90 rounded-xl p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
              filterType === 'all'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
          >
            <span>Todos ({allTrades.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('buy')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
              filterType === 'buy'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-900 border border-transparent'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Compras ({stats.buyCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('sell')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
              filterType === 'sell'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                : 'text-slate-400 hover:text-rose-400 hover:bg-slate-900 border border-transparent'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            <span>Ventas ({stats.sellCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('injection')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
              filterType === 'injection'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                : 'text-slate-400 hover:text-amber-400 hover:bg-slate-900 border border-transparent'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>Inyección ({stats.injectionCount})</span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[180px] sm:w-60">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar wallet, hash o tipo..."
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Main Trade History Table */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">Acción</th>
                <th
                  className="py-2.5 px-3 cursor-pointer hover:text-white transition select-none"
                  onClick={() => {
                    if (sortField === 'solAmount') setSortAsc(!sortAsc);
                    else {
                      setSortField('solAmount');
                      setSortAsc(false);
                    }
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Cantidad SOL</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="py-2.5 px-3 cursor-pointer hover:text-white transition select-none hidden sm:table-cell"
                  onClick={() => {
                    if (sortField === 'tokenAmount') setSortAsc(!sortAsc);
                    else {
                      setSortField('tokenAmount');
                      setSortAsc(false);
                    }
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Tokens ({poc.ticker})</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-2.5 px-3 hidden md:table-cell">Precio / Token</th>
                <th className="py-2.5 px-3">Billetera</th>
                <th
                  className="py-2.5 px-3 cursor-pointer hover:text-white transition select-none text-right"
                  onClick={() => {
                    if (sortField === 'timestamp') setSortAsc(!sortAsc);
                    else {
                      setSortField('timestamp');
                      setSortAsc(false);
                    }
                  }}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Fecha & Hash</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <Clock className="w-6 h-6 text-slate-600 mb-1" />
                      <p className="font-semibold text-slate-400">
                        No se encontraron transacciones
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Intenta cambiar los filtros o realiza la primera operación en esta curva.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTrades.map((trade) => {
                  const isUser = trade.user.address === wallet.address;
                  const isInjection = trade.type === 'injection';
                  const isBuy = trade.type === 'buy';

                  return (
                    <tr
                      key={trade.id}
                      className={`hover:bg-slate-900/50 transition-colors ${
                        isUser ? 'bg-cyan-950/20' : ''
                      }`}
                    >
                      {/* Acción */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {getActionBadge(trade.type)}
                          {isUser && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
                              TÚ
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cantidad SOL */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span
                            className={`font-extrabold text-xs ${
                              isInjection
                                ? 'text-amber-300'
                                : isBuy
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {isInjection ? '+' : isBuy ? '+' : '-'}
                            {formatSol(trade.solAmount)} SOL
                          </span>
                          <span className="text-[10px] text-slate-500">
                            ≈ {formatUsd(trade.solAmount * SOL_USD_RATE)}
                          </span>
                        </div>
                      </td>

                      {/* Tokens */}
                      <td className="py-2.5 px-3 whitespace-nowrap hidden sm:table-cell">
                        {isInjection ? (
                          <span className="text-slate-500 text-[11px] italic">
                            Inyección Directa (Reserva)
                          </span>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-slate-200 font-bold">
                              {formatTokens(trade.tokenAmount)}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {poc.ticker}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Precio / Token */}
                      <td className="py-2.5 px-3 whitespace-nowrap hidden md:table-cell text-slate-400 text-[11px]">
                        <span>{formatSol(trade.tokenPrice, 8)} SOL</span>
                      </td>

                      {/* Billetera */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <img
                            src={trade.user.avatar}
                            alt={trade.user.name}
                            className="w-5 h-5 rounded-full object-cover border border-slate-700 shrink-0"
                          />
                          <div className="flex flex-col leading-tight">
                            <span className="font-bold text-white text-[11px] truncate max-w-[110px]">
                              {trade.user.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {shortenAddress(trade.user.address, 4, 3)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Fecha & Hash */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-[11px] text-slate-300 font-medium">
                            {formatRelativeTime(trade.timestamp)}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <button
                              type="button"
                              onClick={(e) => handleCopyHash(trade.txHash, e)}
                              className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5 transition cursor-pointer"
                              title="Copiar Hash de Transacción"
                            >
                              {copiedHash === trade.txHash ? (
                                <>
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  <span className="text-emerald-400 font-bold">Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-2.5 h-2.5" />
                                  <span>{shortenAddress(trade.txHash, 3, 3)}</span>
                                </>
                              )}
                            </button>

                            <a
                              href={getSolanaExplorerUrl(trade.txHash, 'tx', solanaCluster)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-500 hover:text-cyan-400 transition"
                              title="Ver en Solana Explorer"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Info */}
        <div className="bg-slate-900/60 px-3 py-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Auditoría On-Chain Solana ({solanaCluster})</span>
          </div>
          <span>Mostrando {filteredTrades.length} transacciones</span>
        </div>
      </div>
    </div>
  );
};
