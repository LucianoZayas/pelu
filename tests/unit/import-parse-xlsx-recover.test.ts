import path from 'path';
import fs from 'fs';
import { parseXlsx } from '@/../scripts/import-sheets/parse-xlsx';

const FIXTURE = path.join(__dirname, '../../scripts/import-sheets/__fixtures__/juncal-3706-real.xlsx');

describe('parseXlsx — recuperación de items y categorización de descartes', () => {
  let result: Awaited<ReturnType<typeof parseXlsx>>;

  beforeAll(async () => {
    result = await parseXlsx(await fs.promises.readFile(FIXTURE), 'juncal-3706-real.xlsx');
  });

  test('recupera items con costo en COSTO PARCIAL cuando TOTAL está vacío', () => {
    // R142 "Bacha lavadero" — c5 (parcial) tiene formula que resuelve a 20000,
    // c6 (total) vacío. El parser anterior lo descartaba.
    const bacha = result.items.find((i) => /Bacha lavadero/i.test(i.descripcion));
    expect(bacha).toBeDefined();
    expect(bacha!.warnings.some((w) => w.tipo === 'costo_solo_parcial')).toBe(true);
  });

  test('recupera items con costo en MO PARCIAL cuando MO TOTAL está vacío', () => {
    // R124-126 MUEBLES DE OBRA — c12 (mo parcial) tiene formulas, c13 (mo total) vacío.
    const muebleCocina = result.items.find((i) => /Mueble de cocina/i.test(i.descripcion));
    expect(muebleCocina).toBeDefined();
    expect(muebleCocina!.costoUnitario).toBeGreaterThan(0);
    expect(muebleCocina!.warnings.some((w) => w.tipo === 'costo_solo_parcial')).toBe(true);
  });

  test('detecta y categoriza placeholder ADICIONALES como estructural', () => {
    const adicionales = result.descartes.filter((d) =>
      /Placeholder ADICIONALES/i.test(d.razon),
    );
    expect(adicionales.length).toBeGreaterThan(0);
    adicionales.forEach((d) => expect(d.categoria).toBe('estructural'));
  });

  test('categoriza SUBTOTAL/TOTAL/HONORARIOS como informativo, no warning', () => {
    const totales = result.descartes.filter((d) =>
      /Fila agregada/i.test(d.razon),
    );
    expect(totales.length).toBeGreaterThan(0);
    totales.forEach((d) => expect(d.categoria).toBe('informativo'));
  });

  test('costos huérfanos sin descripción se marcan como warning', () => {
    // R140 tiene c6=2500000 sin detalle
    const huerfanos = result.descartes.filter((d) =>
      /Costo huérfano/i.test(d.razon),
    );
    expect(huerfanos.length).toBeGreaterThan(0);
    huerfanos.forEach((d) => expect(d.categoria).toBe('warning'));
  });

  test('formulas rotas (#REF!) se categorizan como warning', () => {
    const refs = result.descartes.filter((d) => /#REF!/.test(d.razon));
    expect(refs.length).toBeGreaterThanOrEqual(8); // bloque INSUMOS roto
    refs.forEach((d) => expect(d.categoria).toBe('warning'));
  });

  test('separadores de sección en col 1 (CONTRATISTA N, MARMOLERIA, etc) son estructural', () => {
    const titulos = result.descartes.filter((d) =>
      /Título de sección|Separador de contratista/i.test(d.razon),
    );
    expect(titulos.length).toBeGreaterThan(0);
    titulos.forEach((d) => expect(d.categoria).toBe('estructural'));
  });

  test('warnings reales (los importantes) son ≤ 15', () => {
    // Si esto crece mucho, hay que revisar — quizás más casos a normalizar.
    const warnings = result.descartes.filter((d) => d.categoria === 'warning');
    expect(warnings.length).toBeLessThanOrEqual(15);
  });

  test('TOTAL MANO DE OBRA consolidado tiene notas con grupos por rubro', () => {
    const totalMo = result.items.find((i) =>
      /TOTAL\s+MANO\s+DE\s+OBRA/i.test(i.descripcion),
    );
    expect(totalMo).toBeDefined();
    expect(totalMo!.notas).toMatch(/DEMOLICION/i);
    expect(totalMo!.notas).toMatch(/ALBAÑILERIA/i);
    expect(totalMo!.notas).toMatch(/PINTURA/i);
    // Y el conteo de líneas consolidadas
    expect(totalMo!.notas).toMatch(/consolidado de \d+ filas/);
  });

  test('filas cubiertas por TOTAL MO no aparecen como descartes "sin costo"', () => {
    // Antes: 119 descartes "sin costo material ni mano de obra"
    // Después: la mayoría caen como "Descripción incluida en TOTAL MANO DE OBRA"
    const sinCostoVisible = result.descartes.filter((d) =>
      /sin costo material ni mano de obra/i.test(d.razon),
    );
    const incluidosEnTotalMo = result.descartes.filter((d) =>
      /Descripción incluida en TOTAL MANO DE OBRA/i.test(d.razon),
    );
    expect(incluidosEnTotalMo.length).toBeGreaterThan(50);
    expect(sinCostoVisible.length).toBeLessThan(50);
  });
});
