import React, { useState } from 'react';
import { PoC, PoCAlertConfig } from '../types';
import { useApp, DEFAULT_ALERT_MILESTONES } from '../context/AppContext';
import {
  X,
  Bell,
  BellRing,
  Check,
  Zap,
  Crown,
  Flame,
  ArrowUpRight,
  TrendingUp,
  Target,
  Sparkles,
} from 'lucide-react';
import { TARGET_SOL, formatSol, formatUsd } from '../utils/bondingCurve';

interface MilestoneAlertsModalProps {
  poc: PoC;
  isOpen: boolean;
  onClose: () => void;
}

export const MilestoneAlertsModal: React.FC<MilestoneAlertsModalProps> = ({
  poc,
  isOpen,
  onClose,
}) => {
  const { alerts, updateAlertConfig, toggleAlerts, triggerTestAlert, triggerMilestoneAlert } = useApp();

  const currentConfig: PoCAlertConfig = alerts[poc.id] || {
    pocId: poc.id,
    enabled: false,
    milestones: { ...DEFAULT_ALERT_MILESTONES },
  };

  const [enabled, setEnabled] = useState<boolean>(currentConfig.enabled);
  const [milestones, setMilestones] = useState(currentConfig.milestones);

  if (!isOpen) return null;

  const handleToggleMilestone = (key: keyof typeof DEFAULT_ALERT_MILESTONES) => {
    setMilestones((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = () => {
    updateAlertConfig(poc.id, {
      pocId: poc.id,
      enabled,
      milestones,
    });
    onClose();
  };

  // Determine next milestone
  const progress = poc.bondingCurveProgress;
  let nextMilestone = '100% Raydium Graduation';
  let nextPct = 100;
  if (progress < 25) {
    nextMilestone = '25% Curve Milestone';
    nextPct = 25;
  } else if (progress < 50) {
    nextMilestone = '50% Halfway Milestone';
    nextPct = 50;
  } else if (progress < 75) {
    nextMilestone = '75% High Velocity Curve';
    nextPct = 75;
  } else if (progress < 90) {
    nextMilestone = '90% King of the Hill';
    nextPct = 90;
  }

  const solRemainingToNext = Math.max(0, ((nextPct - progress) / 100) * TARGET_SOL);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#0c1017] border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 font-mono space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <BellRing className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Milestone Price Alerts</span>
                <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                  {poc.ticker}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Get notified when {poc.title} crosses key bonding curve thresholds
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Master Toggle */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Enable Real-Time Alerts</span>
              {enabled && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Receive high-priority banner toasts when milestones hit
            </p>
          </div>

          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              enabled ? 'bg-emerald-500' : 'bg-slate-800 border border-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                enabled ? 'left-7 bg-black' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Next Milestone Radar HUD */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-cyan-400" />
              <span>Next Milestone Radar</span>
            </span>
            <span className="text-cyan-400 font-bold">{nextMilestone}</span>
          </div>

          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (progress / nextPct) * 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
            <span>Current: {progress.toFixed(1)}%</span>
            <span>
              {solRemainingToNext > 0
                ? `Need ≈ ${formatSol(solRemainingToNext, 2)} SOL to trigger`
                : 'Milestone reached! 🎉'}
            </span>
          </div>
        </div>

        {/* Milestone Thresholds Checklist */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Select Milestone Triggers
          </span>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {/* 25% Milestone */}
            <label
              className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                milestones.at25
                  ? 'bg-slate-900/90 border-cyan-500/40 text-slate-200'
                  : 'bg-slate-950/60 border-slate-900 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2.5 text-xs">
                <input
                  type="checkbox"
                  checked={milestones.at25}
                  onChange={() => handleToggleMilestone('at25')}
                  className="accent-cyan-400 rounded"
                />
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>🎯 25% Curve Reached</span>
                    <span className="text-[10px] text-slate-400 font-normal">($21.2 SOL)</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Early liquidity proof of momentum</div>
                </div>
              </div>
              <span className="text-[10px] text-cyan-400 font-bold">25%</span>
            </label>

            {/* 50% Milestone */}
            <label
              className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                milestones.at50
                  ? 'bg-slate-900/90 border-cyan-500/40 text-slate-200'
                  : 'bg-slate-950/60 border-slate-900 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2.5 text-xs">
                <input
                  type="checkbox"
                  checked={milestones.at50}
                  onChange={() => handleToggleMilestone('at50')}
                  className="accent-cyan-400 rounded"
                />
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>🎯 50% Curve Milestone</span>
                    <span className="text-[10px] text-slate-400 font-normal">($42.5 SOL)</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Halfway mark toward Raydium migration</div>
                </div>
              </div>
              <span className="text-[10px] text-cyan-400 font-bold">50%</span>
            </label>

            {/* 75% Milestone */}
            <label
              className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                milestones.at75
                  ? 'bg-slate-900/90 border-emerald-500/40 text-slate-200'
                  : 'bg-slate-950/60 border-slate-900 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2.5 text-xs">
                <input
                  type="checkbox"
                  checked={milestones.at75}
                  onChange={() => handleToggleMilestone('at75')}
                  className="accent-emerald-400 rounded"
                />
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>⚡ 75% High Velocity Alert</span>
                    <span className="text-[10px] text-slate-400 font-normal">($63.7 SOL)</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Rapid bonding curve accumulation</div>
                </div>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold">75%</span>
            </label>

            {/* 90% Milestone */}
            <label
              className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                milestones.at90
                  ? 'bg-slate-900/90 border-amber-500/40 text-slate-200'
                  : 'bg-slate-950/60 border-slate-900 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2.5 text-xs">
                <input
                  type="checkbox"
                  checked={milestones.at90}
                  onChange={() => handleToggleMilestone('at90')}
                  className="accent-amber-400 rounded"
                />
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>👑 90% King of the Hill Alert</span>
                    <span className="text-[10px] text-slate-400 font-normal">($76.5 SOL)</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Pre-graduation top spot alert</div>
                </div>
              </div>
              <span className="text-[10px] text-amber-400 font-bold">90%</span>
            </label>

            {/* 100% Graduation */}
            <label
              className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                milestones.at100
                  ? 'bg-slate-900/90 border-emerald-500/40 text-slate-200'
                  : 'bg-slate-950/60 border-slate-900 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2.5 text-xs">
                <input
                  type="checkbox"
                  checked={milestones.at100}
                  onChange={() => handleToggleMilestone('at100')}
                  className="accent-emerald-400 rounded"
                />
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>🎉 100% Raydium Graduation</span>
                    <span className="text-[10px] text-slate-400 font-normal">($85.0 SOL)</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Instant production incubator deploy</div>
                </div>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold">100%</span>
            </label>

            {/* Whale Buys */}
            <label
              className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                milestones.whaleBuys
                  ? 'bg-slate-900/90 border-cyan-500/40 text-slate-200'
                  : 'bg-slate-950/60 border-slate-900 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2.5 text-xs">
                <input
                  type="checkbox"
                  checked={milestones.whaleBuys}
                  onChange={() => handleToggleMilestone('whaleBuys')}
                  className="accent-cyan-400 rounded"
                />
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>🐋 Whale Buys Alert</span>
                    <span className="text-[10px] text-slate-400 font-normal">(&gt; 1.0 SOL)</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Notify when large market buyers ape</div>
                </div>
              </div>
              <span className="text-[10px] text-cyan-400 font-bold">Whales</span>
            </label>

            {/* Prompt Updates */}
            <label
              className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                milestones.promptUpdates
                  ? 'bg-slate-900/90 border-indigo-500/40 text-slate-200'
                  : 'bg-slate-950/60 border-slate-900 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2.5 text-xs">
                <input
                  type="checkbox"
                  checked={milestones.promptUpdates}
                  onChange={() => handleToggleMilestone('promptUpdates')}
                  className="accent-indigo-400 rounded"
                />
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>🚀 Prompter Code Iteration</span>
                  </div>
                  <div className="text-[10px] text-slate-400">When prompter upgrades sandbox version</div>
                </div>
              </div>
              <span className="text-[10px] text-indigo-400 font-bold">v1.x</span>
            </label>
          </div>
        </div>

        {/* Action Buttons & Real-Time Test Suite */}
        <div className="pt-2 border-t border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>Probar Toasts de Hitos en Tiempo Real:</span>
            </span>
            <div className="flex items-center gap-1">
              {[25, 50, 75, 90, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => triggerMilestoneAlert(poc, pct as any)}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400 text-[10px] text-cyan-300 font-bold transition cursor-pointer"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => triggerTestAlert(poc)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Alert 75%</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-400 hover:from-emerald-400 hover:to-cyan-300 text-black font-extrabold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Guardar & Suscribirse</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
