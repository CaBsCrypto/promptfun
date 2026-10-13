/** Exact decimal parsing for token and lamport amounts; never round through Number. */
export function decimalToUnits(value: string, decimals: number): string {
  const normalized = value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match || (match[2]?.length ?? 0) > decimals) {
    throw new Error(`Escribe una cantidad positiva con hasta ${decimals} decimales y punto decimal.`);
  }
  const units = BigInt(match[1]) * 10n ** BigInt(decimals) + BigInt((match[2] ?? '').padEnd(decimals, '0') || '0');
  if (units <= 0n) throw new Error('La cantidad debe ser mayor que cero.');
  return units.toString();
}

export function formatUnits(value: string, decimals: number, maximumFraction = decimals): string {
  if (!/^\d+$/.test(value)) return 'No disponible';
  const padded = value.padStart(decimals + 1, '0');
  const whole = decimals ? padded.slice(0, -decimals) : padded;
  const fraction = decimals ? padded.slice(-decimals).slice(0, maximumFraction).replace(/0+$/, '') : '';
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${fraction ? `.${fraction}` : ''}`;
}

export function shortAddress(address: string) {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-5)}` : address;
}

export function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}
