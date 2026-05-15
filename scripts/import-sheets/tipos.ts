export interface FilaCsv {
  rubro: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  costo_unitario: string;
  moneda_costo: string;
  markup: string;
  notas: string;
}

export interface FilaXlsx {
  filaExcel: number;
  rubro: string;
  ubicacion: string | null;
  detalle: string;
  costoTotal: unknown;       // crudo de exceljs, sanitizar con safeParseNumber
  manoObraTotal: unknown;
  coeficiente: unknown;
  col1: unknown;             // celda col 1 para detectar "CONTRATISTA N"
}

export interface WarningItem {
  tipo:
    | 'rubro_heredado'
    | 'costo_invalido'
    | 'ref_error'
    | 'ubicacion_nueva'
    | 'costo_solo_parcial'      // Costo recuperado de col PARCIAL porque TOTAL estaba vacío
    | 'mo_consolidada'          // Item viene de TOTAL MANO DE OBRA — descripciones detalladas en notas
    | 'costo_huerfano';         // Costo presente pero sin descripción
  mensaje: string;
}

/**
 * Categoría de un descarte:
 * - 'estructural' → ruido del Excel sin valor de auditoría (headers de sección,
 *   placeholders ADICIONALES, sub-tablas, filas numeradas). Se cuentan pero
 *   se muestran como informativo (no alarma).
 * - 'informativo' → filas que son TOTAL/SUBTOTAL/HONORARIOS/PLANILLA esperables.
 *   Se muestran agrupadas como "esperado del Excel".
 * - 'warning' → potencial pérdida de data: orphan cost, #REF!, etc.
 *   Se muestran prominentes para que el usuario revise.
 */
export type CategoriaDescarte = 'estructural' | 'informativo' | 'warning';

export interface DescarteRow {
  filaExcel: number;
  razon: string;
  detalle: string;
  categoria: CategoriaDescarte;
}

export interface ItemPreview {
  filaExcel: number;
  rubro: string;
  descripcion: string;        // ya incluye " — Material" o " — Mano de obra" según C.2
  ubicacion: string | null;
  cantidad: number;
  unidad: 'gl' | 'm2' | 'm3' | 'hs' | 'u' | 'ml' | 'kg';
  costoUnitario: number;
  monedaCosto: 'ARS' | 'USD';
  markupPorcentaje: number;   // 0.20 para markup 20%
  notas: string;
  warnings: WarningItem[];
  estado: 'ok' | 'warning' | 'error';
  incluido: boolean;
}

export interface ResultadoParseoXlsx {
  items: ItemPreview[];
  descartes: DescarteRow[];
  cotizacionDetectada: number | null;
  nombreObraDetectado: string | null;
  mapeoColumnas: Record<string, number>;
  metadata: {
    archivoNombre: string;
    hojaParseada: string;
    totalFilasExcel: number;
    headerRow: number;
  };
}
