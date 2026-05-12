import ExcelJS from 'exceljs';
import type { ResultadoParseoXlsx, ItemPreview, DescarteRow } from './tipos';
import { safeParseNumber } from './safe-parse';

const HEADER_PATTERNS = {
  RUBRO: /^RUBRO$/i,
  UBICACIÓN: /^UBICACI[ÓO]N$/i,
  DETALLE: /^DETALLE$/i,
  COSTO_TOTAL: /^COSTO\s+TOTAL$/i,
  MANO_OBRA_TOTAL: /^MANO\s+(DE\s+)?OBRA\s+TOTAL/i,
  COEFICIENTE: /coeficiente|aumento/i,
};

const SHEET_PATTERNS = /JUNCAL|presupuesto|obra/i;
// Sheets that look like "FLUJO DE CAJA" or "PROYECCIONES" are finance/cashflow sheets —
// they match SHEET_PATTERNS by name but don't contain the item-list headers we need.
const SHEET_EXCLUDE = /FLUJO\s+DE\s+CAJA|PROYECCI[ÓO]N|GASTOS\s+GENERALES/i;

function selectSheet(wb: ExcelJS.Workbook, hasValidHeader: (ws: ExcelJS.Worksheet) => boolean): ExcelJS.Worksheet {
  const candidates = wb.worksheets.filter(
    (ws) => SHEET_PATTERNS.test(ws.name) && !SHEET_EXCLUDE.test(ws.name),
  );
  // Among candidates, prefer the one with a valid header row
  const withHeader = candidates.find((ws) => hasValidHeader(ws));
  if (withHeader) return withHeader;
  if (candidates.length > 0) return candidates[0];
  // Fallback: any sheet with a valid header
  const anyWithHeader = wb.worksheets.find((ws) => hasValidHeader(ws));
  return anyWithHeader ?? wb.worksheets[0];
}

function findCotizacion(ws: ExcelJS.Worksheet): number | null {
  for (let r = 1; r <= 5; r++) {
    for (let c = 1; c <= 10; c++) {
      const v = ws.getRow(r).getCell(c).value;
      if (typeof v === 'string' && /DOLAR|COTIZ/i.test(v)) {
        // Buscar número en celdas adyacentes (misma fila siguientes, o fila siguiente misma col)
        for (let dc = 1; dc <= 5; dc++) {
          const candidate = safeParseNumber(ws.getRow(r).getCell(c + dc).value);
          if (candidate != null && candidate > 0) return candidate;
        }
        const below = safeParseNumber(ws.getRow(r + 1).getCell(c).value);
        if (below != null && below > 0) return below;
      }
    }
  }
  return null;
}

function findNombreObra(ws: ExcelJS.Worksheet): string | null {
  for (let r = 1; r <= 5; r++) {
    for (let c = 1; c <= 5; c++) {
      const v = ws.getRow(r).getCell(c).value;
      if (typeof v === 'string' && /^OBRA\s*\d*$/i.test(v.trim())) {
        for (let dc = 1; dc <= 3; dc++) {
          const adj = ws.getRow(r).getCell(c + dc).value;
          if (typeof adj === 'string' && adj.trim()) return adj.trim();
        }
      }
    }
  }
  return null;
}

function findHeaderRow(ws: ExcelJS.Worksheet): { row: number; mapeo: Record<string, number> } | null {
  // First pass: find the anchor row (where RUBRO/DETALLE/COSTO_TOTAL live)
  for (let r = 1; r <= 15; r++) {
    const found: Record<string, number> = {};
    for (let c = 1; c <= ws.columnCount; c++) {
      const raw = ws.getRow(r).getCell(c).value;
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (!text) continue;
      for (const [key, pattern] of Object.entries(HEADER_PATTERNS)) {
        if (key in found) continue; // primer match desde la izquierda
        if (pattern.test(text)) found[key] = c;
      }
    }
    // Header válido si tiene al menos 2 de RUBRO/DETALLE/COSTO_TOTAL
    const requiredFound = ['RUBRO', 'DETALLE', 'COSTO_TOTAL'].filter((k) => k in found).length;
    if (requiredFound >= 2) {
      // Second pass: scan rows above the anchor for any missing column labels (e.g. COEFICIENTE)
      // Some XLSX files put secondary headers in rows above the main header row
      for (let rr = 1; rr < r; rr++) {
        for (let c = 1; c <= ws.columnCount; c++) {
          const raw = ws.getRow(rr).getCell(c).value;
          const text = typeof raw === 'string' ? raw.trim() : '';
          if (!text) continue;
          for (const [key, pattern] of Object.entries(HEADER_PATTERNS)) {
            if (key in found) continue; // don't overwrite anchor-row mappings
            if (pattern.test(text)) found[key] = c;
          }
        }
      }
      return { row: r, mapeo: found };
    }
  }
  return null;
}

export async function parseXlsx(buf: Buffer, archivoNombre: string): Promise<ResultadoParseoXlsx> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const ws = selectSheet(wb, (sheet) => findHeaderRow(sheet) !== null);
  if (!ws) throw new Error('XLSX sin hojas');

  const cotizacionDetectada = findCotizacion(ws);
  const nombreObraDetectado = findNombreObra(ws);
  const headerInfo = findHeaderRow(ws);
  if (!headerInfo) {
    throw new Error(`No se detectó la fila de header en la hoja "${ws.name}". Columnas obligatorias: RUBRO, DETALLE, COSTO TOTAL.`);
  }

  // Validar columnas obligatorias
  const required = ['RUBRO', 'DETALLE', 'COSTO_TOTAL'];
  const missing = required.filter((k) => !(k in headerInfo.mapeo));
  if (missing.length > 0) {
    throw new Error(`Faltan columnas obligatorias en el Excel: ${missing.join(', ')}`);
  }

  // TODO Task 7: agregar el loop fila por fila acá
  const items: ItemPreview[] = [];
  const descartes: DescarteRow[] = [];

  return {
    items,
    descartes,
    cotizacionDetectada,
    nombreObraDetectado,
    mapeoColumnas: headerInfo.mapeo,
    metadata: {
      archivoNombre,
      hojaParseada: ws.name,
      totalFilasExcel: ws.rowCount,
      headerRow: headerInfo.row,
    },
  };
}
