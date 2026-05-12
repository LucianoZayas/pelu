import { parseCsv } from './parse-csv';
import { parseXlsx } from './parse-xlsx';
import type { FilaCsv, ResultadoParseoXlsx } from './tipos';

export type ParsedFile =
  | { kind: 'csv'; filas: FilaCsv[] }
  | { kind: 'xlsx'; result: ResultadoParseoXlsx };

export async function parseFile(buf: Buffer, fileName: string): Promise<ParsedFile> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xlsx')) {
    return { kind: 'xlsx', result: await parseXlsx(buf, fileName) };
  }
  if (lower.endsWith('.csv')) {
    return { kind: 'csv', filas: await parseCsv(buf) };
  }
  throw new Error(`Extensión no soportada: ${fileName}. Usar .csv o .xlsx.`);
}

// Re-export para compatibilidad con código existente
export { parseCsv } from './parse-csv';
