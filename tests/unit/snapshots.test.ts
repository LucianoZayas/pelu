import { D } from '@/lib/money/decimal';
import { calcularSnapshotItem, type ItemRaw, type PresupuestoCtx } from '@/features/presupuestos/services/snapshots';

const ctx: PresupuestoCtx = {
  monedaBase: 'USD',
  cotizacionUsd: D('1200'),
  markupDefault: D('30'),
};

describe('snapshots.calcularSnapshotItem', () => {
  it('caso simple USD obra USD costo', () => {
    const item: ItemRaw = {
      cantidad: D('10'), costoUnitario: D('100'), costoUnitarioMoneda: 'USD',
      markupPorcentaje: null,
    };
    const s = calcularSnapshotItem(item, ctx);
    expect(s.costoUnitarioBase.toFixed(4)).toBe('100.0000');
    expect(s.markupEfectivoPorcentaje.toFixed(2)).toBe('30.00');
    expect(s.precioUnitarioCliente.toFixed(4)).toBe('130.0000');
  });

  it('costo ARS, obra USD, conversión vía cotizacion', () => {
    const item: ItemRaw = {
      cantidad: D('1'), costoUnitario: D('120000'), costoUnitarioMoneda: 'ARS',
      markupPorcentaje: null,
    };
    const s = calcularSnapshotItem(item, ctx);
    expect(s.costoUnitarioBase.toFixed(4)).toBe('100.0000'); // 120000 / 1200
    expect(s.precioUnitarioCliente.toFixed(4)).toBe('130.0000');
  });

  it('markup override por item', () => {
    const item: ItemRaw = {
      cantidad: D('1'), costoUnitario: D('100'), costoUnitarioMoneda: 'USD',
      markupPorcentaje: D('50'),
    };
    const s = calcularSnapshotItem(item, ctx);
    expect(s.markupEfectivoPorcentaje.toFixed(2)).toBe('50.00');
    expect(s.precioUnitarioCliente.toFixed(4)).toBe('150.0000');
  });

  it('subtotal = cantidad × precio cliente', () => {
    const item: ItemRaw = {
      cantidad: D('3.5'), costoUnitario: D('100'), costoUnitarioMoneda: 'USD',
      markupPorcentaje: null,
    };
    const s = calcularSnapshotItem(item, ctx);
    expect(s.subtotalCliente.toFixed(4)).toBe('455.0000'); // 3.5 * 130
    expect(s.subtotalCosto.toFixed(4)).toBe('350.0000');
  });

  it('precisión: items con muchos decimales', () => {
    const item: ItemRaw = {
      cantidad: D('1.7777'), costoUnitario: D('123.4567'),
      costoUnitarioMoneda: 'USD', markupPorcentaje: D('33.33'),
    };
    const s = calcularSnapshotItem(item, ctx);
    // costoBase = 123.4567
    // precioCliente = 123.4567 * 1.3333 = 164.604818 (precisión 30)
    // subtotal = 1.7777 * precioCliente
    expect(s.precioUnitarioCliente.toFixed(6)).toBe('164.604818');
    expect(s.subtotalCliente.toFixed(6)).toBe('292.617985');
  });
});
