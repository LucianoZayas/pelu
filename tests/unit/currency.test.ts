import { D } from '@/lib/money/decimal';
import { convertirAMonedaBase } from '@/features/presupuestos/services/currency';

describe('currency.convertirAMonedaBase', () => {
  it('USD→USD identidad', () => {
    expect(convertirAMonedaBase(D('100'), 'USD', 'USD', D('1200')).toFixed(4)).toBe('100.0000');
  });

  it('ARS→ARS identidad', () => {
    expect(convertirAMonedaBase(D('120000'), 'ARS', 'ARS', D('1200')).toFixed(4)).toBe('120000.0000');
  });

  it('ARS→USD: monto / cotizacion', () => {
    // 120000 ARS / 1200 = 100 USD
    expect(convertirAMonedaBase(D('120000'), 'ARS', 'USD', D('1200')).toFixed(4)).toBe('100.0000');
  });

  it('USD→ARS: monto * cotizacion', () => {
    expect(convertirAMonedaBase(D('100'), 'USD', 'ARS', D('1200')).toFixed(4)).toBe('120000.0000');
  });

  it('lanza si cotizacion es 0', () => {
    expect(() => convertirAMonedaBase(D('100'), 'ARS', 'USD', D('0'))).toThrow();
  });

  it('preserva precisión en conversiones grandes', () => {
    // 1234.5678 USD * 1234.5678 = 1524157.65279684
    const r = convertirAMonedaBase(D('1234.5678'), 'USD', 'ARS', D('1234.5678'));
    expect(r.toFixed(4)).toBe('1524157.6528');
  });
});
