import { PoC } from '../types';
import { TARGET_SOL, formatSol } from './bondingCurve';

export interface SparklinePoint {
  time: string;
  hour: number;
  price: number;
  solPrice: number;
  displayPrice: string;
  curveProgress: number;
}

/**
 * Generates 16 realistic 24-hour time-series data points
 * modeling the PoC's bonding curve progression, spot token price, and pooled SOL.
 */
export function generate24hBondingCurveSparkline(poc: PoC): {
  points: SparklinePoint[];
  isPositive: boolean;
  change24hPercent: number;
  highPrice: number;
  lowPrice: number;
} {
  const VIRTUAL_SOL = 30;
  const K = 30 * 1_073_000_000;
  const pointsCount = 16;
  const currentSol = poc.currentSolPooled;
  const targetSol = poc.targetMarketCapSol || TARGET_SOL;

  const isUp = poc.priceChange24h >= 0;
  // Calculate historical start SOL pool 24 hours ago
  const priceChangeFactor = Math.max(-0.9, poc.priceChange24h / 100);
  const startSol = isUp
    ? Math.max(0.1, currentSol / (1 + priceChangeFactor * 0.8))
    : currentSol * (1 + Math.abs(priceChangeFactor) * 0.5);

  // Deterministic seed based on poc.id
  let seed = 73;
  for (let i = 0; i < poc.id.length; i++) {
    seed = (seed * 37 + poc.id.charCodeAt(i)) % 10000;
  }

  const points: SparklinePoint[] = [];
  let lowPrice = Infinity;
  let highPrice = -Infinity;

  for (let i = 0; i < pointsCount; i++) {
    const fraction = i / (pointsCount - 1);
    const hoursAgo = Math.round(24 * (1 - fraction));
    const timeLabel = hoursAgo === 0 ? 'Now' : `-${hoursAgo}h`;

    // Realistic market curve oscillation
    const noise = Math.sin(seed + i * 1.6) * 0.06 * (1 - fraction * 0.5);
    const momentum = Math.pow(fraction, isUp ? 1.3 : 0.8);
    const interpolatedSol =
      i === pointsCount - 1
        ? currentSol
        : Math.max(0.05, startSol + (currentSol - startSol) * momentum + noise * currentSol);

    // Exact bonding curve pricing: P = S / T
    const solReserve = VIRTUAL_SOL + interpolatedSol;
    const tokenReserve = K / solReserve;
    const priceSol = solReserve / tokenReserve;
    const curveProg = Math.min(100, Math.max(0, (interpolatedSol / targetSol) * 100));

    if (priceSol < lowPrice) lowPrice = priceSol;
    if (priceSol > highPrice) highPrice = priceSol;

    points.push({
      time: timeLabel,
      hour: 24 - hoursAgo,
      price: priceSol * 1_000_000_000, // scaled nano-SOL for chart
      solPrice: priceSol,
      displayPrice: formatSol(priceSol, 9) + ' SOL',
      curveProgress: curveProg,
    });
  }

  return {
    points,
    isPositive: poc.priceChange24h >= 0,
    change24hPercent: poc.priceChange24h,
    highPrice,
    lowPrice,
  };
}

// Backwards compatibility alias
export const generateBondingCurveSparkline = generate24hBondingCurveSparkline;
