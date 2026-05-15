// Helpers de formato compartidos por el front. Usar en lugar de re-implementar
// formatters en cada componente.

export function formatMoney(
  value: string | number,
  moneda: 'USD' | 'ARS',
  opts: { minDecimals?: number; maxDecimals?: number } = {},
): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return String(value);
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: opts.minDecimals ?? 2,
    maximumFractionDigits: opts.maxDecimals ?? 2,
  }).format(n);
  return `${moneda === 'USD' ? 'US$' : '$'} ${formatted}`;
}

export function formatMoneyCompact(value: string | number, moneda: 'USD' | 'ARS'): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return String(value);
  const formatted = new Intl.NumberFormat('es-AR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
  return `${moneda === 'USD' ? 'US$' : '$'} ${formatted}`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// Diferencia con signo y flecha: positivo verde, negativo rojo.
export function formatDelta(value: number, decimals = 1): { text: string; positive: boolean; zero: boolean } {
  if (value === 0) return { text: '0%', positive: false, zero: true };
  const arrow = value > 0 ? '↑' : '↓';
  return {
    text: `${arrow} ${Math.abs(value * 100).toFixed(decimals)}%`,
    positive: value > 0,
    zero: false,
  };
}

export function formatDate(value: Date | string, opts: { withTime?: boolean } = {}): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    ...(opts.withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export function formatRelativeTime(value: Date | string, now: Date = new Date()): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });
  for (const [unit, secs] of RELATIVE_UNITS) {
    if (Math.abs(diffSec) >= secs) return rtf.format(Math.round(diffSec / secs), unit);
  }
  return rtf.format(diffSec, 'second');
}

// Devuelve {desde, hasta} en YYYY-MM-DD para un preset.
export type PeriodoPreset = 'mes' | 'mes_pasado' | 'ultimos_30' | 'anio';

export function rangoDelPreset(preset: PeriodoPreset, ahora: Date = new Date()): { desde: string; hasta: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const año = ahora.getFullYear();
  const mes = ahora.getMonth();
  if (preset === 'mes') {
    return { desde: fmt(new Date(año, mes, 1)), hasta: fmt(new Date(año, mes + 1, 0)) };
  }
  if (preset === 'mes_pasado') {
    return { desde: fmt(new Date(año, mes - 1, 1)), hasta: fmt(new Date(año, mes, 0)) };
  }
  if (preset === 'ultimos_30') {
    const hasta = new Date(ahora);
    const desde = new Date(ahora);
    desde.setDate(desde.getDate() - 30);
    return { desde: fmt(desde), hasta: fmt(hasta) };
  }
  return { desde: fmt(new Date(año, 0, 1)), hasta: fmt(new Date(año, 11, 31)) };
}
