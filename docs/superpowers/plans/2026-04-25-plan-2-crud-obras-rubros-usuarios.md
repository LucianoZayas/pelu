# Plan 2 — CRUD Obras + Rubros + Usuarios

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Asume:** Plan 1 mergeado.

**Goal:** Admin puede crear/editar/soft-delete obras, gestionar catálogo de rubros (con jerarquías) e invitar/editar/desactivar usuarios. Operador ve la lista de obras (read-only) y el detalle limitado. AuditLog se llena en cada operación. Tests de integración cubren los happy paths.

**Architecture:** Cada dominio vive en `src/features/<dominio>/` con:
- `schema.ts` (Zod, tipos compartidos)
- `queries.ts` (lectura, server-only)
- `actions.ts` (Server Actions con Zod + audit + autorización)
- `components/` (UI específica del dominio)

Las páginas en `src/app/(internal)/` son thin wrappers que llaman a queries y montan componentes. Soft-delete por convención: queries siempre filtran `WHERE deleted_at IS NULL` excepto en una vista "papelera" que en F1 no se construye.

**Tech Stack:** Drizzle, Zod, react-hook-form (formularios), shadcn/ui, Supabase Auth admin API (invitar usuarios).

---

## File Structure

```
src/features/
  obras/
    schema.ts            # ObraInputSchema, types
    queries.ts           # listarObras, getObra, getObraByCodigo
    actions.ts           # crearObra, editarObra, eliminarObra (soft), regenerarToken
    codigo.ts            # generador "M-2026-NNN"
    components/
      obra-form.tsx      # form crear/editar
      obras-table.tsx    # tabla en lista
      obra-summary.tsx   # header del detalle
  rubros/
    schema.ts
    queries.ts           # listarRubrosArbol, getRubro
    actions.ts           # crearRubro, editarRubro, archivarRubro
    components/
      rubros-tree.tsx    # vista de árbol jerárquico editable
  usuarios/
    schema.ts
    queries.ts
    actions.ts           # invitarUsuario, editarUsuario, desactivarUsuario
    components/
      usuarios-table.tsx
      invitar-dialog.tsx
  audit/
    log.ts               # logAudit() — usado acá por primera vez

src/app/(internal)/
  obras/
    page.tsx             # lista
    nueva/page.tsx       # crear (Admin)
    [id]/
      page.tsx           # detalle (con tabs: Info / Presupuestos / Movimientos*)
      editar/page.tsx    # editar (Admin)
  configuracion/
    rubros/page.tsx      # CRUD rubros (Admin)
    usuarios/page.tsx    # CRUD usuarios (Admin)

tests/integration/
  obras.test.ts
  rubros.test.ts
  usuarios.test.ts
  setup.ts               # crea conexión a DB de test, helpers para fixtures
```

\* tab Movimientos = placeholder con "Próximamente F2".

---

## Task 1: Setup de tests de integración

**Files:**
- Create: `tests/integration/setup.ts`, `tests/integration/factories.ts`, `.env.test`

- [ ] **Step 1: `.env.test` apuntando a Supabase dev (dedicado para tests)**

> El usuario debe crear un proyecto Supabase aparte para tests, o reutilizar el dev limpiando entre suites. Documentar.

```env
DATABASE_URL=postgresql://postgres:PASS@aws-0-XX.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:PASS@db.PROJECT-test.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT-test.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

- [ ] **Step 2: Setup file**

```ts
// tests/integration/setup.ts
import 'dotenv/config';
import { execSync } from 'child_process';
import { db, pg } from '@/db/client';
import { obra, presupuesto, itemPresupuesto, auditLog, usuario, rubro } from '@/db/schema';

export async function resetDb() {
  // TRUNCATE en orden de FKs.
  await db.execute(`TRUNCATE TABLE
    audit_log, item_presupuesto, presupuesto, movimiento, obra, rubro, usuario
    RESTART IDENTITY CASCADE` as never);
}

export async function migrateTestDb() {
  execSync('pnpm db:migrate', { stdio: 'inherit' });
}

afterAll(async () => {
  await pg.end({ timeout: 5 });
});
```

- [ ] **Step 3: Factories**

```ts
// tests/integration/factories.ts
import { db } from '@/db/client';
import { usuario, rubro, obra } from '@/db/schema';
import { randomBytes, randomUUID } from 'crypto';

export async function makeUsuario(rol: 'admin' | 'operador' = 'admin') {
  const id = randomUUID();
  const [u] = await db.insert(usuario).values({
    id, email: `${id}@test.local`, nombre: `Test ${rol}`, rol, activo: true,
  }).returning();
  return u;
}

export async function makeRubro(nombre = `Rubro-${Date.now()}`) {
  const [r] = await db.insert(rubro).values({ nombre, orden: 0 }).returning();
  return r;
}

export function makeToken() {
  return randomBytes(32).toString('base64url');
}

export async function makeObra(adminId: string, overrides: Partial<typeof obra.$inferInsert> = {}) {
  const [o] = await db.insert(obra).values({
    codigo: `T-${Date.now()}`,
    nombre: 'Obra test',
    clienteNombre: 'Cliente test',
    estado: 'borrador',
    monedaBase: 'USD',
    porcentajeHonorarios: '16',
    clienteToken: makeToken(),
    createdBy: adminId,
    updatedBy: adminId,
    ...overrides,
  }).returning();
  return o;
}
```

- [ ] **Step 4: Configurar Jest para integration**

Editar `jest.config.ts` (proyectos):

```ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],
  projects: [
    { displayName: 'unit', testMatch: ['<rootDir>/tests/unit/**/*.test.ts'], testEnvironment: 'node' },
    { displayName: 'integration', testMatch: ['<rootDir>/tests/integration/**/*.test.ts'], testEnvironment: 'node', setupFiles: ['dotenv/config'] },
  ],
};
export default config;
```

- [ ] **Step 5: Commit**

```bash
git add tests/integration/setup.ts tests/integration/factories.ts jest.config.ts .env.test
git commit -m "test: integration setup + factories"
```

---

## Task 2: AuditLog helper (usado desde acá en adelante)

**Files:**
- Create: `src/features/audit/log.ts`

- [ ] **Step 1: `log.ts`**

```ts
import { db } from '@/db/client';
import { auditLog } from '@/db/schema';

type Entidad = 'obra' | 'presupuesto' | 'item_presupuesto' | 'usuario' | 'cliente_token' | 'rubro';
type Accion = 'crear' | 'editar' | 'eliminar' | 'firmar' | 'cancelar' | 'regenerar_token';

export interface LogAuditInput {
  entidad: Entidad;
  entidadId: string;
  accion: Accion;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  descripcionHumana?: string;
  usuarioId: string;
}

function diffOf(before?: Record<string, unknown> | null, after?: Record<string, unknown> | null) {
  if (!before && !after) return null;
  if (!before) return { after };
  if (!after) return { before };
  const changed: Record<string, { before: unknown; after: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      changed[k] = { before: before[k], after: after[k] };
    }
  }
  return Object.keys(changed).length ? changed : null;
}

export async function logAudit(input: LogAuditInput) {
  const diff = diffOf(input.before, input.after);
  await db.insert(auditLog).values({
    entidad: input.entidad,
    entidadId: input.entidadId,
    accion: input.accion,
    diff,
    descripcionHumana: input.descripcionHumana,
    usuarioId: input.usuarioId,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/audit/
git commit -m "feat(audit): logAudit helper with diff"
```

---

## Task 3: Generador de código de obra

**Files:**
- Create: `src/features/obras/codigo.ts`, `tests/unit/codigo-obra.test.ts`

- [ ] **Step 1: Test fallido**

```ts
// tests/unit/codigo-obra.test.ts
import { siguienteCodigoObra } from '@/features/obras/codigo';

describe('siguienteCodigoObra', () => {
  it('arranca en 001 si no hay obras del año', () => {
    expect(siguienteCodigoObra(2026, [])).toBe('M-2026-001');
  });

  it('toma max + 1 entre los del mismo año', () => {
    expect(siguienteCodigoObra(2026, ['M-2026-001', 'M-2026-007', 'M-2025-099'])).toBe('M-2026-008');
  });

  it('ignora códigos no estándar', () => {
    expect(siguienteCodigoObra(2026, ['Manual-1', 'M-2026-002'])).toBe('M-2026-003');
  });

  it('rellena con ceros a 3 dígitos', () => {
    expect(siguienteCodigoObra(2026, ['M-2026-098'])).toBe('M-2026-099');
    expect(siguienteCodigoObra(2026, ['M-2026-099'])).toBe('M-2026-100');
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm test:unit -- codigo`
Expected: FAIL ("module not found").

- [ ] **Step 3: Implementación**

```ts
// src/features/obras/codigo.ts
const RE = /^M-(\d{4})-(\d{3,})$/;

export function siguienteCodigoObra(anio: number, existentes: string[]): string {
  const max = existentes.reduce((acc, codigo) => {
    const m = RE.exec(codigo);
    if (!m) return acc;
    if (Number(m[1]) !== anio) return acc;
    return Math.max(acc, Number(m[2]));
  }, 0);
  return `M-${anio}-${String(max + 1).padStart(3, '0')}`;
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm test:unit -- codigo`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/obras/codigo.ts tests/unit/codigo-obra.test.ts
git commit -m "feat(obras): generador de código M-YYYY-NNN"
```

---

## Task 4: Schema Zod + queries de obra

**Files:**
- Create: `src/features/obras/schema.ts`, `src/features/obras/queries.ts`

- [ ] **Step 1: Schema Zod**

```ts
// src/features/obras/schema.ts
import { z } from 'zod';

export const obraInputSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(200),
  clienteNombre: z.string().min(1, 'Cliente requerido').max(200),
  clienteEmail: z.string().email().nullable().optional(),
  clienteTelefono: z.string().max(50).nullable().optional(),
  ubicacion: z.string().max(500).nullable().optional(),
  superficieM2: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  fechaInicio: z.coerce.date().nullable().optional(),
  fechaFinEstimada: z.coerce.date().nullable().optional(),
  monedaBase: z.enum(['USD', 'ARS']).default('USD'),
  cotizacionUsdInicial: z.string().regex(/^\d+(\.\d{1,4})?$/).nullable().optional(),
  porcentajeHonorarios: z.string().regex(/^\d+(\.\d{1,2})?$/).default('16'),
});

export type ObraInput = z.infer<typeof obraInputSchema>;
```

- [ ] **Step 2: Queries**

```ts
// src/features/obras/queries.ts
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { obra } from '@/db/schema';

export async function listarObras() {
  return db.select().from(obra).where(isNull(obra.deletedAt)).orderBy(desc(obra.createdAt));
}

export async function getObra(id: string) {
  const [o] = await db.select().from(obra)
    .where(and(eq(obra.id, id), isNull(obra.deletedAt))).limit(1);
  return o ?? null;
}

export async function getObraByCodigo(codigo: string) {
  const [o] = await db.select().from(obra)
    .where(and(eq(obra.codigo, codigo), isNull(obra.deletedAt))).limit(1);
  return o ?? null;
}

export async function listarCodigosDelAnio(anio: number) {
  // Filtra por prefijo M-YYYY-
  const rows = await db.select({ codigo: obra.codigo }).from(obra);
  return rows.map((r) => r.codigo).filter((c) => c.startsWith(`M-${anio}-`));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/obras/schema.ts src/features/obras/queries.ts
git commit -m "feat(obras): zod schema + queries"
```

---

## Task 5: Server Actions de obra (TDD)

**Files:**
- Create: `src/features/obras/actions.ts`, `tests/integration/obras.test.ts`

- [ ] **Step 1: Test fallido**

```ts
// tests/integration/obras.test.ts
import { resetDb } from './setup';
import { makeUsuario } from './factories';
import { db } from '@/db/client';
import { obra, auditLog } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as actions from '@/features/obras/actions';

// Mock de getSessionUser para inyectar el usuario en cada test.
jest.mock('@/lib/auth/require', () => ({
  __esModule: true,
  getSessionUser: jest.fn(),
  requireSession: jest.fn(),
  requireRole: jest.fn(),
}));
import * as auth from '@/lib/auth/require';

describe('obras/actions', () => {
  beforeEach(async () => { await resetDb(); jest.clearAllMocks(); });

  it('Admin crea obra y se loguea audit', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);

    const result = await actions.crearObra({
      nombre: 'Casa Test',
      clienteNombre: 'Juan Pérez',
      monedaBase: 'USD',
      porcentajeHonorarios: '16',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [creada] = await db.select().from(obra).where(eq(obra.id, result.id));
    expect(creada.nombre).toBe('Casa Test');
    expect(creada.codigo).toMatch(/^M-\d{4}-\d{3}$/);
    expect(creada.clienteToken).toHaveLength(43);

    const logs = await db.select().from(auditLog).where(eq(auditLog.entidadId, result.id));
    expect(logs).toHaveLength(1);
    expect(logs[0].accion).toBe('crear');
  });

  it('Operador no puede crear obra (403)', async () => {
    (auth.requireRole as jest.Mock).mockRejectedValue(new Response('Forbidden', { status: 403 }));
    await expect(actions.crearObra({
      nombre: 'X', clienteNombre: 'Y', monedaBase: 'USD', porcentajeHonorarios: '16',
    })).rejects.toBeInstanceOf(Response);
  });

  it('soft delete deja la obra fuera de listarObras', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);

    const r = await actions.crearObra({
      nombre: 'Borrar', clienteNombre: 'C', monedaBase: 'USD', porcentajeHonorarios: '16',
    });
    if (!r.ok) throw new Error('crearObra failed');
    await actions.eliminarObra(r.id);

    const { listarObras } = await import('@/features/obras/queries');
    const lista = await listarObras();
    expect(lista.find((o) => o.id === r.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm test:integration -- obras`
Expected: FAIL.

- [ ] **Step 3: Implementación**

```ts
// src/features/obras/actions.ts
'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { obra } from '@/db/schema';
import { requireRole } from '@/lib/auth/require';
import { logAudit } from '@/features/audit/log';
import { obraInputSchema, type ObraInput } from './schema';
import { siguienteCodigoObra } from './codigo';
import { listarCodigosDelAnio, getObra } from './queries';

type Result<T = void> = { ok: true } & (T extends void ? object : { id: string }) | { ok: false; error: string };

function generarToken() {
  return randomBytes(32).toString('base64url');
}

export async function crearObra(input: ObraInput): Promise<Result<{ id: string }>> {
  const admin = await requireRole('admin');
  const parsed = obraInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const anio = new Date().getFullYear();
  const existentes = await listarCodigosDelAnio(anio);
  const codigo = siguienteCodigoObra(anio, existentes);
  const token = generarToken();

  const [creada] = await db.insert(obra).values({
    codigo,
    nombre: parsed.data.nombre,
    clienteNombre: parsed.data.clienteNombre,
    clienteEmail: parsed.data.clienteEmail ?? null,
    clienteTelefono: parsed.data.clienteTelefono ?? null,
    ubicacion: parsed.data.ubicacion ?? null,
    superficieM2: parsed.data.superficieM2 ?? null,
    fechaInicio: parsed.data.fechaInicio ?? null,
    fechaFinEstimada: parsed.data.fechaFinEstimada ?? null,
    monedaBase: parsed.data.monedaBase,
    cotizacionUsdInicial: parsed.data.cotizacionUsdInicial ?? null,
    porcentajeHonorarios: parsed.data.porcentajeHonorarios,
    clienteToken: token,
    estado: 'borrador',
    createdBy: admin.id,
    updatedBy: admin.id,
  }).returning();

  await logAudit({
    entidad: 'obra', entidadId: creada.id, accion: 'crear',
    after: creada, usuarioId: admin.id,
    descripcionHumana: `${admin.nombre} creó la obra ${creada.codigo}`,
  });

  revalidatePath('/obras');
  return { ok: true, id: creada.id };
}

export async function editarObra(id: string, input: ObraInput): Promise<Result> {
  const admin = await requireRole('admin');
  const parsed = obraInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const before = await getObra(id);
  if (!before) return { ok: false, error: 'Obra no encontrada' };

  const [after] = await db.update(obra).set({
    nombre: parsed.data.nombre,
    clienteNombre: parsed.data.clienteNombre,
    clienteEmail: parsed.data.clienteEmail ?? null,
    clienteTelefono: parsed.data.clienteTelefono ?? null,
    ubicacion: parsed.data.ubicacion ?? null,
    superficieM2: parsed.data.superficieM2 ?? null,
    fechaInicio: parsed.data.fechaInicio ?? null,
    fechaFinEstimada: parsed.data.fechaFinEstimada ?? null,
    monedaBase: parsed.data.monedaBase,
    cotizacionUsdInicial: parsed.data.cotizacionUsdInicial ?? null,
    porcentajeHonorarios: parsed.data.porcentajeHonorarios,
    updatedAt: new Date(),
    updatedBy: admin.id,
  }).where(eq(obra.id, id)).returning();

  await logAudit({
    entidad: 'obra', entidadId: id, accion: 'editar',
    before, after, usuarioId: admin.id,
    descripcionHumana: `${admin.nombre} editó la obra ${after.codigo}`,
  });

  revalidatePath('/obras');
  revalidatePath(`/obras/${id}`);
  return { ok: true };
}

export async function eliminarObra(id: string): Promise<Result> {
  const admin = await requireRole('admin');
  const before = await getObra(id);
  if (!before) return { ok: false, error: 'Obra no encontrada' };

  await db.update(obra).set({
    deletedAt: new Date(), updatedBy: admin.id, updatedAt: new Date(),
  }).where(eq(obra.id, id));

  await logAudit({
    entidad: 'obra', entidadId: id, accion: 'eliminar',
    before, usuarioId: admin.id,
    descripcionHumana: `${admin.nombre} eliminó la obra ${before.codigo}`,
  });

  revalidatePath('/obras');
  return { ok: true };
}

export async function regenerarTokenCliente(id: string): Promise<Result<{ token: string }>> {
  const admin = await requireRole('admin');
  const before = await getObra(id);
  if (!before) return { ok: false, error: 'Obra no encontrada' };

  const token = generarToken();
  await db.update(obra).set({ clienteToken: token, updatedBy: admin.id, updatedAt: new Date() })
    .where(eq(obra.id, id));

  await logAudit({
    entidad: 'cliente_token', entidadId: id, accion: 'regenerar_token',
    usuarioId: admin.id,
    descripcionHumana: `${admin.nombre} regeneró el link cliente de ${before.codigo}`,
  });

  revalidatePath(`/obras/${id}`);
  return { ok: true, id: token } as never; // typed-result helper trick
}
```

> Nota: el typed-result trick del `regenerarTokenCliente` es feo; rediseñar el `Result<T>` si confunde. Por simplicidad lo dejamos así en F1.

- [ ] **Step 4: Run tests**

Run: `pnpm test:integration -- obras`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/obras/actions.ts tests/integration/obras.test.ts
git commit -m "feat(obras): server actions (CRUD + audit)"
```

---

## Task 6: Componentes UI de obra

**Files:**
- Create: `src/features/obras/components/obra-form.tsx`, `obras-table.tsx`, `obra-summary.tsx`

- [ ] **Step 1: Form**

```tsx
// src/features/obras/components/obra-form.tsx
'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ObraInput } from '../schema';

type Props = {
  initial?: Partial<ObraInput & { id: string }>;
  onSubmit: (input: ObraInput) => Promise<{ ok: true; id?: string } | { ok: false; error: string }>;
};

export function ObraForm({ initial, onSubmit }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handle(formData: FormData) {
    setPending(true);
    setError(null);
    const input = {
      nombre: String(formData.get('nombre') ?? ''),
      clienteNombre: String(formData.get('clienteNombre') ?? ''),
      clienteEmail: String(formData.get('clienteEmail') ?? '') || null,
      clienteTelefono: String(formData.get('clienteTelefono') ?? '') || null,
      ubicacion: String(formData.get('ubicacion') ?? '') || null,
      superficieM2: String(formData.get('superficieM2') ?? '') || null,
      monedaBase: (formData.get('monedaBase') ?? 'USD') as 'USD' | 'ARS',
      cotizacionUsdInicial: String(formData.get('cotizacionUsdInicial') ?? '') || null,
      porcentajeHonorarios: String(formData.get('porcentajeHonorarios') ?? '16'),
    };
    const r = await onSubmit(input);
    setPending(false);
    if (!r.ok) setError(r.error);
    else router.push(r.id ? `/obras/${r.id}` : '/obras');
  }

  return (
    <form action={handle} className="grid grid-cols-2 gap-4 max-w-3xl">
      <Field name="nombre" label="Nombre de la obra" defaultValue={initial?.nombre} required />
      <Field name="clienteNombre" label="Cliente" defaultValue={initial?.clienteNombre} required />
      <Field name="clienteEmail" label="Email cliente" type="email" defaultValue={initial?.clienteEmail ?? ''} />
      <Field name="clienteTelefono" label="Teléfono cliente" defaultValue={initial?.clienteTelefono ?? ''} />
      <Field name="ubicacion" label="Ubicación" defaultValue={initial?.ubicacion ?? ''} />
      <Field name="superficieM2" label="Superficie m²" type="number" step="0.01" defaultValue={initial?.superficieM2 ?? ''} />
      <div>
        <Label htmlFor="monedaBase">Moneda base</Label>
        <Select name="monedaBase" defaultValue={initial?.monedaBase ?? 'USD'}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="ARS">ARS</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Field name="cotizacionUsdInicial" label="Cotización USD inicial" type="number" step="0.0001" defaultValue={initial?.cotizacionUsdInicial ?? ''} />
      <Field name="porcentajeHonorarios" label="Honorarios %" type="number" step="0.01" defaultValue={initial?.porcentajeHonorarios ?? '16'} />
      {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
      <div className="col-span-2 flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? 'Guardando...' : 'Guardar'}</Button>
      </div>
    </form>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <div>
      <Label htmlFor={rest.name}>{label}</Label>
      <Input id={rest.name} {...rest} />
    </div>
  );
}
```

- [ ] **Step 2: Tabla**

```tsx
// src/features/obras/components/obras-table.tsx
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Obra = {
  id: string; codigo: string; nombre: string; clienteNombre: string;
  estado: string; monedaBase: string; createdAt: Date;
};

export function ObrasTable({ obras }: { obras: Obra[] }) {
  if (obras.length === 0) return <p className="text-muted-foreground">No hay obras.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Código</TableHead>
          <TableHead>Nombre</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Moneda</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {obras.map((o) => (
          <TableRow key={o.id} className="cursor-pointer">
            <TableCell><Link href={`/obras/${o.id}`} className="font-mono text-sm">{o.codigo}</Link></TableCell>
            <TableCell>{o.nombre}</TableCell>
            <TableCell>{o.clienteNombre}</TableCell>
            <TableCell><span className="text-xs px-2 py-0.5 rounded bg-slate-100">{o.estado}</span></TableCell>
            <TableCell>{o.monedaBase}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Summary**

```tsx
// src/features/obras/components/obra-summary.tsx
export function ObraSummary({ obra }: { obra: { codigo: string; nombre: string; clienteNombre: string; estado: string; monedaBase: string } }) {
  return (
    <header className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold">{obra.nombre}</h1>
        <p className="text-sm text-muted-foreground font-mono">{obra.codigo} · {obra.clienteNombre} · {obra.monedaBase}</p>
      </div>
      <span className="text-xs px-2 py-1 rounded bg-slate-100">{obra.estado}</span>
    </header>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/obras/components/
git commit -m "feat(obras): UI components (form, table, summary)"
```

---

## Task 7: Páginas de obra

**Files:**
- Create: `src/app/(internal)/obras/page.tsx`, `nueva/page.tsx`, `[id]/page.tsx`, `[id]/editar/page.tsx`

- [ ] **Step 1: Lista**

```tsx
// src/app/(internal)/obras/page.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { listarObras } from '@/features/obras/queries';
import { ObrasTable } from '@/features/obras/components/obras-table';
import { requireSession } from '@/lib/auth/require';

export default async function ObrasPage() {
  const user = await requireSession();
  const obras = await listarObras();
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Obras</h1>
        {user.rol === 'admin' && (
          <Button asChild><Link href="/obras/nueva">Nueva obra</Link></Button>
        )}
      </div>
      <ObrasTable obras={obras} />
    </div>
  );
}
```

- [ ] **Step 2: Nueva**

```tsx
// src/app/(internal)/obras/nueva/page.tsx
import { requireRole } from '@/lib/auth/require';
import { ObraForm } from '@/features/obras/components/obra-form';
import { crearObra } from '@/features/obras/actions';

export default async function NuevaObraPage() {
  await requireRole('admin');
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Nueva obra</h1>
      <ObraForm onSubmit={crearObra} />
    </div>
  );
}
```

- [ ] **Step 3: Detalle**

```tsx
// src/app/(internal)/obras/[id]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { requireSession } from '@/lib/auth/require';
import { getObra } from '@/features/obras/queries';
import { ObraSummary } from '@/features/obras/components/obra-summary';

export default async function ObraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const obra = await getObra(id);
  if (!obra) notFound();
  const previewUrl = `/cliente/${obra.clienteToken}`;

  return (
    <div>
      <ObraSummary obra={obra} />
      <div className="flex gap-2 mb-6">
        {user.rol === 'admin' && (
          <>
            <Button asChild><Link href={`/obras/${id}/editar`}>Editar</Link></Button>
            <Button asChild variant="outline"><Link href={`/obras/${id}/presupuestos/nuevo`}>Nuevo presupuesto</Link></Button>
            <Button asChild variant="outline" target="_blank"><a href={previewUrl} target="_blank">Previsualizar como cliente</a></Button>
          </>
        )}
      </div>
      <section className="border rounded p-4">
        <h2 className="font-semibold mb-2">Presupuestos</h2>
        <p className="text-muted-foreground text-sm">(Lista de presupuestos llega en Plan 3.)</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Editar**

```tsx
// src/app/(internal)/obras/[id]/editar/page.tsx
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { getObra } from '@/features/obras/queries';
import { ObraForm } from '@/features/obras/components/obra-form';
import { editarObra } from '@/features/obras/actions';

export default async function EditarObraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole('admin');
  const obra = await getObra(id);
  if (!obra) notFound();

  async function onSubmit(input: Parameters<typeof editarObra>[1]) {
    'use server';
    return editarObra(id, input);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Editar {obra.codigo}</h1>
      <ObraForm
        initial={{
          nombre: obra.nombre, clienteNombre: obra.clienteNombre,
          clienteEmail: obra.clienteEmail, clienteTelefono: obra.clienteTelefono,
          ubicacion: obra.ubicacion, superficieM2: obra.superficieM2,
          monedaBase: obra.monedaBase, cotizacionUsdInicial: obra.cotizacionUsdInicial,
          porcentajeHonorarios: obra.porcentajeHonorarios,
        }}
        onSubmit={onSubmit}
      />
    </div>
  );
}
```

- [ ] **Step 5: Smoke manual + commit**

Run: `pnpm dev`. Login como Admin → ir a `/obras`, crear, editar, ver detalle.

```bash
git add src/app/\(internal\)/obras/
git commit -m "feat(obras): pages (list, new, detail, edit)"
```

---

## Task 8: Rubros — schema, queries, actions, página

**Files:**
- Create: `src/features/rubros/{schema.ts,queries.ts,actions.ts}`, `src/features/rubros/components/rubros-tree.tsx`, `src/app/(internal)/configuracion/rubros/page.tsx`, `tests/integration/rubros.test.ts`

- [ ] **Step 1: Schema y queries**

```ts
// src/features/rubros/schema.ts
import { z } from 'zod';

export const rubroInputSchema = z.object({
  nombre: z.string().min(1).max(120),
  idPadre: z.string().uuid().nullable().optional(),
  orden: z.number().int().min(0).default(0),
  activo: z.boolean().default(true),
});
export type RubroInput = z.infer<typeof rubroInputSchema>;
```

```ts
// src/features/rubros/queries.ts
import { db } from '@/db/client';
import { rubro } from '@/db/schema';
import { asc } from 'drizzle-orm';

export type RubroNode = {
  id: string; nombre: string; orden: number; activo: boolean;
  hijos: RubroNode[];
};

export async function listarRubrosArbol(): Promise<RubroNode[]> {
  const flat = await db.select().from(rubro).orderBy(asc(rubro.orden));
  const byId = new Map<string, RubroNode>();
  flat.forEach((r) => byId.set(r.id, { id: r.id, nombre: r.nombre, orden: r.orden, activo: r.activo, hijos: [] }));
  const roots: RubroNode[] = [];
  flat.forEach((r) => {
    const node = byId.get(r.id)!;
    if (r.idPadre) byId.get(r.idPadre)?.hijos.push(node);
    else roots.push(node);
  });
  return roots;
}

export async function listarRubrosPlanos() {
  return db.select().from(rubro).orderBy(asc(rubro.orden));
}
```

- [ ] **Step 2: Test fallido**

```ts
// tests/integration/rubros.test.ts
import { resetDb } from './setup';
import { makeUsuario } from './factories';
import * as actions from '@/features/rubros/actions';
import { listarRubrosArbol } from '@/features/rubros/queries';

jest.mock('@/lib/auth/require', () => ({
  requireRole: jest.fn(),
}));
import * as auth from '@/lib/auth/require';

describe('rubros', () => {
  beforeEach(async () => { await resetDb(); jest.clearAllMocks(); });

  it('jerarquía padre-hijo se construye correctamente', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);

    const inst = await actions.crearRubro({ nombre: 'Instalaciones', orden: 1, activo: true });
    if (!inst.ok) throw new Error();
    await actions.crearRubro({ nombre: 'Gas', idPadre: inst.id, orden: 1, activo: true });
    await actions.crearRubro({ nombre: 'Eléctrica', idPadre: inst.id, orden: 2, activo: true });

    const arbol = await listarRubrosArbol();
    const nodo = arbol.find((n) => n.nombre === 'Instalaciones');
    expect(nodo?.hijos.map((h) => h.nombre)).toEqual(['Gas', 'Eléctrica']);
  });
});
```

- [ ] **Step 3: Implementación de actions**

```ts
// src/features/rubros/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { rubro } from '@/db/schema';
import { requireRole } from '@/lib/auth/require';
import { logAudit } from '@/features/audit/log';
import { rubroInputSchema, type RubroInput } from './schema';

type Result<T = void> = ({ ok: true } & (T extends { id: string } ? { id: string } : object)) | { ok: false; error: string };

export async function crearRubro(input: RubroInput): Promise<Result<{ id: string }>> {
  const admin = await requireRole('admin');
  const parsed = rubroInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const [r] = await db.insert(rubro).values(parsed.data).returning();
  await logAudit({ entidad: 'rubro', entidadId: r.id, accion: 'crear', after: r, usuarioId: admin.id });
  revalidatePath('/configuracion/rubros');
  return { ok: true, id: r.id };
}

export async function editarRubro(id: string, input: RubroInput): Promise<Result> {
  const admin = await requireRole('admin');
  const parsed = rubroInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const [before] = await db.select().from(rubro).where(eq(rubro.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  const [after] = await db.update(rubro).set(parsed.data).where(eq(rubro.id, id)).returning();
  await logAudit({ entidad: 'rubro', entidadId: id, accion: 'editar', before, after, usuarioId: admin.id });
  revalidatePath('/configuracion/rubros');
  return { ok: true };
}

export async function archivarRubro(id: string): Promise<Result> {
  const admin = await requireRole('admin');
  const [before] = await db.select().from(rubro).where(eq(rubro.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  await db.update(rubro).set({ activo: false }).where(eq(rubro.id, id));
  await logAudit({ entidad: 'rubro', entidadId: id, accion: 'eliminar', before, usuarioId: admin.id });
  revalidatePath('/configuracion/rubros');
  return { ok: true };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:integration -- rubros`
Expected: PASS.

- [ ] **Step 5: Componente y página**

```tsx
// src/features/rubros/components/rubros-tree.tsx
'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { crearRubro, editarRubro, archivarRubro } from '../actions';
import type { RubroNode } from '../queries';

export function RubrosTree({ arbol, planos }: { arbol: RubroNode[]; planos: { id: string; nombre: string }[] }) {
  const [pending, start] = useTransition();
  const [nombre, setNombre] = useState('');
  const [padre, setPadre] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <form
        className="flex gap-2 items-end"
        action={() => start(async () => { await crearRubro({ nombre, idPadre: padre, orden: 0, activo: true }); setNombre(''); setPadre(null); })}
      >
        <div>
          <label className="text-sm">Nombre</label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm">Padre (opcional)</label>
          <Select value={padre ?? ''} onValueChange={(v) => setPadre(v || null)}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Sin padre (raíz)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sin padre</SelectItem>
              {planos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={pending || !nombre}>Agregar</Button>
      </form>

      <ul className="space-y-1">
        {arbol.map((n) => <NodeView key={n.id} node={n} depth={0} />)}
      </ul>
    </div>
  );
}

function NodeView({ node, depth }: { node: RubroNode; depth: number }) {
  return (
    <>
      <li className="flex items-center gap-2" style={{ paddingLeft: depth * 16 }}>
        <span className={node.activo ? '' : 'line-through text-muted-foreground'}>{node.nombre}</span>
        <Button variant="ghost" size="sm" onClick={() => archivarRubro(node.id)}>Archivar</Button>
      </li>
      {node.hijos.map((h) => <NodeView key={h.id} node={h} depth={depth + 1} />)}
    </>
  );
}
```

```tsx
// src/app/(internal)/configuracion/rubros/page.tsx
import { requireRole } from '@/lib/auth/require';
import { listarRubrosArbol, listarRubrosPlanos } from '@/features/rubros/queries';
import { RubrosTree } from '@/features/rubros/components/rubros-tree';

export default async function Page() {
  await requireRole('admin');
  const [arbol, planos] = await Promise.all([listarRubrosArbol(), listarRubrosPlanos()]);
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Rubros</h1>
      <RubrosTree arbol={arbol} planos={planos.map((p) => ({ id: p.id, nombre: p.nombre }))} />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/features/rubros/ src/app/\(internal\)/configuracion/rubros/ tests/integration/rubros.test.ts
git commit -m "feat(rubros): CRUD jerárquico"
```

---

## Task 9: Usuarios — schema, queries, actions, página

**Files:**
- Create: `src/features/usuarios/{schema.ts,queries.ts,actions.ts}`, `usuarios-table.tsx`, `invitar-dialog.tsx`, `src/app/(internal)/configuracion/usuarios/page.tsx`, `tests/integration/usuarios.test.ts`

- [ ] **Step 1: Schema y queries**

```ts
// src/features/usuarios/schema.ts
import { z } from 'zod';
export const invitarUsuarioSchema = z.object({
  email: z.string().email(),
  nombre: z.string().min(1).max(120),
  rol: z.enum(['admin', 'operador']),
});
export type InvitarUsuarioInput = z.infer<typeof invitarUsuarioSchema>;

export const editarUsuarioSchema = z.object({
  nombre: z.string().min(1).max(120),
  rol: z.enum(['admin', 'operador']),
  activo: z.boolean(),
});
export type EditarUsuarioInput = z.infer<typeof editarUsuarioSchema>;
```

```ts
// src/features/usuarios/queries.ts
import { db } from '@/db/client';
import { usuario } from '@/db/schema';
import { asc } from 'drizzle-orm';
export async function listarUsuarios() {
  return db.select().from(usuario).orderBy(asc(usuario.nombre));
}
```

- [ ] **Step 2: Actions**

```ts
// src/features/usuarios/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { usuario } from '@/db/schema';
import { requireRole } from '@/lib/auth/require';
import { logAudit } from '@/features/audit/log';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { invitarUsuarioSchema, editarUsuarioSchema, type InvitarUsuarioInput, type EditarUsuarioInput } from './schema';

type Result = { ok: true } | { ok: false; error: string };

export async function invitarUsuario(input: InvitarUsuarioInput): Promise<Result> {
  const admin = await requireRole('admin');
  const parsed = invitarUsuarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const sb = createSupabaseAdminClient();
  const tempPassword = randomBytes(12).toString('base64url');
  const { data, error } = await sb.auth.admin.createUser({
    email: parsed.data.email, password: tempPassword, email_confirm: true,
  });
  if (error || !data.user) return { ok: false, error: error?.message ?? 'Error creando user' };

  await db.insert(usuario).values({
    id: data.user.id, email: parsed.data.email,
    nombre: parsed.data.nombre, rol: parsed.data.rol, activo: true,
  });

  // Mandar reset password para que el invitado fije la suya.
  await sb.auth.admin.generateLink({ type: 'recovery', email: parsed.data.email });

  await logAudit({
    entidad: 'usuario', entidadId: data.user.id, accion: 'crear',
    after: { email: parsed.data.email, rol: parsed.data.rol },
    descripcionHumana: `${admin.nombre} invitó a ${parsed.data.email} (${parsed.data.rol})`,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/usuarios');
  return { ok: true };
}

export async function editarUsuario(id: string, input: EditarUsuarioInput): Promise<Result> {
  const admin = await requireRole('admin');
  const parsed = editarUsuarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const [before] = await db.select().from(usuario).where(eq(usuario.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  const [after] = await db.update(usuario).set(parsed.data).where(eq(usuario.id, id)).returning();
  await logAudit({ entidad: 'usuario', entidadId: id, accion: 'editar', before, after, usuarioId: admin.id });
  revalidatePath('/configuracion/usuarios');
  return { ok: true };
}

export async function desactivarUsuario(id: string): Promise<Result> {
  const admin = await requireRole('admin');
  if (id === admin.id) return { ok: false, error: 'No podés desactivarte a vos mismo' };
  const [before] = await db.select().from(usuario).where(eq(usuario.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  await db.update(usuario).set({ activo: false }).where(eq(usuario.id, id));
  await logAudit({ entidad: 'usuario', entidadId: id, accion: 'eliminar', before, usuarioId: admin.id });
  revalidatePath('/configuracion/usuarios');
  return { ok: true };
}
```

- [ ] **Step 3: Test de integración**

```ts
// tests/integration/usuarios.test.ts
import { resetDb } from './setup';
import { makeUsuario } from './factories';
import { db } from '@/db/client';
import { usuario } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as actions from '@/features/usuarios/actions';

jest.mock('@/lib/auth/require', () => ({ requireRole: jest.fn() }));
jest.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    auth: {
      admin: {
        createUser: jest.fn().mockResolvedValue({ data: { user: { id: 'mock-user-id' } }, error: null }),
        generateLink: jest.fn().mockResolvedValue({ data: {}, error: null }),
      },
    },
  }),
}));
import * as auth from '@/lib/auth/require';

describe('usuarios', () => {
  beforeEach(async () => { await resetDb(); jest.clearAllMocks(); });

  it('admin invita operador, queda activo y rol correcto', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);

    const r = await actions.invitarUsuario({
      email: 'op@test.com', nombre: 'Op Uno', rol: 'operador',
    });
    expect(r.ok).toBe(true);

    const [u] = await db.select().from(usuario).where(eq(usuario.id, 'mock-user-id'));
    expect(u.rol).toBe('operador');
    expect(u.activo).toBe(true);
  });

  it('admin no se puede desactivar a sí mismo', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);
    const r = await actions.desactivarUsuario(admin.id);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 4: Run + componentes UI + página**

Run: `pnpm test:integration -- usuarios`
Expected: PASS.

```tsx
// src/features/usuarios/components/usuarios-table.tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
type U = { id: string; email: string; nombre: string; rol: string; activo: boolean };
export function UsuariosTable({ usuarios }: { usuarios: U[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow><TableHead>Nombre</TableHead><TableHead>Email</TableHead><TableHead>Rol</TableHead><TableHead>Activo</TableHead></TableRow>
      </TableHeader>
      <TableBody>
        {usuarios.map((u) => (
          <TableRow key={u.id}>
            <TableCell>{u.nombre}</TableCell>
            <TableCell>{u.email}</TableCell>
            <TableCell>{u.rol}</TableCell>
            <TableCell>{u.activo ? 'Sí' : 'No'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

```tsx
// src/features/usuarios/components/invitar-dialog.tsx
'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { invitarUsuario } from '../actions';

export function InvitarDialog() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Invitar usuario</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle>Invitar usuario</DialogTitle>
        <form action={(fd) => start(async () => {
          const r = await invitarUsuario({
            email: String(fd.get('email')),
            nombre: String(fd.get('nombre')),
            rol: fd.get('rol') as 'admin' | 'operador',
          });
          if (r.ok) setOpen(false);
        })} className="space-y-3">
          <div><Label>Nombre</Label><Input name="nombre" required /></div>
          <div><Label>Email</Label><Input name="email" type="email" required /></div>
          <div><Label>Rol</Label>
            <Select name="rol" defaultValue="operador">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="operador">Operador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending}>{pending ? 'Enviando...' : 'Invitar'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

```tsx
// src/app/(internal)/configuracion/usuarios/page.tsx
import { requireRole } from '@/lib/auth/require';
import { listarUsuarios } from '@/features/usuarios/queries';
import { UsuariosTable } from '@/features/usuarios/components/usuarios-table';
import { InvitarDialog } from '@/features/usuarios/components/invitar-dialog';

export default async function Page() {
  await requireRole('admin');
  const usuarios = await listarUsuarios();
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <InvitarDialog />
      </div>
      <UsuariosTable usuarios={usuarios} />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/features/usuarios/ src/app/\(internal\)/configuracion/usuarios/ tests/integration/usuarios.test.ts
git commit -m "feat(usuarios): CRUD + invitar via Supabase Auth admin"
```

---

## Task 10: CI — incluir integration tests

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Agregar job de integration**

```yaml
  integration:
    runs-on: ubuntu-latest
    needs: lint-and-test
    if: ${{ secrets.TEST_DATABASE_URL != '' }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:migrate:prod
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          DIRECT_URL: ${{ secrets.TEST_DIRECT_URL }}
      - run: pnpm test:integration
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          DIRECT_URL: ${{ secrets.TEST_DIRECT_URL }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_ROLE_KEY }}
```

> El usuario debe configurar los secrets en GitHub.

- [ ] **Step 2: Commit + push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: integration tests job"
git push
```

---

## Verificación final del Plan 2

- [ ] Admin loguea, ve `/obras`, crea + edita + elimina (soft) obras.
- [ ] Operador loguea, ve `/obras` solo lectura, no aparece botón "Nueva obra".
- [ ] Admin gestiona rubros con jerarquía (Instalaciones → Gas/Eléctrica).
- [ ] Admin invita operador; recibe email de password reset (verificar manual con email real).
- [ ] AuditLog tiene entries por cada operación (verificar via SQL).
- [ ] Tests: unit + integration verdes en CI.

**Salida**: app de gestión funcional sin presupuestos. Lista para Plan 3.
