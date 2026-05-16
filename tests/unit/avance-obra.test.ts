// Tests del cálculo de avance: progreso global ponderado por monto.
// La fórmula vive en queries.ts (obtenerAvanceDeObra). Replico la lógica.

type Item = {
  precio: number;
  cantidad: number;
  avance: number; // 0-100
};

function calcularProgreso(items: Item[]): { progreso: number; ejecutado: number; total: number; completados: number } {
  let total = 0;
  let ejecutado = 0;
  let completados = 0;
  for (const it of items) {
    const monto = it.precio * it.cantidad;
    total += monto;
    ejecutado += monto * (it.avance / 100);
    if (it.avance >= 100) completados++;
  }
  return {
    progreso: total > 0 ? (ejecutado / total) * 100 : 0,
    ejecutado,
    total,
    completados,
  };
}

describe('cálculo de progreso de avance de obra', () => {
  it('sin items: progreso 0%', () => {
    const r = calcularProgreso([]);
    expect(r.progreso).toBe(0);
    expect(r.total).toBe(0);
    expect(r.completados).toBe(0);
  });

  it('un solo item al 0%: progreso 0%', () => {
    const r = calcularProgreso([{ precio: 100, cantidad: 10, avance: 0 }]);
    expect(r.progreso).toBe(0);
    expect(r.completados).toBe(0);
  });

  it('un solo item al 50%: progreso 50%', () => {
    const r = calcularProgreso([{ precio: 100, cantidad: 10, avance: 50 }]);
    expect(r.progreso).toBe(50);
    expect(r.ejecutado).toBe(500);
    expect(r.total).toBe(1000);
    expect(r.completados).toBe(0);
  });

  it('un solo item al 100%: progreso 100% + completado', () => {
    const r = calcularProgreso([{ precio: 100, cantidad: 10, avance: 100 }]);
    expect(r.progreso).toBe(100);
    expect(r.completados).toBe(1);
  });

  it('items con avances iguales: progreso = avance común', () => {
    const r = calcularProgreso([
      { precio: 100, cantidad: 5, avance: 30 },
      { precio: 200, cantidad: 2, avance: 30 },
    ]);
    expect(r.progreso).toBe(30);
  });

  it('items con avances distintos: progreso ponderado por monto', () => {
    // Item A: monto 1000, 100% → contribuye 1000
    // Item B: monto 1000, 0%   → contribuye 0
    // Total: 2000, ejecutado 1000 → 50%
    const r = calcularProgreso([
      { precio: 100, cantidad: 10, avance: 100 },
      { precio: 100, cantidad: 10, avance: 0 },
    ]);
    expect(r.progreso).toBe(50);
    expect(r.completados).toBe(1);
  });

  it('item grande al 50% pesa más que item chico al 100%', () => {
    // Item grande: $10.000 al 50% → ejecuta $5.000
    // Item chico: $100 al 100% → ejecuta $100
    // Total: $10.100, ejecutado: $5.100 → ~50.5%
    const r = calcularProgreso([
      { precio: 10000, cantidad: 1, avance: 50 },
      { precio: 100, cantidad: 1, avance: 100 },
    ]);
    expect(r.progreso).toBeCloseTo(50.5, 1);
    expect(r.completados).toBe(1); // solo el chico está completo
  });

  it('todos completos: progreso 100% + N completados', () => {
    const r = calcularProgreso([
      { precio: 100, cantidad: 10, avance: 100 },
      { precio: 200, cantidad: 5, avance: 100 },
      { precio: 50, cantidad: 20, avance: 100 },
    ]);
    expect(r.progreso).toBe(100);
    expect(r.completados).toBe(3);
  });

  it('caso testigo Macna: 3 items mixtos', () => {
    // Albañilería $5000/u × 2 → $10.000 al 100% → ejec $10.000, completo
    // Pintura $2000/u × 1 → $2.000 al 50% → ejec $1.000
    // Pisos $3000/u × 3 → $9.000 al 0% → ejec $0
    // Total: $21.000, ejec: $11.000 → 52.38%, 1 completado
    const r = calcularProgreso([
      { precio: 5000, cantidad: 2, avance: 100 },
      { precio: 2000, cantidad: 1, avance: 50 },
      { precio: 3000, cantidad: 3, avance: 0 },
    ]);
    expect(r.total).toBe(21000);
    expect(r.ejecutado).toBe(11000);
    expect(r.progreso).toBeCloseTo(52.38, 1);
    expect(r.completados).toBe(1);
  });
});
