import React, { useMemo } from 'react';
import { PoC, Trade } from '../types';
import { formatSol, formatTokens, formatUsd, SOL_USD_RATE } from '../utils/bondingCurve';
import { Activity, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface RecentActivityTickerProps {
  poc: PoC;
}

export const RecentActivityTicker: React.FC<RecentActivityTickerProps> = ({ poc }) => {
  // Generate a rich, continuous stream of real and simulated recent bonding curve trades
  const tradesStream = useMemo(() => {
    const realTrades = poc.trades || [];

    // Realistic simulated trades to ensure ticker is always packed and alive
    const simulatedTrades: Trade[] = [
      {
        id: `sim-1-${poc.id}`,
        pocId: poc.id,
        type: 'buy',
        user: {
          address: '3Kx...82M',
          name: 'SolWhale',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
        },
        solAmount: 3.5,
        tokenAmount: 18_900_000,
        tokenPrice: poc.tokenPriceSol * 0.96,
        timestamp: Date.now() - 1000 * 60 * 3,
        txHash: '5K2b...8Yn1',
      },
      {
        id: `sim-2-${poc.id}`,
        pocId: poc.id,
        type: 'buy',
        user: {
          address: '7Rm...94P',
          name: 'DegenSniper',
          avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100',
        },
        solAmount: 1.25,
        tokenAmount: 6_750_000,
        tokenPrice: poc.tokenPriceSol * 0.98,
        timestamp: Date.now() - 1000 * 60 * 8,
        txHash: '9Zq...74B',
      },
      {
        id: `sim-3-${poc.id}`,
        pocId: poc.id,
        type: 'sell',
        user: {
          address: '2Vb...45L',
          name: 'HodlTrader',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
        },
        solAmount: 0.65,
        tokenAmount: 3_510_000,
        tokenPrice: poc.tokenPriceSol * 0.99,
        timestamp: Date.now() - 1000 * 60 * 15,
        txHash: '3Mn...21X',
      },
      {
        id: `sim-4-${poc.id}`,
        pocId: poc.id,
        type: 'buy',
        user: {
          address: '8Xq...11W',
          name: 'AlphaSeeker',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
        },
        solAmount: 2.1,
        tokenAmount: 11_340_000,
        tokenPrice: poc.tokenPriceSol * 0.95,
        timestamp: Date.now() - 1000 * 60 * 24,
        txHash: '7Ty...99K',
      },
      {
        id: `sim-5-${poc.id}`,
        pocId: poc.id,
        type: 'buy',
        user: {
          address: '4Wz...89K',
          name: 'CyberApe',
          avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=100',
        },
        solAmount: 0.8,
        tokenAmount: 4_320_000,
        tokenPrice: poc.tokenPriceSol * 0.94,
        timestamp: Date.now() - 1000 * 60 * 36,
        txHash: '2Lp...55M',
      },
    ];

    // Combine real trades with simulated trades, sorted by timestamp descending
    const combined = [...realTrades, ...simulatedTrades];
    return combined.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  }, [poc.trades, poc.id, poc.tokenPriceSol]);

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="bg-[#090d14] border-b border-slate-800/80 px-3 py-1.5 flex items-center overflow-hidden font-mono text-xs select-none">
      {/* Pinned Left Header Badge */}
      <div className="flex items-center gap-2 pr-3 border-r border-slate-800/80 shrink-0 z-10 bg-[#090d14]">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
          <Activity className="w-3 h-3" />
          <span className="hidden xs:inline">RECENT ACTIVITY</span>
        </span>
      </div>

      {/* Marquee Ticker Track */}
      <div className="overflow-hidden flex-1 relative mx-2">
        <div className="animate-marquee flex items-center gap-4 whitespace-nowrap">
          {/* We repeat the items twice for a 100% seamless infinite loop */}
          {[...tradesStream, ...tradesStream].map((trade, idx) => {
            const isBuy = trade.type === 'buy';
            const isInjection = trade.type === 'injection';
            return (
              <div
                key={`${trade.id}-${idx}`}
                className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-all hover:scale-105 cursor-default ${
                  isInjection
                    ? 'bg-amber-950/30 border-amber-500/30 text-amber-200 hover:border-amber-500/60'
                    : isBuy
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-slate-200 hover:border-emerald-500/60'
                    : 'bg-rose-950/30 border-rose-500/30 text-slate-200 hover:border-rose-500/60'
                }`}
              >
                {/* Trade Type Indicator */}
                <span
                  className={`text-[10px] font-extrabold flex items-center gap-0.5 ${
                    isInjection ? 'text-amber-400' : isBuy ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isInjection ? (
                    <span>💉</span>
                  ) : isBuy ? (
                    <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />
                  )}
                  <span>{isInjection ? 'INJECTION' : isBuy ? 'BUY' : 'SELL'}</span>
                </span>

                {/* User Name / Address */}
                <span className="text-slate-300 font-semibold text-[11px] truncate max-w-[90px]">
                  {trade.user.name}
                </span>

                {/* Volume in SOL & USD */}
                <span className="font-bold text-white text-[11px]">
                  {formatSol(trade.solAmount)} SOL
                </span>

                <span className="text-[10px] text-slate-500 hidden sm:inline">
                  ({formatUsd(trade.solAmount * SOL_USD_RATE)})
                </span>

                {/* Tokens Amount */}
                <span
                  className={`text-[10px] font-mono ${
                    isBuy ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {formatTokens(trade.tokenAmount)} {poc.ticker}
                </span>

                {/* Timestamp */}
                <span className="text-[10px] text-slate-400 border-l border-slate-800 pl-1.5">
                  {getTimeAgo(trade.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pinned Right 24h Volume Stats */}
      <div className="hidden md:flex items-center gap-1.5 pl-3 border-l border-slate-800/80 shrink-0 z-10 bg-[#090d14] text-[10px] text-slate-400">
        <span>24h Vol:</span>
        <strong className="text-white font-mono">{formatSol(poc.volume24hSol)} SOL</strong>
      </div>
    </div>
  );
};
