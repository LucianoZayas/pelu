import type { DescarteRow } from '@/../scripts/import-sheets/tipos';

/**
 * Metadata persisted in `presupuesto.import_metadata` (jsonb column).
 *
 * Decision: nested schema (Task 11 [PARALLEL-DECISION]).
 * Alternatives considered: flat (string-encoded JSON arrays) and minimal (counts only).
 * Drawbacks of each documented in
 * `docs/superpowers/specs/2026-05-12-importer-xlsx-real-design.md` § 11.
 *
 * Note: per-item warnings are NOT stored here — they live in
 * `item_presupuesto.notas` with prefix `[import]` (spec § 5.2). This avoids
 * duplicating data that the editor already parses from notas to render
 * `ImportRowStatus` chips.
 *
 * `descartes` IS stored here as the source of truth for skipped rows —
 * it does not exist anywhere else in the schema.
 */
export interface ImportMetadata {
  archivo: {
    nombre: string;
    tamanioBytes: number;
    subidoEn: string; // ISO-8601 timestamp
  };
  parseo: {
    hojaParseada: string;
    headerRow: number;
    totalFilasExcel: number;
    cotizacionDetectada: number | null;
    nombreObraDetectado: string | null;
    mapeoColumnas: Record<string, number>;
  };
  items: {
    totalImportados: number;
    totalConWarning: number;
    descartes: DescarteRow[];
  };
}

export type { ItemPreview, ResultadoParseoXlsx } from '@/../scripts/import-sheets/tipos';
