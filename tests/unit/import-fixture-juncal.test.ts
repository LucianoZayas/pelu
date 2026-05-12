import path from 'path';
import fs from 'fs';
import { parseXlsx } from '@/../scripts/import-sheets/parse-xlsx';

const FIXTURE = path.join(__dirname, '../../scripts/import-sheets/__fixtures__/juncal-3706-real.xlsx');

describe('Importer XLSX — snapshot del fixture real Juncal 3706', () => {
  let result: Awaited<ReturnType<typeof parseXlsx>>;

  beforeAll(async () => {
    const buf = await fs.promises.readFile(FIXTURE);
    result = await parseXlsx(buf, 'juncal-3706-real.xlsx');
  });

  test('cotización USD detectada = 1500', () => {
    expect(result.cotizacionDetectada).toBe(1500);
  });

  test('hoja parseada = "Copia de JUNCAL 3706"', () => {
    expect(result.metadata.hojaParseada).toBe('Copia de JUNCAL 3706');
  });

  test('total de items importados está en rango razonable (10-50)', () => {
    expect(result.items.length).toBeGreaterThanOrEqual(10);
    expect(result.items.length).toBeLessThanOrEqual(50);
  });

  test('total de descartes está en rango razonable (100-250)', () => {
    expect(result.descartes.length).toBeGreaterThanOrEqual(100);
    expect(result.descartes.length).toBeLessThanOrEqual(250);
  });

  test('al menos 5 rubros únicos detectados', () => {
    const rubros = new Set(result.items.map((i) => i.rubro));
    expect(rubros.size).toBeGreaterThanOrEqual(5);
  });

  test('todos los items tienen cantidad=1 y unidad=gl', () => {
    for (const item of result.items) {
      expect(item.cantidad).toBe(1);
      expect(item.unidad).toBe('gl');
    }
  });

  test('items en bloque MARMOLERÍA tienen ubicación variada (COCINA/LAVADERO/BAÑO)', () => {
    const marm = result.items.filter((i) => i.rubro.includes('MARMOL'));
    const ubicaciones = new Set(marm.map((i) => i.ubicacion));
    expect(ubicaciones.size).toBeGreaterThanOrEqual(2);
  });

  test('no hay items con DETALLE empezando con SUBTOTAL/HONORARIOS/etc', () => {
    for (const item of result.items) {
      expect(item.descripcion).not.toMatch(/^(SUB)?TOTAL|^HONORARIOS|^BENEFICIO/i);
    }
  });
});
