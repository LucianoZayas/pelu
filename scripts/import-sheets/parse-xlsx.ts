import ExcelJS from 'exceljs';
import type { ResultadoParseoXlsx, ItemPreview, DescarteRow, WarningItem } from './tipos';
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

const BLOCKLIST_DETALLE = /^(SUB)?TOTAL|HONORARIOS|BENEFICIO|MATERIALES GRUESOS|MANO DE OBRA CONTRATISTAS|PLANILLA|INS - /i;
const CONTRATISTA_PATTERN = /^CONTRATISTA \d/i;

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

function isEmptyRow(row: ExcelJS.Row): boolean {
  for (let c = 1; c <= row.cellCount; c++) {
    const v = row.getCell(c).value;
    if (v != null && v !== '') return false;
  }
  return true;
}

function getCellString(row: ExcelJS.Row, col: number): string {
  const v = row.getCell(col).value;
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object' && 'richText' in v) {
    return (v.richText as { text: string }[]).map((t) => t.text).join('').trim();
  }
  if (typeof v === 'object' && 'formula' in v) {
    // Formula cell — use result if it's a plain string; ignore error results
    const res = (v as { result?: unknown }).result;
    if (typeof res === 'string') return res.trim();
    if (typeof res === 'number') return String(res);
    return '';
  }
  return String(v).trim();
}

/** Returns the first non-empty plain-string value found scanning left-to-right across the row. */
function getAnyRowText(row: ExcelJS.Row): string {
  for (let c = 1; c <= Math.max(row.cellCount, 20); c++) {
    const s = getCellString(row, c);
    if (s) return s;
  }
  return '';
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

  const items: ItemPreview[] = [];
  const descartes: DescarteRow[] = [];
  const m = headerInfo.mapeo;
  let ultimoRubro: string | null = null;

  for (let r = headerInfo.row + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);

    if (isEmptyRow(row)) continue;

    const detalle = getCellString(row, m.DETALLE);
    const col1 = getCellString(row, 1);

    if (BLOCKLIST_DETALLE.test(detalle)) {
      descartes.push({ filaExcel: r, razon: 'fila separadora/total', detalle });
      continue;
    }

    if (CONTRATISTA_PATTERN.test(col1)) {
      descartes.push({ filaExcel: r, razon: 'separador de contratista', detalle: col1 });
      continue;
    }

    let rubroEfectivo = getCellString(row, m.RUBRO);
    let rubroHeredado = false;
    if (!rubroEfectivo) {
      rubroEfectivo = ultimoRubro ?? '';
      rubroHeredado = !!ultimoRubro;
    } else {
      ultimoRubro = rubroEfectivo;
    }
    if (!rubroEfectivo) {
      descartes.push({ filaExcel: r, razon: 'sin rubro y sin rubro previo', detalle });
      continue;
    }

    if (!detalle) {
      descartes.push({ filaExcel: r, razon: 'sin descripción', detalle: getAnyRowText(row) });
      continue;
    }

    const costoTotalRaw = m.COSTO_TOTAL ? row.getCell(m.COSTO_TOTAL).value : null;
    const manoObraRaw = m.MANO_OBRA_TOTAL ? row.getCell(m.MANO_OBRA_TOTAL).value : null;
    const coefRaw = m.COEFICIENTE ? row.getCell(m.COEFICIENTE).value : null;

    const costoMat = safeParseNumber(costoTotalRaw);
    const costoMO = safeParseNumber(manoObraRaw);

    if ((costoMat == null || costoMat === 0) && (costoMO == null || costoMO === 0)) {
      descartes.push({ filaExcel: r, razon: 'sin costo material ni mano de obra', detalle });
      continue;
    }

    const coef = safeParseNumber(coefRaw);
    const markupPorcentaje = coef != null && coef > 1 ? Number((coef - 1).toFixed(4)) : 0;

    const ubicacion = m.UBICACIÓN ? getCellString(row, m.UBICACIÓN) || null : null;

    const warnings: WarningItem[] = [];
    if (rubroHeredado) {
      warnings.push({ tipo: 'rubro_heredado', mensaje: `Rubro heredado de fila anterior ("${rubroEfectivo}")` });
    }
    if (typeof costoTotalRaw === 'string' && costoTotalRaw && costoMat == null) {
      warnings.push({ tipo: 'costo_invalido', mensaje: `Valor "${costoTotalRaw}" en COSTO TOTAL no es numérico — importado como 0` });
    }
    if (costoTotalRaw === '#REF!' || manoObraRaw === '#REF!') {
      warnings.push({ tipo: 'ref_error', mensaje: 'Fórmula rota en el Excel (#REF!) — verificar' });
    }

    const estado: ItemPreview['estado'] = warnings.some((w) => w.tipo === 'costo_invalido' || w.tipo === 'ref_error')
      ? 'error'
      : warnings.length > 0
        ? 'warning'
        : 'ok';

    if (costoMat != null && costoMat > 0) {
      items.push({
        filaExcel: r,
        rubro: rubroEfectivo,
        descripcion: `${detalle} — Material`,
        ubicacion,
        cantidad: 1,
        unidad: 'gl',
        costoUnitario: costoMat,
        monedaCosto: 'ARS',
        markupPorcentaje,
        notas: `Import XLSX fila ${r}, costo material original`,
        warnings: [...warnings],
        estado,
        incluido: true,
      });
    }

    if (costoMO != null && costoMO > 0) {
      items.push({
        filaExcel: r,
        rubro: rubroEfectivo,
        descripcion: `${detalle} — Mano de obra`,
        ubicacion,
        cantidad: 1,
        unidad: 'gl',
        costoUnitario: costoMO,
        monedaCosto: 'ARS',
        markupPorcentaje,
        notas: `Import XLSX fila ${r}, costo mano de obra original`,
        warnings: [...warnings],
        estado,
        incluido: true,
      });
    }
  }

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
