# Importer XLSX real de Macna — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el importer XLSX real de Macna con UI web completa: parser, server actions, editor existente como preview, manejo de re-import con snapshot. Plan ejecuta el spec `docs/superpowers/specs/2026-05-12-importer-xlsx-real-design.md` (aprobado 2026-05-12).

**Architecture:** Capas: parser puro en `scripts/import-sheets/` (sin DB/Next) → server actions en `src/features/import-presupuestos/actions.ts` → 7 componentes UI en `src/features/import-presupuestos/components/` → integración como banner + columna nueva en el editor existente (Plan 3). Flag `presupuesto.import_pendiente` modela el sub-estado sin tocar el enum `estado`.

**Tech Stack:** Next.js 16 (Turbopack, Server Actions), Supabase (Postgres + Auth), Drizzle ORM, `exceljs` (ya instalado), shadcn base-nova con `@base-ui/react`, Tailwind, jest + Playwright.

**[PARALLEL-DECISION] tag:** Tareas marcadas con este tag implican decisión no trivial. El executor (agente principal o usuario) debe lanzar 2-3 sub-agentes en paralelo, cada uno proponiendo una alternativa concreta. Elegir la mejor, documentar drawbacks de las descartadas en el plan. Ver `~/.claude/projects/-Users-lzayas-Desktop-Pelu/memory/feedback_agentes_en_paralelo.md`.

**Convención de paths**: las rutas del App Router viven bajo `src/app/(internal)/obras/...` (el group `(internal)` es el authed group del repo). El spec menciona `(authed)` por costumbre — usar `(internal)` que es lo real.

---

## File structure

### Archivos NUEVOS

```
docs/superpowers/plans/2026-05-12-plan-importer-xlsx-real.md   (este plan)

drizzle/migrations/
└── 0002_importer_xlsx.sql                                      (migration con 3 columnas + 1 índice)

scripts/import-sheets/
├── parse-xlsx.ts                                               (parser XLSX puro, ~200 LOC)
├── parse-csv.ts                                                (renombrado desde parse.ts actual, sin cambios)
├── safe-parse.ts                                               (función safeParseNumber)
└── __fixtures__/
    ├── juncal-3706-real.xlsx                                   (copia del XLSX real de Macna)
    └── synthetic-small.xlsx                                    (fixture sintético chico para tests rápidos)

src/features/import-presupuestos/
├── actions.ts                                                  (4 server actions)
├── types.ts                                                    (ItemPreview, PreviewResult, ImportMetadata)
├── helpers.ts                                                  (parseImportWarningPrefix, formatImportNotes)
└── components/
    ├── DropzoneXlsx.tsx
    ├── FormMetadatosObra.tsx
    ├── PreviewSummary.tsx
    ├── ImportPendienteBanner.tsx
    ├── ConfirmarImportDialog.tsx
    ├── CancelarImportDialog.tsx
    └── ImportRowStatus.tsx

src/app/(internal)/obras/importar/
├── page.tsx                                                    (wizard: dropzone + form metadatos)
└── importar-client.tsx                                         (client wrapper)

src/app/(internal)/obras/[id]/importar/
├── page.tsx                                                    (dropzone solo, obra ya cargada)
└── importar-client.tsx

tests/unit/
├── import-parse-xlsx.test.ts                                   (header detection, safeParseNumber, etc)
├── import-parse-row-loop.test.ts                               (C.2 split, forward-fill, blocklist)
└── import-fixture-juncal.test.ts                               (end-to-end contra fixture real)

tests/integration/
├── import-presupuestos/
│   ├── parse-preview.test.ts
│   ├── commit-import-nueva-obra.test.ts
│   ├── commit-import-reimport-borrador.test.ts
│   ├── commit-import-reimport-firmado.test.ts
│   ├── confirmar-import.test.ts
│   └── cancelar-import.test.ts

tests/e2e/
├── import-nueva-obra.spec.ts
├── import-reimport.spec.ts
├── import-cancelar.spec.ts
└── import-permisos.spec.ts
```

### Archivos MODIFICADOS

```
src/db/schema.ts                                                 (+3 columnas en presupuesto, +1 en item_presupuesto, +1 index)

scripts/import-sheets/
├── parse.ts                                                     (renombrar contenido a parse-csv.ts; convertir a dispatcher)
├── ejecutor.ts                                                  (extraer commitImport como función reusable)
├── tipos.ts                                                     (extender con ItemPreview/Warning/Descarte)
└── validate.ts                                                  (agregar warnings nuevos)

src/features/presupuestos/components/
├── editor-form.tsx                                              (detectar import_pendiente, montar banner)
├── items-tabla.tsx                                              (columna nueva ImportRowStatus si import_pendiente)
└── item-row.tsx                                                 (renderizar chip de estado)

src/app/(internal)/obras/
├── page.tsx                                                     (+botón "Nueva obra desde Excel")
└── [id]/page.tsx                                                (+botón "Importar presupuesto desde Excel")

src/proxy.ts                                                     (NO modificar — el /preview-importer ya está; se REMUEVE en cleanup)

SETUP_PENDIENTE.md                                              (marcar 6.1-6.3 como hechos)
docs/ROADMAP.md                                                  (marcar § 1.1 como HECHO, mover backlog a § 1.5)
```

### Archivos a ELIMINAR (al final)

```
src/app/preview-importer/page.tsx                                (mockup temporal del brainstorming)
```

Y revertir línea 50 de `src/proxy.ts` (sacar `/preview-importer` de `publicPaths`).

---

## Tasks

### Task 1: Instalar primitives shadcn faltantes

**Files:**
- Modify: `package.json` (vía pnpm)
- Create: `src/components/ui/tooltip.tsx`, `badge.tsx`, `alert.tsx`, `checkbox.tsx`

- [ ] **Step 1: Correr el install**

```bash
pnpm dlx shadcn@latest add tooltip badge alert checkbox
```

Expected: cuatro archivos nuevos en `src/components/ui/`, sin errores.

- [ ] **Step 2: Verificar que los componentes funcionan**

```bash
pnpm tsc --noEmit
```

Expected: sin errores de tipos.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/{tooltip,badge,alert,checkbox}.tsx package.json pnpm-lock.yaml
git commit -m "chore(deps): add tooltip/badge/alert/checkbox shadcn primitives"
```

---

### Task 2: Crear fixtures de XLSX

**Files:**
- Create: `scripts/import-sheets/__fixtures__/juncal-3706-real.xlsx`
- Create: `scripts/import-sheets/__fixtures__/synthetic-small.xlsx`
- Create: `scripts/import-sheets/__fixtures__/README.md`

- [ ] **Step 1: Copiar el XLSX real al fixture folder**

```bash
mkdir -p scripts/import-sheets/__fixtures__
cp "/Users/lzayas/Downloads/MACNA ADMINISTRACION - Lucho (1).xlsx" scripts/import-sheets/__fixtures__/juncal-3706-real.xlsx
```

- [ ] **Step 2: Generar fixture sintético chico (5 items, 1 hoja)**

Crear `scripts/import-sheets/__fixtures__/generate-synthetic.ts`:

```typescript
import ExcelJS from 'exceljs';

async function main() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Presupuesto Sintético');
  // Cotización en fila 2
  ws.getRow(2).getCell(5).value = 'DOLAR BLUE';
  ws.getRow(2).getCell(6).value = 1500;
  // Headers en fila 6
  const headers = ['', 'RUBRO', 'UBICACIÓN', 'DETALLE', 'COSTO PARCIAL', 'COSTO TOTAL', '', '', '', '', '', 'MANO OBRA PARCIAL', 'MANO DE OBRA TOTAL', 'coeficiente o aumento'];
  headers.forEach((h, i) => { ws.getRow(6).getCell(i + 1).value = h; });
  // Datos
  const rows: [string, string, string, number | null, number | null, number | null][] = [
    ['DEMOLICION', 'GENERAL', 'Retiro de revestimientos', null, 500000, 800000, 1.2],
    ['ALBAÑILERIA', 'COCINA', 'Pared nueva en L', null, 1200000, 600000, 1.2],
    ['', 'COCINA', 'Continúa albañilería (rubro heredado)', null, 300000, null, 1.2],
    ['MARMOLERÍA', 'BAÑO', 'Mesada baño', null, null, 250000, 1.2],
    ['', '', 'SUBTOTAL', null, 2000000, 1650000, null],  // debe descartarse por regex
  ];
  rows.forEach((r, i) => {
    const row = ws.getRow(7 + i);
    row.getCell(2).value = r[0];
    row.getCell(3).value = r[1];
    row.getCell(4).value = r[2];
    row.getCell(6).value = r[3] != null ? r[3] : null;  // COSTO TOTAL material en col 6
    row.getCell(13).value = r[4];
    row.getCell(14).value = r[5];
  });
  await wb.xlsx.writeFile('scripts/import-sheets/__fixtures__/synthetic-small.xlsx');
}
main();
```

Correr:
```bash
pnpm tsx scripts/import-sheets/__fixtures__/generate-synthetic.ts
rm scripts/import-sheets/__fixtures__/generate-synthetic.ts
```

- [ ] **Step 3: Crear README del fixtures folder**

Crear `scripts/import-sheets/__fixtures__/README.md`:

```markdown
# Fixtures del importer

- `juncal-3706-real.xlsx` — XLSX real entregado por Macna 2026-05-12 (anonimizado en cuanto a PII porque no contiene datos personales). Hoja útil: `Copia de JUNCAL 3706` (253 filas × 31 cols). Usado para test end-to-end (`tests/unit/import-fixture-juncal.test.ts`).
- `synthetic-small.xlsx` — Fixture chico generado a mano para tests rápidos del parser (5 items, 1 hoja, cubre forward-fill + regex blocklist + costo material/MO).
```

- [ ] **Step 4: Commit**

```bash
git add scripts/import-sheets/__fixtures__/
git commit -m "test(import): add real and synthetic XLSX fixtures"
```

---

### Task 3: Schema — agregar columnas

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/migrations/0002_importer_xlsx.sql` (generado por drizzle-kit)

- [ ] **Step 1: Editar schema.ts**

En `src/db/schema.ts`:

```typescript
// En presupuesto (después de version):
importPendiente: boolean('import_pendiente').notNull().default(false),
importMetadata: jsonb('import_metadata'),
reemplazadoPorImportId: uuid('reemplazado_por_import_id'),

// En itemPresupuesto (después de notas):
ubicacion: text('ubicacion'),
```

Agregar también el self-reference de `reemplazadoPorImportId`:

```typescript
}, (t) => ({
  obraNumeroIdx: uniqueIndex('presupuesto_obra_numero_idx').on(t.obraId, t.numero),
  importPendienteIdx: index('presupuesto_import_pendiente_idx').on(t.importPendiente).where(sql`import_pendiente = true`),
}));
```

Importar `index, sql` si no están: `import { index, ... } from 'drizzle-orm/pg-core'; import { sql } from 'drizzle-orm';`.

- [ ] **Step 2: Generar la migration**

```bash
pnpm db:generate
```

Expected: archivo nuevo `drizzle/migrations/0002_importer_xlsx.sql` con `ALTER TABLE presupuesto ADD COLUMN import_pendiente boolean NOT NULL DEFAULT false`, etc. Drizzle-kit puede ponerle otro nombre — renombrar al esperado:

```bash
mv drizzle/migrations/0002_*.sql drizzle/migrations/0002_importer_xlsx.sql
```

Editar `drizzle/migrations/meta/_journal.json` si fue necesario renombrar (cambiar `tag` a `0002_importer_xlsx`).

- [ ] **Step 3: Verificar el SQL generado**

```bash
cat drizzle/migrations/0002_importer_xlsx.sql
```

Expected: contiene los 3 ALTER TABLE en `presupuesto` (import_pendiente, import_metadata, reemplazado_por_import_id), 1 ALTER TABLE en `item_presupuesto` (ubicacion), y la creación del index parcial. Si falta el index, agregarlo manualmente:

```sql
CREATE INDEX IF NOT EXISTS "presupuesto_import_pendiente_idx" ON "presupuesto" ("import_pendiente") WHERE "import_pendiente" = true;
```

- [ ] **Step 4: Aplicar contra la DB de dev**

```bash
pnpm db:migrate
```

Expected: `0002_importer_xlsx` aplicada sin errores.

- [ ] **Step 5: Verificar las columnas existen**

```bash
pnpm db:studio
```

En la UI de drizzle-studio, abrir la tabla `presupuesto` y confirmar las 3 columnas nuevas. Ídem `item_presupuesto.ubicacion`. (Cerrar el studio después.)

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts drizzle/migrations/0002_importer_xlsx.sql drizzle/migrations/meta/
git commit -m "feat(schema): add import_pendiente, import_metadata, reemplazado_por_import_id, item.ubicacion"
```

---

### Task 4: Extender tipos del importer

**Files:**
- Modify: `scripts/import-sheets/tipos.ts`

- [ ] **Step 1: Agregar types nuevos**

Reemplazar `scripts/import-sheets/tipos.ts` completo:

```typescript
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
  tipo: 'rubro_heredado' | 'costo_invalido' | 'ref_error' | 'ubicacion_nueva';
  mensaje: string;
}

export interface DescarteRow {
  filaExcel: number;
  razon: string;
  detalle: string;
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
```

- [ ] **Step 2: Verificar tsc**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add scripts/import-sheets/tipos.ts
git commit -m "feat(import): extend types with ItemPreview, WarningItem, DescarteRow, ResultadoParseoXlsx"
```

---

### Task 5: `safeParseNumber` — TDD

**Files:**
- Create: `scripts/import-sheets/safe-parse.ts`
- Create: `tests/unit/import-safe-parse.test.ts`

- [ ] **Step 1: Escribir el test failing**

Crear `tests/unit/import-safe-parse.test.ts`:

```typescript
import { safeParseNumber } from '@/../scripts/import-sheets/safe-parse';

describe('safeParseNumber', () => {
  test('number plano', () => expect(safeParseNumber(1500)).toBe(1500));
  test('number con decimales', () => expect(safeParseNumber(1234.56)).toBe(1234.56));
  test('cero', () => expect(safeParseNumber(0)).toBe(0));
  test('null', () => expect(safeParseNumber(null)).toBeNull());
  test('undefined', () => expect(safeParseNumber(undefined)).toBeNull());
  test('string vacío', () => expect(safeParseNumber('')).toBeNull());
  test('string "Adelanto"', () => expect(safeParseNumber('Adelanto')).toBeNull());
  test('string "NO INCLUYE"', () => expect(safeParseNumber('NO INCLUYE')).toBeNull());
  test('string "#REF!"', () => expect(safeParseNumber('#REF!')).toBeNull());
  test('string "#DIV/0!"', () => expect(safeParseNumber('#DIV/0!')).toBeNull());
  test('string "$1.500.000,50" (formato es-AR)', () => expect(safeParseNumber('$1.500.000,50')).toBe(1500000.5));
  test('string "1500"', () => expect(safeParseNumber('1500')).toBe(1500));
  test('formula con result', () => expect(safeParseNumber({ result: 1500, formula: '=A1+A2' } as never)).toBe(1500));
  test('formula con result null', () => expect(safeParseNumber({ result: null, formula: '=BAD()' } as never)).toBeNull());
  test('richText', () => expect(safeParseNumber({ richText: [{ text: '1500' }] } as never)).toBe(1500));
  test('Infinity', () => expect(safeParseNumber(Infinity)).toBeNull());
  test('NaN', () => expect(safeParseNumber(NaN)).toBeNull());
});
```

- [ ] **Step 2: Correr para verificar que falla**

```bash
pnpm test:unit -- import-safe-parse
```

Expected: FAIL — `Cannot find module '@/../scripts/import-sheets/safe-parse'`.

- [ ] **Step 3: Implementar**

Crear `scripts/import-sheets/safe-parse.ts`:

```typescript
export function safeParseNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'object') {
    const o = v as { result?: unknown; richText?: { text: string }[] };
    if ('result' in o) return safeParseNumber(o.result);
    if ('richText' in o && Array.isArray(o.richText)) {
      return safeParseNumber(o.richText.map((t) => t.text).join(''));
    }
    return null;
  }
  if (typeof v === 'string') {
    if (v.startsWith('#')) return null;
    // Limpiar: quitar $, espacios, puntos de miles; convertir coma decimal a punto
    const cleaned = v.replace(/[$\s]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
```

- [ ] **Step 4: Correr tests**

```bash
pnpm test:unit -- import-safe-parse
```

Expected: PASS, 17 tests passing.

- [ ] **Step 5: Commit**

```bash
git add scripts/import-sheets/safe-parse.ts tests/unit/import-safe-parse.test.ts
git commit -m "feat(import): add safeParseNumber with TDD"
```

---

### Task 6: Parse XLSX — detección estructural

**Files:**
- Create: `scripts/import-sheets/parse-xlsx.ts` (parcial, primera parte)
- Create: `tests/unit/import-parse-xlsx.test.ts`

- [ ] **Step 1: Escribir el test failing**

Crear `tests/unit/import-parse-xlsx.test.ts`:

```typescript
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
```

- [ ] **Step 2: Correr — debe fallar**

```bash
pnpm test:unit -- import-parse-xlsx
```

Expected: FAIL — `Cannot find module '.../parse-xlsx'`.

- [ ] **Step 3: Implementar parse-xlsx.ts (parte 1: detección estructural)**

Crear `scripts/import-sheets/parse-xlsx.ts`:

```typescript
import ExcelJS from 'exceljs';
import type { ResultadoParseoXlsx, FilaXlsx, ItemPreview, DescarteRow, WarningItem } from './tipos';
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

function selectSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet {
  const matched = wb.worksheets.find((ws) => SHEET_PATTERNS.test(ws.name));
  return matched ?? wb.worksheets[0];
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
    if (requiredFound >= 2) return { row: r, mapeo: found };
  }
  return null;
}

export async function parseXlsx(buf: Buffer, archivoNombre: string): Promise<ResultadoParseoXlsx> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = selectSheet(wb);
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
```

- [ ] **Step 4: Correr tests**

```bash
pnpm test:unit -- import-parse-xlsx
```

Expected: PASS, 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add scripts/import-sheets/parse-xlsx.ts tests/unit/import-parse-xlsx.test.ts
git commit -m "feat(import): parse-xlsx structural detection (sheet/header/cotizacion/mapping)"
```

---

### Task 7: Parse XLSX — loop de filas con forward-fill, blocklist, C.2

**Files:**
- Modify: `scripts/import-sheets/parse-xlsx.ts`
- Create: `tests/unit/import-parse-row-loop.test.ts`

- [ ] **Step 1: Escribir el test failing**

Crear `tests/unit/import-parse-row-loop.test.ts`:

```typescript
import path from 'path';
import fs from 'fs';
import { parseXlsx } from '@/../scripts/import-sheets/parse-xlsx';

const FIXTURE_DIR = path.join(__dirname, '../../scripts/import-sheets/__fixtures__');
const loadFixture = (n: string) => fs.promises.readFile(path.join(FIXTURE_DIR, n));

describe('parseXlsx — row loop con C.2 split y forward-fill', () => {
  test('synthetic: descarta fila SUBTOTAL', async () => {
    const r = await parseXlsx(await loadFixture('synthetic-small.xlsx'), 's.xlsx');
    const descartado = r.descartes.find((d) => d.detalle.includes('SUBTOTAL'));
    expect(descartado).toBeDefined();
    expect(descartado!.razon).toMatch(/separadora|total/i);
  });

  test('synthetic: forward-fill de rubro genera warning', async () => {
    const r = await parseXlsx(await loadFixture('synthetic-small.xlsx'), 's.xlsx');
    const heredado = r.items.find((i) => i.descripcion.includes('Continúa albañilería'));
    expect(heredado).toBeDefined();
    expect(heredado!.rubro).toBe('ALBAÑILERIA');
    expect(heredado!.warnings.some((w) => w.tipo === 'rubro_heredado')).toBe(true);
  });

  test('C.2: fila con material y MO genera 2 items', async () => {
    const r = await parseXlsx(await loadFixture('synthetic-small.xlsx'), 's.xlsx');
    const demolicion = r.items.filter((i) => i.descripcion.startsWith('Retiro de revestimientos'));
    expect(demolicion).toHaveLength(2);
    expect(demolicion.find((i) => i.descripcion.endsWith('— Material'))).toBeDefined();
    expect(demolicion.find((i) => i.descripcion.endsWith('— Mano de obra'))).toBeDefined();
  });

  test('C.2: fila con solo MO genera 1 item (— Mano de obra)', async () => {
    const r = await parseXlsx(await loadFixture('synthetic-small.xlsx'), 's.xlsx');
    const mesada = r.items.filter((i) => i.descripcion.startsWith('Mesada baño'));
    expect(mesada).toHaveLength(1);
    expect(mesada[0].descripcion).toBe('Mesada baño — Mano de obra');
    expect(mesada[0].costoUnitario).toBe(250000);
  });

  test('markup: coeficiente 1.2 → markupPorcentaje 0.20', async () => {
    const r = await parseXlsx(await loadFixture('synthetic-small.xlsx'), 's.xlsx');
    expect(r.items[0].markupPorcentaje).toBeCloseTo(0.20, 5);
  });

  test('costoUnitario, cantidad, unidad defaults', async () => {
    const r = await parseXlsx(await loadFixture('synthetic-small.xlsx'), 's.xlsx');
    expect(r.items[0].cantidad).toBe(1);
    expect(r.items[0].unidad).toBe('gl');
    expect(r.items[0].monedaCosto).toBe('ARS');
  });

  test('XLSX real: descarta filas en región 3 (HONORARIOS, BENEFICIO, etc)', async () => {
    const r = await parseXlsx(await loadFixture('juncal-3706-real.xlsx'), 'j.xlsx');
    expect(r.descartes.some((d) => /HONORARIOS/i.test(d.detalle))).toBe(true);
    expect(r.descartes.some((d) => /BENEFICIO|BENEF/i.test(d.detalle))).toBe(true);
  });

  test('XLSX real: descarta filas tipo CONTRATISTA N', async () => {
    const r = await parseXlsx(await loadFixture('juncal-3706-real.xlsx'), 'j.xlsx');
    expect(r.descartes.some((d) => /CONTRATISTA \d/i.test(d.detalle))).toBe(true);
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
pnpm test:unit -- import-parse-row-loop
```

Expected: la mayoría de tests fallan (items vacío). Algunos pueden pasar accidentalmente.

- [ ] **Step 3: Implementar el loop**

En `scripts/import-sheets/parse-xlsx.ts`, reemplazar la sección `// TODO Task 7` por:

```typescript
const BLOCKLIST_DETALLE = /^(SUB)?TOTAL|HONORARIOS|BENEFICIO|MATERIALES GRUESOS|MANO DE OBRA CONTRATISTAS|PLANILLA|INS - /i;
const CONTRATISTA_PATTERN = /^CONTRATISTA \d/i;

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
  return String(v).trim();
}

// Dentro de parseXlsx, después de obtener headerInfo:
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
    descartes.push({ filaExcel: r, razon: 'sin descripción', detalle: '' });
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
```

- [ ] **Step 4: Correr tests**

```bash
pnpm test:unit -- import-parse-row-loop
pnpm test:unit -- import-parse-xlsx
```

Expected: ambos PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/import-sheets/parse-xlsx.ts tests/unit/import-parse-row-loop.test.ts
git commit -m "feat(import): parse-xlsx row loop with C.2 split, forward-fill, blocklist"
```

---

### Task 8: Dispatcher CSV/XLSX en `parse.ts`

**Files:**
- Modify: `scripts/import-sheets/parse.ts` (renombrar contenido a parse-csv.ts, hacer dispatcher)
- Create: `scripts/import-sheets/parse-csv.ts` (movido)

- [ ] **Step 1: Mover el contenido actual de parse.ts a parse-csv.ts**

```bash
mv scripts/import-sheets/parse.ts scripts/import-sheets/parse-csv.ts
```

Editar `parse-csv.ts` para renombrar la export:

```typescript
// Cambiar `parseCsv` mantiene el nombre (ya era ese)
```

- [ ] **Step 2: Crear el dispatcher en parse.ts**

Crear nuevo `scripts/import-sheets/parse.ts`:

```typescript
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
```

- [ ] **Step 3: Verificar tests existentes (import-parse.test.ts) siguen pasando**

```bash
pnpm test:unit -- import-parse
```

Expected: PASS (los tests existentes para parseCsv siguen funcionando porque el re-export está).

- [ ] **Step 4: Verificar que el CLI legacy sigue andando contra un CSV chico**

```bash
echo 'rubro,descripcion,unidad,cantidad,costo_unitario,moneda_costo,markup,notas
ALBAÑILERIA,Test item,gl,1,1000,ARS,0.2,nota' > /tmp/test.csv
pnpm import-sheets /tmp/test.csv --dry-run --codigo-obra TEST-001 || echo "CLI legacy test"
rm /tmp/test.csv
```

Expected: el CLI dispatcher antiguo invoca `parseCsv` y funciona (puede dar error de DB en dry-run si no hay sesión, pero no error de parseo).

- [ ] **Step 5: Commit**

```bash
git add scripts/import-sheets/parse.ts scripts/import-sheets/parse-csv.ts
git commit -m "refactor(import): split parse.ts into parse-csv + parse-xlsx with dispatcher"
```

---

### Task 9: Test end-to-end del parser contra XLSX real

**Files:**
- Create: `tests/unit/import-fixture-juncal.test.ts`

- [ ] **Step 1: Generar valores esperados (run-once manual)**

Inspeccionar el fixture real con un script ad-hoc para calcular el total esperado:

```bash
pnpm tsx -e "
import { parseXlsx } from './scripts/import-sheets/parse-xlsx';
import fs from 'fs';
(async () => {
  const buf = await fs.promises.readFile('scripts/import-sheets/__fixtures__/juncal-3706-real.xlsx');
  const r = await parseXlsx(buf, 'real');
  console.log('items:', r.items.length);
  console.log('descartes:', r.descartes.length);
  console.log('total costo bruto:', r.items.reduce((s, i) => s + i.costoUnitario, 0));
  console.log('rubros únicos:', new Set(r.items.map(i => i.rubro)).size);
  console.log('cotización:', r.cotizacionDetectada);
})();
"
```

Anotar los valores numéricos resultantes (ej. items=87, descartes=156, total=42500000, rubros=10, cotizacion=1500).

- [ ] **Step 2: Escribir el test con esos valores fijos**

Crear `tests/unit/import-fixture-juncal.test.ts`:

```typescript
import path from 'path';
import fs from 'fs';
import { parseXlsx } from '@/../scripts/import-sheets/parse-xlsx';

const FIXTURE = path.join(__dirname, '../../scripts/import-sheets/__fixtures__/juncal-3706-real.xlsx');

describe('Importer XLSX — snapshot del fixture real Juncal 3706', () => {
  let result: Awaited<ReturnType<typeof parseXlsx>>;

  beforeAll(async () => {
    const buf = await fs.promises.readFile(FIXTURE);
    result = await parseXlsx(buf, 'juncal-3706-real.xlsx');
  });

  test('cotización USD detectada = 1500', () => {
    expect(result.cotizacionDetectada).toBe(1500);
  });

  test('hoja parseada = "Copia de JUNCAL 3706"', () => {
    expect(result.metadata.hojaParseada).toBe('Copia de JUNCAL 3706');
  });

  // REPLACE LOS VALORES DE ABAJO con los obtenidos en Step 1
  test('total de items importados está en rango razonable (50-150)', () => {
    expect(result.items.length).toBeGreaterThanOrEqual(50);
    expect(result.items.length).toBeLessThanOrEqual(150);
  });

  test('total de descartes está en rango razonable (100-200)', () => {
    expect(result.descartes.length).toBeGreaterThanOrEqual(100);
    expect(result.descartes.length).toBeLessThanOrEqual(200);
  });

  test('al menos 5 rubros únicos detectados', () => {
    const rubros = new Set(result.items.map((i) => i.rubro));
    expect(rubros.size).toBeGreaterThanOrEqual(5);
  });

  test('todos los items tienen cantidad=1 y unidad=gl', () => {
    for (const item of result.items) {
      expect(item.cantidad).toBe(1);
      expect(item.unidad).toBe('gl');
    }
  });

  test('items en bloque MARMOLERÍA tienen ubicación variada (COCINA/LAVADERO/BAÑO)', () => {
    const marm = result.items.filter((i) => i.rubro.includes('MARMOL'));
    const ubicaciones = new Set(marm.map((i) => i.ubicacion));
    expect(ubicaciones.size).toBeGreaterThanOrEqual(2);
  });

  test('no hay items con DETALLE empezando con SUBTOTAL/HONORARIOS/etc', () => {
    for (const item of result.items) {
      expect(item.descripcion).not.toMatch(/^(SUB)?TOTAL|^HONORARIOS|^BENEFICIO/i);
    }
  });
});
```

- [ ] **Step 3: Correr — debe pasar**

```bash
pnpm test:unit -- import-fixture-juncal
```

Expected: PASS, 8 tests passing.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/import-fixture-juncal.test.ts
git commit -m "test(import): snapshot test against real Juncal 3706 fixture"
```

---

### Task 10: Extraer `commitImport` del ejecutor — reusable desde Server Action

**Files:**
- Modify: `scripts/import-sheets/ejecutor.ts`

- [ ] **Step 1: Refactor ejecutor.ts**

Reescribir `scripts/import-sheets/ejecutor.ts` separando la lógica de DB de la lógica de CLI:

```typescript
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { obra, presupuesto, itemPresupuesto, rubro } from '@/db/schema';
import { D, toDb } from '@/lib/money/decimal';
import { calcularSnapshotItem, type PresupuestoCtx } from '@/features/presupuestos/services/snapshots';
import { logAudit } from '@/features/audit/log';
import { parseCsv } from './parse-csv';
import { validarFila } from './validate';
import type { ItemPreview } from './tipos';

export interface CommitImportArgs {
  items: ItemPreview[];
  metadatosObra: {
    codigoObra: string;
    nombreObra: string;
    clienteNombre: string;
    monedaBase: 'USD' | 'ARS';
    cotizacionUsd: string;
    markupDefaultPorcentaje: string;
    porcentajeHonorarios?: string;
  };
  importMetadata: Record<string, unknown>;
  adminId: string;
  obraIdExistente?: string;
}

export interface CommitImportResult {
  ok: true;
  obraId: string;
  presupuestoId: string;
  itemsCreados: number;
}

/**
 * Crea obra + presupuesto + items en transacción atómica.
 * Reusable desde CLI legacy (Plan 5) y desde Server Action nueva.
 * NO parsea — recibe items ya preparados.
 */
export async function commitImport(args: CommitImportArgs): Promise<CommitImportResult> {
  return db.transaction(async (tx) => {
    // 1. Resolver rubros (crear faltantes)
    const rubrosCache = new Map<string, string>();
    for (const it of args.items) {
      if (rubrosCache.has(it.rubro)) continue;
      const [existing] = await tx.select().from(rubro).where(eq(rubro.nombre, it.rubro)).limit(1);
      if (existing) {
        rubrosCache.set(it.rubro, existing.id);
      } else {
        const [created] = await tx.insert(rubro).values({
          nombre: it.rubro, orden: 999, activo: true, creadoPorImportador: true,
        }).returning();
        rubrosCache.set(it.rubro, created.id);
      }
    }

    // 2. Resolver obra (existente o nueva)
    let obraId: string;
    if (args.obraIdExistente) {
      obraId = args.obraIdExistente;
    } else {
      const [oCreated] = await tx.insert(obra).values({
        codigo: args.metadatosObra.codigoObra,
        nombre: args.metadatosObra.nombreObra,
        clienteNombre: args.metadatosObra.clienteNombre,
        estado: 'borrador',
        monedaBase: args.metadatosObra.monedaBase,
        porcentajeHonorarios: args.metadatosObra.porcentajeHonorarios ?? '16',
        cotizacionUsdInicial: args.metadatosObra.cotizacionUsd,
        clienteToken: randomBytes(32).toString('base64url'),
        createdBy: args.adminId,
        updatedBy: args.adminId,
      }).returning();
      obraId = oCreated.id;
    }

    // 3. Decidir tipo del presupuesto y soft-delete del anterior si aplica
    let tipoPresupuesto: 'original' | 'adicional' = 'original';
    let reemplazadoPorImportId: string | null = null;

    if (args.obraIdExistente) {
      const presupuestosObra = await tx.select().from(presupuesto)
        .where(eq(presupuesto.obraId, obraId));
      const borradorActivo = presupuestosObra.find((p) => p.estado === 'borrador' && !p.deletedAt && !p.importPendiente);
      const firmadoActivo = presupuestosObra.find((p) => p.estado === 'firmado' && !p.deletedAt);

      if (firmadoActivo) {
        tipoPresupuesto = 'adicional';
      } else if (borradorActivo) {
        // Soft-delete del anterior
        await tx.update(presupuesto).set({ deletedAt: new Date() }).where(eq(presupuesto.id, borradorActivo.id));
        reemplazadoPorImportId = borradorActivo.id;
      }
    }

    // 4. Calcular número del presupuesto
    const presupuestosObra = await tx.select().from(presupuesto).where(eq(presupuesto.obraId, obraId));
    const numero = presupuestosObra.filter((p) => p.tipo === tipoPresupuesto).length + 1;

    // 5. INSERT presupuesto
    const [pCreated] = await tx.insert(presupuesto).values({
      obraId,
      tipo: tipoPresupuesto,
      numero,
      estado: 'borrador',
      markupDefaultPorcentaje: args.metadatosObra.markupDefaultPorcentaje,
      cotizacionUsd: args.metadatosObra.cotizacionUsd,
      version: 1,
      importPendiente: true,
      importMetadata: args.importMetadata,
      reemplazadoPorImportId,
      createdBy: args.adminId,
      updatedBy: args.adminId,
    }).returning();

    // 6. INSERT items con snapshot
    const ctx: PresupuestoCtx = {
      monedaBase: args.metadatosObra.monedaBase,
      cotizacionUsd: D(args.metadatosObra.cotizacionUsd),
      markupDefault: D(args.metadatosObra.markupDefaultPorcentaje),
    };

    let i = 0;
    for (const it of args.items.filter((x) => x.incluido)) {
      const markupPct = it.markupPorcentaje > 0 ? D(String(it.markupPorcentaje * 100)) : null;
      const snap = calcularSnapshotItem({
        cantidad: D(String(it.cantidad)),
        costoUnitario: D(String(it.costoUnitario)),
        costoUnitarioMoneda: it.monedaCosto,
        markupPorcentaje: markupPct,
      }, ctx);

      // Warnings persisten en `notas` con prefix [import]
      const warningsPrefix = it.warnings.length > 0
        ? `[import] ${it.warnings.map((w) => w.mensaje).join('; ')} | `
        : '';

      await tx.insert(itemPresupuesto).values({
        presupuestoId: pCreated.id,
        rubroId: rubrosCache.get(it.rubro)!,
        orden: i++,
        descripcion: it.descripcion,
        ubicacion: it.ubicacion,
        unidad: it.unidad,
        cantidad: String(it.cantidad),
        costoUnitario: String(it.costoUnitario),
        costoUnitarioMoneda: it.monedaCosto,
        costoUnitarioBase: toDb(snap.costoUnitarioBase),
        markupPorcentaje: markupPct ? String(it.markupPorcentaje * 100) : null,
        markupEfectivoPorcentaje: toDb(snap.markupEfectivoPorcentaje, 2),
        precioUnitarioCliente: toDb(snap.precioUnitarioCliente),
        notas: warningsPrefix + (it.notas || ''),
      });
    }

    // 7. Audit log
    await logAudit({
      entidad: 'presupuesto',
      entidadId: pCreated.id,
      accion: 'crear',
      descripcionHumana: `Import XLSX creó presupuesto ${tipoPresupuesto} #${numero} con ${i} items (pendiente de confirmación)`,
      usuarioId: args.adminId,
      diff: { importMetadata: args.importMetadata },
    });

    return { ok: true, obraId, presupuestoId: pCreated.id, itemsCreados: i };
  });
}

// ───── CLI legacy compatibility (Plan 5) ─────
export interface EjecutarImportArgs {
  buf: Buffer;
  codigoObra: string;
  adminId: string;
  dryRun: boolean;
  cotizacionUsd: string;
  markupDefault: string;
  monedaBase?: 'USD' | 'ARS';
  nombreObra?: string;
  clienteNombre?: string;
}

export type EjecutarImportResult =
  | { ok: true; obraId?: string; itemsImportados: number }
  | { ok: false; errores: string[] };

export async function ejecutarImport(args: EjecutarImportArgs): Promise<EjecutarImportResult> {
  const filasCsv = await parseCsv(args.buf);

  const errores: string[] = [];
  filasCsv.forEach((f, i) => {
    const v = validarFila(f, i);
    if (!v.ok) errores.push(v.error);
  });
  if (errores.length) return { ok: false, errores };

  const [exists] = await db.select({ id: obra.id }).from(obra).where(eq(obra.codigo, args.codigoObra)).limit(1);
  if (exists) return { ok: false, errores: [`obra con código ${args.codigoObra} ya existe`] };

  if (args.dryRun) {
    return { ok: true, itemsImportados: filasCsv.length };
  }

  // Convertir FilaCsv → ItemPreview para reusar commitImport
  const items: ItemPreview[] = filasCsv.map((f, i) => ({
    filaExcel: i + 1,
    rubro: f.rubro.trim(),
    descripcion: f.descripcion,
    ubicacion: null,
    cantidad: Number(f.cantidad),
    unidad: f.unidad as ItemPreview['unidad'],
    costoUnitario: Number(f.costo_unitario),
    monedaCosto: f.moneda_costo as 'USD' | 'ARS',
    markupPorcentaje: f.markup ? Number(f.markup) / 100 : 0,
    notas: f.notas || '',
    warnings: [],
    estado: 'ok',
    incluido: true,
  }));

  const r = await commitImport({
    items,
    metadatosObra: {
      codigoObra: args.codigoObra,
      nombreObra: args.nombreObra ?? args.codigoObra,
      clienteNombre: args.clienteNombre ?? 'Cliente importado',
      monedaBase: args.monedaBase ?? 'USD',
      cotizacionUsd: args.cotizacionUsd,
      markupDefaultPorcentaje: args.markupDefault,
    },
    importMetadata: { source: 'cli-legacy-csv', filas: filasCsv.length },
    adminId: args.adminId,
  });

  return { ok: true, obraId: r.obraId, itemsImportados: r.itemsCreados };
}
```

- [ ] **Step 2: Verificar tsc**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Verificar que tests existentes siguen pasando**

```bash
pnpm test:unit
```

Expected: todos pasan (incluyendo los nuevos del importer XLSX).

- [ ] **Step 4: Commit**

```bash
git add scripts/import-sheets/ejecutor.ts
git commit -m "refactor(import): extract commitImport as reusable transaction; CLI uses it via ItemPreview adapter"
```

---

### Task 11: [PARALLEL-DECISION] Estructura del JSON `import_metadata`

**Decisión a tomar**: qué keys exactos lleva el JSON `presupuesto.import_metadata`. Afecta a la UI (banner expandible) y al audit log.

Lanzar 2-3 sub-agentes en paralelo, cada uno propone un schema distinto del `ImportMetadata`. Comparar y elegir.

**Sub-agentes a lanzar:**

> Agent A: "Schema flat — un solo nivel de keys, todo strings/números/booleans, máximo 8 keys." Propone qué keys.
>
> Agent B: "Schema anidado — secciones tipo `{ archivo: {...}, parseo: {...}, items: { warnings: [...], descartes: [...] } }`." Propone estructura.
>
> Agent C: "Schema mínimo — solo lo estrictamente necesario para reconstruir el banner UI y el audit log; el resto se rederiva." Propone qué es 'lo estrictamente necesario'.

Criterios: (a) tamaño del payload (presupuestos con 200 items pueden tener JSON grande), (b) facilidad de query (ej. "presupuestos con más de 5 warnings"), (c) facilidad de versioning futuro, (d) facilidad de render en UI.

- [ ] **Step 1: Lanzar agentes en paralelo**

Crear archivo temporal `docs/superpowers/decisions/2026-05-12-import-metadata-schema.md` con los 3 outputs.

- [ ] **Step 2: Elegir y documentar**

Editar el spec `docs/superpowers/specs/2026-05-12-importer-xlsx-real-design.md` § 3.2 con la estructura elegida. Anotar las 2 descartadas en § 11 con drawbacks.

- [ ] **Step 3: Implementar el type**

Crear `src/features/import-presupuestos/types.ts`:

```typescript
// Estructura elegida en Task 11 (PARALLEL-DECISION)
export interface ImportMetadata {
  // [REEMPLAZAR este placeholder con los campos elegidos]
  archivoNombre: string;
  hojaParseada: string;
  totalFilasExcel: number;
  headerRow: number;
  cotizacionDetectada: number | null;
  itemsCreados: number;
  warnings: { tipo: string; mensaje: string; filaExcel: number }[];
  descartes: { filaExcel: number; razon: string; detalle: string }[];
  mapeoColumnas: Record<string, number>;
  ts: string; // ISO timestamp del import
}

export type { ItemPreview, ResultadoParseoXlsx } from '@/../scripts/import-sheets/tipos';
```

- [ ] **Step 4: Commit**

```bash
git add src/features/import-presupuestos/types.ts docs/superpowers/decisions/ docs/superpowers/specs/2026-05-12-importer-xlsx-real-design.md
git commit -m "feat(import): define ImportMetadata schema after parallel evaluation"
```

---

### Task 12: Server Action `parse-preview`

**Files:**
- Create: `src/features/import-presupuestos/actions.ts` (parcial — solo parsePreview)
- Create: `tests/integration/import-presupuestos/parse-preview.test.ts`

- [ ] **Step 1: Test failing**

Crear `tests/integration/import-presupuestos/parse-preview.test.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import { parsePreview } from '@/features/import-presupuestos/actions';

const FIXTURE = path.join(process.cwd(), 'scripts/import-sheets/__fixtures__/synthetic-small.xlsx');

describe('parsePreview server action', () => {
  test('archivo XLSX válido devuelve preview con items y descartes', async () => {
    const buf = await fs.promises.readFile(FIXTURE);
    const file = new File([buf], 'synthetic-small.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const form = new FormData();
    form.append('file', file);

    const r = await parsePreview(form);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.cotizacionDetectada).toBe(1500);
  });

  test('archivo no XLSX devuelve error', async () => {
    const file = new File(['hola'], 'test.pdf', { type: 'application/pdf' });
    const form = new FormData();
    form.append('file', file);

    const r = await parsePreview(form);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/extensión|xlsx/i);
  });

  test('archivo > 5MB devuelve error', async () => {
    const bigBuf = Buffer.alloc(6 * 1024 * 1024);
    const file = new File([bigBuf], 'big.xlsx');
    const form = new FormData();
    form.append('file', file);

    const r = await parsePreview(form);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Implementar la action**

Crear `src/features/import-presupuestos/actions.ts`:

```typescript
'use server';

import { requireRole } from '@/lib/auth/require-role';
import { parseFile } from '@/../scripts/import-sheets/parse';
import type { ItemPreview, ResultadoParseoXlsx } from './types';

const MAX_BYTES = 5 * 1024 * 1024;

export type PreviewResult =
  | {
      ok: true;
      items: ItemPreview[];
      descartes: ResultadoParseoXlsx['descartes'];
      cotizacionDetectada: number | null;
      nombreObraDetectado: string | null;
      mapeoColumnas: Record<string, number>;
      metadata: ResultadoParseoXlsx['metadata'];
    }
  | { ok: false; error: string };

export async function parsePreview(form: FormData): Promise<PreviewResult> {
  await requireRole('admin');
  const file = form.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'No se recibió archivo' };
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return { ok: false, error: 'El archivo debe ser .xlsx (Excel moderno).' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `El archivo supera 5 MB (pesa ${(file.size / 1024 / 1024).toFixed(1)} MB).` };
  }
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const parsed = await parseFile(buf, file.name);
    if (parsed.kind !== 'xlsx') {
      return { ok: false, error: 'Esperado XLSX, recibido CSV (no soportado por la UI).' };
    }
    return {
      ok: true,
      items: parsed.result.items,
      descartes: parsed.result.descartes,
      cotizacionDetectada: parsed.result.cotizacionDetectada,
      nombreObraDetectado: parsed.result.nombreObraDetectado,
      mapeoColumnas: parsed.result.mapeoColumnas,
      metadata: parsed.result.metadata,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido al parsear' };
  }
}
```

- [ ] **Step 3: Correr el test (integration tests pueden estar gateados por harness bug — checkear)**

```bash
pnpm test:integration -- parse-preview 2>&1 | head -40
```

Si el harness está roto (ROADMAP § 1.4), correr directo el archivo:

```bash
npx jest tests/integration/import-presupuestos/parse-preview.test.ts --no-coverage
```

Expected: PASS, 3 tests.

- [ ] **Step 4: Commit**

```bash
git add src/features/import-presupuestos/actions.ts tests/integration/import-presupuestos/parse-preview.test.ts
git commit -m "feat(import): parsePreview server action with file validation"
```

---

### Task 13: Server Action `commit-import`

**Files:**
- Modify: `src/features/import-presupuestos/actions.ts`
- Create: `tests/integration/import-presupuestos/commit-import-nueva-obra.test.ts`

- [ ] **Step 1: Test integration failing**

Crear el test (sigue el patrón de Plan 5 integration tests). Validar:
- Crea obra + presupuesto con `import_pendiente=true`
- Crea N items por ítem incluido
- Items con dos costos generan 2 inserts (C.2)
- Audit log queda
- Falla si el `codigoObra` ya existe (en caso nueva obra)
- Si `obraIdExistente` con borrador → soft-delete del anterior, nuevo con `reemplazadoPorImportId`
- Si `obraIdExistente` con firmado → crea adicional

(Por brevedad del plan: el test debe tener 6-8 casos. Subagente puede expandirlo.)

- [ ] **Step 2: Implementar commitImport action**

Agregar a `src/features/import-presupuestos/actions.ts`:

```typescript
import { commitImport, type CommitImportArgs } from '@/../scripts/import-sheets/ejecutor';
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth/current-user';

export async function commitImportAction(args: Omit<CommitImportArgs, 'adminId'>): Promise<
  | { ok: true; obraId: string; presupuestoId: string; itemsCreados: number; redirectTo: string }
  | { ok: false; error: string }
> {
  await requireRole('admin');
  const adminId = await getCurrentUserId();
  try {
    const r = await commitImport({ ...args, adminId });
    const redirectTo = `/obras/${r.obraId}/presupuestos/${r.presupuestoId}`;
    revalidatePath('/obras');
    revalidatePath(`/obras/${r.obraId}`);
    return { ok: true, ...r, redirectTo };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido' };
  }
}
```

- [ ] **Step 3: Correr tests**

```bash
npx jest tests/integration/import-presupuestos/commit-import-nueva-obra.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/import-presupuestos/actions.ts tests/integration/import-presupuestos/
git commit -m "feat(import): commitImportAction with transactional create + audit"
```

---

### Task 14: Server Actions `confirmar-import` y `cancelar-import`

**Files:**
- Modify: `src/features/import-presupuestos/actions.ts`
- Create: `tests/integration/import-presupuestos/confirmar-import.test.ts`
- Create: `tests/integration/import-presupuestos/cancelar-import.test.ts`

- [ ] **Step 1: Tests failing**

`confirmar-import.test.ts`:
- Cambia `import_pendiente` de true a false.
- Crea audit log de confirmación.
- Si ya está confirmado (idempotencia): no falla, devuelve OK.

`cancelar-import.test.ts`:
- Caso obra nueva (un solo presupuesto en la obra): hard-delete obra completa.
- Caso re-import sobre borrador: hard-delete del nuevo, restore (`deletedAt=NULL`) del anterior.
- Caso re-import sobre firmado (adicional): hard-delete del adicional, firmado intacto.

- [ ] **Step 2: Implementar**

Agregar a `actions.ts`:

```typescript
import { eq, and, isNull, isNotNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { obra, presupuesto, itemPresupuesto } from '@/db/schema';
import { logAudit } from '@/features/audit/log';

export async function confirmarImportAction({ presupuestoId }: { presupuestoId: string }) {
  await requireRole('admin');
  const adminId = await getCurrentUserId();
  try {
    const [p] = await db.select().from(presupuesto).where(eq(presupuesto.id, presupuestoId)).limit(1);
    if (!p) return { ok: false as const, error: 'Presupuesto no encontrado' };
    if (!p.importPendiente) return { ok: true as const, alreadyConfirmed: true };

    await db.transaction(async (tx) => {
      await tx.update(presupuesto)
        .set({ importPendiente: false, updatedBy: adminId, updatedAt: new Date() })
        .where(eq(presupuesto.id, presupuestoId));
      await logAudit({
        entidad: 'presupuesto',
        entidadId: presupuestoId,
        accion: 'confirmar_import',
        descripcionHumana: `Import confirmado para presupuesto ${p.tipo} #${p.numero}`,
        usuarioId: adminId,
      });
    });

    revalidatePath(`/obras/${p.obraId}/presupuestos/${presupuestoId}`);
    return { ok: true as const, alreadyConfirmed: false };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : 'Error' };
  }
}

export async function cancelarImportAction({ presupuestoId }: { presupuestoId: string }) {
  await requireRole('admin');
  const adminId = await getCurrentUserId();
  try {
    const [p] = await db.select().from(presupuesto).where(eq(presupuesto.id, presupuestoId)).limit(1);
    if (!p) return { ok: false as const, error: 'Presupuesto no encontrado' };
    if (!p.importPendiente) return { ok: false as const, error: 'No es una importación pendiente' };

    let redirectTo: string;
    await db.transaction(async (tx) => {
      // Caso: re-import (hay un anterior soft-deleted con reemplazado_por_import_id apuntando a este)
      const [anterior] = await tx.select().from(presupuesto)
        .where(eq(presupuesto.reemplazadoPorImportId, presupuestoId))
        .limit(1);

      if (anterior) {
        // Restaurar anterior
        await tx.update(presupuesto)
          .set({ deletedAt: null, reemplazadoPorImportId: null })
          .where(eq(presupuesto.id, anterior.id));
      }

      // Hard delete del presupuesto nuevo (cascade limpia items por ON DELETE CASCADE)
      await tx.delete(presupuesto).where(eq(presupuesto.id, presupuestoId));

      // Caso obra nueva: si era nueva y no quedan más presupuestos, borrar obra
      const restantes = await tx.select().from(presupuesto).where(eq(presupuesto.obraId, p.obraId));
      if (restantes.length === 0) {
        await tx.delete(obra).where(eq(obra.id, p.obraId));
        redirectTo = '/obras';
      } else {
        redirectTo = `/obras/${p.obraId}`;
      }

      await logAudit({
        entidad: 'presupuesto',
        entidadId: presupuestoId,
        accion: 'cancelar_import',
        descripcionHumana: anterior
          ? `Import cancelado, presupuesto anterior restaurado`
          : restantes.length === 0
            ? `Import cancelado, obra ${p.obraId} eliminada`
            : `Import cancelado`,
        usuarioId: adminId,
      });
    });

    revalidatePath('/obras');
    return { ok: true as const, redirectTo: redirectTo! };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : 'Error' };
  }
}
```

- [ ] **Step 3: Correr tests**

```bash
npx jest tests/integration/import-presupuestos/confirmar-import.test.ts
npx jest tests/integration/import-presupuestos/cancelar-import.test.ts
```

Expected: ambos PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/import-presupuestos/actions.ts tests/integration/import-presupuestos/
git commit -m "feat(import): confirmar/cancelar import actions with transactional rollback"
```

---

### Task 15: Componente DropzoneXlsx

**Files:**
- Create: `src/features/import-presupuestos/components/DropzoneXlsx.tsx`

- [ ] **Step 1: Crear archivo**

Copiar el componente del mockup `src/app/preview-importer/page.tsx` (sub-component `DropzoneXlsx`) al nuevo archivo, ajustando imports a paths reales del proyecto. (Ver Anexo 12.2 del spec o el archivo mockup directo).

- [ ] **Step 2: Smoke test (no TDD para componentes UI)**

```bash
pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/import-presupuestos/components/DropzoneXlsx.tsx
git commit -m "feat(import): DropzoneXlsx component"
```

---

### Task 16-20: Componentes restantes

(Cada uno sigue el mismo patrón de Task 15 — copiar del mockup, ajustar imports, tsc, commit.)

- [ ] **Task 16: FormMetadatosObra.tsx** (con `useActionState` y los inputs descriptos en spec § 5.1)
- [ ] **Task 17: PreviewSummary.tsx** (card con totales + descartes expandibles)
- [ ] **Task 18: ConfirmarImportDialog.tsx** (del mockup, conectado a `confirmarImportAction`)
- [ ] **Task 19: CancelarImportDialog.tsx** (del mockup, conectado a `cancelarImportAction`)
- [ ] **Task 20: ImportPendienteBanner.tsx** (del mockup, recibe presupuesto + metadata)
- [ ] **Task 21: ImportRowStatus.tsx** (chip simple, con Tooltip del shadcn nuevo)

---

### Task 22: [PARALLEL-DECISION] Layout de la página `/obras/importar`

**Decisión a tomar**: cómo se distribuyen los elementos del wizard "Nueva obra desde Excel" en una sola pantalla.

Lanzar 2-3 sub-agentes:

> Agent A: "Dropzone arriba, full-width. Una vez parsea, debajo aparece el form de metadatos + summary cards (items / descartes / warnings) lado a lado. Botón 'Importar' al final, sticky."
>
> Agent B: "Layout en dos columnas: izq = dropzone + form metadatos persistente. Der = preview summary que va apareciendo a medida que el archivo se parsea."
>
> Agent C: "Stepper de 3 pasos: Paso 1 = subir archivo, Paso 2 = revisar resumen + ajustar metadatos, Paso 3 = confirmar. Cada paso es una sección visible scrolleable."

Criterios: simplicidad, fluidez (cuántos clicks), claridad de qué falta, comportamiento si subió mal el archivo y quiere cambiarlo.

- [ ] **Step 1**: lanzar agentes con mocks ASCII.
- [ ] **Step 2**: elegir, documentar drawbacks de descartados en spec § 11.

---

### Task 23: Página `/obras/importar` (nueva obra desde Excel)

**Files:**
- Create: `src/app/(internal)/obras/importar/page.tsx`
- Create: `src/app/(internal)/obras/importar/importar-client.tsx`

(Implementar según el layout elegido en Task 22. Server component carga al admin, client component maneja el flujo de archivo + form + submit.)

---

### Task 24: Página `/obras/[id]/importar` (a obra existente)

**Files:**
- Create: `src/app/(internal)/obras/[id]/importar/page.tsx`
- Create: `src/app/(internal)/obras/[id]/importar/importar-client.tsx`

(Reusa los mismos componentes pero NO muestra el form de metadatos de obra — usa los de la obra existente. Detecta si la obra tiene presupuesto borrador o firmado y muestra diálogo de "reemplazar borrador" o "crear adicional" antes de redirigir al editor.)

---

### Task 25: Botones de entrada en `/obras` y `/obras/[id]`

**Files:**
- Modify: `src/app/(internal)/obras/page.tsx`
- Modify: `src/app/(internal)/obras/[id]/page.tsx`

Agregar el `<Link>` con `buttonVariants()` (recordar: shadcn base-nova no soporta `asChild`).

---

### Task 26: Integración con editor — detectar `import_pendiente`

**Files:**
- Modify: `src/features/presupuestos/components/editor-form.tsx`
- Modify: `src/features/presupuestos/components/items-tabla.tsx`
- Modify: `src/features/presupuestos/components/item-row.tsx`

Pasos:
1. En `editor-form.tsx`: recibir `presupuesto` como prop, si `importPendiente=true` montar `<ImportPendienteBanner>` sticky arriba.
2. En `items-tabla.tsx`: si `importPendiente`, agregar columna `ImportRowStatus` antes de "Rubro". Parsear `item.notas` con regex `/^\[import\] ([^|]+)\|/` para extraer warnings.
3. En `item-row.tsx`: renderizar `<ImportRowStatus filaExcel={...} estado={...}>` extraído de las notas.

(Detalle de cada cambio en sub-agentes. Sin tests unitarios — los E2E lo cubren.)

---

### Task 27: Permisos rol `operador`

**Files:**
- Modify: `src/features/presupuestos/components/editor-form.tsx`
- Modify: `src/app/(internal)/obras/page.tsx`
- Modify: `src/app/(internal)/obras/[id]/page.tsx`

Si el usuario es `operador` y `presupuesto.importPendiente=true`: deshabilitar inputs y ocultar botones Confirmar/Cancelar. Banner cambia a "Importación pendiente de revisión por un admin".

Ocultar botones "Importar..." en listado y detalle de obra cuando el rol es `operador`.

---

### Task 28: E2E happy path — nueva obra desde Excel

**Files:**
- Create: `tests/e2e/import-nueva-obra.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import path from 'path';

test('admin sube Excel, revisa preview, confirma import', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name=email]', 'admin@macna.local');
  await page.fill('input[name=password]', 'ChangeMe!Local2026');
  await page.click('button[type=submit]');
  await page.waitForURL('/obras');

  await page.click('text=Nueva obra desde Excel');
  await page.waitForURL('/obras/importar');

  const fixtureFile = path.join(process.cwd(), 'scripts/import-sheets/__fixtures__/synthetic-small.xlsx');
  await page.locator('input[type=file]').setInputFiles(fixtureFile);

  await expect(page.locator('text=Cotización detectada')).toBeVisible({ timeout: 5000 });

  await page.fill('input[name=clienteNombre]', 'Cliente E2E');
  await page.click('text=Importar');
  await page.click('text=Confirmar', { timeout: 5000 });

  await page.waitForURL(/\/obras\/[^/]+\/presupuestos\/[^/]+/);
  await expect(page.locator('text=Estás revisando una importación')).toBeVisible();

  await page.click('text=Confirmar importación');
  await page.click('text=Confirmar'); // diálogo de confirmación final

  await expect(page.locator('text=Estás revisando una importación')).not.toBeVisible({ timeout: 5000 });
});
```

- [ ] Correr: `pnpm test:e2e -- import-nueva-obra`.

---

### Task 29-31: Resto de E2E

- [ ] **Task 29: import-reimport.spec.ts** — obra existente con borrador, re-import reemplaza + queda snapshot.
- [ ] **Task 30: import-cancelar.spec.ts** — cancel borra la obra (caso nueva) o restaura el anterior (caso re-import).
- [ ] **Task 31: import-permisos.spec.ts** — login operador no ve botones.

---

### Task 32: Cleanup temporal

**Files:**
- Delete: `src/app/preview-importer/page.tsx`
- Modify: `src/proxy.ts:50`

- [ ] **Step 1: Eliminar mockup**

```bash
rm -rf src/app/preview-importer/
```

- [ ] **Step 2: Revertir proxy publicPaths**

En `src/proxy.ts:50`:

```typescript
const publicPaths = ['/login', '/auth/callback'];
```

(Remover `'/preview-importer'`.)

- [ ] **Step 3: Commit**

```bash
git add src/app/ src/proxy.ts
git commit -m "chore: remove temporary preview-importer mockup"
```

---

### Task 33: Update docs y marcar hecho

**Files:**
- Modify: `SETUP_PENDIENTE.md`
- Modify: `docs/ROADMAP.md`
- Modify: `~/.claude/projects/-Users-lzayas-Desktop-Pelu/memory/project_importer_xlsx_decisiones.md`

- [ ] **Step 1: SETUP_PENDIENTE.md § 6** — marcar 6.1, 6.2, 6.3 como `[x]`. Agregar nota de "smoke manual sigue pendiente".

- [ ] **Step 2: ROADMAP.md § 1.1** — cambiar estado a `✅ HECHO (YYYY-MM-DD)`. Mover backlog interno (C.3, wizard diff, etc.) a § 1.5 ya existente.

- [ ] **Step 3: Memory** — actualizar la entrada del importer en MEMORY.md para reflejar que está hecho.

- [ ] **Step 4: Commit**

```bash
git add SETUP_PENDIENTE.md docs/ROADMAP.md
git commit -m "docs: importer XLSX completado, actualizar SETUP_PENDIENTE y ROADMAP"
```

---

### Task 34: Smoke manual end-to-end

**No es código** — checklist humano. El user (no el agente) debe:

- [ ] Login admin → `/obras` → "Nueva obra desde Excel"
- [ ] Subir el XLSX real → verificar preview tiene cotización 1500, items > 50, descartes > 100
- [ ] Completar form (código, cliente) → "Importar"
- [ ] En editor: ver banner sticky, columna de estado por fila, hover tooltips
- [ ] Editar 1 item, autosave, verificar persiste
- [ ] Click "Confirmar importación" → diálogo → confirmar → banner desaparece
- [ ] Verificar audit log en `/configuracion/auditoria`
- [ ] Probar "Cancelar importación" en otra obra nueva: verificar redirect y que la obra desaparece
- [ ] Probar re-import: en obra con borrador, subir Excel distinto, ver mensaje "reemplazar", confirmar, verificar nuevo borrador y anterior soft-deleted
- [ ] Login operador (si está creado): verificar que NO ve botones de import, y si entra a un presupuesto con import_pendiente=true ve banner read-only

---

## Self-review (al ejecutor del plan)

Antes de mergear:
- [ ] `pnpm tsc --noEmit` sin errores
- [ ] `pnpm test:unit` — todos pasan
- [ ] `pnpm test:integration` — todos pasan (o gateados explícitamente si harness aún roto)
- [ ] `pnpm test:e2e -- import-` — los 4 E2E pasan
- [ ] `pnpm build` — build OK
- [ ] Mockup `/preview-importer` borrado
- [ ] `src/proxy.ts` sin `/preview-importer` en publicPaths
- [ ] SETUP_PENDIENTE y ROADMAP actualizados
- [ ] Smoke manual del usuario completado

---

## Execution choice

**Plan complete and saved to `docs/superpowers/plans/2026-05-12-plan-importer-xlsx-real.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for this plan because tasks are mostly independent within each phase and benefit from focused context per task. Decisiones marcadas `[PARALLEL-DECISION]` se resuelven con 2-3 sub-agentes evaluando alternativas (Tasks 11, 22).

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Más lento porque carga todo el contexto en mi sesión principal.

**Which approach?**
