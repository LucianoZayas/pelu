# Plan 5 — Importador + Auditoría + Export

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Asume:** Planes 1, 2, 3 y 4 mergeados.

**Goal:**
1. **Importador**: CLI `pnpm import-sheets <csv> --codigo-obra M-2026-001 [--dry-run]` levanta una obra desde CSV (rubro, descripción, unidad, cantidad, costo_unitario, moneda_costo, markup, notas). Idempotente por código de obra.
2. **Auditoría**: UI Admin en `/configuracion/auditoria` con filtros (entidad, usuario, rango, acción) + diff expandible.
3. **Export**: botón "Exportar XLSX" en lista de obras, detalle de obra y auditoría, con estructura idéntica a la planilla actual.

**Architecture:** Importador es un script Node ejecutado con `tsx` que reusa los servicios de snapshots/markup/currency. Acepta `--dry-run` para reportar sin escribir. La auditoría aprovecha la tabla `audit_log` ya poblada por planes anteriores; sólo agrega UI. El export usa `exceljs` (streaming) para generar archivos sin cargar todo en memoria.

**Tech Stack:** `tsx`, `csv-parse`, `exceljs`, Drizzle, shadcn.

---

## File Structure

```
src/features/audit/
  log.ts                  # ya existe (Plan 2)
  queries.ts              # buscarLogs(filtros)
  components/
    auditoria-table.tsx
    auditoria-filtros.tsx
src/app/(internal)/configuracion/auditoria/page.tsx

scripts/import-sheets/
  index.ts                # entrypoint CLI
  parse.ts                # CSV → tipo crudo
  validate.ts             # validación + matching de rubros
  ejecutor.ts             # crea obra + presupuesto + items con snapshots
  tipos.ts
fixtures/
  obra-ejemplo.csv

src/lib/export/
  xlsx-obras.ts           # exporta lista de obras
  xlsx-obra.ts            # exporta una obra (presupuestos + items)
  xlsx-auditoria.ts
src/app/api/export/obras/route.ts
src/app/api/export/obras/[id]/route.ts
src/app/api/export/auditoria/route.ts

tests/unit/
  import-parse.test.ts
  import-validate.test.ts
tests/integration/
  import-end-to-end.test.ts
  audit-queries.test.ts
  export-obras.test.ts
```

---

## Task 1: Auditoría — queries y tabla

**Files:**
- Create: `src/features/audit/queries.ts`, `src/features/audit/components/auditoria-table.tsx`, `auditoria-filtros.tsx`, `src/app/(internal)/configuracion/auditoria/page.tsx`, `tests/integration/audit-queries.test.ts`

- [ ] **Step 1: Test fallido**

```ts
// tests/integration/audit-queries.test.ts
import { resetDb } from './setup';
import { makeUsuario } from './factories';
import { logAudit } from '@/features/audit/log';
import { buscarLogs } from '@/features/audit/queries';
import { randomUUID } from 'crypto';

describe('audit queries', () => {
  beforeEach(async () => { await resetDb(); });

  it('filtra por entidad y rango', async () => {
    const u = await makeUsuario('admin');
    const id1 = randomUUID(), id2 = randomUUID();
    await logAudit({ entidad: 'obra', entidadId: id1, accion: 'crear', usuarioId: u.id });
    await logAudit({ entidad: 'presupuesto', entidadId: id2, accion: 'firmar', usuarioId: u.id });

    const todos = await buscarLogs({});
    expect(todos.length).toBe(2);

    const soloObras = await buscarLogs({ entidad: 'obra' });
    expect(soloObras).toHaveLength(1);

    const porUsuario = await buscarLogs({ usuarioId: u.id });
    expect(porUsuario).toHaveLength(2);
  });

  it('paginación: limit + offset', async () => {
    const u = await makeUsuario('admin');
    for (let i = 0; i < 5; i++) {
      await logAudit({ entidad: 'obra', entidadId: randomUUID(), accion: 'crear', usuarioId: u.id });
    }
    const page1 = await buscarLogs({ limit: 2, offset: 0 });
    const page2 = await buscarLogs({ limit: 2, offset: 2 });
    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    expect(page1[0].id).not.toBe(page2[0].id);
  });
});
```

- [ ] **Step 2: Implementación**

```ts
// src/features/audit/queries.ts
import { and, desc, eq, gte, lte, SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditLog, usuario } from '@/db/schema';

interface BuscarFiltros {
  entidad?: 'obra' | 'presupuesto' | 'item_presupuesto' | 'usuario' | 'cliente_token' | 'rubro';
  accion?: 'crear' | 'editar' | 'eliminar' | 'firmar' | 'cancelar' | 'regenerar_token';
  usuarioId?: string;
  desde?: Date;
  hasta?: Date;
  limit?: number;
  offset?: number;
}

export async function buscarLogs(f: BuscarFiltros) {
  const conds: SQL[] = [];
  if (f.entidad) conds.push(eq(auditLog.entidad, f.entidad));
  if (f.accion) conds.push(eq(auditLog.accion, f.accion));
  if (f.usuarioId) conds.push(eq(auditLog.usuarioId, f.usuarioId));
  if (f.desde) conds.push(gte(auditLog.timestamp, f.desde));
  if (f.hasta) conds.push(lte(auditLog.timestamp, f.hasta));

  return db.select({
    log: auditLog,
    usuarioNombre: usuario.nombre,
    usuarioEmail: usuario.email,
  }).from(auditLog)
    .leftJoin(usuario, eq(auditLog.usuarioId, usuario.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLog.timestamp))
    .limit(f.limit ?? 100)
    .offset(f.offset ?? 0);
}
```

- [ ] **Step 3: Componentes**

```tsx
// src/features/audit/components/auditoria-filtros.tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function AuditoriaFiltros() {
  const router = useRouter();
  const sp = useSearchParams();

  function update(key: string, val: string) {
    const next = new URLSearchParams(sp);
    if (val) next.set(key, val); else next.delete(key);
    router.push(`?${next.toString()}`);
  }

  return (
    <div className="flex gap-3 items-end mb-4">
      <div>
        <Label>Entidad</Label>
        <Select value={sp.get('entidad') ?? ''} onValueChange={(v) => update('entidad', v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            <SelectItem value="obra">Obra</SelectItem>
            <SelectItem value="presupuesto">Presupuesto</SelectItem>
            <SelectItem value="usuario">Usuario</SelectItem>
            <SelectItem value="cliente_token">Token cliente</SelectItem>
            <SelectItem value="rubro">Rubro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Acción</Label>
        <Select value={sp.get('accion') ?? ''} onValueChange={(v) => update('accion', v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            <SelectItem value="crear">Crear</SelectItem>
            <SelectItem value="editar">Editar</SelectItem>
            <SelectItem value="firmar">Firmar</SelectItem>
            <SelectItem value="cancelar">Cancelar</SelectItem>
            <SelectItem value="eliminar">Eliminar</SelectItem>
            <SelectItem value="regenerar_token">Regenerar token</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Desde</Label>
        <Input type="date" defaultValue={sp.get('desde') ?? ''} onBlur={(e) => update('desde', e.target.value)} />
      </div>
      <div>
        <Label>Hasta</Label>
        <Input type="date" defaultValue={sp.get('hasta') ?? ''} onBlur={(e) => update('hasta', e.target.value)} />
      </div>
      <Button variant="outline" asChild><a href={`/api/export/auditoria?${sp.toString()}`}>Exportar XLSX</a></Button>
    </div>
  );
}
```

```tsx
// src/features/audit/components/auditoria-table.tsx
'use client';
import { Fragment, useState } from 'react';

type Row = {
  log: { id: string; entidad: string; entidadId: string; accion: string; diff: any; descripcionHumana: string | null; timestamp: Date };
  usuarioNombre: string | null;
  usuarioEmail: string | null;
};

export function AuditoriaTable({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <table className="w-full text-sm border">
      <thead className="bg-slate-50">
        <tr>
          <th className="text-left p-2">Cuándo</th>
          <th className="text-left p-2">Quién</th>
          <th className="text-left p-2">Entidad</th>
          <th className="text-left p-2">Acción</th>
          <th className="text-left p-2">Descripción</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Fragment key={r.log.id}>
            <tr className="border-t cursor-pointer hover:bg-slate-50" onClick={() => setOpen(open === r.log.id ? null : r.log.id)}>
              <td className="p-2 font-mono text-xs">{new Date(r.log.timestamp).toLocaleString('es-AR')}</td>
              <td className="p-2">{r.usuarioNombre ?? r.usuarioEmail ?? '?'}</td>
              <td className="p-2">{r.log.entidad}</td>
              <td className="p-2">{r.log.accion}</td>
              <td className="p-2">{r.log.descripcionHumana ?? <em className="text-muted-foreground">sin descripción</em>}</td>
            </tr>
            {open === r.log.id && r.log.diff && (
              <tr className="bg-slate-50">
                <td colSpan={5} className="p-3"><pre className="text-xs whitespace-pre-wrap">{JSON.stringify(r.log.diff, null, 2)}</pre></td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
```

```tsx
// src/app/(internal)/configuracion/auditoria/page.tsx
import { requireRole } from '@/lib/auth/require';
import { buscarLogs } from '@/features/audit/queries';
import { AuditoriaTable } from '@/features/audit/components/auditoria-table';
import { AuditoriaFiltros } from '@/features/audit/components/auditoria-filtros';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole('admin');
  const sp = await searchParams;
  const rows = await buscarLogs({
    entidad: sp.entidad as any || undefined,
    accion: sp.accion as any || undefined,
    desde: sp.desde ? new Date(sp.desde) : undefined,
    hasta: sp.hasta ? new Date(sp.hasta + 'T23:59:59') : undefined,
    limit: 200,
  });
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Auditoría</h1>
      <AuditoriaFiltros />
      <AuditoriaTable rows={rows} />
    </div>
  );
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm test:integration -- audit-queries
git add src/features/audit/ src/app/\(internal\)/configuracion/auditoria/ tests/integration/audit-queries.test.ts
git commit -m "feat(audit): UI con filtros y diff expandible"
```

---

## Task 2: Export — librería + helpers comunes

**Files:**
- Create: `src/lib/export/xlsx-obras.ts`, `xlsx-obra.ts`

- [ ] **Step 1: Instalar exceljs**

```bash
pnpm add exceljs
```

- [ ] **Step 2: Export lista de obras**

```ts
// src/lib/export/xlsx-obras.ts
import ExcelJS from 'exceljs';
import { listarObras } from '@/features/obras/queries';

export async function buildXlsxObras(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Obras');
  ws.columns = [
    { header: 'Código', key: 'codigo', width: 14 },
    { header: 'Nombre', key: 'nombre', width: 40 },
    { header: 'Cliente', key: 'clienteNombre', width: 30 },
    { header: 'Email cliente', key: 'clienteEmail', width: 26 },
    { header: 'Estado', key: 'estado', width: 12 },
    { header: 'Moneda base', key: 'monedaBase', width: 10 },
    { header: 'Fecha inicio', key: 'fechaInicio', width: 14 },
    { header: 'Fecha fin estim.', key: 'fechaFinEstimada', width: 16 },
    { header: 'Honorarios %', key: 'porcentajeHonorarios', width: 12 },
    { header: 'Creado', key: 'createdAt', width: 16 },
  ];
  ws.getRow(1).font = { bold: true };

  const obras = await listarObras();
  obras.forEach((o) => ws.addRow({
    ...o,
    fechaInicio: o.fechaInicio?.toISOString().slice(0, 10),
    fechaFinEstimada: o.fechaFinEstimada?.toISOString().slice(0, 10),
    createdAt: o.createdAt.toISOString().slice(0, 10),
  }));

  return Buffer.from(await wb.xlsx.writeBuffer());
}
```

- [ ] **Step 3: Export obra detallada**

```ts
// src/lib/export/xlsx-obra.ts
import ExcelJS from 'exceljs';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { presupuesto, itemPresupuesto, rubro } from '@/db/schema';
import { getObra } from '@/features/obras/queries';

export async function buildXlsxObra(obraId: string): Promise<Buffer | null> {
  const obra = await getObra(obraId);
  if (!obra) return null;

  const wb = new ExcelJS.Workbook();
  const wsResumen = wb.addWorksheet('Resumen');
  wsResumen.addRows([
    ['Código', obra.codigo],
    ['Nombre', obra.nombre],
    ['Cliente', obra.clienteNombre],
    ['Estado', obra.estado],
    ['Moneda', obra.monedaBase],
  ]);

  const presupuestos = await db.select().from(presupuesto).where(eq(presupuesto.obraId, obraId)).orderBy(asc(presupuesto.numero));
  for (const p of presupuestos) {
    const ws = wb.addWorksheet(`Presupuesto ${p.numero}`);
    ws.addRow(['Tipo', p.tipo]);
    ws.addRow(['Estado', p.estado]);
    ws.addRow(['Cotización USD', p.cotizacionUsd]);
    ws.addRow(['Markup default %', p.markupDefaultPorcentaje]);
    ws.addRow(['Total cliente', p.totalClienteCalculado ?? '-']);
    ws.addRow([]);

    ws.addRow(['Rubro', 'Descripción', 'Unidad', 'Cantidad', 'Costo U.', 'Moneda costo', 'Markup %', 'Precio U. cliente', 'Subtotal']);
    ws.getRow(7).font = { bold: true };
    const items = await db.select({ item: itemPresupuesto, rubro }).from(itemPresupuesto)
      .leftJoin(rubro, eq(itemPresupuesto.rubroId, rubro.id))
      .where(eq(itemPresupuesto.presupuestoId, p.id))
      .orderBy(asc(itemPresupuesto.orden));
    for (const { item, rubro: r } of items) {
      ws.addRow([
        r?.nombre, item.descripcion, item.unidad, item.cantidad,
        item.costoUnitario, item.costoUnitarioMoneda,
        item.markupEfectivoPorcentaje, item.precioUnitarioCliente,
        Number(item.precioUnitarioCliente) * Number(item.cantidad),
      ]);
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
```

- [ ] **Step 4: Export de auditoría**

```ts
// src/lib/export/xlsx-auditoria.ts
import ExcelJS from 'exceljs';
import { buscarLogs } from '@/features/audit/queries';

export async function buildXlsxAuditoria(filtros: Parameters<typeof buscarLogs>[0]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Auditoría');
  ws.columns = [
    { header: 'Timestamp', key: 'timestamp', width: 22 },
    { header: 'Usuario', key: 'usuario', width: 30 },
    { header: 'Entidad', key: 'entidad', width: 14 },
    { header: 'Entidad ID', key: 'entidadId', width: 38 },
    { header: 'Acción', key: 'accion', width: 14 },
    { header: 'Descripción', key: 'descripcion', width: 60 },
    { header: 'Diff', key: 'diff', width: 60 },
  ];
  const rows = await buscarLogs({ ...filtros, limit: 10_000 });
  for (const r of rows) {
    ws.addRow({
      timestamp: r.log.timestamp.toISOString(),
      usuario: r.usuarioNombre ?? r.usuarioEmail,
      entidad: r.log.entidad,
      entidadId: r.log.entidadId,
      accion: r.log.accion,
      descripcion: r.log.descripcionHumana,
      diff: JSON.stringify(r.log.diff),
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/
git commit -m "feat(export): xlsx para obras (lista + detalle) + auditoría"
```

---

## Task 3: API routes de export

**Files:**
- Create: `src/app/api/export/obras/route.ts`, `src/app/api/export/obras/[id]/route.ts`, `src/app/api/export/auditoria/route.ts`

- [ ] **Step 1: Lista de obras**

```ts
// src/app/api/export/obras/route.ts
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/require';
import { buildXlsxObras } from '@/lib/export/xlsx-obras';

export const runtime = 'nodejs';

export async function GET() {
  await requireSession();
  const buf = await buildXlsxObras();
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="obras.xlsx"`,
    },
  });
}
```

- [ ] **Step 2: Obra detallada**

```ts
// src/app/api/export/obras/[id]/route.ts
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/require';
import { buildXlsxObra } from '@/lib/export/xlsx-obra';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const buf = await buildXlsxObra(id);
  if (!buf) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="obra-${id}.xlsx"`,
    },
  });
}
```

- [ ] **Step 3: Auditoría (solo Admin)**

```ts
// src/app/api/export/auditoria/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/require';
import { buildXlsxAuditoria } from '@/lib/export/xlsx-auditoria';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  await requireRole('admin');
  const sp = req.nextUrl.searchParams;
  const buf = await buildXlsxAuditoria({
    entidad: (sp.get('entidad') as any) || undefined,
    accion: (sp.get('accion') as any) || undefined,
    desde: sp.get('desde') ? new Date(sp.get('desde')!) : undefined,
    hasta: sp.get('hasta') ? new Date(sp.get('hasta')! + 'T23:59:59') : undefined,
  });
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="auditoria.xlsx"`,
    },
  });
}
```

- [ ] **Step 4: Botones en UI**

En `/obras/page.tsx` agregar `<Button asChild variant="outline"><a href="/api/export/obras">Exportar XLSX</a></Button>` al lado de "Nueva obra".

En `/obras/[id]/page.tsx` agregar `<Button asChild variant="outline"><a href={\`/api/export/obras/\${id}\`}>Exportar XLSX</a></Button>`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/export/ src/app/\(internal\)/obras/
git commit -m "feat(export): rutas API + botones UI"
```

---

## Task 4: Test integración del export

**Files:**
- Create: `tests/integration/export-obras.test.ts`

- [ ] **Step 1: Test**

```ts
// tests/integration/export-obras.test.ts
import { resetDb } from './setup';
import { makeUsuario, makeObra } from './factories';
import ExcelJS from 'exceljs';
import { buildXlsxObras } from '@/lib/export/xlsx-obras';

describe('xlsx obras', () => {
  beforeEach(async () => { await resetDb(); });

  it('genera xlsx con headers + 1 fila por obra', async () => {
    const u = await makeUsuario('admin');
    await makeObra(u.id, { nombre: 'Casa A', codigo: 'M-2026-001' });
    await makeObra(u.id, { nombre: 'Casa B', codigo: 'M-2026-002' });

    const buf = await buildXlsxObras();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet('Obras')!;
    expect(ws.rowCount).toBe(3); // 1 header + 2 obras
    expect(ws.getRow(2).getCell('codigo').value).toBe('M-2026-001');
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
pnpm test:integration -- export-obras
git add tests/integration/export-obras.test.ts
git commit -m "test(export): xlsx obras"
```

---

## Task 5: Importador — tipos + parse CSV (TDD)

**Files:**
- Create: `scripts/import-sheets/tipos.ts`, `parse.ts`, `tests/unit/import-parse.test.ts`, `fixtures/obra-ejemplo.csv`

- [ ] **Step 1: Instalar `csv-parse`**

```bash
pnpm add csv-parse
```

- [ ] **Step 2: Tipos**

```ts
// scripts/import-sheets/tipos.ts
export interface FilaCsv {
  rubro: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  costo_unitario: string;
  moneda_costo: string;
  markup: string; // puede ser vacío
  notas: string;
}
```

- [ ] **Step 3: Fixture**

```csv
rubro,descripcion,unidad,cantidad,costo_unitario,moneda_costo,markup,notas
Demoliciones,Demolición de muro existente,m2,20,15.00,USD,,
Albañilería,Mampostería 0.30 m,m2,40,35.00,USD,30,
Instalaciones / Eléctrica,Tablero principal,gl,1,800,USD,25,Incluye térmicas
```

(Guardar en `fixtures/obra-ejemplo.csv`.)

- [ ] **Step 4: Test fallido**

```ts
// tests/unit/import-parse.test.ts
import { parseCsv } from '@/../scripts/import-sheets/parse';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('import.parseCsv', () => {
  it('parsea fixture con 3 filas', async () => {
    const buf = readFileSync(resolve(process.cwd(), 'fixtures/obra-ejemplo.csv'));
    const filas = await parseCsv(buf);
    expect(filas).toHaveLength(3);
    expect(filas[0].rubro).toBe('Demoliciones');
    expect(filas[2].rubro).toBe('Instalaciones / Eléctrica');
    expect(filas[0].markup).toBe('');
    expect(filas[1].markup).toBe('30');
  });

  it('lanza si falta columna obligatoria', async () => {
    const csv = Buffer.from('rubro,descripcion\nA,B');
    await expect(parseCsv(csv)).rejects.toThrow();
  });
});
```

- [ ] **Step 5: Implementación**

```ts
// scripts/import-sheets/parse.ts
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
    rubro: r.rubro, descripcion: r.descripcion, unidad: r.unidad,
    cantidad: r.cantidad, costo_unitario: r.costo_unitario,
    moneda_costo: r.moneda_costo, markup: r.markup, notas: r.notas ?? '',
  }));
}
```

- [ ] **Step 6: Run + commit**

```bash
pnpm test:unit -- import-parse
git add scripts/import-sheets/parse.ts scripts/import-sheets/tipos.ts fixtures/obra-ejemplo.csv tests/unit/import-parse.test.ts
git commit -m "feat(import): csv parse + fixture + tests"
```

---

## Task 6: Importador — validate (TDD)

**Files:**
- Create: `scripts/import-sheets/validate.ts`, `tests/unit/import-validate.test.ts`

- [ ] **Step 1: Test**

```ts
// tests/unit/import-validate.test.ts
import { validarFila } from '@/../scripts/import-sheets/validate';

describe('import.validarFila', () => {
  it('válida cuando todo está en regla', () => {
    expect(validarFila({
      rubro: 'X', descripcion: 'Y', unidad: 'm2',
      cantidad: '1', costo_unitario: '100', moneda_costo: 'USD',
      markup: '', notas: '',
    }, 0)).toEqual({ ok: true });
  });

  it('rechaza unidad inválida', () => {
    const r = validarFila({
      rubro: 'X', descripcion: 'Y', unidad: 'XX',
      cantidad: '1', costo_unitario: '100', moneda_costo: 'USD', markup: '', notas: '',
    }, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/unidad/);
  });

  it('rechaza cantidad no numérica', () => {
    const r = validarFila({
      rubro: 'X', descripcion: 'Y', unidad: 'm2',
      cantidad: 'abc', costo_unitario: '100', moneda_costo: 'USD', markup: '', notas: '',
    }, 0);
    expect(r.ok).toBe(false);
  });

  it('rechaza moneda no soportada', () => {
    const r = validarFila({
      rubro: 'X', descripcion: 'Y', unidad: 'm2',
      cantidad: '1', costo_unitario: '100', moneda_costo: 'EUR', markup: '', notas: '',
    }, 0);
    expect(r.ok).toBe(false);
  });

  it('rechaza descripción vacía', () => {
    const r = validarFila({
      rubro: 'X', descripcion: '', unidad: 'm2',
      cantidad: '1', costo_unitario: '100', moneda_costo: 'USD', markup: '', notas: '',
    }, 0);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Implementación**

```ts
// scripts/import-sheets/validate.ts
import type { FilaCsv } from './tipos';

const UNIDADES = ['m2', 'm3', 'hs', 'gl', 'u', 'ml', 'kg'] as const;
const MONEDAS = ['USD', 'ARS'] as const;

export type ValidacionResult = { ok: true } | { ok: false; error: string };

export function validarFila(f: FilaCsv, indice: number): ValidacionResult {
  if (!f.rubro?.trim()) return { ok: false, error: `[fila ${indice + 1}] rubro vacío` };
  if (!f.descripcion?.trim()) return { ok: false, error: `[fila ${indice + 1}] descripción vacía` };
  if (!UNIDADES.includes(f.unidad as any)) return { ok: false, error: `[fila ${indice + 1}] unidad inválida: ${f.unidad}` };
  if (!/^\d+(\.\d+)?$/.test(f.cantidad)) return { ok: false, error: `[fila ${indice + 1}] cantidad no numérica: ${f.cantidad}` };
  if (!/^\d+(\.\d+)?$/.test(f.costo_unitario)) return { ok: false, error: `[fila ${indice + 1}] costo_unitario no numérico: ${f.costo_unitario}` };
  if (!MONEDAS.includes(f.moneda_costo as any)) return { ok: false, error: `[fila ${indice + 1}] moneda_costo inválida: ${f.moneda_costo}` };
  if (f.markup && !/^-?\d+(\.\d+)?$/.test(f.markup)) return { ok: false, error: `[fila ${indice + 1}] markup no numérico: ${f.markup}` };
  return { ok: true };
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm test:unit -- import-validate
git add scripts/import-sheets/validate.ts tests/unit/import-validate.test.ts
git commit -m "feat(import): validación por fila + tests"
```

---

## Task 7: Importador — ejecutor (resolución de rubros + creación end-to-end)

**Files:**
- Create: `scripts/import-sheets/ejecutor.ts`, `tests/integration/import-end-to-end.test.ts`

- [ ] **Step 1: Test fallido**

```ts
// tests/integration/import-end-to-end.test.ts
import 'dotenv/config';
import { resetDb } from './setup';
import { makeUsuario } from './factories';
import { db } from '@/db/client';
import { obra, presupuesto, itemPresupuesto, rubro } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ejecutarImport } from '@/../scripts/import-sheets/ejecutor';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('importador end-to-end', () => {
  beforeEach(async () => { await resetDb(); });

  it('importa fixture, crea obra + presupuesto + 3 items', async () => {
    const admin = await makeUsuario('admin');
    const csv = readFileSync(resolve(process.cwd(), 'fixtures/obra-ejemplo.csv'));

    const r = await ejecutarImport({
      buf: csv, codigoObra: 'M-2026-IMP', adminId: admin.id, dryRun: false,
      cotizacionUsd: '1200', markupDefault: '30',
    });
    expect(r.ok).toBe(true);

    const [o] = await db.select().from(obra).where(eq(obra.codigo, 'M-2026-IMP'));
    expect(o).toBeDefined();
    const [p] = await db.select().from(presupuesto).where(eq(presupuesto.obraId, o.id));
    expect(p.tipo).toBe('original');
    const items = await db.select().from(itemPresupuesto).where(eq(itemPresupuesto.presupuestoId, p.id));
    expect(items).toHaveLength(3);
  });

  it('--dry-run no escribe nada', async () => {
    const admin = await makeUsuario('admin');
    const csv = readFileSync(resolve(process.cwd(), 'fixtures/obra-ejemplo.csv'));
    await ejecutarImport({
      buf: csv, codigoObra: 'M-2026-DRY', adminId: admin.id, dryRun: true,
      cotizacionUsd: '1200', markupDefault: '30',
    });
    const all = await db.select().from(obra);
    expect(all.find((o) => o.codigo === 'M-2026-DRY')).toBeUndefined();
  });

  it('rechaza si codigo_obra ya existe', async () => {
    const admin = await makeUsuario('admin');
    const csv = readFileSync(resolve(process.cwd(), 'fixtures/obra-ejemplo.csv'));
    await ejecutarImport({ buf: csv, codigoObra: 'M-2026-DUP', adminId: admin.id, dryRun: false, cotizacionUsd: '1200', markupDefault: '30' });
    const r = await ejecutarImport({ buf: csv, codigoObra: 'M-2026-DUP', adminId: admin.id, dryRun: false, cotizacionUsd: '1200', markupDefault: '30' });
    expect(r.ok).toBe(false);
  });

  it('crea rubro nuevo con creado_por_importador=true si no existe', async () => {
    const admin = await makeUsuario('admin');
    const csv = readFileSync(resolve(process.cwd(), 'fixtures/obra-ejemplo.csv'));
    await ejecutarImport({ buf: csv, codigoObra: 'M-2026-RUB', adminId: admin.id, dryRun: false, cotizacionUsd: '1200', markupDefault: '30' });
    const rubros = await db.select().from(rubro).where(eq(rubro.creadoPorImportador, true));
    expect(rubros.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implementación**

```ts
// scripts/import-sheets/ejecutor.ts
import { randomBytes } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { obra, presupuesto, itemPresupuesto, rubro } from '@/db/schema';
import { D, toDb } from '@/lib/money/decimal';
import { calcularSnapshotItem, type PresupuestoCtx } from '@/features/presupuestos/services/snapshots';
import { logAudit } from '@/features/audit/log';
import { parseCsv } from './parse';
import { validarFila } from './validate';

interface Args {
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

type Result = { ok: true; obraId?: string; itemsImportados: number } | { ok: false; errores: string[] };

export async function ejecutarImport(args: Args): Promise<Result> {
  const filas = await parseCsv(args.buf);

  // Validación
  const errores: string[] = [];
  filas.forEach((f, i) => {
    const v = validarFila(f, i);
    if (!v.ok) errores.push(v.error);
  });
  if (errores.length) return { ok: false, errores };

  // Idempotencia
  const [exists] = await db.select({ id: obra.id }).from(obra).where(eq(obra.codigo, args.codigoObra)).limit(1);
  if (exists) return { ok: false, errores: [`obra con código ${args.codigoObra} ya existe`] };

  // Resolución de rubros (crear los faltantes)
  const rubrosCache = new Map<string, string>();
  for (const f of filas) {
    const nombre = f.rubro.trim();
    if (rubrosCache.has(nombre)) continue;
    const [existing] = await db.select().from(rubro).where(eq(rubro.nombre, nombre)).limit(1);
    if (existing) {
      rubrosCache.set(nombre, existing.id);
    } else if (!args.dryRun) {
      const [created] = await db.insert(rubro).values({
        nombre, orden: 999, activo: true, creadoPorImportador: true,
      }).returning();
      rubrosCache.set(nombre, created.id);
    } else {
      rubrosCache.set(nombre, '__DRY__');
    }
  }

  if (args.dryRun) {
    console.log(`[dry-run] obra ${args.codigoObra} importaría con ${filas.length} items y ${[...new Set(filas.map((f) => f.rubro))].length} rubros distintos`);
    return { ok: true, itemsImportados: filas.length };
  }

  // Creación
  const [oCreated] = await db.insert(obra).values({
    codigo: args.codigoObra,
    nombre: args.nombreObra ?? args.codigoObra,
    clienteNombre: args.clienteNombre ?? 'Cliente importado',
    estado: 'borrador',
    monedaBase: args.monedaBase ?? 'USD',
    porcentajeHonorarios: '16',
    cotizacionUsdInicial: args.cotizacionUsd,
    clienteToken: randomBytes(32).toString('base64url'),
    createdBy: args.adminId, updatedBy: args.adminId,
  }).returning();

  const [pCreated] = await db.insert(presupuesto).values({
    obraId: oCreated.id, tipo: 'original', numero: 1, estado: 'borrador',
    markupDefaultPorcentaje: args.markupDefault,
    cotizacionUsd: args.cotizacionUsd,
    version: 1, createdBy: args.adminId, updatedBy: args.adminId,
  }).returning();

  const ctx: PresupuestoCtx = {
    monedaBase: oCreated.monedaBase,
    cotizacionUsd: D(args.cotizacionUsd),
    markupDefault: D(args.markupDefault),
  };

  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    const markupPct = f.markup ? D(f.markup) : null;
    const snap = calcularSnapshotItem({
      cantidad: D(f.cantidad), costoUnitario: D(f.costo_unitario),
      costoUnitarioMoneda: f.moneda_costo as 'USD' | 'ARS', markupPorcentaje: markupPct,
    }, ctx);
    await db.insert(itemPresupuesto).values({
      presupuestoId: pCreated.id, rubroId: rubrosCache.get(f.rubro)!, orden: i,
      descripcion: f.descripcion, unidad: f.unidad as any,
      cantidad: f.cantidad, costoUnitario: f.costo_unitario,
      costoUnitarioMoneda: f.moneda_costo as 'USD' | 'ARS',
      costoUnitarioBase: toDb(snap.costoUnitarioBase),
      markupPorcentaje: f.markup || null,
      markupEfectivoPorcentaje: toDb(snap.markupEfectivoPorcentaje, 2),
      precioUnitarioCliente: toDb(snap.precioUnitarioCliente),
      notas: f.notas || null,
    });
  }

  await logAudit({
    entidad: 'obra', entidadId: oCreated.id, accion: 'crear',
    descripcionHumana: `Importador creó obra ${args.codigoObra} con ${filas.length} items`,
    usuarioId: args.adminId,
  });

  return { ok: true, obraId: oCreated.id, itemsImportados: filas.length };
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm test:integration -- import-end-to-end
```

Expected: 4 PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/import-sheets/ejecutor.ts tests/integration/import-end-to-end.test.ts
git commit -m "feat(import): ejecutor end-to-end con dry-run e idempotencia"
```

---

## Task 8: Importador — CLI entrypoint

**Files:**
- Create: `scripts/import-sheets/index.ts`, modify `package.json`

- [ ] **Step 1: CLI**

```ts
// scripts/import-sheets/index.ts
import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ejecutarImport } from './ejecutor';
import { db } from '@/db/client';
import { usuario } from '@/db/schema';
import { eq } from 'drizzle-orm';

function parseArgs(argv: string[]): { csvPath?: string; codigoObra?: string; dryRun: boolean; cotizacion?: string; markup?: string; adminEmail?: string; nombreObra?: string; clienteNombre?: string } {
  const out: any = { dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!out.csvPath && !a.startsWith('--')) out.csvPath = a;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--codigo-obra') out.codigoObra = argv[++i];
    else if (a === '--cotizacion') out.cotizacion = argv[++i];
    else if (a === '--markup') out.markup = argv[++i];
    else if (a === '--admin-email') out.adminEmail = argv[++i];
    else if (a === '--nombre-obra') out.nombreObra = argv[++i];
    else if (a === '--cliente-nombre') out.clienteNombre = argv[++i];
  }
  return out;
}

async function main() {
  const a = parseArgs(process.argv);
  if (!a.csvPath || !a.codigoObra) {
    console.error('Uso: pnpm import-sheets <csv> --codigo-obra M-2026-001 --cotizacion 1200 [--markup 30] [--dry-run]');
    process.exit(2);
  }

  const adminEmail = a.adminEmail ?? process.env.SEED_ADMIN_EMAIL;
  if (!adminEmail) { console.error('Falta admin-email o SEED_ADMIN_EMAIL'); process.exit(2); }
  const [admin] = await db.select().from(usuario).where(eq(usuario.email, adminEmail));
  if (!admin) { console.error(`Admin ${adminEmail} no existe en tabla usuario`); process.exit(2); }

  const buf = readFileSync(resolve(a.csvPath));
  const r = await ejecutarImport({
    buf, codigoObra: a.codigoObra, adminId: admin.id, dryRun: a.dryRun,
    cotizacionUsd: a.cotizacion ?? '1', markupDefault: a.markup ?? '30',
    nombreObra: a.nombreObra, clienteNombre: a.clienteNombre,
  });

  if (r.ok) {
    console.log(`✓ ${a.dryRun ? 'DRY-RUN: ' : ''}importados ${r.itemsImportados} items`);
    if ('obraId' in r && r.obraId) console.log(`  obra_id=${r.obraId}`);
    process.exit(0);
  } else {
    console.error('✗ Errores:');
    r.errores.forEach((e) => console.error(`  ${e}`));
    process.exit(1);
  }
}

main();
```

- [ ] **Step 2: Script en `package.json`**

```json
{
  "scripts": {
    "import-sheets": "dotenv -e .env.local -- tsx scripts/import-sheets/index.ts"
  }
}
```

- [ ] **Step 3: Smoke**

Run:

```bash
pnpm import-sheets fixtures/obra-ejemplo.csv --codigo-obra M-2026-IMPSMOKE --cotizacion 1200 --dry-run
```

Expected: imprime `DRY-RUN: importados 3 items`.

```bash
pnpm import-sheets fixtures/obra-ejemplo.csv --codigo-obra M-2026-IMPSMOKE --cotizacion 1200
```

Expected: crea obra, imprime obra_id. Visitable en `/obras` desde la app.

- [ ] **Step 4: Commit**

```bash
git add scripts/import-sheets/index.ts package.json
git commit -m "feat(import): CLI entrypoint"
```

---

## Task 9: Documentación de uso del importador

**Files:**
- Modify: `README.md` (crear si no existe)

- [ ] **Step 1: README**

```markdown
# Macna — Sistema de Gestión de Obras

## Setup

1. Crear proyectos Supabase (`prod`, `dev`).
2. `cp .env.example .env.local` y completar.
3. `pnpm install`
4. `pnpm db:migrate` (aplica schema)
5. `pnpm db:seed` (rubros + primer admin)
6. `pnpm dev`

## Importador de Sheets

Convertir la planilla actual a CSV con columnas: `rubro,descripcion,unidad,cantidad,costo_unitario,moneda_costo,markup,notas`.

Ejemplo:

```bash
# Validar sin escribir
pnpm import-sheets ./mi-obra.csv --codigo-obra M-2026-005 --cotizacion 1200 --dry-run

# Importar
pnpm import-sheets ./mi-obra.csv --codigo-obra M-2026-005 --cotizacion 1200 --markup 30 \
  --nombre-obra "Casa Pérez" --cliente-nombre "Juan Pérez"
```

Notas:
- `unidad` ∈ {m2, m3, hs, gl, u, ml, kg}
- `moneda_costo` ∈ {USD, ARS}
- `markup` opcional (vacío = usa default del presupuesto)
- Idempotente: aborta si `codigo-obra` ya existe.
- Rubros nuevos se crean con flag `creado_por_importador=true` para revisión posterior.

## Tests

- `pnpm test:unit` — services, parsers, validators
- `pnpm test:integration` — DB + Server Actions (requiere Supabase test)
- `pnpm test:e2e` — Playwright (requiere app levantada + seed)
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README con setup + uso del importador"
```

---

## Task 10: Plan de cutover documentado

**Files:**
- Create: `docs/cutover-piloto.md`

- [ ] **Step 1: Plan**

```markdown
# Plan de cutover — Obra piloto

## Objetivo
Validar que el sistema reemplaza la planilla de Sheets sin pérdida de datos ni errores de cálculo, antes de migrar el resto de obras.

## Pasos
1. Elegir 1 obra activa cuyos datos ya estén estabilizados en Sheets.
2. Exportar la planilla a CSV con el formato del importador (ver README).
3. Importar al sistema:
   ```
   pnpm import-sheets obra-piloto.csv --codigo-obra M-2026-XXX --cotizacion <TC> --markup <X>
   ```
4. Verificar manual: el total cliente del sistema coincide con el de Sheets en la fecha del corte. Diferencias > $0.01 deben investigarse.
5. **Operar en paralelo** durante 3 cierres semanales:
   - Cargar movimientos en Sheets como hasta ahora.
   - **Adicionalmente**, cargar los mismos datos en el sistema.
6. **Criterio de promoción**: 3 cierres consecutivos donde:
   - Total cliente del presupuesto coincida.
   - Total costo coincida.
   - Si hay adicionales firmados, también coinciden.
7. Una vez promovido: la planilla queda como histórico de solo lectura. La siguiente obra se carga directo en el sistema, sin paralelo.

## Rollback
- App: rollback con un click desde Vercel.
- DB: PITR en Supabase Pro (7 días).
- Si la obra en el sistema queda inservible: `eliminar` la obra (soft delete) y reimportar.
```

- [ ] **Step 2: Commit**

```bash
git add docs/cutover-piloto.md
git commit -m "docs: plan de cutover de obra piloto"
```

---

## Verificación final del Plan 5

- [ ] Auditoría: pantalla `/configuracion/auditoria` muestra eventos con filtros y diff expandible.
- [ ] Export XLSX desde lista de obras descarga el archivo correctamente.
- [ ] Export XLSX desde detalle de obra incluye todos los presupuestos + items.
- [ ] Export XLSX de auditoría respeta filtros activos.
- [ ] Importador con `--dry-run` reporta sin escribir.
- [ ] Importador real crea obra + presupuesto + items con snapshots correctos.
- [ ] Importador rechaza código duplicado y rubros inválidos con mensaje claro.
- [ ] Tests: unit (parse + validate) y integration (audit, export, import-end-to-end) verdes.

**Salida**: F0 + F1 completas. Listo para arrancar piloto siguiendo `docs/cutover-piloto.md`.
