import { D } from '@/lib/money/decimal';
import { calcularTotales } from '@/features/presupuestos/totales';

describe('totales', () => {
  it('suma de subtotales por rubro', () => {
    const items = [
      { rubroId: 'r1', subtotalCosto: D('100'), subtotalCliente: D('130') },
      { rubroId: 'r1', subtotalCosto: D('50'), subtotalCliente: D('65') },
      { rubroId: 'r2', subtotalCosto: D('200'), subtotalCliente: D('260') },
    ];
    const t = calcularTotales(items);
    expect(t.totalCosto.toFixed(2)).toBe('350.00');
    expect(t.totalCliente.toFixed(2)).toBe('455.00');
    expect(t.porRubro['r1'].subtotalCliente.toFixed(2)).toBe('195.00');
    expect(t.porRubro['r2'].subtotalCliente.toFixed(2)).toBe('260.00');
  });
});
