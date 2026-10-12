import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ToastNotification } from '../types';
import {
  X,
  Target,
  Zap,
  Flame,
  Crown,
  Trophy,
  ArrowUpRight,
  TrendingUp,
  Volume2,
  Play,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { formatSol, formatUsd } from '../utils/bondingCurve';

export const ToastNotificationContainer: React.FC = () => {
  const { toasts, dismissToast, pocs, setActivePoC } = useApp();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-20 right-3 sm:right-6 z-50 flex flex-col gap-2.5 max-w-[92vw] sm:max-w-md w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => dismissToast(toast.id)}
          onAction={() => {
            if (toast.pocId) {
              const matched = pocs.find((p) => p.id === toast.pocId);
              if (matched) {
                setActivePoC(matched);
                dismissToast(toast.id);
              }
            }
          }}
        />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: ToastNotification;
  onDismiss: () => void;
  onAction: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss, onAction }) => {
  const [progressWidth, setProgressWidth] = useState(100);

  const duration = toast.durationMs || 6000;

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgressWidth(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration]);

  // Determine styling configuration based on toast type
  const config = getToastConfig(toast);
  const Icon = config.icon;

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 transform translate-y-0 opacity-100 ${config.containerClasses}`}
      style={{
        boxShadow: config.boxShadow,
      }}
    >
      {/* Top Banner Accent */}
      <div className="p-3.5 sm:p-4 space-y-2">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${config.iconBg}`}
            >
              <Icon className={`w-5 h-5 ${config.iconColor}`} />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full border ${config.badgeClasses}`}>
                  {config.badgeText}
                </span>
                {toast.pocTicker && (
                  <span className="text-[11px] font-mono font-bold text-white bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/80">
                    {toast.pocTicker}
                  </span>
                )}
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(toast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>

              <h4 className="text-xs sm:text-sm font-bold text-white font-mono mt-0.5">
                {toast.title}
              </h4>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-900/60 hover:bg-slate-800 transition cursor-pointer"
            title="Cerrar notificación"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Message body */}
        <p className="text-xs text-slate-200 font-mono leading-relaxed pl-11">
          {toast.message}
        </p>

        {/* Milestone Bonding Curve Visual Bar if percentage is provided */}
        {toast.percentage !== undefined && (
          <div className="pl-11 pt-1 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400">Progreso en Curva de Vinculación:</span>
              <span className={`font-bold ${config.percentTextColor}`}>
                {toast.percentage.toFixed(1)}% / 100%
              </span>
            </div>
            <div className="w-full bg-slate-950/80 rounded-full h-1.5 overflow-hidden border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-700 ${config.progressBarGradient}`}
                style={{ width: `${Math.min(100, toast.percentage)}%` }}
              />
            </div>
          </div>
        )}

        {/* Interactive Action Bar */}
        <div className="pl-11 pt-1.5 flex items-center justify-between gap-2">
          {toast.solPooled !== undefined ? (
            <span className="text-[10px] font-mono text-slate-400">
              SOL acumulados: <strong className="text-white">{toast.solPooled.toFixed(1)} SOL</strong>
            </span>
          ) : (
            <span />
          )}

          {toast.pocId && (
            <button
              onClick={onAction}
              className={`px-3 py-1 rounded-xl text-[11px] font-mono font-extrabold flex items-center gap-1.5 shadow-md transition cursor-pointer active:scale-95 ${config.actionButtonClasses}`}
            >
              <span>Ape In / Ver PoC</span>
              <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Auto-dismiss countdown line */}
      <div className="w-full h-0.5 bg-slate-800/40">
        <div
          className={`h-full transition-all duration-75 ${config.timerLineColor}`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>
    </div>
  );
};

function getToastConfig(toast: ToastNotification) {
  switch (toast.type) {
    case 'milestone_25':
      return {
        icon: Target,
        iconBg: 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400',
        iconColor: 'text-cyan-400',
        badgeText: 'HITO 25% ALCANZADO',
        badgeClasses: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        containerClasses: 'bg-gradient-to-r from-slate-900/95 via-cyan-950/80 to-slate-900/95 border-cyan-500/50',
        boxShadow: '0 10px 30px -5px rgba(6, 182, 212, 0.25)',
        progressBarGradient: 'bg-gradient-to-r from-cyan-500 to-emerald-400',
        percentTextColor: 'text-cyan-400',
        actionButtonClasses: 'bg-cyan-400 hover:bg-cyan-300 text-black',
        timerLineColor: 'bg-cyan-400',
      };

    case 'milestone_50':
      return {
        icon: Zap,
        iconBg: 'bg-blue-500/20 border border-blue-500/40 text-blue-400',
        iconColor: 'text-blue-400 fill-blue-400/20',
        badgeText: 'HITO 50% MEDIO CAMINO',
        badgeClasses: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
        containerClasses: 'bg-gradient-to-r from-slate-900/95 via-blue-950/80 to-slate-900/95 border-blue-500/50',
        boxShadow: '0 10px 30px -5px rgba(59, 130, 246, 0.25)',
        progressBarGradient: 'bg-gradient-to-r from-blue-500 to-cyan-400',
        percentTextColor: 'text-blue-400',
        actionButtonClasses: 'bg-blue-400 hover:bg-blue-300 text-black',
        timerLineColor: 'bg-blue-400',
      };

    case 'milestone_75':
      return {
        icon: Flame,
        iconBg: 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400',
        iconColor: 'text-emerald-400 fill-emerald-400/20',
        badgeText: '⚡ 75% ALTA VELOCIDAD',
        badgeClasses: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse',
        containerClasses: 'bg-gradient-to-r from-slate-900/95 via-emerald-950/85 to-slate-900/95 border-emerald-500/60',
        boxShadow: '0 12px 35px -5px rgba(16, 185, 129, 0.35)',
        progressBarGradient: 'bg-gradient-to-r from-emerald-500 to-amber-400',
        percentTextColor: 'text-emerald-400',
        actionButtonClasses: 'bg-emerald-400 hover:bg-emerald-300 text-black',
        timerLineColor: 'bg-emerald-400',
      };

    case 'milestone_90':
      return {
        icon: Crown,
        iconBg: 'bg-amber-500/20 border border-amber-500/40 text-amber-400',
        iconColor: 'text-amber-400 fill-amber-400',
        badgeText: '👑 90% KING OF THE HILL',
        badgeClasses: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        containerClasses: 'bg-gradient-to-r from-slate-900/95 via-amber-950/85 to-slate-900/95 border-amber-500/60',
        boxShadow: '0 12px 35px -5px rgba(245, 158, 11, 0.35)',
        progressBarGradient: 'bg-gradient-to-r from-amber-500 to-yellow-300',
        percentTextColor: 'text-amber-400',
        actionButtonClasses: 'bg-amber-400 hover:bg-amber-300 text-black',
        timerLineColor: 'bg-amber-400',
      };

    case 'milestone_100':
      return {
        icon: Trophy,
        iconBg: 'bg-gradient-to-tr from-amber-500 to-yellow-300 text-black shadow-amber-500/40',
        iconColor: 'text-black fill-black',
        badgeText: '🎉 100% GRADUACIÓN A RAYDIUM',
        badgeClasses: 'bg-amber-400 text-black font-extrabold border-amber-300 animate-bounce',
        containerClasses: 'bg-gradient-to-r from-purple-950/95 via-amber-950/90 to-emerald-950/95 border-yellow-400/80 shadow-2xl',
        boxShadow: '0 15px 45px -5px rgba(250, 204, 21, 0.45)',
        progressBarGradient: 'bg-gradient-to-r from-amber-400 via-pink-500 to-emerald-400',
        percentTextColor: 'text-amber-300',
        actionButtonClasses: 'bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold shadow-lg shadow-yellow-500/30',
        timerLineColor: 'bg-yellow-400',
      };

    case 'whale_buy':
      return {
        icon: TrendingUp,
        iconBg: 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400',
        iconColor: 'text-cyan-400',
        badgeText: '🐋 COMPRA BALLENA',
        badgeClasses: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        containerClasses: 'bg-slate-900/95 border-cyan-500/50',
        boxShadow: '0 10px 30px -5px rgba(6, 182, 212, 0.25)',
        progressBarGradient: 'bg-cyan-400',
        percentTextColor: 'text-cyan-400',
        actionButtonClasses: 'bg-cyan-400 hover:bg-cyan-300 text-black',
        timerLineColor: 'bg-cyan-400',
      };

    default:
      return {
        icon: Sparkles,
        iconBg: 'bg-slate-800 border border-slate-700 text-emerald-400',
        iconColor: 'text-emerald-400',
        badgeText: 'ALERTA DE RED',
        badgeClasses: 'bg-slate-800 text-slate-300 border-slate-700',
        containerClasses: 'bg-slate-900/95 border-slate-800',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
        progressBarGradient: 'bg-emerald-400',
        percentTextColor: 'text-emerald-400',
        actionButtonClasses: 'bg-slate-800 hover:bg-slate-700 text-white',
        timerLineColor: 'bg-emerald-400',
      };
  }
}
