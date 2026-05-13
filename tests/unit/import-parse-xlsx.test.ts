import path from 'path';
import fs from 'fs';
import { parseXlsx } from '@/../scripts/import-sheets/parse-xlsx';

const FIXTURE_DIR = path.join(__dirname, '../../scripts/import-sheets/__fixtures__');

async function loadFixture(name: string): Promise<Buffer> {
  return fs.promises.readFile(path.join(FIXTURE_DIR, name));
}

describe('parseXlsx — detección estructural', () => {
  test('XLSX real: detecta cotización 1500 en fila 2', async () => {
    const buf = await loadFixture('juncal-3706-real.xlsx');
    const r = await parseXlsx(buf, 'juncal-3706-real.xlsx');
    expect(r.cotizacionDetectada).toBe(1500);
  });

  test('XLSX real: header detectado en fila 6', async () => {
    const buf = await loadFixture('juncal-3706-real.xlsx');
    const r = await parseXlsx(buf, 'juncal-3706-real.xlsx');
    expect(r.metadata.headerRow).toBe(6);
  });

  test('XLSX real: mapeo de columnas detecta RUBRO/UBICACIÓN/DETALLE/COSTO TOTAL', async () => {
    const buf = await loadFixture('juncal-3706-real.xlsx');
    const r = await parseXlsx(buf, 'juncal-3706-real.xlsx');
    expect(r.mapeoColumnas.RUBRO).toBe(2);
    expect(r.mapeoColumnas.UBICACIÓN).toBe(3);
    expect(r.mapeoColumnas.DETALLE).toBe(4);
    expect(r.mapeoColumnas.COSTO_TOTAL).toBe(6);       // primer match izq
    expect(r.mapeoColumnas.MANO_OBRA_TOTAL).toBe(13);
    expect(r.mapeoColumnas.COEFICIENTE).toBe(14);
  });

  test('XLSX real: hoja parseada es "Copia de JUNCAL 3706"', async () => {
    const buf = await loadFixture('juncal-3706-real.xlsx');
    const r = await parseXlsx(buf, 'juncal-3706-real.xlsx');
    expect(r.metadata.hojaParseada).toBe('Copia de JUNCAL 3706');
  });

  test('XLSX sintético: detecta cotización 1500 y header en fila 6', async () => {
    const buf = await loadFixture('synthetic-small.xlsx');
    const r = await parseXlsx(buf, 'synthetic-small.xlsx');
    expect(r.cotizacionDetectada).toBe(1500);
    expect(r.metadata.headerRow).toBe(6);
  });
});
