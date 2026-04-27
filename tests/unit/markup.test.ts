import { D } from '@/lib/money/decimal';
import { calcularPrecioCliente, markupEfectivo } from '@/features/presupuestos/services/markup';

describe('markup service', () => {
  it('precio cliente = costoBase × (1 + markup/100)', () => {
    const precio = calcularPrecioCliente(D('100'), D('30'));
    expect(precio.toFixed(4)).toBe('130.0000');
  });

  it('markup 0 → precio = costo', () => {
    expect(calcularPrecioCliente(D('99.99'), D('0')).toFixed(4)).toBe('99.9900');
  });

  it('markup negativo (descuento) válido', () => {
    expect(calcularPrecioCliente(D('100'), D('-10')).toFixed(4)).toBe('90.0000');
  });

  it('markupEfectivo: usa markup item si está, si no el del presupuesto', () => {
    expect(markupEfectivo(null, D('30')).toFixed(2)).toBe('30.00');
    expect(markupEfectivo(D('45.5'), D('30')).toFixed(2)).toBe('45.50');
    expect(markupEfectivo(D('0'), D('30')).toFixed(2)).toBe('0.00'); // markup explícito 0 NO hereda
  });

  it('precisión: 33.33% sobre 99.99', () => {
    const precio = calcularPrecioCliente(D('99.99'), D('33.33'));
    // 99.99 * 1.3333 = 133.316667
    expect(precio.toFixed(6)).toBe('133.316667');
  });
});
