import path from 'path';
import fs from 'fs';
import { parseXlsx } from '@/../scripts/import-sheets/parse-xlsx';

const FIXTURE_DIR = path.join(__dirname, '../../scripts/import-sheets/__fixtures__');
const loadFixture = (n: string) => fs.promises.readFile(path.join(FIXTURE_DIR, n));

describe('parseXlsx — row loop con C.2 split y forward-fill', () => {
  test('synthetic: descarta fila SUBTOTAL', async () => {
    const r = await parseXlsx(await loadFixture('synthetic-small.xlsx'), 's.xlsx');
    const descartado = r.descartes.find((d) => d.detalle.includes('SUBTOTAL'));
    expect(descartado).toBeDefined();
    expect(descartado!.razon).toMatch(/separadora|total/i);
  });

  test('synthetic: forward-fill de rubro genera warning', async () => {
    const r = await parseXlsx(await loadFixture('synthetic-small.xlsx'), 's.xlsx');
    const heredado = r.items.find((i) => i.descripcion.includes('Continúa albañilería'));
    expect(heredado).toBeDefined();
    expect(heredado!.rubro).toBe('ALBAÑILERIA');
    expect(heredado!.warnings.some((w) => w.tipo === 'rubro_heredado')).toBe(true);
  });

  test('C.2: fila con material y MO genera 2 items', async () => {
    const r = await parseXlsx(await loadFixture('synthetic-small.xlsx'), 's.xlsx');
    const demolicion = r.items.filter((i) => i.descripcion.startsWith('Retiro de revestimientos'));
    expect(demolicion).toHaveLength(2);
    expect(demolicion.find((i) => i.descripcion.endsWith('— Material'))).toBeDefined();
    expect(demolicion.find((i) => i.descripcion.endsWith('— Mano de obra'))).toBeDefined();
  });

  test('C.2: fila con solo MO genera 1 item sin suffix', async () => {
    // El suffix " — Mano de obra" solo se agrega cuando la fila tiene
    // material AND MO (split). Si la fila tiene solo MO, el item conserva
    // la descripción original sin suffix — más legible.
    const r = await parseXlsx(await loadFixture('synthetic-small.xlsx'), 's.xlsx');
    const mesada = r.items.filter((i) => i.descripcion.startsWith('Mesada baño'));
    expect(mesada).toHaveLength(1);
    expect(mesada[0].descripcion).toBe('Mesada baño');
    expect(mesada[0].costoUnitario).toBe(250000);
  });

  test('markup: coeficiente 1.2 → markupPorcentaje 0.20', async () => {
    const r = await parseXlsx(await loadFixture('synthetic-small.xlsx'), 's.xlsx');
    expect(r.items[0].markupPorcentaje).toBeCloseTo(0.20, 5);
  });

  test('costoUnitario, cantidad, unidad defaults', async () => {
    const r = await parseXlsx(await loadFixture('synthetic-small.xlsx'), 's.xlsx');
    expect(r.items[0].cantidad).toBe(1);
    expect(r.items[0].unidad).toBe('gl');
    expect(r.items[0].monedaCosto).toBe('ARS');
  });

  test('XLSX real: descarta filas en región 3 (HONORARIOS, BENEFICIO, etc)', async () => {
    const r = await parseXlsx(await loadFixture('juncal-3706-real.xlsx'), 'j.xlsx');
    expect(r.descartes.some((d) => /HONORARIOS/i.test(d.detalle))).toBe(true);
    expect(r.descartes.some((d) => /BENEFICIO|BENEF/i.test(d.detalle))).toBe(true);
  });

  test('XLSX real: descarta filas tipo CONTRATISTA N', async () => {
    const r = await parseXlsx(await loadFixture('juncal-3706-real.xlsx'), 'j.xlsx');
    expect(r.descartes.some((d) => /CONTRATISTA \d/i.test(d.detalle))).toBe(true);
  });
});
