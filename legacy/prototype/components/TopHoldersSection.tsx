import React, { useMemo } from 'react';
import { PoC } from '../types';
import { useApp } from '../context/AppContext';
import {
  Users,
  ShieldCheck,
  Crown,
  Sparkles,
  TrendingUp,
  Coins,
  CheckCircle2,
  Clock,
  Layers,
  Flame,
} from 'lucide-react';
import {
  formatSol,
  formatTokens,
  formatUsd,
  TOTAL_SUPPLY,
  SOL_USD_RATE,
} from '../utils/bondingCurve';

export interface TopHolder {
  rank: number;
  address: string;
  name: string;
  avatar: string;
  tokens: number;
  percentage: number;
  valueSol: number;
  valueUsd: number;
  role: 'curve' | 'creator' | 'whale' | 'user' | 'community';
  activity: {
    lastActive: string;
    tradeCount: number;
    summary: string;
    badge?: string;
  };
  isCurrentUser?: boolean;
}

interface TopHoldersSectionProps {
  poc: PoC;
}

export const TopHoldersSection: React.FC<TopHoldersSectionProps> = ({ poc }) => {
  const { wallet } = useApp();

  const { holders, curveRemaining, curvePercent, topHoldersConcentration } = useMemo(() => {
    const userHolding = wallet.holdings[poc.id];
    const userTokens = userHolding ? userHolding.tokenAmount : 0;

    // Remaining tokens in bonding curve reserve
    const unsoldTokens = Math.max(0, TOTAL_SUPPLY - poc.tokensSold);
    const curvePct = (unsoldTokens / TOTAL_SUPPLY) * 100;

    // Creator allocation (simulated ~3.5% or initial dev buy)
    const creatorTokens = Math.min(poc.tokensSold, 35_000_000);

    // Build raw list of known unique holders
    const list: Omit<TopHolder, 'rank'>[] = [];

    // 1. Bonding Curve Contract
    list.push({
      address: 'CurveProgram1111111111111111111111111111',
      name: 'Bonding Curve Reserve',
      avatar: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=100',
      tokens: unsoldTokens,
      percentage: curvePct,
      valueSol: unsoldTokens * poc.tokenPriceSol,
      valueUsd: unsoldTokens * poc.tokenPriceSol * SOL_USD_RATE,
      role: 'curve',
      activity: {
        lastActive: 'Now (Real-time)',
        tradeCount: poc.trades.length,
        summary: `${poc.bondingCurveProgress.toFixed(1)}% filled towards Raydium migration`,
        badge: 'AMM Reserve',
      },
    });

    // 2. Creator
    list.push({
      address: poc.creator.address,
      name: `${poc.creator.name} (${poc.creator.handle})`,
      avatar: poc.creator.avatar,
      tokens: creatorTokens,
      percentage: (creatorTokens / TOTAL_SUPPLY) * 100,
      valueSol: creatorTokens * poc.tokenPriceSol,
      valueUsd: creatorTokens * poc.tokenPriceSol * SOL_USD_RATE,
      role: 'creator',
      activity: {
        lastActive: `${Math.floor((Date.now() - poc.createdAt) / 3600000)}h ago`,
        tradeCount: 1,
        summary: `Authored ${poc.promptHistory.length} prompt iteration${poc.promptHistory.length > 1 ? 's' : ''}`,
        badge: 'Prompt Architect',
      },
    });

    // 3. Current User (if holds tokens)
    if (userTokens > 0) {
      const userTrades = wallet.tradeHistory.filter((t) => t.pocId === poc.id);
      const lastTradeTime = userTrades.length > 0 ? userTrades[0].timestamp : Date.now();
      const minsAgo = Math.max(1, Math.floor((Date.now() - lastTradeTime) / 60000));

      list.push({
        address: wallet.address,
        name: `You (${wallet.name})`,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
        tokens: userTokens,
        percentage: (userTokens / TOTAL_SUPPLY) * 100,
        valueSol: userTokens * poc.tokenPriceSol,
        valueUsd: userTokens * poc.tokenPriceSol * SOL_USD_RATE,
        role: 'user',
        isCurrentUser: true,
        activity: {
          lastActive: `${minsAgo}m ago`,
          tradeCount: Math.max(1, userTrades.length),
          summary: `Invested ${formatSol(userHolding?.totalInvestedSol || 0)} SOL total`,
          badge: 'Active Wallet',
        },
      });
    }

    // 4. Extract known buyers from actual trades on this PoC
    const tradeHoldersMap = new Map<string, { name: string; avatar: string; address: string; tokens: number; txCount: number; lastTime: number }>();
    for (const t of poc.trades) {
      if (t.user.address === wallet.address) continue; // already added user
      if (t.type === 'injection') continue; // Protocol liquidity injection has no circulating token deduction
      const existing = tradeHoldersMap.get(t.user.address);
      if (existing) {
        existing.tokens += t.type === 'buy' ? t.tokenAmount : -t.tokenAmount;
        existing.txCount += 1;
        existing.lastTime = Math.max(existing.lastTime, t.timestamp);
      } else {
        tradeHoldersMap.set(t.user.address, {
          name: t.user.name,
          avatar: t.user.avatar,
          address: t.user.address,
          tokens: t.tokenAmount,
          txCount: 1,
          lastTime: t.timestamp,
        });
      }
    }

    tradeHoldersMap.forEach((holder) => {
      if (holder.tokens > 1000) {
        const minsAgo = Math.max(2, Math.floor((Date.now() - holder.lastTime) / 60000));
        list.push({
          address: holder.address,
          name: holder.name,
          avatar: holder.avatar,
          tokens: holder.tokens,
          percentage: (holder.tokens / TOTAL_SUPPLY) * 100,
          valueSol: holder.tokens * poc.tokenPriceSol,
          valueUsd: holder.tokens * poc.tokenPriceSol * SOL_USD_RATE,
          role: 'whale',
          activity: {
            lastActive: `${minsAgo}m ago`,
            tradeCount: holder.txCount,
            summary: `Executed ${holder.txCount} trade${holder.txCount > 1 ? 's' : ''} on bonding curve`,
            badge: holder.tokens > 20_000_000 ? 'Whale Backer' : 'Early Investor',
          },
        });
      }
    });

    // 5. Seed simulated realistic community whales based on poc.id if needed
    const defaultWhales = [
      {
        address: '5Rm...91P',
        name: 'AlphaSeeker.sol',
        avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100',
        ratio: 0.12,
        activityTime: '8m ago',
        txs: 3,
        summary: 'Diamond handing • 0 sells recorded',
        badge: 'Diamond Hands',
      },
      {
        address: '9Pa...11Q',
        name: 'DegenQuant',
        avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=100',
        ratio: 0.08,
        activityTime: '24m ago',
        txs: 4,
        summary: 'Accumulated during initial prompt v1.0',
        badge: 'Early Backer',
      },
      {
        address: '4Wz...89K',
        name: 'SolSniper_AI',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
        ratio: 0.05,
        activityTime: '1h ago',
        txs: 2,
        summary: 'Aped immediately upon prompt launch',
        badge: 'Prompt Sniper',
      },
      {
        address: '2Vb...45L',
        name: 'KryptoSage',
        avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100',
        ratio: 0.035,
        activityTime: '3h ago',
        txs: 2,
        summary: 'Suggested prompt upgrade in trollbox',
        badge: 'Community Contributor',
      },
    ];

    for (const w of defaultWhales) {
      if (!list.some((h) => h.address === w.address)) {
        const simulatedTokens = Math.max(500_000, Math.floor(poc.tokensSold * w.ratio));
        list.push({
          address: w.address,
          name: w.name,
          avatar: w.avatar,
          tokens: simulatedTokens,
          percentage: (simulatedTokens / TOTAL_SUPPLY) * 100,
          valueSol: simulatedTokens * poc.tokenPriceSol,
          valueUsd: simulatedTokens * poc.tokenPriceSol * SOL_USD_RATE,
          role: 'whale',
          activity: {
            lastActive: w.activityTime,
            tradeCount: w.txs,
            summary: w.summary,
            badge: w.badge,
          },
        });
      }
    }

    // Sort by tokens descending
    list.sort((a, b) => b.tokens - a.tokens);

    // Assign rank
    const rankedList: TopHolder[] = list.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

    // Calculate top holders concentration excluding curve
    const nonCurveHolders = rankedList.filter((h) => h.role !== 'curve');
    const topConcentration = nonCurveHolders.slice(0, 5).reduce((acc, h) => acc + h.percentage, 0);

    return {
      holders: rankedList,
      curveRemaining: unsoldTokens,
      curvePercent: curvePct,
      topHoldersConcentration: topConcentration,
    };
  }, [poc, wallet.holdings, wallet.tradeHistory]);

  return (
    <div className="space-y-4 text-xs font-mono">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase block">Total Supply</span>
          <span className="text-white font-bold text-xs">1,000,000,000</span>
          <span className="text-[10px] text-slate-500 block">100% Fixed</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase block">Curve Reserve</span>
          <span className="text-cyan-400 font-bold text-xs">{curvePercent.toFixed(1)}%</span>
          <span className="text-[10px] text-slate-400 block">{formatTokens(curveRemaining)} left</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase block">Total Holders</span>
          <span className="text-emerald-400 font-bold text-xs">{poc.holdersCount} Wallets</span>
          <span className="text-[10px] text-slate-400 block">Unique addresses</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase block">Top 5 Concentration</span>
          <span className="text-amber-400 font-bold text-xs">{topHoldersConcentration.toFixed(1)}%</span>
          <span className="text-[10px] text-slate-400 block">Circulating supply</span>
        </div>
      </div>

      {/* Segmented Distribution Bar */}
      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ownership Distribution Breakdown</span>
          </span>
          <span className="text-slate-400 text-[10px]">100% Accounted</span>
        </div>

        {/* Visual segmented bar */}
        <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-900 p-0.5 border border-slate-800 gap-0.5">
          {holders.slice(0, 6).map((h, i) => {
            const colors = [
              'bg-indigo-500',
              'bg-emerald-500',
              'bg-cyan-400',
              'bg-amber-400',
              'bg-purple-400',
              'bg-rose-400',
            ];
            const color = h.isCurrentUser ? 'bg-emerald-400' : colors[i % colors.length];
            return (
              <div
                key={h.address}
                title={`${h.name}: ${h.percentage.toFixed(2)}%`}
                style={{ width: `${Math.max(1.5, h.percentage)}%` }}
                className={`${color} h-full rounded-sm transition-all duration-500 hover:brightness-125 cursor-pointer`}
              />
            );
          })}
          {/* Remainder */}
          <div
            title="Other Community Holders"
            className="flex-1 bg-slate-800 h-full rounded-sm"
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-slate-400">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span>Bonding Curve Reserve ({curvePercent.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Creator / Dev</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span>Top Whale</span>
          </div>
          {wallet.holdings[poc.id]?.tokenAmount > 0 && (
            <div className="flex items-center gap-1 font-bold text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>You ({((wallet.holdings[poc.id].tokenAmount / TOTAL_SUPPLY) * 100).toFixed(2)}%)</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-800"></span>
            <span>Other Community</span>
          </div>
        </div>
      </div>

      {/* Top Holders Ranked Table / List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span>Rank & Holder Account</span>
          <div className="flex items-center gap-8">
            <span className="hidden sm:inline">User Activity</span>
            <span>Holdings / Share</span>
          </div>
        </div>

        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {holders.map((holder) => {
            const isTop3 = holder.rank <= 3;
            const rankBadges = ['🥇', '🥈', '🥉'];

            return (
              <div
                key={holder.address}
                className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  holder.isCurrentUser
                    ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md shadow-emerald-950/30'
                    : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Left: Rank & User Avatar / Role */}
                <div className="flex items-center gap-2.5 min-w-[200px]">
                  <div className="w-6 text-center font-bold font-mono">
                    {isTop3 ? (
                      <span className="text-sm">{rankBadges[holder.rank - 1]}</span>
                    ) : (
                      <span className="text-slate-500 text-xs">#{holder.rank}</span>
                    )}
                  </div>

                  <div className="relative shrink-0">
                    <img
                      src={holder.avatar}
                      alt={holder.name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-700"
                    />
                    {holder.isCurrentUser && (
                      <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border border-slate-950 flex items-center justify-center text-[7px] text-black font-extrabold">
                        ✓
                      </span>
                    )}
                  </div>

                  <div className="leading-tight">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-bold text-xs truncate max-w-[140px] ${holder.isCurrentUser ? 'text-emerald-300' : 'text-slate-100'}`}>
                        {holder.name}
                      </span>
                      {holder.activity.badge && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                            holder.role === 'curve'
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                              : holder.role === 'creator'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : holder.isCurrentUser
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                          }`}
                        >
                          {holder.activity.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                    </span>
                  </div>
                </div>

                {/* Middle: User Activity Details */}
                <div className="text-[11px] text-slate-300 bg-slate-950/70 p-2 rounded-lg border border-slate-900 sm:max-w-xs flex-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Clock className="w-2.5 h-2.5 text-slate-400" />
                      <span>Active: {holder.activity.lastActive}</span>
                    </span>
                    <span className="font-mono text-cyan-400 font-bold">
                      {holder.activity.tradeCount} tx{holder.activity.tradeCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] line-clamp-1 italic">
                    "{holder.activity.summary}"
                  </p>
                </div>

                {/* Right: Holding Amount & Share % */}
                <div className="text-right shrink-0 min-w-[110px]">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="font-bold text-xs text-white">
                      {formatTokens(holder.tokens)}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">
                      {holder.percentage.toFixed(2)}%
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    ≈ {formatSol(holder.valueSol)} SOL ({formatUsd(holder.valueUsd)})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
