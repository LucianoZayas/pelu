import Decimal from 'decimal.js';

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_EVEN });

export type DecimalInput = string | number | Decimal;

export function D(v: DecimalInput): Decimal {
  return new Decimal(v);
}

export function add(...xs: DecimalInput[]): Decimal {
  return xs.reduce<Decimal>((acc, x) => acc.plus(x), new Decimal(0));
}

export function sub(a: DecimalInput, b: DecimalInput): Decimal {
  return D(a).minus(b);
}

export function mul(a: DecimalInput, b: DecimalInput): Decimal {
  return D(a).times(b);
}

export function div(a: DecimalInput, b: DecimalInput): Decimal {
  return D(a).div(b);
}

/** Convierte string columnar de Postgres (decimal) a Decimal. */
export function parseDb(v: string | null | undefined): Decimal | null {
  if (v == null) return null;
  return new Decimal(v);
}

/** Serializa a string para columnas Postgres `decimal(p, s)`. */
export function toDb(v: Decimal, scale = 4): string {
  return v.toFixed(scale);
}

/** Formatea para mostrar al usuario. */
export function fmt(v: Decimal, scale = 2): string {
  return v.toFixed(scale);
}
