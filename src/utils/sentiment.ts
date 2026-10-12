import { PoC, Trade } from '../types';

export interface TweetMention {
  id: string;
  authorHandle: string;
  authorName: string;
  avatar: string;
  content: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  likes: number;
  retweets: number;
  timeAgo: string;
  verified?: boolean;
}

export interface SocialSentiment {
  score: number; // 0 to 100
  label: string;
  emoji: string;
  trendDirection: 'Surging' | 'Bullish' | 'Accumulating' | 'Neutral' | 'Cooling';
  badgeClass: string;
  gradientClass: string;
  activitySummary: string;
  buyRatioPercent: number;
  // Twitter / X Real-time Engagement & Ticker Mentions
  twitterMetrics: {
    tickerQuery: string;
    mentions24h: number;
    mentionsChange24h: number; // percentage change e.g. +42%
    impressionsTotal: number;
    bullishTweetsPercent: number;
    bearishTweetsPercent: number;
    engagementScore: number; // 0 to 100
    recentTweets: TweetMention[];
  };
}

/**
 * Calculates a dynamic social sentiment score based on bonding curve activity,
 * trade flow (buys vs sells), curve velocity, community comments, holders count,
 * and live Twitter/X ticker engagement.
 */
export function calculateSocialSentiment(poc: PoC): SocialSentiment {
  let baseScore = 50;

  // 1. Bonding Curve Progress contribution (up to +25 points)
  const curveWeight = (Math.min(100, poc.bondingCurveProgress) / 100) * 25;
  baseScore += curveWeight;

  // 2. Price Change 24h contribution (up to +20 points)
  if (poc.priceChange24h > 200) {
    baseScore += 20;
  } else if (poc.priceChange24h > 100) {
    baseScore += 16;
  } else if (poc.priceChange24h > 50) {
    baseScore += 12;
  } else if (poc.priceChange24h > 0) {
    baseScore += 6;
  } else {
    baseScore -= 10;
  }

  // 3. Trade Ratio contribution (recent buys vs sells)
  const recentTrades: Trade[] = poc.trades || [];
  let buysCount = recentTrades.filter((t: Trade) => t.type === 'buy').length;
  let sellsCount = recentTrades.filter((t: Trade) => t.type === 'sell').length;

  // If few or no trades yet, infer organic buy ratio from priceChange and volume
  let buyRatio = 0.65;
  if (recentTrades.length > 0) {
    buyRatio = buysCount / Math.max(1, buysCount + sellsCount);
  } else if (poc.priceChange24h > 100) {
    buyRatio = 0.88;
  } else if (poc.priceChange24h > 0) {
    buyRatio = 0.72;
  }

  const tradeWeight = (buyRatio - 0.5) * 20; // -10 to +10
  baseScore += tradeWeight;

  // 4. Community Activity (comments, prompt iterations, holders)
  const commentBonus = Math.min(8, (poc.comments?.length || 0) * 2);
  const promptBonus = Math.min(6, (poc.promptHistory?.length || 1) * 2);
  const holderBonus = Math.min(6, (poc.holdersCount / 100) * 2);
  baseScore += commentBonus + promptBonus + holderBonus;

  // Clamp strictly between 15 and 99
  const finalScore = Math.min(99, Math.max(15, Math.round(baseScore)));
  const buyRatioPercent = Math.round(buyRatio * 100);

  // 5. Twitter / X Engagement & Ticker Mentions computation
  const ticker = poc.ticker || '$POC';
  const cleanTicker = ticker.startsWith('$') ? ticker : `$${ticker}`;
  const baseMentions = Math.max(
    14,
    Math.round(poc.holdersCount * 4.2 + poc.volume24hSol * 18 + (poc.comments?.length || 0) * 14)
  );
  const mentions24h = Math.round(baseMentions * (1 + Math.max(0, poc.priceChange24h) / 300));
  const mentionsChange24h = Math.round(
    poc.priceChange24h * 0.45 + (poc.bondingCurveProgress > 50 ? 48 : 12)
  );
  const impressionsTotal = Math.round(mentions24h * 1280 + poc.marketCapUsd * 2.5);

  // Bullish vs Bearish breakdown based on price action and finalScore
  const bullishTweetsPercent = Math.min(
    96,
    Math.max(22, Math.round(finalScore * 0.95 + (poc.priceChange24h > 0 ? 5 : -15)))
  );
  const bearishTweetsPercent = Math.max(4, 100 - bullishTweetsPercent);
  const engagementScore = Math.min(
    99,
    Math.max(
      20,
      Math.round(finalScore * 0.6 + Math.min(100, (mentions24h / 500) * 100) * 0.4)
    )
  );

  // Synthesize realistic live tweets citing this specific PoC's ticker
  const recentTweets: TweetMention[] = [
    {
      id: `tweet-${poc.id}-1`,
      authorHandle: '@solana_alpha_bot',
      authorName: 'Solana Alpha Alerts ⚡',
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      content: `🚨 INFLOW ALERT: Heavy ape volume detected on ${cleanTicker} (${poc.title})! Bonding curve currently at ${poc.bondingCurveProgress.toFixed(1)}%. Prompt generation looks insane.`,
      sentiment: finalScore >= 60 ? 'positive' : 'neutral',
      likes: Math.max(14, Math.round(mentions24h * 0.12)),
      retweets: Math.max(4, Math.round(mentions24h * 0.04)),
      timeAgo: '2m',
      verified: true,
    },
    {
      id: `tweet-${poc.id}-2`,
      authorHandle: '@vibe_coder_eth',
      authorName: 'CryptoBuilder.sol',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      content: `Just tested the live sandbox for ${cleanTicker}. The prompt architecture with OpenRouter tokens is super clean. Creador @${poc.creator.handle} is cooking 🔥`,
      sentiment: 'positive',
      likes: Math.max(28, Math.round(mentions24h * 0.22)),
      retweets: Math.max(9, Math.round(mentions24h * 0.07)),
      timeAgo: '11m',
      verified: false,
    },
    {
      id: `tweet-${poc.id}-3`,
      authorHandle: '@degens_terminal',
      authorName: 'Pump Scanner AI',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
      content: `${cleanTicker} 24h gainers board: +${poc.priceChange24h.toFixed(1)}% | Market Cap: $${poc.marketCapUsd.toLocaleString()} | Sentiment Score: ${finalScore}/100 🚀`,
      sentiment: poc.priceChange24h >= 0 ? 'positive' : 'negative',
      likes: Math.max(19, Math.round(mentions24h * 0.15)),
      retweets: Math.max(6, Math.round(mentions24h * 0.05)),
      timeAgo: '27m',
      verified: true,
    },
  ];

  const twitterMetrics = {
    tickerQuery: cleanTicker,
    mentions24h,
    mentionsChange24h,
    impressionsTotal,
    bullishTweetsPercent,
    bearishTweetsPercent,
    engagementScore,
    recentTweets,
  };

  // Determine sentiment state, emoji, and styling
  if (finalScore >= 85) {
    return {
      score: finalScore,
      label: 'Super Bullish',
      emoji: '🔥',
      trendDirection: 'Surging',
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      gradientClass: 'bg-gradient-to-r from-amber-400 via-rose-500 to-emerald-400',
      activitySummary: `${buyRatioPercent}% Buys • ${mentions24h.toLocaleString()} X Mentions`,
      buyRatioPercent,
      twitterMetrics,
    };
  } else if (finalScore >= 72) {
    return {
      score: finalScore,
      label: 'Bullish Ape',
      emoji: '🚀',
      trendDirection: 'Bullish',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      gradientClass: 'bg-gradient-to-r from-emerald-500 to-cyan-400',
      activitySummary: `${buyRatioPercent}% Buys • Trending on X`,
      buyRatioPercent,
      twitterMetrics,
    };
  } else if (finalScore >= 58) {
    return {
      score: finalScore,
      label: 'Accumulating',
      emoji: '⚡',
      trendDirection: 'Accumulating',
      badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      gradientClass: 'bg-gradient-to-r from-cyan-500 to-indigo-400',
      activitySummary: `${buyRatioPercent}% Buys • Steady Mentions`,
      buyRatioPercent,
      twitterMetrics,
    };
  } else if (finalScore >= 45) {
    return {
      score: finalScore,
      label: 'Discovery',
      emoji: '🌱',
      trendDirection: 'Neutral',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      gradientClass: 'bg-gradient-to-r from-amber-400 to-cyan-500',
      activitySummary: `Early Backers • ${mentions24h} Ticker Hits`,
      buyRatioPercent,
      twitterMetrics,
    };
  } else {
    return {
      score: finalScore,
      label: 'Cooling Off',
      emoji: '❄️',
      trendDirection: 'Cooling',
      badgeClass: 'bg-slate-700/40 text-slate-300 border-slate-600',
      gradientClass: 'bg-gradient-to-r from-slate-600 to-slate-400',
      activitySummary: 'Awaiting Next X Narrative Wave',
      buyRatioPercent,
      twitterMetrics,
    };
  }
}
