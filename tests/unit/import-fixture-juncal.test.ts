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

  test('total de items importados está en rango razonable (15-60)', () => {
    expect(result.items.length).toBeGreaterThanOrEqual(15);
    expect(result.items.length).toBeLessThanOrEqual(60);
  });

  test('total de descartes está en rango razonable (100-250)', () => {
    expect(result.descartes.length).toBeGreaterThanOrEqual(100);
    expect(result.descartes.length).toBeLessThanOrEqual(250);
  });

  test('todos los descartes tienen categoría válida', () => {
    for (const d of result.descartes) {
      expect(['estructural', 'informativo', 'warning']).toContain(d.categoria);
    }
  });

  test('hay un item especial consolidado de TOTAL MANO DE OBRA con descripciones en notas', () => {
    const totalMo = result.items.find((i) => /TOTAL MANO DE OBRA/i.test(i.descripcion));
    expect(totalMo).toBeDefined();
    expect(totalMo!.notas).toMatch(/Mano de obra consolidada/);
    expect(totalMo!.warnings.some((w) => w.tipo === 'mo_consolidada')).toBe(true);
  });

  test('descartes warning incluyen los #REF! del bloque INSUMOS', () => {
    const warnings = result.descartes.filter((d) => d.categoria === 'warning');
    expect(warnings.some((d) => /#REF!/.test(d.razon))).toBe(true);
  });

  test('al menos 5 rubros únicos detectados', () => {
    const rubros = new Set(result.items.map((i) => i.rubro));
    expect(rubros.size).toBeGreaterThanOrEqual(5);
  });

  test('todos los items tienen cantidad=1 y unidad=u', () => {
    for (const item of result.items) {
      expect(item.cantidad).toBe(1);
      expect(item.unidad).toBe('u');
    }
  });

  test('items en bloque MARMOLERÍA tienen ubicación variada (COCINA/LAVADERO/BAÑO)', () => {
    const marm = result.items.filter((i) => i.rubro.includes('MARMOL'));
    const ubicaciones = new Set(marm.map((i) => i.ubicacion));
    expect(ubicaciones.size).toBeGreaterThanOrEqual(2);
  });

  test('no hay items con DETALLE empezando con SUBTOTAL/HONORARIOS/etc (excepto TOTAL MANO DE OBRA consolidado)', () => {
    // El item "TOTAL MANO DE OBRA / ..." es intencional — consolida ~90 filas
    // descriptivas de mano de obra. Los demás SUBTOTAL/HONORARIOS/BENEFICIO
    // siguen siendo descarte.
    for (const item of result.items) {
      if (/^TOTAL\s+MANO\s+DE\s+OBRA/i.test(item.descripcion)) continue;
      expect(item.descripcion).not.toMatch(/^(SUB)?TOTAL|^HONORARIOS|^BENEFICIO/i);
    }
  });
});
