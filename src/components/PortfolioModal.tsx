import React from 'react';
import { useApp } from '../context/AppContext';
import { X, PieChart, Coins, ArrowUpRight, TrendingUp, TrendingDown, Play } from 'lucide-react';
import { formatSol, formatTokens, formatUsd, SOL_USD_RATE } from '../utils/bondingCurve';

export const PortfolioModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { wallet, pocs, setActivePoC, sellTokens, claimFaucet } = useApp();

  // Calculate portfolio totals
  let totalHoldingsValueSol = 0;
  let totalInvestedSol = 0;

  const userHoldingsList = Object.values(wallet.holdings)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#0c1017] border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono">My PoC Portfolio & Wallet</h2>
              <p className="text-xs text-slate-400 font-mono">
                {wallet.address} ({wallet.name})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={claimFaucet}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 text-xs font-semibold px-3 py-1.5 rounded-xl transition cursor-pointer"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>+5 SOL Airdrop</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Portfolio Summary HUD */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider block">
              Total Net Worth
            </span>
            <span className="text-lg font-bold font-mono text-white">
              {formatSol(totalPortfolioSol)} SOL
            </span>
            <span className="text-xs text-slate-400 font-mono block">
              ≈ {formatUsd(totalPortfolioSol * SOL_USD_RATE)}
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider block">
              Liquid SOL Balance
            </span>
            <span className="text-lg font-bold font-mono text-emerald-400">
              {formatSol(wallet.solBalance)} SOL
            </span>
            <span className="text-xs text-slate-400 font-mono block">
              Available to Ape
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider block">
              Unrealized Profit / Loss
            </span>
            <div className={`flex items-center gap-1 text-lg font-bold font-mono ${totalPnlSol >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalPnlSol >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{totalPnlSol >= 0 ? '+' : ''}{formatSol(totalPnlSol)} SOL</span>
            </div>
            <span className={`text-xs font-mono font-semibold ${totalPnlSol >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Holdings List */}
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
            Invested Proof-of-Concepts ({userHoldingsList.length})
          </h3>

          {userHoldingsList.length === 0 ? (
            <div className="bg-slate-950/80 border border-slate-900 rounded-xl p-8 text-center space-y-2">
              <span className="text-3xl block">🚀</span>
              <h4 className="text-sm font-bold text-white">No active PoC investments</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Explore the live prompter feed and ape into your first Proof of Concept on the bonding curve!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {userHoldingsList.map((item) => {
                if (!item.poc) return null;
                return (
                  <div
                    key={item.pocId}
                    className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold font-mono">
                        ⚡
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{item.poc.title}</h4>
                          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            {item.poc.ticker}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono">
                          Holding: {formatTokens(item.tokenAmount)} tokens (Curve: {item.poc.bondingCurveProgress.toFixed(1)}%)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right font-mono text-xs">
                      <div>
                        <span className="text-white font-bold block">{formatSol(item.currentValSol)} SOL</span>
                        <span className={`text-[11px] font-semibold ${item.pnlSol >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {item.pnlPercent >= 0 ? '+' : ''}{item.pnlPercent.toFixed(1)}%
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (item.poc) {
                              setActivePoC(item.poc);
                              onClose();
                            }
                          }}
                          className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Open</span>
                        </button>
                        <button
                          onClick={() => sellTokens(item.poc!.id, Math.floor(item.tokenAmount * 0.5), 5)}
                          className="bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/40 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer"
                        >
                          Sell 50%
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent Trades Table */}
          {wallet.tradeHistory && wallet.tradeHistory.length > 0 && (
            <div className="pt-4 border-t border-slate-800/80 space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                Recent Wallet Transactions
              </h4>
              <div className="space-y-1">
                {wallet.tradeHistory.slice(0, 5).map((tr) => (
                  <div key={tr.id} className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 flex items-center justify-between text-xs font-mono">
                    <span className={tr.type === 'buy' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {tr.type === 'buy' ? '🟢 BUY' : '🔴 SELL'} {formatSol(tr.solAmount)} SOL
                    </span>
                    <span className="text-slate-400">{formatTokens(tr.tokenAmount)} tokens</span>
                    <span className="text-slate-500 text-[11px]">{new Date(tr.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
