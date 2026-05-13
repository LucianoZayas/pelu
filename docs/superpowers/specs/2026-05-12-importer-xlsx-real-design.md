# Diseño · Importer XLSX real de Macna

**Status**: aprobado por el usuario el 2026-05-12 (brainstorming completo, mockups visuales en `/preview-importer` validados).
**Brainstorming source**: conversación 2026-05-12 (compactable). Memoria de respaldo: `~/.claude/projects/-Users-lzayas-Desktop-Pelu/memory/project_importer_xlsx_decisiones.md`.
**Next step**: invocar `writing-plans` para armar el plan de implementación, luego `subagent-driven-development` para ejecutarlo. Decisiones no triviales que aparezcan en plan/implementación se resuelven con 2-3 agentes en paralelo (ver `feedback_agentes_en_paralelo.md`).

---

## 1. Contexto y motivación

Macna recibió en mano el archivo `MACNA ADMINISTRACION - Lucho (1).xlsx` (584 KB, 8 hojas) — su administración completa actual en Excel. Solo una de las 8 hojas (`Copia de JUNCAL 3706`) corresponde a un presupuesto de obra F1. Las otras siete son funcionalidades fuera del alcance del piloto (caja, proyecciones, P&L, payroll — ver `docs/ROADMAP.md` § 2).

El importer actual (`scripts/import-sheets/`, Plan 5) **solo lee CSV con columnas predefinidas** (`rubro, descripcion, unidad, cantidad, costo_unitario, moneda_costo, markup, notas`) y se ejecuta vía CLI (`pnpm import-sheets <archivo>`). La hoja real de Macna **no tiene esa estructura**: no hay columna `unidad/cantidad/markup`, los costos vienen como totales agregados al final de la hoja en una región distinta del scope descriptivo, los headers están en fila 6 (no 1), hay cotización USD/ARS al tope, celdas rich-text, `#REF!`, strings en columnas numéricas, y bloques separadores tipo "CONTRATISTA N".

**Este spec define** cómo adaptar el importer para procesar ese XLSX y futuros archivos similares, **bajo dos restricciones durables** que el usuario marcó como innegociables:
- **Toda la operación debe ser UI web** — Macna no opera desde terminal (`feedback_no_cli_for_users.md`).
- **UX por encima de simplicidad de implementación** — sin callejones sin salida ni "borrá y re-empezá" (`feedback_ux_over_implementation.md`).

El alcance original del ítem `ROADMAP § 1.1` (CLI + parser básico) se amplía: agregamos UI completa, validación visual, recuperación de errores y manejo de re-import. Esto sube el alcance del piloto pero **es prerequisito real** para que Macna lo use.

---

## 2. Decisiones de diseño cerradas

Cerradas en brainstorming 2026-05-12.

| # | Decisión | Razón |
|---|---|---|
| **A** | Parser XLSX integrado con `exceljs` (ya es dep del repo). El importer acepta `.csv` y `.xlsx`. | exceljs ya está, no agrega deps. CSV intermedio sería un paso manual extra inviable para el usuario. |
| **B** | Campo nuevo `item_presupuesto.ubicacion text NULL`. Text libre con autocomplete de valores ya usados. | El Excel real tiene UBICACIÓN con valores variados (GENERAL, LIV-COM-COC, COCINA, BAÑO PPAL, LAVADERO). Es info útil para reportes F2 (gasto por ambiente). Enum sería frágil; autocomplete da consistencia sin rigidez. |
| **C.2** | **Dos items por fila Excel**: una fila con costo material + mano de obra genera dos `ItemPresupuesto`, con descripciones `... — Material` y `... — Mano de obra`. Si una de las dos columnas es 0/null, ese item no se genera. | Preserva el desglose material/MO que Macna usa en Sheets. C.1 (sumar todo) pierde el desglose. C.3 (campo nuevo `mano_obra_costo` en schema) es lo "correcto" pero cambia el modelo de items y los snapshots inmutables — queda como backlog post-piloto (ver § 10). |
| **D** | Doble entrada en UI con misma Server Action: (a) `/obras` listado tiene botón "Nueva obra desde Excel" (wizard que crea obra + presupuesto), (b) `/obras/[id]` tiene botón "Importar presupuesto desde Excel" (a obra existente). | Cubre los dos casos reales del piloto (obras nuevas migradas de Sheets vs operar una obra ya cargada). |
| **E (revisada)** | **El editor de presupuesto existente ES la preview.** El import crea el presupuesto inmediatamente con flag `import_pendiente=true`, redirige al editor real con banner sticky y botones "Confirmar importación" / "Cancelar importación". | Cero código duplicado, autosave y drag-drop gratis del editor de Plan 3, mismo aprendizaje de UX para el usuario. La alternativa "mini-editor pre-import" duplicaba la lógica del editor existente. |
| **F** | Import parcial permitido. Filas con error (costo inválido, `#REF!`) en rojo con `costo_unitario=0`; filas con warning (rubro heredado, ubicación nueva) en amarillo. Antes de confirmar import, diálogo lista descartes ("Vas a importar 42, 3 quedan fuera"). Audit log queda con detalle de filas saltadas. | Permite avanzar sin bloquear por errores tontos, manteniendo trazabilidad. |
| **G** | Re-import sobre presupuesto **borrador**: reemplazo total con snapshot histórico del anterior (soft-delete + `reemplazado_por_import_id`). Sobre presupuesto **firmado**: ofrece crear adicional (`tipo='adicional'`). UI muestra hint permanente "Hoy reemplazo completo. Próximamente vas a poder mergear cambios item por item." | Sin callejones sin salida. Snapshot histórico aprovecha el `deleted_at` existente (cost cero). Wizard diff queda como backlog post-piloto (ver § 10). |

### 2.1 Decisiones menores (decididas sin pregunta)

1. **Fin de región 2 del XLSX**: regex blocklist sobre el campo DETALLE para descartar filas tipo TOTAL/SUBTOTAL/HONORARIOS/BENEFICIO/MATERIALES GRUESOS/MANO DE OBRA CONTRATISTAS/PLANILLA/`INS - `. Cada item importado muestra su número de fila Excel original (`r127`) para que el usuario desmarque falsos positivos manualmente.
   - *Tradeoff*: si Macna cambia estructura del Excel, regex se queda corta. Backlog: "config visual de regex y mapeo de columnas en `/configuracion/importer`".
2. **Honorarios**: default `obra.porcentaje_honorarios = 16` en form de metadatos, editable.
3. **Strings sucias en columnas numéricas** ("Adelanto", "NO INCLUYE", `#REF!`): `safeParseNumber` devuelve null → warning amarillo + `costo_unitario = 0` (rojo). Audit log incluye lista completa.
4. **Forward-fill rubro**: filas con RUBRO vacío heredan el último rubro visto; warning amarillo "rubro heredado de fila N del Excel".
5. **Moneda por fila**: no soportado en MVP. Input single en form de metadatos, default ARS. Backlog: "agregar columna `MONEDA` opcional al Excel y parsearla per-fila".
6. **Auto-save de preview**: gratis con E revisada — el editor existente ya hace autosave 30s.

---

## 3. Arquitectura técnica

### 3.1 Capas (de abajo hacia arriba)

```
┌─────────────────────────────────────────────────────────────────┐
│ UI components (src/features/import-presupuestos/components/)   │
│   DropzoneXlsx · ImportPendienteBanner · Confirmar/CancelarDlg │
│   (showcase actual en src/app/preview-importer/ — temporal)    │
├─────────────────────────────────────────────────────────────────┤
│ Pages (src/app/(authed)/obras/...)                              │
│   /obras                       (+botón "Nueva obra desde Excel") │
│   /obras/importar              (dropzone + form metadatos)      │
│   /obras/[id]                  (+botón "Importar desde Excel")  │
│   /obras/[id]/importar         (dropzone solo)                  │
│   /obras/[id]/[presupuestoId]  (editor existente + banner)      │
├─────────────────────────────────────────────────────────────────┤
│ Server Actions (src/features/import-presupuestos/actions/)     │
│   parse-preview      (puro: NO toca DB, devuelve preview JSON) │
│   commit-import      (txn: crea obra/presupuesto/items)        │
│   confirmar-import   (UPDATE import_pendiente=false + audit)   │
│   cancelar-import    (rollback: delete o restore snapshot)     │
├─────────────────────────────────────────────────────────────────┤
│ Pure parsing module (scripts/import-sheets/) — sin Next/DB     │
│   parse.ts (dispatcher) · parse-csv.ts · parse-xlsx.ts         │
│   validate.ts · tipos.ts · ejecutor.ts (refactor para reusarlo)│
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Cambios al schema (una sola migration)

```sql
-- B. Campo ubicación
ALTER TABLE item_presupuesto ADD COLUMN ubicacion text;

-- E. Sub-estado import pendiente (flag boolean, NO nuevo valor del enum estado)
ALTER TABLE presupuesto ADD COLUMN import_pendiente boolean NOT NULL DEFAULT false;
ALTER TABLE presupuesto ADD COLUMN import_metadata jsonb;

-- G. Snapshot histórico de borradores reemplazados
ALTER TABLE presupuesto ADD COLUMN reemplazado_por_import_id uuid REFERENCES presupuesto(id);

-- Index para queries de "presupuestos pendientes de confirmación"
CREATE INDEX idx_presupuesto_import_pendiente ON presupuesto(import_pendiente) WHERE import_pendiente = true;
```

**Razón del flag boolean en vez de enum extendido**: el enum `presupuesto.estado` ya tiene `('borrador', 'firmado', 'cancelado')` y la lógica del editor filtra por `estado IN ('borrador', 'firmado')`. Agregar un valor `'import_pendiente'` rompe esa lógica en muchos lugares. Un flag boolean es ortogonal y aditivo.

### 3.3 Flujo de datos completo — caso "nueva obra desde Excel"

```
[1] Usuario admin en /obras → click "Nueva obra desde Excel"
    → Redirect a /obras/importar (form + dropzone)

[2] Sube archivo XLSX
    → Server Action `parse-preview(file)` (NO toca DB)
        ├─ exceljs lee buffer
        ├─ parseXlsx() detecta header, cotización, mapea columnas
        ├─ valida fila por fila aplicando C.2 (split material/MO)
        └─ devuelve { items, warnings, descartes, header, cotizacionDetectada }

[3] UI muestra form metadatos pre-llenados + skeleton de la grilla
    (la grilla NO se muestra acá — solo un resumen contable y descartes)

[4] Usuario completa metadatos faltantes (código, cliente, fechas) y click "Importar"
    → Diálogo confirmación si hay descartes
    → Server Action `commit-import(metadatosObra, payloadItems)`
        TXN:
        ├─ INSERT obra            (estado='borrador')
        ├─ INSERT presupuesto     (import_pendiente=true, import_metadata={archivo, cotizacionDetectada, warnings, descartes, mapeoColumnas})
        ├─ Por cada item con costo material: INSERT item_presupuesto con snapshot
        ├─ Por cada item con costo MO:        INSERT item_presupuesto con snapshot
        └─ INSERT audit_log {accion: 'import_creado'}
    → Redirect /obras/{obraId}/{presupuestoId}/editar

[5] Editor de Plan 3 carga el presupuesto. Como import_pendiente=true:
    ├─ ImportPendienteBanner sticky arriba
    ├─ Columna "estado importación" agregada a la grilla (chips r127, r136, etc.)
    ├─ Tooltips/badges para warnings y errores por fila
    └─ Botones "Confirmar importación" / "Cancelar importación" en el banner

[6a] Usuario edita libremente con el editor existente
     (autosave 30s, drag-drop, virtualización — todo gratis)

[6b] Click "Confirmar importación"
     → Diálogo con resumen de warnings/descartes
     → Server Action `confirmar-import(presupuestoId)`
         ├─ UPDATE presupuesto SET import_pendiente=false
         └─ INSERT audit_log {accion: 'import_confirmado'}
     → Toast verde, banner desaparece. Es un borrador normal.

[6c] (Alternativo) Click "Cancelar importación"
     → Diálogo destructivo
     → Server Action `cancelar-import(presupuestoId)`
         ├─ Obra NUEVA: hard DELETE obra (cascade items + presupuesto)
         ├─ Re-import:  hard DELETE nuevo presupuesto + UPDATE presupuesto SET deleted_at=NULL en el snapshot anterior
         └─ INSERT audit_log {accion: 'import_cancelado'}
     → Redirect /obras (obra nueva) o /obras/{id} (re-import)
```

### 3.4 Flujo "importar a obra existente"

Misma server action `commit-import`, pero con `obraId` provisto. La server action detecta:
- Si la obra tiene un presupuesto borrador → soft-delete del anterior (`deleted_at = now()`, `reemplazado_por_import_id = nuevo_id`) y crea uno nuevo con `import_pendiente=true`.
- Si la obra tiene un presupuesto firmado → crea presupuesto nuevo con `tipo='adicional'` y `import_pendiente=true`.

UI distingue ambos casos:
- Si borrador existente: diálogo "Reemplazar el presupuesto actual? El anterior queda en historial." (la palabra "historial" enlaza al filtro `deleted_at IS NOT NULL` en una pantalla futura — por ahora solo audit log).
- Si firmado existente: diálogo "Crear un presupuesto adicional desde este Excel. El presupuesto firmado no se modifica."

---

## 4. Reglas de parsing XLSX → ItemPresupuesto[]

### 4.1 Detección estructural

| Paso | Estrategia | Si no se detecta |
|---|---|---|
| Hoja a parsear | Primera hoja cuyo nombre matchee `/JUNCAL|presupuesto|obra/i`, o si ninguna matchea, la primera del workbook. | Si el workbook tiene una sola hoja, se usa esa sin checks. |
| Cotización USD | Buscar label `/DOLAR|COTIZ/i` en cols 1-10 de filas 1-5; tomar número en col adyacente. | `cotizacionDetectada = null`, el form pide ingresarla obligatoriamente. |
| Nombre obra | Buscar `/OBRA/i` en cols 3-5 de filas 1-5 + texto adyacente. | `nombreObraDetectado = null`, form vacío. |
| Header row | Primera fila con al menos 2 de las 3 strings `RUBRO`, `DETALLE`, `COSTO`. | Error de UI: "No se detectó estructura de presupuesto en la hoja X. Verificar formato." |
| Mapeo columnas | Por nombre de header: RUBRO, UBICACIÓN, DETALLE, COSTO TOTAL (**primer match desde la izquierda** — el Excel real tiene dos columnas "COSTO TOTAL"; tomar la col 6 = costo material, NO la col 16 = costo con markup), MANO DE OBRA TOTAL (idem, col 13 NO col 16), `coeficiente o aumento`. | Si faltan obligatorias (RUBRO, DETALLE, COSTO TOTAL): error UI. UBICACIÓN/MO/coeficiente son opcionales. |

### 4.2 Loop fila por fila

```ts
let ultimoRubro: string | null = null;

for (let r = headerRow + 1; r <= ws.rowCount; r++) {
  const row = readRow(r);

  if (isEmptyRow(row)) continue;

  // Blocklist por DETALLE
  if (/^(SUB)?TOTAL|HONORARIOS|BENEFICIO|MATERIALES GRUESOS|MANO DE OBRA CONTRATISTAS|PLANILLA|INS - /i
        .test(row.detalle ?? '')) {
    descartar({ filaExcel: r, razon: 'fila separadora/total', detalle: row.detalle });
    continue;
  }

  // Separador CONTRATISTA N
  if (/^CONTRATISTA \d/i.test(row.col1 ?? '')) {
    descartar({ filaExcel: r, razon: 'separador de contratista', detalle: row.col1 });
    continue;
  }

  // Forward-fill rubro
  let rubroEfectivo = row.rubro?.trim();
  let rubroHeredado = false;
  if (!rubroEfectivo) { rubroEfectivo = ultimoRubro; rubroHeredado = true; }
  else ultimoRubro = rubroEfectivo;
  if (!rubroEfectivo) {
    descartar({ filaExcel: r, razon: 'sin rubro y sin rubro previo', detalle: row.detalle });
    continue;
  }

  if (!row.detalle?.trim()) {
    descartar({ filaExcel: r, razon: 'sin descripción', detalle: '' });
    continue;
  }

  const costoMat = safeParseNumber(row.costoTotal);
  const costoMO  = safeParseNumber(row.manoObraTotal);

  // Si ambos vacíos o cero, no genera items
  if ((costoMat == null || costoMat === 0) && (costoMO == null || costoMO === 0)) {
    descartar({ filaExcel: r, razon: 'sin costo material ni mano de obra', detalle: row.detalle });
    continue;
  }

  const coef   = safeParseNumber(row.coeficiente);
  const markup = coef && coef > 0 ? (coef - 1) : 0;
  const ubicacion = row.ubicacion?.trim() || null;
  const baseDescripcion = row.detalle.trim();

  const warnings: Warning[] = [];
  if (rubroHeredado) warnings.push({ tipo: 'rubro_heredado', mensaje: `Rubro heredado de fila anterior ("${rubroEfectivo}")` });
  if (typeof row.costoTotal === 'string' && row.costoTotal && costoMat == null) {
    warnings.push({ tipo: 'costo_invalido', mensaje: `Valor "${row.costoTotal}" en COSTO TOTAL no es numérico — importado como 0` });
  }
  if (row.costoTotal === '#REF!' || row.manoObraTotal === '#REF!') {
    warnings.push({ tipo: 'ref_error', mensaje: 'Fórmula rota en el Excel (#REF!) — verificar' });
  }

  // C.2: hasta 2 items por fila
  if (costoMat != null && costoMat > 0) {
    items.push({ filaExcel: r, rubro: rubroEfectivo, descripcion: `${baseDescripcion} — Material`,
                 ubicacion, cantidad: 1, unidad: 'gl', costoUnitario: costoMat,
                 monedaCosto: monedaForm, markupPorcentaje: markup,
                 notas: `Import XLSX fila ${r}, costo material original`,
                 warnings, incluido: true });
  }
  if (costoMO != null && costoMO > 0) {
    items.push({ filaExcel: r, rubro: rubroEfectivo, descripcion: `${baseDescripcion} — Mano de obra`,
                 ubicacion, cantidad: 1, unidad: 'gl', costoUnitario: costoMO,
                 monedaCosto: monedaForm, markupPorcentaje: markup,
                 notas: `Import XLSX fila ${r}, costo mano de obra original`,
                 warnings, incluido: true });
  }
}
```

### 4.3 `safeParseNumber` (sanitización robusta)

```ts
function safeParseNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'object') {
    if ('result' in v) return safeParseNumber((v as any).result);              // formula result
    if ('richText' in v) return safeParseNumber((v as any).richText.map((t: any) => t.text).join(''));
    return null;
  }
  if (typeof v === 'string') {
    if (v.startsWith('#')) return null;                                         // #REF!, #DIV/0!, etc.
    const cleaned = v.replace(/[$.,\s]/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
```

### 4.4 Casos borde verificados contra el XLSX real

| Caso | Fila | Esperado |
|---|---|---|
| Cotización USD `1500 "DOLAR BLUE"` | r2 | Detectada, pre-llena form |
| Header en fila 6 (no fila 1) | r6 | Detectada por matching de strings |
| Bloque `CONTRATISTA 1` | r7 | Descartado |
| Filas de scope sin costo (r9-r104) | múltiples | Descartadas (sin costo material/MO) |
| Forward-fill: r137-r138 sin rubro tras r136 MARMOLERÍA | r137-138 | Items con warning amarillo |
| Rich-text en cell COSTO PARCIAL | r107 | `safeParseNumber` extrae result o devuelve null |
| `#REF!` en INS-* | r238-245 | Filtradas por regex blocklist |
| "Adelanto" en columna numérica | r128 | `safeParseNumber → null` → warning + costo 0 |
| Una fila con material y MO no nulos | r136 | Genera 2 items (C.2) |
| Subtotal `TOTAL MANO DE OBRA / DEMO-ALB` | r106 | Descartado por regex |

### 4.5 Resultado proyectado sobre `Copia de JUNCAL 3706`

- ~25-35 filas Excel producen items (mayoría en región 2, filas 106-215).
- ~50-100 items totales (algunas filas → 2 items por C.2).
- ~150 filas descartadas (mayoría es región 1 sin costo).
- Total debe coincidir con la suma de col 6 "COSTO TOTAL" + col 13 "MANO DE OBRA TOTAL" de la región 2.

---

## 5. UI / componentes

### 5.1 Componentes nuevos (en `src/features/import-presupuestos/components/`)

| Componente | Responsabilidad |
|---|---|
| `DropzoneXlsx` | Drag-drop + click, validación de extensión y tamaño (max 5 MB), feedback de progreso. |
| `FormMetadatosObra` | Inputs de código (auto `M-YYYY-NNN` o editable), cliente, fechas, % honorarios, cotización USD pre-llenada, moneda default. |
| `PreviewSummary` | Tarjeta con resumen contable: total proyectado, items, descartes, warnings (NO la grilla — eso es el editor real). |
| `ImportPendienteBanner` | Banner sticky con icono, conteo de items/warnings/descartes (expandible), hint "futuro vs presente", botones Confirmar/Cancelar. |
| `ConfirmarImportDialog` | Modal con resumen + warnings/descartes + botones. |
| `CancelarImportDialog` | Modal destructivo con consecuencias claras (caso obra nueva vs re-import). |
| `ImportRowStatus` | Chip de estado (OK / warning / error) con número de fila Excel y tooltip — se integra como columna nueva en la grilla del editor existente cuando `import_pendiente=true`. |

Mockups visuales en `src/app/preview-importer/page.tsx` (temporal — se borra al cerrar la implementación). Snippets de referencia en el anexo 12.2.

### 5.2 Integración con el editor existente (Plan 3)

El editor de presupuesto en `src/features/presupuestos/...` recibe dos refuerzos cuando `presupuesto.import_pendiente=true`:

1. **`ImportPendienteBanner`** se monta sticky arriba (el editor lo tiene que detectar y reservar espacio).
2. **Columna nueva "estado"** en la grilla, antes de la columna "Rubro", mostrando `ImportRowStatus` por item. La columna oculta cuando `import_pendiente=false`.

El editor sigue siendo el mismo en todo lo demás (autosave 30s, virtualización, drag-drop, sign dialog). **MVP**: los warnings por item se persisten en `item_presupuesto.notas` con prefix `"[import] ..."` (sin cambio de schema); el editor los parsea con regex para renderizar `ImportRowStatus`. Cuando el admin edita el item y guarda, el prefix se conserva mientras `import_pendiente=true`. Al confirmar el import, los `[import]` se mantienen como histórico en `notas` (no se borran). **Alternativa post-MVP**: columna `import_warnings jsonb` dedicada (ver § 10.8). Decidida la opción de notas para evitar otra columna en el schema durante el piloto.

### 5.3 Pre-flight de primitives shadcn

Antes de empezar:
```bash
pnpm dlx shadcn@latest add tooltip badge alert checkbox
```
- `tooltip` reemplaza el `title=""` nativo en los warnings.
- `badge` para el chip de estado de fila.
- `alert` como alternativa estructurada al div del banner.
- `checkbox` para marcar/desmarcar items "incluir" (si lo necesita la UI final).

`tabs` queda fuera del MVP (no hay tabs en el flujo final).

### 5.4 Permisos

- Solo rol `admin` ve botones de import y puede invocar las server actions.
- Rol `operador`: si entra a un presupuesto con `import_pendiente=true`, ve banner read-only y grilla bloqueada hasta que admin confirme.

### 5.5 Accesibilidad mínima

- Banner sticky: `role="status" aria-live="polite"`.
- Diálogos: focus trap (`@base-ui/react/dialog` lo provee), `aria-describedby`, escape close.
- Chips de estado: texto alternativo (no solo color) — icon + tooltip + aria-label completo.
- Dropzone: input file accesible (no solo el área visual).

---

## 6. Server Actions — contratos

Todas con `requireRole('admin')`. Devuelven `{ ok: true, ... } | { ok: false, error: string }`.

### 6.1 `parse-preview(file: File): Promise<PreviewResult>`

**NO toca DB.** Recibe el FormData con el File, lo lee, parsea, valida, devuelve el preview. El límite efectivo es 5 MB (validado client-side en `DropzoneXlsx` antes de subir, y reconfirmado server-side al inicio de la acción). Next.js 16 server actions soportan ese tamaño sin configuración especial. Si en el futuro hace falta más, configurar `serverActions.bodySizeLimit` en `next.config.ts`.

```ts
type PreviewResult = {
  ok: true;
  items: ItemPreview[];
  descartes: { filaExcel: number; razon: string; detalle: string }[];
  cotizacionDetectada: number | null;
  nombreObraDetectado: string | null;
  mapeoColumnas: Record<string, number>;
  metadata: {
    archivoNombre: string;
    hojaParseada: string;
    totalFilasExcel: number;
    headerRow: number;
  };
} | { ok: false; error: string };
```

### 6.2 `commit-import(payload): Promise<{ obraId, presupuestoId }>`

Recibe `payload = { metadatosObra, items, descartes, importMetadata, obraIdExistente?: string }`. En una transacción Drizzle:
1. Si `obraIdExistente` está: actualizar la obra ya existente, soft-delete del presupuesto borrador previo (si lo hay), agregar `reemplazado_por_import_id` en el nuevo. Si presupuesto previo está firmado, el nuevo es `tipo='adicional'`.
2. Si no: INSERT obra nueva.
3. INSERT presupuesto (`import_pendiente=true`, `import_metadata=jsonb`).
4. Por cada item del payload (ya splitteado por C.2 desde el preview): INSERT item_presupuesto con snapshot calculado (`calcularSnapshotItem` existente).
5. INSERT audit_log.

### 6.3 `confirmar-import(presupuestoId: string)`

1. Verificar `import_pendiente=true` (idempotencia).
2. UPDATE presupuesto SET import_pendiente=false.
3. INSERT audit_log con resumen de warnings/descartes (extraídos de `import_metadata`).
4. `revalidatePath('/obras/[id]/[presupuestoId]')`.

### 6.4 `cancelar-import(presupuestoId: string)`

Transacción:
1. Cargar el presupuesto. Verificar `import_pendiente=true`.
2. **Caso obra nueva** (presupuesto recién creado y no hay otros presupuestos en esa obra): hard DELETE de los items (cascade via `item_presupuesto.presupuesto_id ON DELETE CASCADE` ya existe en el schema) → hard DELETE del presupuesto → hard DELETE de la obra (el FK `presupuesto.obra_id → obra.id` NO tiene cascade, por eso se hace explícito en orden). Devolver `{ ok: true, redirectTo: '/obras' }`.
3. **Caso re-import**: hard DELETE del presupuesto nuevo (cascade limpia los items). Si hay un anterior con `reemplazado_por_import_id = este_id` y `deleted_at IS NOT NULL`, UPDATE `deleted_at=NULL` y `reemplazado_por_import_id=NULL` para restaurarlo. Devolver `{ ok: true, redirectTo: '/obras/{obraId}' }`.
4. INSERT audit_log.

---

## 7. Manejo de errores y warnings

### 7.1 Niveles

| Nivel | Cuándo | Comportamiento UI |
|---|---|---|
| **Error fatal** | Archivo no `.xlsx`, > 5 MB, sin header detectable, columnas obligatorias faltantes | Pantalla de error en `/obras/importar` con mensaje accionable, botón "Subir otro archivo". |
| **Error por fila** | Costo inválido, fila completamente vacía después de header | Item se descarta o se importa con costo 0 + chip rojo + listed en descartes. |
| **Warning por fila** | Rubro heredado, ubicación nueva, fórmula `#REF!` | Item se importa, chip amarillo, tooltip con razón. |
| **Info** | Cotización detectada, rubros nuevos a crear | Banner informativo en preview, no bloquea. |

### 7.2 Audit log

Cada acción del importer inserta en `audit_log`:
- `import_creado` — al ejecutar `commit-import`, con resumen en `descripcion_humana` y detalles (filas warnings/descartes, mapeo columnas) en `meta`.
- `import_confirmado` — al confirmar, con conteo de items finales.
- `import_cancelado` — al cancelar, con detalle (obra eliminada o snapshot restaurado).

### 7.3 Toasts (sonner)

- Subida OK → toast info "Analizando archivo..."
- Parseo OK → toast success "X items detectados, revisá la preview"
- Parseo error → toast destructivo con razón
- Commit OK → redirect (no toast, el banner sticky cumple)
- Confirmar OK → toast success "Importación confirmada"
- Cancelar OK → toast success "Importación cancelada, [obra eliminada | presupuesto anterior restaurado]"

---

## 8. Testing

### 8.1 Unit tests (jest)

```
scripts/import-sheets/__tests__/
├── parse-xlsx.test.ts
│   ├─ lee fixture real, detecta header/cotización/mapeo
│   ├─ safeParseNumber: number, string, null, #REF!, rich-text, "Adelanto", "$1.500.000,50"
│   ├─ forward-fill: 3 filas sin rubro heredan correctamente; primera fila sin rubro previo se descarta
│   ├─ descarta filas SUBTOTAL/TOTAL/HONORARIOS/etc por regex
│   ├─ descarta filas CONTRATISTA N
│   ├─ C.2: una fila con ambos costos > 0 genera 2 items
│   ├─ C.2: una fila con solo material genera 1 item ("— Material")
│   ├─ C.2: una fila con solo MO genera 1 item ("— Mano de obra")
│   ├─ C.2: una fila con ambos en 0 se descarta
│   ├─ markup: coef 1.2 → markupPct 0.20; coef null → 0
│   └─ output completo contra fixture real: items, descartes y totales esperados
├── validate.test.ts (existente, +nuevos warnings)
└── parse.test.ts (dispatcher: archivo .csv → parseCsv, .xlsx → parseXlsx)
```

**Fixture**: `scripts/import-sheets/__fixtures__/juncal-3706-real.xlsx` — copia del archivo real. No contiene PII sensible. Incluir también un fixture sintético chico (5-10 filas) para tests rápidos.

### 8.2 Integration tests (jest + DB real)

Dependen de fix [1.4] del ROADMAP (harness roto). Pueden quedar gateadas por `RUN_INTEGRATION` hasta arreglar.

```
tests/integration/import-presupuestos/
├── nueva-obra.test.ts: parse+commit crea obra+presupuesto+items, import_pendiente=true
├── confirmar.test.ts: confirmar-import pasa flag a false + audit log
├── cancelar-obra-nueva.test.ts: cancelar borra obra completa
├── reimport-borrador.test.ts: soft-delete del anterior, nuevo con reemplazado_por_import_id
├── reimport-firmado.test.ts: crea adicional, no toca firmado
└── permisos.test.ts: operador NO puede invocar server actions
```

### 8.3 E2E (Playwright)

```
tests/e2e/import-presupuesto/
├── flujo-nueva-obra.spec.ts: login → /obras → "Nueva obra desde Excel" → upload → confirmar → editor
├── flujo-cancelar.spec.ts: cancelar borra obra
├── flujo-reimport.spec.ts: re-import sobre borrador con confirmación
└── permisos-operador.spec.ts: operador no ve botones
```

### 8.4 Smoke manual

`SETUP_PENDIENTE.md` § 6 se actualiza con un checklist clickeable (sin terminal):
- Login admin → /obras → "Nueva obra desde Excel" → subir archivo real → revisar preview → ajustar metadatos → confirmar → verificar editor + auditoría.

---

## 9. Pre-flight (cosas a hacer antes de empezar a codear)

1. Instalar primitives shadcn faltantes: `pnpm dlx shadcn@latest add tooltip badge alert checkbox`.
2. Apuntar el fixture XLSX en el repo: `scripts/import-sheets/__fixtures__/juncal-3706-real.xlsx`.
3. Confirmar que `exceljs` está en deps (sí — ya lo usa el exporter).
4. Verificar permisos del rol `admin` sobre las nuevas server actions.

---

## 10. Out of scope / Backlog post-piloto

Cada item entra al `docs/ROADMAP.md` con detalle al cerrar este spec.

### 10.1 C.3 — Schema con campo `mano_obra_costo` (refactor de C.2)

Hoy C.2 genera dos `ItemPresupuesto` por fila Excel. Post-piloto, refactorizar para que un único `ItemPresupuesto` tenga ambos costos como columnas separadas.

**Cambios necesarios**:
- Schema: agregar `mano_obra_unitario`, `mano_obra_unitario_moneda`, `mano_obra_unitario_base` a `item_presupuesto`.
- `calcularSnapshotItem`: sumar `(costo_unitario_base + mano_obra_unitario_base) × cantidad`.
- Editor: dos columnas separadas en la grilla, totales separados (material vs MO).
- PDF: opcionalmente desglose material/MO.
- Importer: cambiar a 1 item por fila Excel.
- **Migration de back-fill**: para items existentes generados con C.2, unirlos automáticamente buscando pares por descripción `... — Material` / `... — Mano de obra` y mismo rubro/ubicación. Los items en presupuestos firmados (snapshot inmutable) NO se tocan — quedan como están.

**Drawback de C.2 que justifica este backlog**: items duplicados en el editor (50 → 100), descripción con suffix "— Material" / "— Mano de obra" no es UX óptima a largo plazo, y al consumir reportes F2 (P&L por obra) hay que recombinar pares.

### 10.2 Wizard inteligente de diff (refactor de G)

Hoy re-import = reemplazo total. Post-piloto:
- Comparar items existentes vs nuevos del Excel por (rubro, descripción, ubicación) — matching fuzzy.
- UI tipo git-diff: items solo en uno / en el otro / cambios de costo.
- Usuario marca qué cambios aplicar.
- Soporta re-import sobre **firmado** → genera adicional solo con las diferencias.

**Drawback de G actual**: si la corrección era cambiar UN item de un presupuesto de 100, hoy hay que reimportar 100 (con snapshot del anterior). Soluble pero verboso.

### 10.3 Config visual del importer

Hoy la regex de descartes y el mapeo de columnas están hardcoded. Pantalla `/configuracion/importer`:
- Regex de filas a descartar (editable, con preview).
- Mapeo columnas Excel → campos del modelo (con preview).
- `headerRow` configurable (auto-detect + override manual).

**Drawback de hardcodear hoy**: si Macna cambia la estructura de su Excel, hay que tocar código.

### 10.4 Multimoneda por fila

Hoy moneda default global per import. Soportar columna `MONEDA` opcional en Excel.

**Drawback**: si una fila tuviera USD y otra ARS, hoy se mezclan en moneda única — el operador tiene que dividir el archivo manualmente.

### 10.5 Importer de otras hojas (F2/F3)

Cada hoja restante del XLSX real es feature separada:
- `MACNA - FLUJO DE CAJA` → módulo de Flujo de caja general (ROADMAP § 2.2).
- `F.c - LOZANO` / `Copia de FLUJO DE CAJA - JUNCAL` → Flujo de caja por obra (§ 2.1).
- `Res - LOZANO` → P&L por obra (§ 2.5).
- `PROYECCIONES` → Forecast (§ 2.6).
- `GASTOS GENERALES INDIRECTOS - P/O` → Payroll (§ 2.7).

### 10.6 CSV desde UI

Hoy la UI solo acepta `.xlsx`. El CLI legacy (`pnpm import-sheets`) sigue aceptando `.csv` pero NO es interfaz para Macna. Si Macna en el futuro tiene CSV directo, agregar `.csv` al dropzone (reusa `parse-csv.ts` existente).

### 10.7 Histórico de imports

Hoy queda en audit log. Pantalla dedicada `/obras/[id]/imports` que liste todos los imports históricos (incluso los cancelados/reemplazados) con su archivo origen y diff con el actual.

### 10.8 `import_warnings` como columna estructurada

Hoy los warnings por item se guardan en `item_presupuesto.notas` con prefix `[import]`. Alternativa más limpia: columna `import_warnings jsonb` en `item_presupuesto`. Evaluar si el costo del cambio de schema vale en relación al beneficio.

---

## 11. Alternativas consideradas (descartadas con razón)

### 11.1 CSV intermedio (opción A descartada)

Que Macna prepare un CSV "limpio" o que un script auxiliar haga la transformación XLSX→CSV. Descartado: Macna no opera desde terminal; el CSV intermedio es un paso manual extra inviable.

### 11.2 UBICACIÓN concatenada en descripción (opción B descartada)

`descripcion = "[LIV - COM - COC] Demolición de tabique"`. Descartado: el dato queda no-consultable. Cuando lleguen reportes F2 por ambiente, hay que parsear strings. El campo nuevo es low-cost (text NULL).

### 11.3 Mini-editor de preview (opción E original descartada)

Construir un mini-editor pre-import editable. Descartado: duplica la lógica del editor existente, riesgo de divergencia. La alternativa "editor real con flag `import_pendiente`" cumple el spirit (UX-friendly, editable in-place) sin código duplicado.

### 11.4 Bloquear hasta corregir todos los errores (opción F descartada)

No permitir confirmar import si hay algún error. Descartado: frustra al usuario por 3 errores tontos cuando 47 items están OK.

### 11.5 "Borrá y re-empezá" para re-import (descartada por UX)

Mi propuesta inicial. Descartada por el usuario: violación directa del principio "UX > implementation cost".

### 11.6 `import_metadata` schema — flat con strings JSON encoded (descartada en Task 11)

3 sub-agentes propusieron schemas alternativos para `presupuesto.import_metadata`. La opción **flat** mete las arrays de descartes/warnings como string JSON-encoded (`descartesJson: string`, `warningsJson: string`) junto a 8 keys scalar planos (11 keys totales, ~13 KB).

**Drawbacks que la descartaron**:
- **Acceso opaco a datos anidados**: el banner que expande descartes tiene que `JSON.parse(descartesJson)` en cada expansión. Memoization mitiga pero introduce complejidad sin upside.
- **Type-safety vulnerada**: TypeScript no enforces el shape de un string JSON-encoded. Un futuro contributor podría meter un JSON con shape distinto y nadie se daría cuenta hasta runtime.
- **Forensics SQL bloqueada**: queries como "imports con > 5 warnings de tipo X" requieren parsear strings en application code; no se puede usar operadores jsonb nativos (`->`, `->>`, `jsonb_array_elements`).
- **Lo peor de ambos mundos**: el nombre "flat" sugiere acceso directo, pero los datos importantes (descartes/warnings) viven detrás de un string opaco.

**Cuándo revisar**: si en el futuro Postgres queries sobre el contenido de `import_metadata` se vuelven raras (todo lo importante se accede via la app), y el JSON parse overhead se vuelve medible, esta opción podría ser viable como "metadata-as-blob".

### 11.7 `import_metadata` schema — minimal sólo counts (descartada en Task 11)

3 sub-agentes propusieron schemas alternativos. La opción **minimal** persiste sólo 5 scalars (`archivoNombre`, `hojaParseada`, `itemsCount`, `warningsCount`, `descartesCount`) y delega la lista completa de descartes al `audit_log.diff` y los warnings per-item a `item_presupuesto.notas` con prefix `[import]`. ~150 bytes.

**Drawbacks que la descartaron**:
- **Pierde la UX del banner expandible** (validada por el usuario en el mockup `/preview-importer`): no hay lista de descartes para expandir, solo un count + link al audit log. Bajar UX para ganar ~12 KB no se justifica.
- **Forensics requiere join con `audit_log`**: para responder "qué filas fueron descartadas en este presupuesto" hay dos lecturas. En la opción nested elegida es un sólo read del jsonb.
- **`warningsCount` puede quedar stale**: si alguien edita las `notas` de items y remueve el prefix `[import]`, el contador queda mintiendo y nadie se entera.
- **Audit log como single-source-of-truth para descartes**: si el audit log se trunca o un retention policy lo borra, perdemos visibility a los descartes para siempre.
- **`confirmar-import` action necesitaría query extra** para reconstruir descripción del audit log con detalle de warnings (qué tipos predominan, etc.).

**Cuándo revisar**: si los costs de jsonb storage se vuelven preocupantes (e.g., 10k presupuestos × ~15 KB = 150 MB sólo en `import_metadata`), o si el banner expandible cambia su UX para ya no mostrar la lista (e.g., siempre va a una pantalla dedicada de auditoría), entonces minimal vuelve a ser viable.

### 11.8 Layout `/obras/importar` — two-column (descartada en Task 22)

Layout en dos columnas md+ (`grid md:grid-cols-2`): izquierda persistente con Dropzone + FormMetadatosObra, derecha con PreviewSummary o placeholder. El admin podría llenar el form en paralelo a inspeccionar el archivo. Footer no-sticky.

**Drawbacks que la descartaron**:
- **Asunción de "parallel intent" no validada**: el flujo real de Macna es secuencial (subir → ver qué hay → corregir metadatos → confirmar). La "libertad" de llenar form mientras se mira preview rara vez se ejerce, haciendo la columna doble overengineered para el flow real.
- **Columnas crecen desparejas**: si el FormMetadatosObra gana campos, la izquierda se vuelve más alta que la derecha, creando whitespace incómodo.
- **Footer no-sticky se pierde**: en viewports cortos el botón "Importar" sale del viewport mientras se edita el form. El admin tiene que scrollear para encontrarlo.
- **Re-upload flashea skeleton en la derecha** que lee como bug si el parseo es rápido.
- **Más responsive complexity**: stack a single column en mobile cambia el orden visual (dropzone → form → preview), perdiendo la promesa "ambos visibles" del approach.

**Cuándo revisar**: si Macna crece y un admin tiene que importar muchas obras seguido, el form persistente puede ahorrar context switching. Reevaluar después del piloto.

### 11.9 Layout `/obras/importar` — stepper 3-pasos (descartada en Task 22)

Stepper visible arriba con 3 cards apilados (Subir / Revisar / Confirmar). Step 1 y 2 colapsan a summary cuando se completan. Step 3 desbloquea reactivamente cuando los required del form están llenos.

**Drawbacks que la descartaron**:
- **Patrón "stepper" desconocido para admin no técnico**: agrega complejidad cognitiva sin reducir clicks reales (el conteo del happy path es idéntico al de A — 3 clicks + form-fill).
- **Tiny-edit friction (dealbreaker)**: cambiar el archivo en Step 1 colapsa y resetea Step 2 — toda la data del form se pierde sin warning. Para un usuario que solo quería confirmar el nombre del archivo, es un trap.
- **Step 3 desbloquea silenciosamente** sin scroll-to o toast — el admin puede llenar todos los campos y no notar que el botón apareció debajo del fold.
- **Re-upload sin confirmación** borra todo lo ingresado.
- **No "Next" button explícito** entre steps — la transición automática es eficiente en happy path pero confunde al user que quiere pausar y revisar antes de avanzar.
- **3 cards apilados en estados distintos** (activo / colapsado / locked) puede ser ambiguo — usuarios pueden no entender si los pasos anteriores siguen interactivos.

**Cuándo revisar**: si el flow crece a más de 3-4 pasos lógicos (e.g., import + asignar permisos + notificar cliente + confirmar), un wizard explícito empieza a justificarse. Para el caso actual (subir → revisar → confirmar) es over-engineering.

### 11.10 Layout elegido: full-width single column + 3 mitigaciones

**Aproach A (full-width single column)** elegido en Task 22 con tres ajustes que mitigan sus drawbacks principales:

1. **Sin sticky footer**: el botón "Importar N items" va al final de la card del Form, en su espacio natural. Mitiga "sticky bar oculta último input". Acepta el scroll natural — es el comportamiento esperado en formularios largos.
2. **Warning de cotización inline en el campo del Form**: si `cotizacionDetectada === null`, mostrar warning **dentro del campo `cotizacionUsd`** de `FormMetadatosObra` (no en `PreviewSummary`). `PreviewSummary` muestra la cotización detectada como dato informativo, sin warning. Mitiga "warning y campo separados por una card de distancia".
3. **Dialog de confirmación al "Quitar"**: si hay metadatos parcialmente llenos al apretar "Quitar" en el Dropzone, abre dialog "¿Descartar progreso? Los datos del formulario se perderán." Mitiga "reset abrupto sin warning".

Justificación de la elección sobre B y C:
- Match con mental model: el flow es lineal (subir → revisar → confirmar), single-column lo refleja sin patrones extra.
- Menos LOC para mantener: condicional render secuencial, sin grid responsive ni lógica de stepper.
- Mobile equivalente: el layout no cambia su orden conceptual entre mobile y desktop (todo siempre vertical lineal).

---

## 12. Anexos

### 12.1 Estructura observada del XLSX real

Hoja `Copia de JUNCAL 3706`, 253 filas × 31 cols, tres regiones internas:

**Región 1 — filas 7-104**: scope sin costo. Listado descriptivo (`RUBRO | UBICACIÓN | DETALLE`) agrupado por "CONTRATISTA 1/2/..." y subdivisiones tipo "DEMOLICIÓN Y TAREAS PREVIAS", "SUBTOTAL...".

**Región 2 — filas 106-215**: costos agregados (donde viven los números). Columnas clave:
- col 5/6: COSTO PARCIAL / TOTAL (material en ARS).
- col 12/13: MANO OBRA DE PARCIAL / TOTAL.
- col 14: "coeficiente o aumento" (markup multiplicativo, 1.2 = +20%).
- col 15/16: costo con markup aplicado (precio cliente).
- col 17: BENEFICIO NETO.

Sub-bloques "ADICIONALES" repetidos por rubro. Algunos items individuales con UBICACIÓN explícita (muebles, marmolería).

**Región 3 — filas 218+**: totales finales (HONORARIOS 16%, BENEF EN PESOS/DOLARES, MANO DE OBRA CONTRATISTAS, MATERIALES GRUESOS, INSUMOS — algunos con `#REF!` rotos). Toda esta región se descarta al importar.

**Suciedad encontrada**: cotización USD en fila 2 col 6, headers en fila 6 no 1, celdas rich-text (devueltas como objetos), `#REF!`, strings en columnas numéricas ("Adelanto", "NO INCLUYE", "opcion 1"), filas con rubro vacío que heredan el anterior.

### 12.2 Snippets de referencia (componentes UI)

Ver `src/app/preview-importer/page.tsx` (archivo temporal, ~400 LOC) — contiene los 5 componentes principales como mockups self-contained. Cuando empiece la implementación se splittean a archivos individuales en `src/features/import-presupuestos/components/` y se mockean las server actions con las reales.

### 12.3 Referencias

- Brainstorming de esta spec: conversación 2026-05-12 (compactable).
- Memoria de respaldo: `~/.claude/projects/-Users-lzayas-Desktop-Pelu/memory/project_importer_xlsx_decisiones.md`.
- Principios durables aplicables: `feedback_no_cli_for_users.md`, `feedback_ux_over_implementation.md`, `feedback_agentes_en_paralelo.md`, `feedback_persistir_decisiones_de_diseno.md`.
- Spec F1 base: `docs/superpowers/specs/2026-04-25-fase0-fase1-design.md`.
- Plan 5 (importer CSV original): `docs/superpowers/plans/2026-04-25-plan-5-*.md`.
- ROADMAP: `docs/ROADMAP.md` § 1.1 (este spec implementa ese ítem ampliado).
