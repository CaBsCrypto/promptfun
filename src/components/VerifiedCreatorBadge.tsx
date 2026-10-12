import React from 'react';
import { CreatorBadgeMeta, VerifiedBadgeType, BADGE_DEFINITIONS } from '../utils/creatorBadges';

interface VerifiedCreatorBadgeProps {
  badge?: CreatorBadgeMeta;
  badgeType?: VerifiedBadgeType;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'full' | 'compact' | 'icon-only';
  className?: string;
  showTooltip?: boolean;
}

export const VerifiedCreatorBadge: React.FC<VerifiedCreatorBadgeProps> = ({
  badge,
  badgeType,
  size = 'xs',
  variant = 'compact',
  className = '',
  showTooltip = true,
}) => {
  const meta: CreatorBadgeMeta | undefined = badge || (badgeType ? BADGE_DEFINITIONS[badgeType] : undefined);

  if (!meta) return null;

  const Icon = meta.icon;
  const { bg, border, text, glow, dot } = meta.colorClasses;

  const sizeClasses = {
    xs: 'text-[9px] px-1.5 py-0.5 gap-1',
    sm: 'text-[10px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  }[size];

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  }[size];

  if (variant === 'icon-only') {
    return (
      <span
        title={showTooltip ? `${meta.label}: ${meta.description}` : undefined}
        className={`inline-flex items-center justify-center p-0.5 rounded-full ${bg} ${border} border ${text} shrink-0 ${className}`}
      >
        <Icon className={iconSizes} />
      </span>
    );
  }

  const labelText = variant === 'full' ? meta.label : meta.shortLabel;

  return (
    <span
      title={showTooltip ? `${meta.label} - ${meta.description}` : undefined}
      className={`inline-flex items-center rounded-full border font-mono font-bold tracking-tight shrink-0 select-none transition-all duration-200 hover:scale-105 ${bg} ${border} ${text} ${sizeClasses} shadow-sm ${glow} ${className}`}
    >
      <span className={`w-1 h-1 rounded-full ${dot} shrink-0`} />
      <Icon className={`${iconSizes} shrink-0`} />
      <span className="leading-none whitespace-nowrap">{labelText}</span>
    </span>
  );
};

export const VerifiedBadgeGroup: React.FC<{
  badges: CreatorBadgeMeta[];
  maxDisplay?: number;
  size?: 'xs' | 'sm';
  variant?: 'compact' | 'full' | 'icon-only';
  className?: string;
}> = ({ badges, maxDisplay = 2, size = 'xs', variant = 'compact', className = '' }) => {
  if (!badges || badges.length === 0) return null;

  const visibleBadges = badges.slice(0, maxDisplay);
  const remainingCount = badges.length - maxDisplay;

  return (
    <div className={`inline-flex items-center gap-1 flex-wrap ${className}`}>
      {visibleBadges.map((b) => (
        <VerifiedCreatorBadge
          key={b.type}
          badge={b}
          size={size}
          variant={variant}
        />
      ))}
      {remainingCount > 0 && (
        <span
          title={badges
            .slice(maxDisplay)
            .map((b) => `${b.label}: ${b.description}`)
            .join(' • ')}
          className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-400 font-mono text-[9px] font-bold shrink-0 cursor-help"
        >
          +{remainingCount}
        </span>
      )}
    </div>
  );
};
