import React, { useMemo } from 'react';
import { PoC } from '../types';
import { calculateSocialSentiment } from '../utils/sentiment';
import {
  Activity,
  Flame,
  TrendingUp,
  MessageCircle,
  Repeat,
  Heart,
  ExternalLink,
  Users,
  Eye,
  CheckCircle2,
  Share2,
} from 'lucide-react';

interface SocialSentimentWidgetProps {
  poc: PoC;
}

export const SocialSentimentWidget: React.FC<SocialSentimentWidgetProps> = ({ poc }) => {
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
    <div className="bg-[#0b0e14] dark:bg-[#0b0e14] light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 font-mono">
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-base">
              𝕏
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white dark:text-white light:text-slate-900 flex items-center gap-2">
                <span>Social Sentiment Index & Twitter / X Engagement</span>
                <span className="text-xs text-cyan-400 font-mono">({twitterMetrics.tickerQuery})</span>
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-500">
                Live ticker mentions, sentiment score (0-100), and crypto community engagement
              </p>
            </div>
          </div>
        </div>

        {/* Global Sentiment Badge & Gauge Value */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-2xl select-none" title={sentiment.label}>
            {sentiment.emoji}
          </span>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block uppercase">Sentiment Score</span>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-extrabold text-white dark:text-white light:text-slate-900">
                {sentiment.score}
              </span>
              <span className="text-xs text-slate-500">/ 100</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${sentiment.badgeClass}`}>
                {sentiment.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Score Bar & Gauges Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Market Momentum: <strong className="text-emerald-400">{sentiment.trendDirection}</strong></span>
          </span>
          <span>{sentiment.activitySummary}</span>
        </div>

        <div className="w-full bg-slate-900 dark:bg-slate-900 light:bg-slate-200 rounded-full h-3 overflow-hidden border border-slate-800 dark:border-slate-800 light:border-slate-300 p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${sentiment.gradientClass}`}
            style={{ width: `${sentiment.score}%` }}
          />
        </div>

        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>0 (Extreme Fear / Inactive)</span>
          <span>50 (Neutral Discovery)</span>
          <span>100 (Hyper Bullish Mania)</span>
        </div>
      </div>

      {/* Real-time Twitter / X Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-900/80 dark:bg-slate-900/80 light:bg-slate-50 border border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 rounded-xl p-3 space-y-1">
          <span className="text-[10px] text-slate-400 block uppercase flex items-center gap-1">
            <MessageCircle className="w-3 h-3 text-cyan-400" />
            <span>24h Mentions</span>
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-extrabold text-white dark:text-white light:text-slate-900">
              {twitterMetrics.mentions24h.toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-400 font-bold">
              +{twitterMetrics.mentionsChange24h}%
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block truncate">
            Tagged with {twitterMetrics.tickerQuery}
          </span>
        </div>

        <div className="bg-slate-900/80 dark:bg-slate-900/80 light:bg-slate-50 border border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 rounded-xl p-3 space-y-1">
          <span className="text-[10px] text-slate-400 block uppercase flex items-center gap-1">
            <Eye className="w-3 h-3 text-indigo-400" />
            <span>Social Impressions</span>
          </span>
          <span className="text-base font-extrabold text-white dark:text-white light:text-slate-900 block">
            {(twitterMetrics.impressionsTotal / 1000).toFixed(1)}K
          </span>
          <span className="text-[10px] text-slate-500 block">
            Timeline algorithmic reach
          </span>
        </div>

        <div className="bg-slate-900/80 dark:bg-slate-900/80 light:bg-slate-50 border border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 rounded-xl p-3 space-y-1">
          <span className="text-[10px] text-slate-400 block uppercase flex items-center gap-1">
            <Flame className="w-3 h-3 text-rose-400" />
            <span>Bullish vs Bearish</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-extrabold text-emerald-400">
              {twitterMetrics.bullishTweetsPercent}%
            </span>
            <span className="text-[10px] text-slate-500">Bullish</span>
          </div>
          <div className="w-full bg-rose-500/30 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full"
              style={{ width: `${twitterMetrics.bullishTweetsPercent}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900/80 dark:bg-slate-900/80 light:bg-slate-50 border border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 rounded-xl p-3 space-y-1">
          <span className="text-[10px] text-slate-400 block uppercase flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-amber-400" />
            <span>Engagement Index</span>
          </span>
          <span className="text-base font-extrabold text-amber-300 dark:text-amber-300 light:text-amber-600 block">
            {twitterMetrics.engagementScore}/100
          </span>
          <span className="text-[10px] text-slate-500 block">
            Viral Coefficient: High
          </span>
        </div>
      </div>

      {/* Live Twitter / X Mention Feed Stream */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-bold text-white dark:text-white light:text-slate-900 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Live Ticker Mentions Stream ({twitterMetrics.tickerQuery})</span>
          </span>
          <span className="text-[11px] text-cyan-400">
            Real-time sentiment analyzer
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {twitterMetrics.recentTweets.map((tweet) => (
            <div
              key={tweet.id}
              className="bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-50 border border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 rounded-xl p-3 space-y-2 flex flex-col justify-between hover:border-slate-700 transition"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1 text-[11px]">
                  <div className="flex items-center gap-2 truncate">
                    <img
                      src={tweet.avatar}
                      alt={tweet.authorName}
                      className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-700"
                    />
                    <div className="truncate">
                      <span className="text-white dark:text-white light:text-slate-900 font-bold block truncate">
                        {tweet.authorName}
                      </span>
                      <span className="text-slate-500 text-[10px] block truncate">
                        {tweet.authorHandle}
                      </span>
                    </div>
                  </div>
                  <span className="text-slate-500 text-[10px] shrink-0 font-mono">
                    {tweet.timeAgo}
                  </span>
                </div>

                <p className="text-xs text-slate-300 dark:text-slate-300 light:text-slate-700 leading-relaxed line-clamp-3">
                  {tweet.content}
                </p>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-800/60 dark:border-slate-800/60 light:border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-slate-400 hover:text-rose-400 transition cursor-pointer">
                    <Heart className="w-3 h-3 text-rose-500/80" />
                    <span>{tweet.likes}</span>
                  </span>
                  <span className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition cursor-pointer">
                    <Repeat className="w-3 h-3 text-emerald-500/80" />
                    <span>{tweet.retweets}</span>
                  </span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded font-extrabold uppercase text-[8px] ${
                    tweet.sentiment === 'positive'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : tweet.sentiment === 'negative'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {tweet.sentiment}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
