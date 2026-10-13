// Mathematical Engine for Pump.fun-style Bonding Curve

export const TOTAL_SUPPLY = 1_000_000_000; // 1 Billion tokens
export const CURVE_SUPPLY = 800_000_000;   // 800M tokens sold on curve
export const TARGET_SOL = 85;              // 85 SOL targets graduation (~$14,000+)
export const SOL_USD_RATE = 165;           // $165 per SOL estimate

// Base virtual liquidity parameters
const VIRTUAL_SOL_RESERVE = 30;
const VIRTUAL_TOKEN_RESERVE = 1_073_000_000;
const K_CONSTANT = VIRTUAL_SOL_RESERVE * VIRTUAL_TOKEN_RESERVE;

/**
 * Calculates how many tokens a user receives for a given amount of SOL.
 */
export function calculateTokensForSol(currentSolPooled: number, solAmount: number): {
  tokensOut: number;
  newSolPooled: number;
  newPriceSol: number;
  priceImpactPercent: number;
} {
  const currentSolReserve = VIRTUAL_SOL_RESERVE + currentSolPooled;
  const currentTokenReserve = K_CONSTANT / currentSolReserve;

  const newSolReserve = currentSolReserve + solAmount;
  const newTokenReserve = K_CONSTANT / newSolReserve;

  const tokensOut = Math.max(0, currentTokenReserve - newTokenReserve);
  const currentPrice = currentSolReserve / currentTokenReserve;
  const newPrice = newSolReserve / newTokenReserve;

  const priceImpactPercent = Math.min(100, Math.max(0, ((newPrice - currentPrice) / currentPrice) * 100));

  return {
    tokensOut,
    newSolPooled: currentSolPooled + solAmount,
    newPriceSol: newPrice,
    priceImpactPercent,
  };
}

/**
 * Calculates how much SOL a user receives when selling an amount of tokens.
 */
export function calculateSolForTokens(currentSolPooled: number, tokenAmount: number): {
  solOut: number;
  newSolPooled: number;
  newPriceSol: number;
  priceImpactPercent: number;
} {
  const currentSolReserve = VIRTUAL_SOL_RESERVE + currentSolPooled;
  const currentTokenReserve = K_CONSTANT / currentSolReserve;

  const newTokenReserve = currentTokenReserve + tokenAmount;
  const newSolReserve = K_CONSTANT / newTokenReserve;

  const solOut = Math.min(currentSolPooled, Math.max(0, currentSolReserve - newSolReserve));
  const newSolPooled = Math.max(0, currentSolPooled - solOut);
  
  const currentPrice = currentSolReserve / currentTokenReserve;
  const nextSolReserve = VIRTUAL_SOL_RESERVE + newSolPooled;
  const nextTokenReserve = K_CONSTANT / nextSolReserve;
  const newPrice = nextSolReserve / nextTokenReserve;

  const priceImpactPercent = Math.min(100, Math.max(0, ((currentPrice - newPrice) / currentPrice) * 100));

  return {
    solOut,
    newSolPooled,
    newPriceSol: newPrice,
    priceImpactPercent,
  };
}

/**
 * Formats SOL amounts for crisp UI
 */
export function formatSol(amount: number, decimals: number = 3): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0.000';
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formats Token counts (e.g. 1.45M, 240K)
 */
export function formatTokens(amount: number): string {
  if (amount >= 1_000_000_000) {
    return (amount / 1_000_000_000).toFixed(2) + 'B';
  }
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toFixed(2) + 'M';
  }
  if (amount >= 1_000) {
    return (amount / 1_000).toFixed(1) + 'K';
  }
  return Math.floor(amount).toLocaleString();
}

/**
 * Formats USD value
 */
export function formatUsd(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
