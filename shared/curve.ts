/** SOL / classic SPL market arithmetic. All quantities are integer base units. */
export const TOKEN_DECIMALS = 6;
export const TOTAL_SUPPLY = 1_000_000_000_000_000n;
export const CURVE_SUPPLY = 800_000_000_000_000n;
export const LOCKED_SUPPLY = 200_000_000_000_000n;
export const VIRTUAL_TOKENS = 1_073_000_000_000_000n;
export const VIRTUAL_LAMPORTS = 30_000_000_000n;
export const MAX_U64 = (1n << 64n) - 1n;
export const QUOTE_SECONDS = 90;
export function integer(value: unknown, label = 'amount'): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(value)) throw new Error(`${label} debe ser un entero decimal.`);
  const result = BigInt(value);
  if (result > MAX_U64) throw new Error(`${label} excede u64.`);
  return result;
}
export function cumulativeCost(sold: bigint): bigint {
  if (sold < 0n || sold > CURVE_SUPPLY) throw new Error('Cantidad fuera de la curva.');
  const denominator = VIRTUAL_TOKENS - sold;
  return (VIRTUAL_LAMPORTS * VIRTUAL_TOKENS + denominator - 1n) / denominator - VIRTUAL_LAMPORTS;
}
export function quoteTrade(side: 'buy' | 'sell', sold: bigint, quantity: bigint): bigint {
  if (quantity <= 0n) throw new Error('La cantidad debe ser positiva.');
  const amount = side === 'buy' ? cumulativeCost(sold + quantity) - cumulativeCost(sold) : cumulativeCost(sold) - cumulativeCost(sold - quantity);
  if (amount <= 0n) throw new Error('La operación es demasiado pequeña: menos de un lamport.');
  return amount;
}
