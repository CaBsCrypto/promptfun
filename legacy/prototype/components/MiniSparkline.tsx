import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, Tooltip, YAxis } from 'recharts';
import { PoC } from '../types';
import { generate24hBondingCurveSparkline } from '../utils/sparkline';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface MiniSparklineProps {
  poc: PoC;
}

export const MiniSparkline: React.FC<MiniSparklineProps> = ({ poc }) => {
  const { points, isPositive, change24hPercent } = useMemo(() => {
    return generate24hBondingCurveSparkline(poc);
  }, [poc.currentSolPooled, poc.priceChange24h, poc.volume24hSol, poc.id]);

  const strokeColor = isPositive ? '#10b981' : '#f43f5e';
  const gradientId = `sparkline-24h-grad-${poc.id.replace(/[^a-zA-Z0-9]/g, '_')}`;

  return (
    <div className="bg-slate-950/80 border border-slate-900/90 hover:border-slate-800 rounded-xl p-2.5 my-2.5 transition">
      {/* Sparkline Header */}
      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
        <span className="text-slate-400 flex items-center gap-1.5">
          {isPositive ? (
            <TrendingUp className="w-3 h-3 text-emerald-400" />
          ) : (
            <TrendingDown className="w-3 h-3 text-rose-400" />
          )}
          <span className="font-semibold text-slate-300">24h Bonding Curve Trend</span>
        </span>
        <span
          className={`font-extrabold flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] ${
            isPositive
              ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
              : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
          }`}
        >
          {isPositive ? '+' : ''}
          {change24hPercent.toFixed(1)}%
        </span>
      </div>

      {/* Recharts Area Chart for 24h Trend */}
      <div className="h-14 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 3, right: 2, left: 2, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.45} />
                <stop offset="60%" stopColor={strokeColor} stopOpacity={0.12} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <YAxis domain={['dataMin * 0.95', 'dataMax * 1.05']} hide />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-[#0b0e14] border border-slate-700/80 text-[10px] font-mono p-2 rounded-lg shadow-2xl backdrop-blur-md pointer-events-none z-50">
                      <div className="flex items-center justify-between gap-3 text-slate-400 mb-0.5">
                        <span>{data.time === 'Now' ? 'Current spot' : `${data.time} ago`}</span>
                        <span className="text-emerald-400 font-bold">{data.curveProgress.toFixed(1)}% curve</span>
                      </div>
                      <div className="text-white font-extrabold flex items-center gap-1">
                        <span>Price:</span>
                        <span className={isPositive ? 'text-emerald-300' : 'text-rose-300'}>
                          {data.displayPrice}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              dot={false}
              activeDot={{
                r: 3.5,
                fill: strokeColor,
                stroke: '#0b0e14',
                strokeWidth: 1.5,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Axis Timeline Indicators */}
      <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-900/60 mt-1">
        <span>24h ago</span>
        <span>12h</span>
        <span>6h</span>
        <span className="text-slate-400 font-bold">Now</span>
      </div>
    </div>
  );
};
