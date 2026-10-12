import React from 'react';
import { Award, Zap, Code2, Flame, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { PoC } from '../types';

export type VerifiedBadgeType =
  | 'top_developer'
  | 'prompt_engineer'
  | 'high_vol_creator'
  | 'verified_creator'
  | 'og_builder';

export interface CreatorBadgeMeta {
  type: VerifiedBadgeType;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  colorClasses: {
    bg: string;
    border: string;
    text: string;
    glow: string;
    pillBg: string;
    dot: string;
  };
}

export const BADGE_DEFINITIONS: Record<VerifiedBadgeType, CreatorBadgeMeta> = {
  top_developer: {
    type: 'top_developer',
    label: 'Top Developer',
    shortLabel: 'Top Dev',
    icon: Code2,
    description: 'Creador con múltiples PoCs funcionales o más de 3 graduaciones exitosas.',
    colorClasses: {
      bg: 'bg-cyan-500/15 dark:bg-cyan-500/15 light:bg-cyan-50',
      border: 'border-cyan-500/40 dark:border-cyan-500/40 light:border-cyan-300',
      text: 'text-cyan-300 dark:text-cyan-300 light:text-cyan-700',
      glow: 'shadow-cyan-500/20',
      pillBg: 'from-cyan-500/20 to-blue-500/10',
      dot: 'bg-cyan-400',
    },
  },
  prompt_engineer: {
    type: 'prompt_engineer',
    label: 'Prompt Engineer',
    shortLabel: 'Prompt Eng',
    icon: Sparkles,
    description: 'Especialista en arquitecturas de prompts avanzados y agentes autónomos iterativos.',
    colorClasses: {
      bg: 'bg-purple-500/15 dark:bg-purple-500/15 light:bg-purple-50',
      border: 'border-purple-500/40 dark:border-purple-500/40 light:border-purple-300',
      text: 'text-purple-300 dark:text-purple-300 light:text-purple-700',
      glow: 'shadow-purple-500/20',
      pillBg: 'from-purple-500/20 to-pink-500/10',
      dot: 'bg-purple-400',
    },
  },
  high_vol_creator: {
    type: 'high_vol_creator',
    label: 'High Vol Creator',
    shortLabel: 'High Vol',
    icon: Flame,
    description: 'Creador con alto volumen transaccional en bonding curves (>150 SOL o volumen destacado).',
    colorClasses: {
      bg: 'bg-amber-500/15 dark:bg-amber-500/15 light:bg-amber-50',
      border: 'border-amber-500/40 dark:border-amber-500/40 light:border-amber-300',
      text: 'text-amber-300 dark:text-amber-300 light:text-amber-700',
      glow: 'shadow-amber-500/20',
      pillBg: 'from-amber-500/20 to-orange-500/10',
      dot: 'bg-amber-400',
    },
  },
  verified_creator: {
    type: 'verified_creator',
    label: 'Verified Creator',
    shortLabel: 'Verified',
    icon: ShieldCheck,
    description: 'Identidad criptográfica y trayectoria de desarrollador verificada en PromptPump.',
    colorClasses: {
      bg: 'bg-emerald-500/15 dark:bg-emerald-500/15 light:bg-emerald-50',
      border: 'border-emerald-500/40 dark:border-emerald-500/40 light:border-emerald-300',
      text: 'text-emerald-300 dark:text-emerald-300 light:text-emerald-700',
      glow: 'shadow-emerald-500/20',
      pillBg: 'from-emerald-500/20 to-teal-500/10',
      dot: 'bg-emerald-400',
    },
  },
  og_builder: {
    type: 'og_builder',
    label: 'OG Builder',
    shortLabel: 'OG',
    icon: Star,
    description: 'Pionero temprano del protocolo PromptPump y ecosistema Solana AI.',
    colorClasses: {
      bg: 'bg-indigo-500/15 dark:bg-indigo-500/15 light:bg-indigo-50',
      border: 'border-indigo-500/40 dark:border-indigo-500/40 light:border-indigo-300',
      text: 'text-indigo-300 dark:text-indigo-300 light:text-indigo-700',
      glow: 'shadow-indigo-500/20',
      pillBg: 'from-indigo-500/20 to-blue-500/10',
      dot: 'bg-indigo-400',
    },
  },
};

/**
 * Derives badges for a creator based on explicit tags, handle patterns, or on-chain aggregate stats.
 */
export function getCreatorBadges(creator: {
  name: string;
  handle: string;
  address?: string;
  graduatedCount?: number;
  badges?: VerifiedBadgeType[];
}, allPocs?: PoC[]): CreatorBadgeMeta[] {
  const result: CreatorBadgeMeta[] = [];
  const addedTypes = new Set<VerifiedBadgeType>();

  const add = (type: VerifiedBadgeType) => {
    if (!addedTypes.has(type) && BADGE_DEFINITIONS[type]) {
      addedTypes.add(type);
      result.push(BADGE_DEFINITIONS[type]);
    }
  };

  // 1. Explicit badges if configured on creator object
  if (creator.badges && Array.isArray(creator.badges)) {
    creator.badges.forEach((b) => add(b));
  }

  // 2. Compute aggregate metrics if allPocs is provided
  let totalVolumeSol = 0;
  let pocCount = 0;
  let hasAgentsOrDevTools = false;

  if (allPocs && allPocs.length > 0) {
    const creatorPocs = allPocs.filter(
      (p) =>
        p.creator.handle.toLowerCase() === creator.handle.toLowerCase() ||
        (creator.address && p.creator.address === creator.address)
    );
    pocCount = creatorPocs.length;
    totalVolumeSol = creatorPocs.reduce((sum, p) => sum + (p.volume24hSol || 0), 0);
    hasAgentsOrDevTools = creatorPocs.some(
      (p) => p.category === 'Autonomous Agents' || p.category === 'DevTools' || p.category === 'Creative AI'
    );
  }

  const gradCount = creator.graduatedCount || 0;
  const handleLower = creator.handle.toLowerCase();

  // 3. Trait-based badge heuristics to give specialized badges to iconic creators:
  // Elena Rostova (@elena_builds): Top Developer & High Vol Creator
  if (handleLower.includes('elena') || gradCount >= 4) {
    add('top_developer');
    add('high_vol_creator');
    add('verified_creator');
  }

  // Dr. Marcus Vance (@vance_ai): Prompt Engineer & Top Developer
  if (handleLower.includes('vance') || handleLower.includes('agent')) {
    add('prompt_engineer');
    add('top_developer');
    add('verified_creator');
  }

  // Kai Chen (@kaibeats): Prompt Engineer
  if (handleLower.includes('kai') || handleLower.includes('beats')) {
    add('prompt_engineer');
    add('verified_creator');
  }

  // NakamotoX (@nakamotox): High Vol Creator & OG Builder
  if (handleLower.includes('nakamoto') || handleLower.includes('oracle')) {
    add('high_vol_creator');
    add('og_builder');
    add('verified_creator');
  }

  // PixelWizard (@pixelwiz): Prompt Engineer & OG Builder
  if (handleLower.includes('pixel') || handleLower.includes('wiz')) {
    add('prompt_engineer');
    add('og_builder');
  }

  // Sofia Martinez (@sofia_legal): Top Developer & Verified Creator
  if (handleLower.includes('sofia') || handleLower.includes('legal')) {
    add('top_developer');
    add('verified_creator');
  }

  // Metric-based heuristics:
  if (totalVolumeSol >= 150) {
    add('high_vol_creator');
  }
  if (gradCount >= 2 || pocCount >= 2) {
    add('top_developer');
  }
  if (hasAgentsOrDevTools && !addedTypes.has('prompt_engineer')) {
    add('prompt_engineer');
  }

  // Baseline verified creator
  if (result.length === 0) {
    add('verified_creator');
  }

  return result;
}
