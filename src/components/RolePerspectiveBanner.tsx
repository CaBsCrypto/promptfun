import React from 'react';
import { useApp } from '../context/AppContext';
import {
  TrendingUp,
  Palette,
  ShieldAlert,
  Wallet,
  ArrowUpRight,
} from 'lucide-react';
import { formatSol } from '../utils/bondingCurve';
import { UserRole } from '../types';

export const RolePerspectiveBanner: React.FC = () => {
  const {
    currentRole,
    switchRoleAndWallet,
    wallet,
    protocolConfig,
    setIsWalletModalOpen,
    setIsInvestorHubOpen,
    setIsCreatorStudioOpen,
    setIsAdminConsoleOpen,
  } = useApp();

  const roles = [
    {
      id: 'investor' as UserRole,
      title: 'Inversor',
      tagline: 'Trading & Curvas',
      icon: TrendingUp,
      activeColor: 'bg-cyan-500/15 text-cyan-300 dark:text-cyan-300 light:text-cyan-800 border-cyan-500/40 shadow-sm',
      actionLabel: 'Hub de Inversor',
      onAction: () => setIsInvestorHubOpen(true),
    },
    {
      id: 'creator' as UserRole,
      title: 'Creador',
      tagline: 'Prompts & Regalías',
      icon: Palette,
      activeColor: 'bg-emerald-500/15 text-emerald-300 dark:text-emerald-300 light:text-emerald-800 border-emerald-500/40 shadow-sm',
      actionLabel: 'Studio de Creador',
      onAction: () => setIsCreatorStudioOpen(true),
      extraNotice:
        (wallet.creatorRoyaltiesSol || 0) > 0
          ? `+${wallet.creatorRoyaltiesSol?.toFixed(2)} SOL regalía`
          : null,
    },
    {
      id: 'admin' as UserRole,
      title: 'Administrador',
      tagline: 'Tesorería & Protocolo',
      icon: ShieldAlert,
      activeColor: 'bg-purple-500/15 text-purple-300 dark:text-purple-300 light:text-purple-800 border-purple-500/40 shadow-sm',
      actionLabel: 'Consola Admin',
      onAction: () => setIsAdminConsoleOpen(true),
      extraNotice: `Tesorería: ${protocolConfig.protocolTreasurySol.toFixed(1)} SOL`,
    },
  ];

  const activeRoleData = roles.find((r) => r.id === currentRole) || roles[0];

  return (
    <div className="bg-[#0a0e17] dark:bg-[#0a0e17] light:bg-white border border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 rounded-2xl p-2.5 sm:p-3 shadow-lg transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Role Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[10px] uppercase font-mono font-bold text-slate-500 dark:text-slate-500 light:text-slate-400 shrink-0 pl-1">
            Modo:
          </span>

          <div className="flex items-center gap-1.5 bg-slate-950/80 dark:bg-slate-950/80 light:bg-slate-100 p-1 rounded-xl border border-slate-850 dark:border-slate-850 light:border-slate-200 shrink-0">
            {roles.map((r) => {
              const Icon = r.icon;
              const isSelected = currentRole === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => switchRoleAndWallet(r.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                    isSelected
                      ? r.activeColor
                      : 'text-slate-400 dark:text-slate-400 light:text-slate-600 hover:text-white dark:hover:text-white light:hover:text-slate-900 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{r.title}</span>
                  {r.extraNotice && (
                    <span className="hidden lg:inline text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-normal">
                      {r.extraNotice}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Hub Trigger & Wallet HUD */}
        <div className="flex items-center gap-2 font-mono text-xs shrink-0 justify-between sm:justify-end">
          <button
            onClick={activeRoleData.onAction}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 light:bg-slate-100 light:hover:bg-slate-200 border border-slate-800 dark:border-slate-800 light:border-slate-300 text-slate-200 dark:text-slate-200 light:text-slate-800 font-bold transition cursor-pointer active:scale-95"
          >
            <span>{activeRoleData.actionLabel}</span>
            <ArrowUpRight className="w-3 h-3 text-slate-400" />
          </button>

          <button
            onClick={() => setIsWalletModalOpen(true)}
            className="flex items-center gap-1.5 bg-slate-950/80 dark:bg-slate-950/80 light:bg-slate-100 hover:bg-slate-900 border border-slate-800 dark:border-slate-800 light:border-slate-300 px-3 py-1.5 rounded-xl text-slate-300 dark:text-slate-300 light:text-slate-700 transition cursor-pointer active:scale-95"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-white dark:text-white light:text-slate-900 font-bold">
              {formatSol(wallet.solBalance)} SOL
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
