import ExcelJS from 'exceljs';
import type {
  ResultadoParseoXlsx,
  ItemPreview,
  DescarteRow,
  WarningItem,
  CategoriaDescarte,
} from './tipos';
import { safeParseNumber } from './safe-parse';

const HEADER_PATTERNS = {
  RUBRO: /^RUBRO$/i,
  UBICACIÓN: /^UBICACI[ÓO]N$/i,
  DETALLE: /^DETALLE$/i,
  COSTO_PARCIAL: /^COSTO\s+PARCIAL$/i,
  COSTO_TOTAL: /^COSTO\s+TOTAL$/i,
  MANO_OBRA_PARCIAL: /^MANO\s+(DE\s+)?OBRA\s+(DE\s+)?PARCIAL/i,
  MANO_OBRA_TOTAL: /^MANO\s+(DE\s+)?OBRA\s+TOTAL/i,
  COEFICIENTE: /coeficiente|aumento/i,
};

const SHEET_PATTERNS = /JUNCAL|presupuesto|obra/i;
const SHEET_EXCLUDE = /FLUJO\s+DE\s+CAJA|PROYECCI[ÓO]N|GASTOS\s+GENERALES/i;

// Rows whose detalle starts with these patterns are aggregate/separator rows.
// They are still parsed for special handling (TOTAL MANO DE OBRA consolidation)
// but never become regular items.
const TOTAL_MO_PATTERN = /^TOTAL\s+MANO\s+(DE\s+)?OBRA/i;
const TOTAL_AGREGADO_PATTERN =
  /^(SUB)?TOTAL\b|^HONORARIOS|^BENEFICIO|^MATERIALES\s+GRUESOS|^MANO\s+DE\s+OBRA\s+CONTRATISTAS|^PLANILLA|^INSUMOS|^INS\s*-\s*|^TOTAL\s+ADICIONALES/i;
const CONTRATISTA_PATTERN = /^CONTRATISTA \d/i;
// Repeated sub-table header rows (e.g., "ITEM / UBICACIÓN / DETALLE" appearing
// further down the sheet as a marker for a new sub-table).
const SUB_TABLE_HEADER = /^(ITEM|UBICACI[ÓO]N|DETALLE)$/i;
// Section title rows where col 1 holds a single short uppercase phrase like
// "CONTRATISTA 1", "MUEBLES DE OBRA", "MARMOLERIA", "ESPEJOS Y MAMPARAS", etc.
// Used to mark structural noise.
const NUMBERED_RUBRO = /^\d+$/;

function selectSheet(wb: ExcelJS.Workbook, hasValidHeader: (ws: ExcelJS.Worksheet) => boolean): ExcelJS.Worksheet {
  const candidates = wb.worksheets.filter(
    (ws) => SHEET_PATTERNS.test(ws.name) && !SHEET_EXCLUDE.test(ws.name),
  );
  const withHeader = candidates.find((ws) => hasValidHeader(ws));
  if (withHeader) return withHeader;
  if (candidates.length > 0) return candidates[0];
  const anyWithHeader = wb.worksheets.find((ws) => hasValidHeader(ws));
  return anyWithHeader ?? wb.worksheets[0];
}

function findCotizacion(ws: ExcelJS.Worksheet): number | null {
  for (let r = 1; r <= 5; r++) {
    for (let c = 1; c <= 10; c++) {
      const v = ws.getRow(r).getCell(c).value;
      if (typeof v === 'string' && /DOLAR|COTIZ/i.test(v)) {
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
  // First pass: anchor row where RUBRO/DETALLE/COSTO_TOTAL live
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
    const requiredFound = ['RUBRO', 'DETALLE', 'COSTO_TOTAL'].filter((k) => k in found).length;
    if (requiredFound >= 2) {
      // Second pass: rows above for missing labels (e.g. COEFICIENTE)
      for (let rr = 1; rr < r; rr++) {
        for (let c = 1; c <= ws.columnCount; c++) {
          const raw = ws.getRow(rr).getCell(c).value;
          const text = typeof raw === 'string' ? raw.trim() : '';
          if (!text) continue;
          for (const [key, pattern] of Object.entries(HEADER_PATTERNS)) {
            if (key in found) continue;
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
    const res = (v as { result?: unknown }).result;
    if (typeof res === 'string') return res.trim();
    if (typeof res === 'number') return String(res);
    return '';
  }
  return String(v).trim();
}

function getAnyRowText(row: ExcelJS.Row): string {
  for (let c = 1; c <= Math.max(row.cellCount, 20); c++) {
    const s = getCellString(row, c);
    if (s) return s;
  }
  return '';
}

/**
 * Detect repeated table-header rows (e.g., "ITEM | UBICACIÓN | DETALLE" appearing
 * mid-sheet as a marker for a new sub-table like PLANILLA DE INSUMOS).
 * These don't carry data and should be silenced as structural noise.
 */
function isSubTableHeader(row: ExcelJS.Row, m: Record<string, number>): boolean {
  const r = m.RUBRO ? getCellString(row, m.RUBRO) : '';
  const u = m.UBICACIÓN ? getCellString(row, m.UBICACIÓN) : '';
  const d = m.DETALLE ? getCellString(row, m.DETALLE) : '';
  const matches = [r, u, d].filter((s) => SUB_TABLE_HEADER.test(s)).length;
  return matches >= 2;
}

/**
 * Identifies rows that consolidate the TOTAL MANO DE OBRA for a range of preceding
 * rubros. Returns the row indexes in the sheet (1-based).
 */
function findTotalMoRows(
  ws: ExcelJS.Worksheet,
  headerRow: number,
  m: Record<string, number>,
): number[] {
  const out: number[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const det = m.DETALLE ? getCellString(row, m.DETALLE) : '';
    if (TOTAL_MO_PATTERN.test(det)) out.push(r);
  }
  return out;
}

/**
 * Given a TOTAL MANO DE OBRA row index, walk backward to collect the detail
 * rows it consolidates. Stops at: the previous TOTAL MO row, the header row, or
 * a row that already has a recognizable item cost (which means we're outside
 * the MO descriptive block).
 *
 * Returns row indexes and a structured tree grouped by detected rubro headings.
 */
interface ConsolidatedBlock {
  totalRow: number;
  detailRows: number[];
  groups: Array<{ heading: string; descriptions: Array<{ row: number; text: string }> }>;
}

function buildMoBlock(
  ws: ExcelJS.Worksheet,
  totalMoRow: number,
  prevTotalMoRow: number,
  headerRow: number,
  m: Record<string, number>,
): ConsolidatedBlock {
  const startExclusive = Math.max(prevTotalMoRow, headerRow);
  const detailRows: number[] = [];
  const groups: ConsolidatedBlock['groups'] = [];
  let currentGroup: ConsolidatedBlock['groups'][number] | null = null;

  for (let r = startExclusive + 1; r < totalMoRow; r++) {
    const row = ws.getRow(r);
    if (isEmptyRow(row)) continue;

    const det = m.DETALLE ? getCellString(row, m.DETALLE) : '';
    const rub = m.RUBRO ? getCellString(row, m.RUBRO) : '';
    const ubi = m.UBICACIÓN ? getCellString(row, m.UBICACIÓN) : '';
    const col1 = getCellString(row, 1);

    // A "heading" row inside the MO block is one that introduces a new rubro
    // section, e.g. "DEMOLICION y TAREAS PREVIAS- M.O" or "ALBAÑILERIA y COLOCACION - MANO DE OBRA"
    // We detect them as: detalle present, no per-item rubro/ubicación filled,
    // or detalle matches "/- M.?O\b/" or "- MANO\s+DE\s+OBRA/i".
    const isHeading =
      det &&
      !rub &&
      !ubi &&
      (/-\s*M\.?\s*O\.?\b/i.test(det) || /-\s*MANO\s+DE\s+OBRA/i.test(det));
    const isSubtotal = /^SUBTOTAL\b/i.test(det);

    if (isHeading) {
      const cleanHeading = det
        .replace(/\s*-\s*M\.?\s*O\.?\s*$/i, '')
        .replace(/\s*-\s*MANO\s+DE\s+OBRA.*$/i, '')
        .replace(/^CONTRATISTA\s+GENERAL\s*-\s*/i, '')
        .trim();
      currentGroup = { heading: cleanHeading, descriptions: [] };
      groups.push(currentGroup);
      detailRows.push(r);
      continue;
    }
    if (isSubtotal) {
      detailRows.push(r);
      continue;
    }
    if (col1 && CONTRATISTA_PATTERN.test(col1)) {
      detailRows.push(r);
      continue;
    }
    // Numbered section markers like rub="1" with no useful detalle
    if (rub && NUMBERED_RUBRO.test(rub) && !det) {
      detailRows.push(r);
      continue;
    }
    if (det) {
      // It's a description row — attach to current group (or create a default)
      if (!currentGroup) {
        // Skip numeric-only rubros as headings ("1", "3" are section counters,
        // not real rubro names — they live in col 1 / col 2 as section markers)
        const headingBase = rub && !NUMBERED_RUBRO.test(rub) ? rub : 'General';
        currentGroup = { heading: headingBase, descriptions: [] };
        groups.push(currentGroup);
      }
      // Skip placeholder ubicación text "rubro" (used as a placeholder in the
      // template). Real ubications are short uppercase tokens like "GENERAL".
      const realUbi = ubi && !/^rubro$/i.test(ubi) ? ubi : null;
      const label = realUbi ? `[${realUbi}] ${det}` : det;
      currentGroup.descriptions.push({ row: r, text: label });
      detailRows.push(r);
    }
  }

  return { totalRow: totalMoRow, detailRows, groups };
}

function formatBlockNotas(block: ConsolidatedBlock): string {
  const lines: string[] = [];
  lines.push('Mano de obra consolidada — incluye:');
  lines.push('');
  for (const g of block.groups) {
    if (g.descriptions.length === 0) continue;
    lines.push(g.heading.toUpperCase());
    for (const d of g.descriptions) {
      // Compact long descriptions
      const text = d.text.replace(/\s+/g, ' ').trim();
      lines.push(`  • ${text}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

function classifyDescarte(args: {
  filaExcel: number;
  detalle: string;
  rubro: string;
  ubicacion: string;
  col1: string;
  costoTotalRaw: unknown;
  manoObraTotalRaw: unknown;
  costoParcialRaw: unknown;
  manoObraParcialRaw: unknown;
  cubiertaPorTotalMo: boolean;
}): { razon: string; categoria: CategoriaDescarte } {
  const {
    detalle,
    rubro,
    col1,
    costoTotalRaw,
    manoObraTotalRaw,
    cubiertaPorTotalMo,
  } = args;

  // #REF! anywhere → potential data loss
  const hasRefError =
    String(costoTotalRaw).includes('#REF!') ||
    String(manoObraTotalRaw).includes('#REF!') ||
    String(args.costoParcialRaw).includes('#REF!') ||
    String(args.manoObraParcialRaw).includes('#REF!');
  if (hasRefError) {
    return { razon: 'Fórmula rota (#REF!) en el Excel — revisar', categoria: 'warning' };
  }

  // Sub-table header repeated mid-sheet
  if (
    /^ITEM$/i.test(rubro) &&
    /^UBICACI[ÓO]N$/i.test(args.ubicacion) &&
    /^DETALLE$/i.test(detalle)
  ) {
    return { razon: 'Header de sub-tabla', categoria: 'estructural' };
  }

  // Aggregate rows: SUBTOTAL, TOTAL, HONORARIOS, PLANILLA, INS - X
  if (TOTAL_AGREGADO_PATTERN.test(detalle)) {
    return { razon: 'Fila agregada (subtotal/total/planilla)', categoria: 'informativo' };
  }

  // Section dividers in col 1: "CONTRATISTA 1", "MUEBLES DE OBRA", "MARMOLERIA", etc.
  if (col1 && CONTRATISTA_PATTERN.test(col1)) {
    return { razon: 'Separador de contratista', categoria: 'estructural' };
  }
  if (col1 && !detalle && !rubro) {
    return { razon: `Título de sección "${col1}"`, categoria: 'estructural' };
  }

  // Numbered rubro markers ("1", "3", "4"...) without detalle — section starters
  if (rubro && NUMBERED_RUBRO.test(rubro) && !detalle) {
    return { razon: 'Marcador numerado de sección', categoria: 'estructural' };
  }

  // ADICIONALES placeholders (sub-section header with no real item)
  if (/^ADICIONALES$/i.test(rubro) && !detalle) {
    return { razon: 'Placeholder ADICIONALES', categoria: 'estructural' };
  }

  // Row covered by a TOTAL MANO DE OBRA consolidation
  if (cubiertaPorTotalMo) {
    return {
      razon: 'Descripción incluida en TOTAL MANO DE OBRA (ver notas del item)',
      categoria: 'estructural',
    };
  }

  // Orphan cost (cost present but no detalle) → flag as warning
  const costoMat = safeParseNumber(costoTotalRaw) ?? safeParseNumber(args.costoParcialRaw);
  const costoMO = safeParseNumber(manoObraTotalRaw) ?? safeParseNumber(args.manoObraParcialRaw);
  if (!detalle && ((costoMat != null && costoMat !== 0) || (costoMO != null && costoMO !== 0))) {
    return {
      razon: `Costo huérfano sin descripción ($${costoMat ?? costoMO})`,
      categoria: 'warning',
    };
  }

  // Empty-ish rows with no detalle and no rubro
  if (!detalle && !rubro && !col1) {
    return { razon: 'Fila vacía', categoria: 'estructural' };
  }

  // Detalle but no cost (after fallback)
  if (detalle && costoMat == null && costoMO == null) {
    return { razon: 'Sin costo (material ni mano de obra)', categoria: 'estructural' };
  }

  return { razon: 'Sin rubro y sin rubro previo', categoria: 'estructural' };
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

  const required = ['RUBRO', 'DETALLE', 'COSTO_TOTAL'];
  const missing = required.filter((k) => !(k in headerInfo.mapeo));
  if (missing.length > 0) {
    throw new Error(`Faltan columnas obligatorias en el Excel: ${missing.join(', ')}`);
  }

  const m = headerInfo.mapeo;

  // Pass 1: detect all TOTAL MANO DE OBRA rows and build their consolidation blocks
  const totalMoRows = findTotalMoRows(ws, headerInfo.row, m);
  const blocks: ConsolidatedBlock[] = [];
  let prev = headerInfo.row;
  for (const r of totalMoRows) {
    blocks.push(buildMoBlock(ws, r, prev, headerInfo.row, m));
    prev = r;
  }
  const rowsCoveredByMo = new Set<number>(blocks.flatMap((b) => b.detailRows));

  // Pass 2: emit items + descartes
  const items: ItemPreview[] = [];
  const descartes: DescarteRow[] = [];
  let ultimoRubro: string | null = null;

  for (let r = headerInfo.row + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (isEmptyRow(row)) continue;

    const detalle = m.DETALLE ? getCellString(row, m.DETALLE) : '';
    const col1 = getCellString(row, 1);
    const rubroRaw = m.RUBRO ? getCellString(row, m.RUBRO) : '';
    const ubicacion = m.UBICACIÓN ? getCellString(row, m.UBICACIÓN) : '';

    const costoTotalRaw = m.COSTO_TOTAL ? row.getCell(m.COSTO_TOTAL).value : null;
    const costoParcialRaw = m.COSTO_PARCIAL ? row.getCell(m.COSTO_PARCIAL).value : null;
    const manoObraTotalRaw = m.MANO_OBRA_TOTAL ? row.getCell(m.MANO_OBRA_TOTAL).value : null;
    const manoObraParcialRaw = m.MANO_OBRA_PARCIAL ? row.getCell(m.MANO_OBRA_PARCIAL).value : null;
    const coefRaw = m.COEFICIENTE ? row.getCell(m.COEFICIENTE).value : null;
    const coef = safeParseNumber(coefRaw);

    const block = blocks.find((b) => b.totalRow === r);

    // ─── Case A: this row IS a TOTAL MANO DE OBRA consolidation ───
    if (block) {
      const costoTotal = safeParseNumber(costoTotalRaw) ?? safeParseNumber(costoParcialRaw);
      const costoMO = safeParseNumber(manoObraTotalRaw) ?? safeParseNumber(manoObraParcialRaw);
      let cost = costoMO;
      if (cost == null || cost === 0) cost = costoTotal;
      if (cost == null) cost = 0;

      const rubroFinal = rubroRaw || ultimoRubro || 'MANO DE OBRA';
      if (rubroRaw) ultimoRubro = rubroRaw;

      const notasBlock = formatBlockNotas(block);
      const baseNotas = `Import XLSX fila ${r}, TOTAL MANO DE OBRA consolidado de ${block.detailRows.length} filas`;
      const notas = notasBlock ? `${baseNotas}\n\n${notasBlock}` : baseNotas;

      const warnings: WarningItem[] = [
        {
          tipo: 'mo_consolidada',
          mensaje: `Item resume ${block.detailRows.length} líneas de mano de obra del Excel — detalles en notas`,
        },
      ];

      items.push({
        filaExcel: r,
        rubro: rubroFinal,
        descripcion: detalle,
        ubicacion: ubicacion || null,
        cantidad: 1,
        unidad: 'gl',
        costoUnitario: cost,
        monedaCosto: 'ARS',
        markupPorcentaje: coef != null && coef > 1 ? Number((coef - 1).toFixed(4)) : 0,
        notas,
        warnings,
        estado: 'warning',
        incluido: true,
      });
      continue;
    }

    // ─── Case B: this row is covered by a TOTAL MO above → descarte estructural ───
    if (rowsCoveredByMo.has(r)) {
      descartes.push({
        filaExcel: r,
        razon: 'Descripción incluida en TOTAL MANO DE OBRA (ver notas del item)',
        detalle: detalle || getAnyRowText(row),
        categoria: 'estructural',
      });
      continue;
    }

    // ─── Case C: sub-table header (repeated ITEM/UBICACIÓN/DETALLE) ───
    if (isSubTableHeader(row, m)) {
      descartes.push({
        filaExcel: r,
        razon: 'Header de sub-tabla repetido',
        detalle: getAnyRowText(row).slice(0, 80),
        categoria: 'estructural',
      });
      continue;
    }

    // ─── Case D: normal row processing ───
    let rubroEfectivo = rubroRaw;
    let rubroHeredado = false;
    if (!rubroEfectivo) {
      rubroEfectivo = ultimoRubro ?? '';
      rubroHeredado = !!ultimoRubro;
    } else if (!NUMBERED_RUBRO.test(rubroEfectivo)) {
      ultimoRubro = rubroEfectivo;
    }

    // Detect cost with PARCIAL fallback
    const costoTotalNum = safeParseNumber(costoTotalRaw);
    const costoParcialNum = safeParseNumber(costoParcialRaw);
    const manoObraTotalNum = safeParseNumber(manoObraTotalRaw);
    const manoObraParcialNum = safeParseNumber(manoObraParcialRaw);

    let costoMat = costoTotalNum;
    let usadoParcialMat = false;
    if (costoMat == null && costoParcialNum != null) {
      costoMat = costoParcialNum;
      usadoParcialMat = true;
    }
    let costoMO = manoObraTotalNum;
    let usadoParcialMO = false;
    if (costoMO == null && manoObraParcialNum != null) {
      costoMO = manoObraParcialNum;
      usadoParcialMO = true;
    }

    // Mirror detection: if both Material and MO resolve to the SAME positive
    // value AND one of them came from a fallback formula (cPar usually mirrors
    // moPar via =L<row>), treat as a mirror and keep only one (prefer MO since
    // PARCIAL is usually the mirror source).
    if (
      costoMat != null &&
      costoMO != null &&
      costoMat > 0 &&
      costoMat === costoMO &&
      (usadoParcialMat || usadoParcialMO)
    ) {
      costoMat = null;
    }

    // Apply discard filters (already covered by classifyDescarte for descartes)
    if (TOTAL_AGREGADO_PATTERN.test(detalle)) {
      const cat = classifyDescarte({
        filaExcel: r,
        detalle,
        rubro: rubroRaw,
        ubicacion,
        col1,
        costoTotalRaw,
        manoObraTotalRaw,
        costoParcialRaw,
        manoObraParcialRaw,
        cubiertaPorTotalMo: false,
      });
      descartes.push({ filaExcel: r, razon: cat.razon, detalle, categoria: cat.categoria });
      continue;
    }

    if (col1 && CONTRATISTA_PATTERN.test(col1)) {
      descartes.push({
        filaExcel: r,
        razon: 'Separador de contratista',
        detalle: col1,
        categoria: 'estructural',
      });
      continue;
    }

    if (col1 && !detalle && !rubroRaw) {
      descartes.push({
        filaExcel: r,
        razon: `Título de sección "${col1}"`,
        detalle: col1,
        categoria: 'estructural',
      });
      continue;
    }

    if (rubroRaw && NUMBERED_RUBRO.test(rubroRaw) && !detalle) {
      descartes.push({
        filaExcel: r,
        razon: 'Marcador numerado de sección',
        detalle: getAnyRowText(row),
        categoria: 'estructural',
      });
      continue;
    }

    if (/^ADICIONALES$/i.test(rubroRaw) && !detalle) {
      descartes.push({
        filaExcel: r,
        razon: 'Placeholder ADICIONALES',
        detalle: getAnyRowText(row),
        categoria: 'estructural',
      });
      continue;
    }

    // Orphan cost
    if (!detalle && ((costoMat != null && costoMat !== 0) || (costoMO != null && costoMO !== 0))) {
      descartes.push({
        filaExcel: r,
        razon: `Costo huérfano sin descripción ($${(costoMat ?? costoMO) ?? 0})`,
        detalle: getAnyRowText(row),
        categoria: 'warning',
      });
      continue;
    }

    if (!rubroEfectivo) {
      descartes.push({
        filaExcel: r,
        razon: 'Sin rubro y sin rubro previo',
        detalle,
        categoria: 'estructural',
      });
      continue;
    }

    if (!detalle) {
      descartes.push({
        filaExcel: r,
        razon: 'Sin descripción',
        detalle: getAnyRowText(row),
        categoria: 'estructural',
      });
      continue;
    }

    if ((costoMat == null || costoMat === 0) && (costoMO == null || costoMO === 0)) {
      // Detail present but no cost — likely a MO description that wasn't
      // captured by any TOTAL MO block (file structure differs from expected).
      descartes.push({
        filaExcel: r,
        razon: 'Sin costo material ni mano de obra',
        detalle,
        categoria: 'estructural',
      });
      continue;
    }

    const markupPorcentaje = coef != null && coef > 1 ? Number((coef - 1).toFixed(4)) : 0;
    const ubicacionFinal = ubicacion || null;

    const warningsBase: WarningItem[] = [];
    if (rubroHeredado) {
      warningsBase.push({
        tipo: 'rubro_heredado',
        mensaje: `Rubro heredado de fila anterior ("${rubroEfectivo}")`,
      });
    }
    if (typeof costoTotalRaw === 'string' && costoTotalRaw && safeParseNumber(costoTotalRaw) == null) {
      warningsBase.push({
        tipo: 'costo_invalido',
        mensaje: `Valor "${costoTotalRaw}" en COSTO TOTAL no es numérico — importado como 0`,
      });
    }
    if (
      String(costoTotalRaw).includes('#REF!') ||
      String(manoObraTotalRaw).includes('#REF!')
    ) {
      warningsBase.push({
        tipo: 'ref_error',
        mensaje: 'Fórmula rota en el Excel (#REF!) — verificar',
      });
    }
    if (usadoParcialMat) {
      warningsBase.push({
        tipo: 'costo_solo_parcial',
        mensaje: 'Costo material recuperado de COSTO PARCIAL (TOTAL estaba vacío)',
      });
    }
    if (usadoParcialMO) {
      warningsBase.push({
        tipo: 'costo_solo_parcial',
        mensaje: 'Costo de mano de obra recuperado de PARCIAL (TOTAL estaba vacío)',
      });
    }

    const estado: ItemPreview['estado'] = warningsBase.some(
      (w) => w.tipo === 'costo_invalido' || w.tipo === 'ref_error',
    )
      ? 'error'
      : warningsBase.length > 0
        ? 'warning'
        : 'ok';

    if (costoMat != null && costoMat > 0) {
      items.push({
        filaExcel: r,
        rubro: rubroEfectivo,
        descripcion: costoMO != null && costoMO > 0 ? `${detalle} — Material` : detalle,
        ubicacion: ubicacionFinal,
        cantidad: 1,
        unidad: 'gl',
        costoUnitario: costoMat,
        monedaCosto: 'ARS',
        markupPorcentaje,
        notas: `Import XLSX fila ${r}, costo material${usadoParcialMat ? ' (PARCIAL)' : ''}`,
        warnings: [...warningsBase],
        estado,
        incluido: true,
      });
    }

    if (costoMO != null && costoMO > 0) {
      items.push({
        filaExcel: r,
        rubro: rubroEfectivo,
        descripcion: costoMat != null && costoMat > 0 ? `${detalle} — Mano de obra` : detalle,
        ubicacion: ubicacionFinal,
        cantidad: 1,
        unidad: 'gl',
        costoUnitario: costoMO,
        monedaCosto: 'ARS',
        markupPorcentaje,
        notas: `Import XLSX fila ${r}, costo mano de obra${usadoParcialMO ? ' (PARCIAL)' : ''}`,
        warnings: [...warningsBase],
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
