import { parse } from 'csv-parse/sync';
import type { FilaCsv } from './tipos';

const COLUMNAS_REQUERIDAS = ['rubro', 'descripcion', 'unidad', 'cantidad', 'costo_unitario', 'moneda_costo', 'markup', 'notas'] as const;

export async function parseCsv(buf: Buffer): Promise<FilaCsv[]> {
  const records = parse(buf, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
  if (records.length === 0) return [];

  const cols = Object.keys(records[0]);
  for (const req of COLUMNAS_REQUERIDAS) {
    if (!cols.includes(req)) {
      throw new Error(`Falta columna obligatoria: ${req}`);
    }
  }

  return records.map((r) => ({
    rubro: r.rubro,
    descripcion: r.descripcion,
    unidad: r.unidad,
    cantidad: r.cantidad,
    costo_unitario: r.costo_unitario,
    moneda_costo: r.moneda_costo,
    markup: r.markup,
    notas: r.notas ?? '',
  }));
}
