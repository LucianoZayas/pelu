import Decimal from 'decimal.js';
import { D, add, mul, div, parseDb, toDb } from '@/lib/money/decimal';

describe('money/decimal', () => {
  it('0.1 + 0.2 = 0.3 (sin error de coma flotante)', () => {
    const r = add('0.1', '0.2');
    expect(r.equals(new Decimal('0.3'))).toBe(true);
    expect(r.toFixed(1)).toBe('0.3');
  });

  it('cálculo de markup con 4 decimales', () => {
    // costo 123.4567 * (1 + 0.3) = 160.49371
    const costo = D('123.4567');
    const markup = D('30');
    const precio = mul(costo, add(1, div(markup, 100)));
    expect(precio.toFixed(4)).toBe('160.4937');
  });

  it('parseDb null-safe', () => {
    expect(parseDb(null)).toBeNull();
    expect(parseDb('1.2300')!.equals(D('1.23'))).toBe(true);
  });

  it('toDb redondea half-even', () => {
    expect(toDb(D('0.12345'), 4)).toBe('0.1234'); // banker's rounding
    expect(toDb(D('0.12355'), 4)).toBe('0.1236');
  });

  it('conversión USD→ARS preserva precisión', () => {
    // $1.23 * 1234.5678 = 1518.518394
    const ars = mul('1.23', '1234.5678');
    expect(ars.toFixed(6)).toBe('1518.518394');
  });
});
