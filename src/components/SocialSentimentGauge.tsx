import React, { useState, useMemo } from 'react';
import { PoC } from '../types';
import { calculateSocialSentiment, TweetMention } from '../utils/sentiment';
import {
  Activity,
  Flame,
  TrendingUp,
  MessageCircle,
  Repeat,
  Heart,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  BarChart2,
  CheckCircle2,
} from 'lucide-react';

interface SocialSentimentGaugeProps {
  poc: PoC;
  showDetailsByDefault?: boolean;
}

export const SocialSentimentGauge: React.FC<SocialSentimentGaugeProps> = ({
  poc,
  showDetailsByDefault = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(showDetailsByDefault);

  const sentiment = useMemo(() => {
    return calculateSocialSentiment(poc);
  }, [
    poc.bondingCurveProgress,
    poc.priceChange24h,
    poc.trades,
    poc.comments,
    poc.holdersCount,
    poc.promptHistory.length,
    poc.ticker,
    poc.marketCapUsd,
    poc.volume24hSol,
  ]);

  const { twitterMetrics } = sentiment;

  return (
    <div className="bg-slate-950/90 dark:bg-slate-950/90 light:bg-slate-50 border border-slate-900 dark:border-slate-900 light:border-slate-200 rounded-xl p-2.5 my-2 font-mono transition-all">
      {/* Top Header: Score & Emoji & Label */}
      <div className="flex items-center justify-between text-[11px] mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm select-none" title={sentiment.label}>
            {sentiment.emoji}
          </span>
          <span className="text-white dark:text-white light:text-slate-900 font-bold">
            {sentiment.label}
          </span>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${sentiment.badgeClass}`}
            title="Social sentiment index score (0-100)"
          >
            {sentiment.score}/100
          </span>
        </div>

        {/* Twitter / X Ticker mentions & Activity summary */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-cyan-400 dark:text-cyan-400 light:text-cyan-600 font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>{twitterMetrics.mentions24h.toLocaleString()} X mentions</span>
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            title={isExpanded ? 'Collapse X engagement metrics' : 'Expand live Twitter / X metrics'}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            {isExpanded ? (
              <ChevronUp className="w-3 h-3 text-slate-400" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Mini Gauge Meter */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-slate-900 dark:bg-slate-900 light:bg-slate-200 rounded-full h-1.5 overflow-hidden flex p-0.5 border border-slate-800 dark:border-slate-800 light:border-slate-300">
          <div
            className={`h-full rounded-full transition-all duration-700 ${sentiment.gradientClass}`}
            style={{ width: `${sentiment.score}%` }}
          />
        </div>
        <span className="text-[9px] text-slate-400 dark:text-slate-400 light:text-slate-500 uppercase font-semibold shrink-0">
          {sentiment.trendDirection}
        </span>
      </div>

      {/* Expanded Twitter / X Metrics & Live Ticker Feed */}
      {isExpanded && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 space-y-2 text-[10px]">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-1.5 bg-black/40 dark:bg-black/40 light:bg-white p-2 rounded-lg border border-slate-900 dark:border-slate-900 light:border-slate-200 text-center">
            <div>
              <span className="text-slate-500 block uppercase text-[9px]">Ticker query</span>
              <span className="text-cyan-400 font-bold">{twitterMetrics.tickerQuery}</span>
            </div>
            <div>
              <span className="text-slate-500 block uppercase text-[9px]">Bullish Tweets</span>
              <span className="text-emerald-400 font-bold">
                {twitterMetrics.bullishTweetsPercent}%
              </span>
            </div>
            <div>
              <span className="text-slate-500 block uppercase text-[9px]">Est. Reach</span>
              <span className="text-slate-300 dark:text-slate-300 light:text-slate-700 font-bold">
                {(twitterMetrics.impressionsTotal / 1000).toFixed(1)}k
              </span>
            </div>
          </div>

          {/* Live Ticker Tweets Feed */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[9px] text-slate-400 px-0.5">
              <span className="flex items-center gap-1 font-semibold text-slate-300 dark:text-slate-300 light:text-slate-700">
                <span className="text-cyan-400">𝕏</span>
                <span>Live Feed for {twitterMetrics.tickerQuery}</span>
              </span>
              <span className="text-slate-500">Live stream</span>
            </div>

            {twitterMetrics.recentTweets.map((tweet) => (
              <div
                key={tweet.id}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900/60 dark:bg-slate-900/60 light:bg-white border border-slate-800/60 dark:border-slate-800/60 light:border-slate-200 rounded-lg p-2 space-y-1 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between gap-1 text-[9px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <img
                      src={tweet.avatar}
                      alt={tweet.authorName}
                      className="w-4 h-4 rounded-full object-cover shrink-0"
                    />
                    <span className="text-slate-200 dark:text-slate-200 light:text-slate-800 font-semibold truncate">
                      {tweet.authorName}
                    </span>
                    {tweet.verified && (
                      <span className="text-cyan-400 text-[8px]">✓</span>
                    )}
                    <span className="text-slate-500 text-[8px] truncate">
                      {tweet.authorHandle}
                    </span>
                  </div>
                  <span className="text-slate-500 text-[8px] shrink-0">{tweet.timeAgo}</span>
                </div>

                <p className="text-slate-300 dark:text-slate-300 light:text-slate-700 text-[10px] leading-snug line-clamp-2">
                  {tweet.content}
                </p>

                <div className="flex items-center justify-between text-[8px] text-slate-400 pt-0.5">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-0.5 hover:text-rose-400 transition">
                      <Heart className="w-2.5 h-2.5" />
                      <span>{tweet.likes}</span>
                    </span>
                    <span className="flex items-center gap-0.5 hover:text-emerald-400 transition">
                      <Repeat className="w-2.5 h-2.5" />
                      <span>{tweet.retweets}</span>
                    </span>
                  </div>
                  <span
                    className={`px-1 py-0.2 rounded font-bold uppercase text-[7px] ${
                      tweet.sentiment === 'positive'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : tweet.sentiment === 'negative'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tweet.sentiment}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
