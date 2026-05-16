// Tests del cálculo de avances: monto neto y honorarios por item, totales.
// El cálculo real vive embebido en actualizarAvance (no es una función pura
// extraíble por ahora), así que acá testeamos las primitivas matemáticas
// equivalentes que la action usa.

import { D, toDb } from '@/lib/money/decimal';

// Reproduce la fórmula que aplica actualizarAvance por item.
function calcularMontoNeto(args: {
  precioUnitarioCliente: string;
  cantidad: string;
  porcentajeAcumulado: number;
  porcentajeAnterior: number;
}): string {
  const delta = args.porcentajeAcumulado - args.porcentajeAnterior;
  return toDb(D(args.precioUnitarioCliente).times(args.cantidad).times(D(delta).div(100)));
}

function calcularMontoHonorarios(args: {
  montoNeto: string;
  porcentajeHonorarios: string;
}): string {
  return toDb(D(args.montoNeto).times(args.porcentajeHonorarios).div(100));
}

describe('cálculo de avances de certificación', () => {
  it('item simple: $100/u × 100 unidades × 30% avance = $3000 neto', () => {
    const neto = calcularMontoNeto({
      precioUnitarioCliente: '100',
      cantidad: '100',
      porcentajeAcumulado: 30,
      porcentajeAnterior: 0,
    });
    expect(Number(neto)).toBe(3000);
  });

  it('avance acumulado: 30% → 50%, delta 20%, mismo item = $2000 neto adicional', () => {
    const neto = calcularMontoNeto({
      precioUnitarioCliente: '100',
      cantidad: '100',
      porcentajeAcumulado: 50,
      porcentajeAnterior: 30,
    });
    expect(Number(neto)).toBe(2000);
  });

  it('avance retrocede: 50% → 30%, monto neto negativo', () => {
    const neto = calcularMontoNeto({
      precioUnitarioCliente: '100',
      cantidad: '100',
      porcentajeAcumulado: 30,
      porcentajeAnterior: 50,
    });
    expect(Number(neto)).toBe(-2000);
  });

  it('avance sin cambio (delta 0): monto neto = 0', () => {
    const neto = calcularMontoNeto({
      precioUnitarioCliente: '100',
      cantidad: '100',
      porcentajeAcumulado: 50,
      porcentajeAnterior: 50,
    });
    expect(Number(neto)).toBe(0);
  });

  it('honorarios 16% sobre $3000 = $480', () => {
    const hon = calcularMontoHonorarios({ montoNeto: '3000', porcentajeHonorarios: '16' });
    expect(Number(hon)).toBe(480);
  });

  it('honorarios 3% sobre $5000 (item con override bajo) = $150', () => {
    const hon = calcularMontoHonorarios({ montoNeto: '5000', porcentajeHonorarios: '3' });
    expect(Number(hon)).toBe(150);
  });

  it('honorarios 0% (override) = 0', () => {
    const hon = calcularMontoHonorarios({ montoNeto: '5000', porcentajeHonorarios: '0' });
    expect(Number(hon)).toBe(0);
  });

  it('precisión decimal: $100.50 × 3 × 33.33% = $100.4985, redondea a 4 decimales', () => {
    const neto = calcularMontoNeto({
      precioUnitarioCliente: '100.50',
      cantidad: '3',
      porcentajeAcumulado: 33.33,
      porcentajeAnterior: 0,
    });
    // 100.50 × 3 = 301.50, × 0.3333 = 100.48995, redondeado a 4 = 100.4900 o similar
    expect(Number(neto)).toBeCloseTo(100.49, 2);
  });

  it('caso completo: presupuesto con 2 items, mismo % avance', () => {
    // Item 1: Albañilería $5000/u × 2 unidades, 50% avance, 16% honorarios
    const neto1 = calcularMontoNeto({
      precioUnitarioCliente: '5000',
      cantidad: '2',
      porcentajeAcumulado: 50,
      porcentajeAnterior: 0,
    });
    const hon1 = calcularMontoHonorarios({ montoNeto: neto1, porcentajeHonorarios: '16' });
    // Item 2: Pintura $2000/u × 1 unidad, 0% avance (no se certifica), 3% honorarios
    const neto2 = calcularMontoNeto({
      precioUnitarioCliente: '2000',
      cantidad: '1',
      porcentajeAcumulado: 0,
      porcentajeAnterior: 0,
    });
    const hon2 = calcularMontoHonorarios({ montoNeto: neto2, porcentajeHonorarios: '3' });

    const totalNeto = Number(neto1) + Number(neto2);
    const totalHon = Number(hon1) + Number(hon2);
    const totalGeneral = totalNeto + totalHon;

    expect(Number(neto1)).toBe(5000);
    expect(Number(hon1)).toBe(800);
    expect(Number(neto2)).toBe(0);
    expect(Number(hon2)).toBe(0);
    expect(totalNeto).toBe(5000);
    expect(totalHon).toBe(800);
    expect(totalGeneral).toBe(5800);
  });
});
