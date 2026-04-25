# Plan 1 — Fundaciones + Auth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inicializar el proyecto Next.js con TypeScript, Drizzle ORM contra Supabase, schema completo (incluyendo stubs F2), trigger Postgres "escrito en piedra", login (email/password + OAuth Google/Apple), middleware de sesión, helpers de autorización, seed inicial y CI verde.

**Architecture:** App Router de Next.js con organización feature-first (`src/features/<dominio>/`). Drizzle ORM con cliente singleton hablando directo al pooler de Supabase. Supabase Auth gestiona sesiones via cookies HttpOnly (`@supabase/ssr`). Middleware redirige a `/login` cuando no hay sesión en `/(internal)/*`. Trigger Postgres rechaza UPDATE sobre items de presupuestos firmados (defensa en profundidad).

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui, Drizzle ORM + drizzle-kit, Supabase (Postgres + Auth + Storage), `decimal.js`, Jest, Playwright, `@supabase/ssr`, Zod, `pnpm`.

---

## File Structure

| Path | Responsabilidad |
|---|---|
| `package.json` | Dependencias y scripts npm. |
| `next.config.ts` | Configuración Next.js. |
| `tsconfig.json` | Compilador TS estricto. |
| `tailwind.config.ts`, `postcss.config.mjs`, `src/app/globals.css` | Estilos globales. |
| `eslint.config.mjs` | Linting. |
| `.env.example`, `.env.local` | Variables de entorno (Supabase URL/keys, DATABASE_URL, DIRECT_URL). |
| `drizzle.config.ts` | Config de drizzle-kit (path schema, dialect postgres). |
| `src/db/schema.ts` | **Toda** la definición de tablas + relaciones Drizzle. |
| `src/db/client.ts` | Cliente Drizzle singleton (vía `globalThis`). |
| `src/db/seed.ts` | Script de seed (rubros estándar + primer admin). |
| `drizzle/migrations/0001_init.sql` | Migración inicial autogenerada. |
| `drizzle/migrations/0002_triggers.sql` | Trigger "escrito en piedra" (manual). |
| `src/lib/supabase/server.ts` | Cliente Supabase para Server Components/Actions (lee cookies). |
| `src/lib/supabase/browser.ts` | Cliente Supabase del lado cliente. |
| `src/lib/supabase/admin.ts` | Service-role client (solo seed/scripts). |
| `src/lib/auth/require.ts` | `requireSession()`, `requireRole('admin')`. |
| `src/lib/auth/types.ts` | Tipos `SessionUser`, `Rol`. |
| `src/lib/money/decimal.ts` | Wrappers `decimal.js`: `D(x)`, `add`, `mul`, `div`, `parseDb`, `toDb`, `fmt`. |
| `src/middleware.ts` | Sesión para `/(internal)/*`. |
| `src/app/layout.tsx` | Root layout (fuentes, providers). |
| `src/app/page.tsx` | Redirige a `/obras` si hay sesión, a `/login` si no. |
| `src/app/(auth)/login/page.tsx` | Form de login. |
| `src/app/(auth)/login/actions.ts` | Server Action `iniciarSesion(formData)`. |
| `src/app/(auth)/auth/callback/route.ts` | Callback OAuth (Supabase intercambia code → session). |
| `src/app/(internal)/layout.tsx` | Auth check + sidebar (placeholder). |
| `src/app/(internal)/page.tsx` | Dashboard placeholder ("Hola, {nombre}"). |
| `tests/unit/money.test.ts` | Tests precisión decimal. |
| `tests/integration/setup.ts` | Setup de DB de test (drizzle-kit migrate antes de cada suite). |
| `jest.config.ts`, `jest.setup.ts` | Config Jest. |
| `playwright.config.ts` | Config Playwright (skeleton, sin tests aún). |
| `.github/workflows/ci.yml` | Lint + unit + integration. |

---

## Convención de naming

- Dominio en español (`obra`, `presupuesto`, `rubro`, `usuario`).
- Infra en inglés (`schema`, `queries`, `actions`, `client`, `middleware`).
- Columnas DB en snake_case español (`fecha_inicio`, `costo_unitario_base`).

---

## Task 1: Inicializar Next.js + TypeScript

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `.gitignore`

- [ ] **Step 1: Bootstrap con `create-next-app`**

```bash
cd /Users/lzayas/Desktop/Pelu
pnpm create next-app@latest macna --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
mv macna/* macna/.* . 2>/dev/null || true
rmdir macna
git init
```

- [ ] **Step 2: Verificar build inicial**

Run: `pnpm install && pnpm build`
Expected: build OK, `.next/` generado.

- [ ] **Step 3: Editar `src/app/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/obras');
  redirect('/login');
}
```

(Los imports se rompen acá; los crea Task 5/9. Está OK — ya escribimos esto pensando en el final.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: bootstrap Next.js + TypeScript + Tailwind"
```

---

## Task 2: Instalar shadcn/ui

**Files:**
- Create: `components.json`, `src/components/ui/*` (varios), `src/lib/utils.ts`

- [ ] **Step 1: Init shadcn**

```bash
pnpm dlx shadcn@latest init -d
```

Defaults: New York style, Slate base color, CSS variables yes.

- [ ] **Step 2: Instalar primitives básicas**

```bash
pnpm dlx shadcn@latest add button input label card dialog dropdown-menu form select table toast sonner sheet
```

- [ ] **Step 3: Verificar build**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: install shadcn/ui primitives"
```

---

## Task 3: Variables de entorno + skeleton

**Files:**
- Create: `.env.example`, `.env.local`, edit `.gitignore`

- [ ] **Step 1: Crear `.env.example`**

```env
# Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Postgres connection (Drizzle usa estas — pooler para app, direct para migrate)
DATABASE_URL=postgresql://postgres:PASS@aws-0-XX.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:PASS@db.PROJECT.supabase.co:5432/postgres

# OAuth (configurar después en Supabase dashboard, dejar vacío en dev)
# GOOGLE_CLIENT_ID=
# APPLE_CLIENT_ID=

# Seed
SEED_ADMIN_EMAIL=admin@macna.local
SEED_ADMIN_PASSWORD=ChangeMe!Local2026
```

- [ ] **Step 2: Crear `.env.local` con valores reales**

Manual: el usuario crea el proyecto Supabase (`prod` y `dev`) en https://supabase.com/dashboard, copia URL/keys/connection strings.

> **Nota para el operador:** este paso requiere que el usuario haya creado el proyecto Supabase. Si no está creado, pausar acá y pedírselo.

- [ ] **Step 3: Asegurar `.gitignore`**

Verificar (agregar si falta):

```
.env*.local
.env
!.env.example
drizzle/.cache/
playwright-report/
test-results/
```

- [ ] **Step 4: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: env template"
```

---

## Task 4: Instalar dependencias core

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar deps de runtime**

```bash
pnpm add drizzle-orm postgres @supabase/supabase-js @supabase/ssr decimal.js zod
```

- [ ] **Step 2: Instalar deps de dev**

```bash
pnpm add -D drizzle-kit jest @types/jest ts-jest jest-environment-node @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test tsx dotenv-cli
```

- [ ] **Step 3: Agregar scripts a `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration --runInBand",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "dotenv -e .env.local -- drizzle-kit migrate",
    "db:migrate:prod": "drizzle-kit migrate",
    "db:push": "dotenv -e .env.local -- drizzle-kit push",
    "db:studio": "dotenv -e .env.local -- drizzle-kit studio",
    "db:seed": "dotenv -e .env.local -- tsx src/db/seed.ts",
    "vercel-build": "drizzle-kit migrate && next build"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: install drizzle, supabase, decimal.js, testing deps"
```

---

## Task 5: Schema Drizzle — núcleo (Usuario, Obra, Rubro)

**Files:**
- Create: `src/db/schema.ts`

- [ ] **Step 1: Crear `src/db/schema.ts` con tablas core**

```ts
import {
  pgTable, uuid, text, timestamp, boolean, integer, decimal, jsonb, pgEnum, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const rolEnum = pgEnum('rol', ['admin', 'operador']);
export const monedaEnum = pgEnum('moneda', ['USD', 'ARS']);
export const unidadEnum = pgEnum('unidad', ['m2', 'm3', 'hs', 'gl', 'u', 'ml', 'kg']);
export const estadoObraEnum = pgEnum('estado_obra', ['borrador', 'activa', 'pausada', 'cerrada', 'cancelada']);
export const tipoPresupuestoEnum = pgEnum('tipo_presupuesto', ['original', 'adicional']);
export const estadoPresupuestoEnum = pgEnum('estado_presupuesto', ['borrador', 'firmado', 'cancelado']);
export const entidadAuditEnum = pgEnum('entidad_audit', [
  'obra', 'presupuesto', 'item_presupuesto', 'usuario', 'cliente_token', 'rubro',
]);
export const accionAuditEnum = pgEnum('accion_audit', [
  'crear', 'editar', 'eliminar', 'firmar', 'cancelar', 'regenerar_token',
]);

export const usuario = pgTable('usuario', {
  id: uuid('id').primaryKey(), // mismo UUID que auth.users.id de Supabase
  email: text('email').notNull().unique(),
  nombre: text('nombre').notNull(),
  rol: rolEnum('rol').notNull(),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const obra = pgTable('obra', {
  id: uuid('id').primaryKey().defaultRandom(),
  codigo: text('codigo').notNull().unique(),
  nombre: text('nombre').notNull(),
  clienteNombre: text('cliente_nombre').notNull(),
  clienteEmail: text('cliente_email'),
  clienteTelefono: text('cliente_telefono'),
  ubicacion: text('ubicacion'),
  superficieM2: decimal('superficie_m2', { precision: 12, scale: 2 }),
  fechaInicio: timestamp('fecha_inicio', { mode: 'date' }),
  fechaFinEstimada: timestamp('fecha_fin_estimada', { mode: 'date' }),
  fechaFinReal: timestamp('fecha_fin_real', { mode: 'date' }),
  monedaBase: monedaEnum('moneda_base').notNull().default('USD'),
  cotizacionUsdInicial: decimal('cotizacion_usd_inicial', { precision: 18, scale: 4 }),
  porcentajeHonorarios: decimal('porcentaje_honorarios', { precision: 6, scale: 2 }).notNull().default('16'),
  estado: estadoObraEnum('estado').notNull().default('borrador'),
  clienteToken: text('cliente_token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').notNull().references(() => usuario.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').notNull().references(() => usuario.id),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  clienteTokenIdx: uniqueIndex('obra_cliente_token_idx').on(t.clienteToken),
}));

export const rubro = pgTable('rubro', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),
  idPadre: uuid('id_padre'),
  orden: integer('orden').notNull().default(0),
  activo: boolean('activo').notNull().default(true),
  creadoPorImportador: boolean('creado_por_importador').notNull().default(false),
});

export const rubroRelations = relations(rubro, ({ one, many }) => ({
  padre: one(rubro, { fields: [rubro.idPadre], references: [rubro.id], relationName: 'padre_hijos' }),
  hijos: many(rubro, { relationName: 'padre_hijos' }),
}));
```

- [ ] **Step 2: Verificar que compila**

Run: `pnpm tsc --noEmit`
Expected: errores solo por imports faltantes en otros archivos (esperado), no en `schema.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(db): schema core (usuario, obra, rubro)"
```

---

## Task 6: Schema Drizzle — Presupuesto + ItemPresupuesto + AuditLog + stubs F2

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Agregar Presupuesto + ItemPresupuesto al final del archivo**

```ts
export const presupuesto = pgTable('presupuesto', {
  id: uuid('id').primaryKey().defaultRandom(),
  obraId: uuid('obra_id').notNull().references(() => obra.id),
  tipo: tipoPresupuestoEnum('tipo').notNull(),
  numero: integer('numero').notNull(),
  descripcion: text('descripcion'),
  fechaEmision: timestamp('fecha_emision', { mode: 'date' }).notNull().defaultNow(),
  fechaFirma: timestamp('fecha_firma', { mode: 'date' }),
  estado: estadoPresupuestoEnum('estado').notNull().default('borrador'),
  markupDefaultPorcentaje: decimal('markup_default_porcentaje', { precision: 6, scale: 2 }).notNull().default('30'),
  cotizacionUsd: decimal('cotizacion_usd', { precision: 18, scale: 4 }).notNull(),
  templateVersion: integer('template_version').notNull().default(1),
  version: integer('version').notNull().default(1),
  totalClienteCalculado: decimal('total_cliente_calculado', { precision: 18, scale: 4 }),
  totalCostoCalculado: decimal('total_costo_calculado', { precision: 18, scale: 4 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').notNull().references(() => usuario.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').notNull().references(() => usuario.id),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  obraNumeroIdx: uniqueIndex('presupuesto_obra_numero_idx').on(t.obraId, t.numero),
}));

export const itemPresupuesto = pgTable('item_presupuesto', {
  id: uuid('id').primaryKey().defaultRandom(),
  presupuestoId: uuid('presupuesto_id').notNull().references(() => presupuesto.id, { onDelete: 'cascade' }),
  rubroId: uuid('rubro_id').notNull().references(() => rubro.id),
  orden: integer('orden').notNull().default(0),
  descripcion: text('descripcion').notNull(),
  unidad: unidadEnum('unidad').notNull(),
  cantidad: decimal('cantidad', { precision: 18, scale: 4 }).notNull(),
  costoUnitario: decimal('costo_unitario', { precision: 18, scale: 4 }).notNull(),
  costoUnitarioMoneda: monedaEnum('costo_unitario_moneda').notNull(),
  costoUnitarioBase: decimal('costo_unitario_base', { precision: 18, scale: 4 }).notNull(),
  markupPorcentaje: decimal('markup_porcentaje', { precision: 6, scale: 2 }),
  markupEfectivoPorcentaje: decimal('markup_efectivo_porcentaje', { precision: 6, scale: 2 }).notNull(),
  precioUnitarioCliente: decimal('precio_unitario_cliente', { precision: 18, scale: 4 }).notNull(),
  notas: text('notas'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  entidad: entidadAuditEnum('entidad').notNull(),
  entidadId: uuid('entidad_id').notNull(),
  accion: accionAuditEnum('accion').notNull(),
  diff: jsonb('diff'),
  descripcionHumana: text('descripcion_humana'),
  usuarioId: uuid('usuario_id').notNull().references(() => usuario.id),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
});

// Stubs F2 — sin UI, solo definición para evitar migración disruptiva.
export const tipoMovimientoEnum = pgEnum('tipo_movimiento', ['entrada', 'salida']);

export const proveedor = pgTable('proveedor', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),
  cuit: text('cuit'),
  contacto: text('contacto'),
  esContratista: boolean('es_contratista').notNull().default(false),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cuenta = pgTable('cuenta', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),
  moneda: monedaEnum('moneda').notNull(),
  tipo: text('tipo').notNull(), // 'caja' | 'banco'
  activo: boolean('activo').notNull().default(true),
});

export const movimiento = pgTable('movimiento', {
  id: uuid('id').primaryKey().defaultRandom(),
  tipo: tipoMovimientoEnum('tipo').notNull(),
  fecha: timestamp('fecha', { mode: 'date' }).notNull(),
  monto: decimal('monto', { precision: 18, scale: 4 }).notNull(),
  moneda: monedaEnum('moneda').notNull(),
  cotizacionUsd: decimal('cotizacion_usd', { precision: 18, scale: 4 }),
  cuentaId: uuid('cuenta_id').references(() => cuenta.id),
  obraId: uuid('obra_id').references(() => obra.id),
  rubroId: uuid('rubro_id').references(() => rubro.id),
  proveedorId: uuid('proveedor_id').references(() => proveedor.id),
  descripcion: text('descripcion'),
  comprobanteUrl: text('comprobante_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => usuario.id),
});
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: sin errores en `schema.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(db): schema completo (presupuesto, items, audit, stubs F2)"
```

---

## Task 7: Configurar drizzle-kit y generar migración inicial

**Files:**
- Create: `drizzle.config.ts`, `drizzle/migrations/0001_init.sql`

- [ ] **Step 1: Crear `drizzle.config.ts`**

```ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
  verbose: true,
  strict: true,
});
```

- [ ] **Step 2: Generar migración inicial**

```bash
pnpm db:generate
```

Expected: archivo `drizzle/migrations/0001_*.sql` creado.

- [ ] **Step 3: Aplicar migración a Supabase dev**

```bash
pnpm db:migrate
```

Expected: tablas creadas en Supabase dev. Verificar en dashboard.

- [ ] **Step 4: Commit**

```bash
git add drizzle.config.ts drizzle/
git commit -m "feat(db): generate and apply initial migration"
```

---

## Task 8: Trigger Postgres "escrito en piedra"

**Files:**
- Create: `drizzle/migrations/0002_escrito_en_piedra.sql`

- [ ] **Step 1: Crear archivo SQL del trigger**

```sql
-- Defensa en profundidad: rechaza UPDATE/DELETE en items de presupuestos firmados.
-- La UI y la Server Action ya validan, este es la última línea de defensa.

CREATE OR REPLACE FUNCTION rechazar_edicion_firmado()
RETURNS TRIGGER AS $$
DECLARE
  estado_pres text;
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    SELECT estado INTO estado_pres FROM presupuesto WHERE id = OLD.presupuesto_id;
  ELSIF (TG_OP = 'DELETE') THEN
    SELECT estado INTO estado_pres FROM presupuesto WHERE id = OLD.presupuesto_id;
  END IF;

  IF estado_pres = 'firmado' THEN
    RAISE EXCEPTION 'No se puede modificar items de un presupuesto firmado (presupuesto_id=%)', OLD.presupuesto_id
      USING ERRCODE = '23514'; -- check_violation
  END IF;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS escrito_en_piedra_item ON item_presupuesto;
CREATE TRIGGER escrito_en_piedra_item
  BEFORE UPDATE OR DELETE ON item_presupuesto
  FOR EACH ROW EXECUTE FUNCTION rechazar_edicion_firmado();

-- También bloquear UPDATE sobre el presupuesto firmado mismo (excepto cambio de estado a 'cancelado').
CREATE OR REPLACE FUNCTION rechazar_edicion_presupuesto_firmado()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado = 'firmado' AND NEW.estado = 'firmado' THEN
    RAISE EXCEPTION 'No se puede editar un presupuesto firmado (id=%); cancelarlo y reemitir.', OLD.id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS escrito_en_piedra_presupuesto ON presupuesto;
CREATE TRIGGER escrito_en_piedra_presupuesto
  BEFORE UPDATE ON presupuesto
  FOR EACH ROW EXECUTE FUNCTION rechazar_edicion_presupuesto_firmado();
```

- [ ] **Step 2: Aplicar la migración**

```bash
pnpm db:migrate
```

Expected: SQL ejecutado, dos triggers creados en Supabase dev.

- [ ] **Step 3: Smoke-test manual via SQL**

En Supabase SQL editor:

```sql
-- Insertar usuario, obra, presupuesto firmado, item — luego intentar UPDATE.
-- Detallamos en Task 7 del Plan 3 (test de integración formal).
-- Por ahora basta con verificar que los triggers existen:
SELECT tgname FROM pg_trigger WHERE tgname LIKE 'escrito_en_piedra%';
```

Expected: 2 filas.

- [ ] **Step 4: Commit**

```bash
git add drizzle/migrations/0002_escrito_en_piedra.sql
git commit -m "feat(db): trigger 'escrito en piedra' para presupuestos firmados"
```

---

## Task 9: Cliente Drizzle singleton

**Files:**
- Create: `src/db/client.ts`

- [ ] **Step 1: Crear el cliente**

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  pg: ReturnType<typeof postgres> | undefined;
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL no configurada');

export const pg = globalForDb.pg ?? postgres(url, { prepare: false, max: 10 });
export const db = globalForDb.db ?? drizzle(pg, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pg = pg;
  globalForDb.db = db;
}

export type DB = typeof db;
```

> `prepare: false` requerido por PgBouncer en transaction-pooling mode.

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm tsc --noEmit`
Expected: sin errores en `client.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/db/client.ts
git commit -m "feat(db): drizzle singleton client"
```

---

## Task 10: Wrappers `decimal.js` + tests de precisión

**Files:**
- Create: `src/lib/money/decimal.ts`, `tests/unit/money.test.ts`

- [ ] **Step 1: Crear `src/lib/money/decimal.ts`**

```ts
import Decimal from 'decimal.js';

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_EVEN });

export type DecimalInput = string | number | Decimal;

export function D(v: DecimalInput): Decimal {
  return new Decimal(v);
}

export function add(...xs: DecimalInput[]): Decimal {
  return xs.reduce<Decimal>((acc, x) => acc.plus(x), new Decimal(0));
}

export function sub(a: DecimalInput, b: DecimalInput): Decimal {
  return D(a).minus(b);
}

export function mul(a: DecimalInput, b: DecimalInput): Decimal {
  return D(a).times(b);
}

export function div(a: DecimalInput, b: DecimalInput): Decimal {
  return D(a).div(b);
}

/** Convierte string columnar de Postgres (decimal) a Decimal. */
export function parseDb(v: string | null | undefined): Decimal | null {
  if (v == null) return null;
  return new Decimal(v);
}

/** Serializa a string para columnas Postgres `decimal(p, s)`. */
export function toDb(v: Decimal, scale = 4): string {
  return v.toFixed(scale);
}

/** Formatea para mostrar al usuario. */
export function fmt(v: Decimal, scale = 2): string {
  return v.toFixed(scale);
}
```

- [ ] **Step 2: Escribir test fallido**

```ts
// tests/unit/money.test.ts
import Decimal from 'decimal.js';
import { D, add, mul, div, parseDb, toDb } from '@/lib/money/decimal';

describe('money/decimal', () => {
  it('0.1 + 0.2 = 0.3 (sin error de coma flotante)', () => {
    const r = add('0.1', '0.2');
    expect(r.equals(new Decimal('0.3'))).toBe(true);
    expect(r.toFixed(1)).toBe('0.3');
  });

  it('cálculo de markup con 4 decimales', () => {
    // costo 123.4567 * (1 + 0.3) = 160.49371
    const costo = D('123.4567');
    const markup = D('30');
    const precio = mul(costo, add(1, div(markup, 100)));
    expect(precio.toFixed(4)).toBe('160.4937');
  });

  it('parseDb null-safe', () => {
    expect(parseDb(null)).toBeNull();
    expect(parseDb('1.2300')!.equals(D('1.23'))).toBe(true);
  });

  it('toDb redondea half-even', () => {
    expect(toDb(D('0.12345'), 4)).toBe('0.1234'); // banker's rounding
    expect(toDb(D('0.12355'), 4)).toBe('0.1236');
  });

  it('conversión USD→ARS preserva precisión', () => {
    // $1.23 * 1234.5678 = 1518.518394
    const ars = mul('1.23', '1234.5678');
    expect(ars.toFixed(6)).toBe('1518.518394');
  });
});
```

- [ ] **Step 3: Configurar Jest**

Crear `jest.config.ts`:

```ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/tests/e2e/'],
};

export default config;
```

Crear `jest.setup.ts`:

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Correr el test**

Run: `pnpm test:unit`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/money/decimal.ts tests/unit/money.test.ts jest.config.ts jest.setup.ts
git commit -m "feat(money): decimal.js wrappers + precision tests"
```

---

## Task 11: Clientes Supabase (server / browser / admin)

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`, `src/lib/supabase/admin.ts`

- [ ] **Step 1: `src/lib/supabase/server.ts`**

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components no pueden setear cookies — es esperado, lo hace el middleware.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 2: `src/lib/supabase/browser.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: `src/lib/supabase/admin.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

/** Service-role client. SOLO para seed/scripts/server-side admin. NUNCA exponer al browser. */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
```

- [ ] **Step 4: Type-check + commit**

```bash
pnpm tsc --noEmit
git add src/lib/supabase/
git commit -m "feat(auth): supabase clients (server, browser, admin)"
```

---

## Task 12: Middleware de sesión

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Crear middleware**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Rutas públicas
  const publicPaths = ['/login', '/auth/callback', '/cliente'];
  const isPublic = publicPaths.some((p) => path === p || path.startsWith(p + '/'));

  if (!isPublic && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  if (user && (path === '/login' || path === '/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/obras';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/pdf).*)'],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(auth): middleware enforces session on internal routes"
```

---

## Task 13: Helpers de autorización

**Files:**
- Create: `src/lib/auth/types.ts`, `src/lib/auth/require.ts`

- [ ] **Step 1: `src/lib/auth/types.ts`**

```ts
export type Rol = 'admin' | 'operador';

export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}
```

- [ ] **Step 2: `src/lib/auth/require.ts`**

```ts
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { db } from '@/db/client';
import { usuario } from '@/db/schema';
import type { SessionUser } from './types';

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const [u] = await db.select().from(usuario).where(eq(usuario.id, data.user.id)).limit(1);
  if (!u || !u.activo) return null;

  return { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol };
}

export async function requireSession(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect('/login');
  return u;
}

export async function requireRole(rol: 'admin'): Promise<SessionUser> {
  const u = await requireSession();
  if (u.rol !== rol) {
    throw new Response('Forbidden', { status: 403 });
  }
  return u;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/
git commit -m "feat(auth): session + role helpers"
```

---

## Task 14: Página de login + Server Action

**Files:**
- Create: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/actions.ts`, `src/app/(auth)/login/login-form.tsx`

- [ ] **Step 1: Server Action**

```ts
// src/app/(auth)/login/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function iniciarSesion(prev: { error?: string } | null, formData: FormData) {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next'),
  });
  if (!parsed.success) return { error: 'Datos inválidos' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: 'Email o contraseña incorrectos' };

  redirect(parsed.data.next || '/obras');
}

export async function iniciarSesionGoogle() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
  });
  if (error || !data.url) return { error: 'Error iniciando OAuth' };
  redirect(data.url);
}

export async function iniciarSesionApple() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
  });
  if (error || !data.url) return { error: 'Error iniciando OAuth' };
  redirect(data.url);
}
```

- [ ] **Step 2: Form (cliente)**

```tsx
// src/app/(auth)/login/login-form.tsx
'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { iniciarSesion } from './actions';

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(iniciarSesion, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ''} />
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Ingresando...' : 'Ingresar'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Page**

```tsx
// src/app/(auth)/login/page.tsx
import { LoginForm } from './login-form';
import { iniciarSesionGoogle, iniciarSesionApple } from './actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Macna · Ingresar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm next={next} />
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">o</span></div>
          </div>
          <form action={iniciarSesionGoogle}><Button variant="outline" className="w-full">Continuar con Google</Button></form>
          <form action={iniciarSesionApple}><Button variant="outline" className="w-full">Continuar con Apple</Button></form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Verificar manual**

Run: `pnpm dev`
Abrir `http://localhost:3000/login`. Form debe verse correctamente. (Sin admin sembrado todavía no se loguea — eso lo hace Task 16.)

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/
git commit -m "feat(auth): login page + email/password + OAuth actions"
```

---

## Task 15: Callback OAuth

**Files:**
- Create: `src/app/(auth)/auth/callback/route.ts`

- [ ] **Step 1: Crear handler**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/obras';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL('/login?error=oauth', request.url));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(auth\)/auth/callback/
git commit -m "feat(auth): OAuth callback handler"
```

---

## Task 16: Layout interno + dashboard placeholder

**Files:**
- Create: `src/app/(internal)/layout.tsx`, `src/app/(internal)/page.tsx`, `src/app/(internal)/sign-out-action.ts`

- [ ] **Step 1: Action de logout**

```ts
// src/app/(internal)/sign-out-action.ts
'use server';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function cerrarSesion() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

- [ ] **Step 2: Layout**

```tsx
// src/app/(internal)/layout.tsx
import Link from 'next/link';
import { requireSession } from '@/lib/auth/require';
import { Button } from '@/components/ui/button';
import { cerrarSesion } from './sign-out-action';

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const isAdmin = user.rol === 'admin';
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r bg-slate-50 p-4 flex flex-col gap-1">
        <div className="font-bold mb-4">Macna</div>
        <Link href="/obras" className="px-2 py-1 rounded hover:bg-slate-200">Obras</Link>
        {isAdmin && (
          <>
            <Link href="/configuracion/rubros" className="px-2 py-1 rounded hover:bg-slate-200">Rubros</Link>
            <Link href="/configuracion/usuarios" className="px-2 py-1 rounded hover:bg-slate-200">Usuarios</Link>
            <Link href="/configuracion/auditoria" className="px-2 py-1 rounded hover:bg-slate-200">Auditoría</Link>
          </>
        )}
        <div className="mt-auto text-xs text-muted-foreground">
          <div className="mb-2">{user.nombre} ({user.rol})</div>
          <form action={cerrarSesion}>
            <Button variant="ghost" size="sm" type="submit">Salir</Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Dashboard placeholder**

```tsx
// src/app/(internal)/page.tsx
import { redirect } from 'next/navigation';
export default function Index() { redirect('/obras'); }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(internal\)/
git commit -m "feat(layout): internal layout with sidebar + sign out"
```

---

## Task 17: Seed (rubros + primer admin)

**Files:**
- Create: `src/db/seed.ts`, `src/db/seed-data.ts`

- [ ] **Step 1: Datos del seed**

```ts
// src/db/seed-data.ts
export const RUBROS_BASE = [
  { nombre: 'Trabajos preliminares', orden: 1 },
  { nombre: 'Demoliciones', orden: 2 },
  { nombre: 'Excavaciones', orden: 3 },
  { nombre: 'Albañilería', orden: 4 },
  { nombre: 'Hormigón armado', orden: 5 },
  { nombre: 'Cubiertas', orden: 6 },
  { nombre: 'Aislaciones', orden: 7 },
  { nombre: 'Revoques', orden: 8 },
  { nombre: 'Contrapisos y carpetas', orden: 9 },
  { nombre: 'Revestimientos', orden: 10 },
  { nombre: 'Pisos', orden: 11 },
  { nombre: 'Cielorrasos', orden: 12 },
  { nombre: 'Carpinterías', orden: 13 },
  { nombre: 'Pinturas', orden: 14 },
  { nombre: 'Instalaciones', orden: 15, hijos: [
    { nombre: 'Sanitarias', orden: 1 },
    { nombre: 'Gas', orden: 2 },
    { nombre: 'Eléctrica', orden: 3 },
    { nombre: 'Termomecánica', orden: 4 },
  ]},
  { nombre: 'Equipamiento', orden: 16 },
  { nombre: 'Limpieza final', orden: 17 },
];
```

- [ ] **Step 2: Script de seed**

```ts
// src/db/seed.ts
import 'dotenv/config';
import { randomBytes } from 'crypto';
import { db } from './client';
import { usuario, rubro } from './schema';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { RUBROS_BASE } from './seed-data';
import { eq } from 'drizzle-orm';

async function seedRubros() {
  for (const r of RUBROS_BASE) {
    const [exists] = await db.select().from(rubro).where(eq(rubro.nombre, r.nombre)).limit(1);
    if (exists) continue;
    const [created] = await db.insert(rubro).values({ nombre: r.nombre, orden: r.orden }).returning();
    if ('hijos' in r && r.hijos) {
      for (const h of r.hijos) {
        await db.insert(rubro).values({ nombre: h.nombre, orden: h.orden, idPadre: created.id });
      }
    }
  }
  console.log('✓ Rubros sembrados');
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD requeridos en .env.local');
  }

  const admin = createSupabaseAdminClient();
  // Crear/buscar usuario en Supabase Auth.
  let userId: string;
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list.users.find((u) => u.email === email);
  if (existing) {
    userId = existing.id;
    console.log('✓ Admin ya existía en Supabase Auth');
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log('✓ Admin creado en Supabase Auth');
  }

  // Espejo en tabla `usuario`.
  const [exists] = await db.select().from(usuario).where(eq(usuario.id, userId)).limit(1);
  if (!exists) {
    await db.insert(usuario).values({
      id: userId, email, nombre: 'Admin Macna', rol: 'admin', activo: true,
    });
    console.log('✓ Admin espejado en tabla usuario');
  }
}

async function main() {
  await seedRubros();
  await seedAdmin();
  console.log('Seed completado.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Correr seed**

```bash
pnpm db:seed
```

Expected: rubros y admin creados. Verificar en Supabase dashboard (Auth + Table editor).

- [ ] **Step 4: Probar login end-to-end**

```bash
pnpm dev
```

Abrir `/login`, ingresar con `SEED_ADMIN_EMAIL` + password. Debe redirigir a `/obras` (404 todavía, normal — Plan 2 lo crea).

- [ ] **Step 5: Commit**

```bash
git add src/db/seed.ts src/db/seed-data.ts
git commit -m "feat(seed): rubros estándar + primer admin"
```

---

## Task 18: CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Workflow**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test:unit
      # integration y e2e se agregan en planes posteriores
      - run: pnpm tsc --noEmit
      - run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
          DIRECT_URL: postgresql://postgres:postgres@localhost:5432/postgres
```

- [ ] **Step 2: Push y verificar verde**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: lint + unit tests + typecheck + build"
git push -u origin main
```

Expected: GitHub Actions verde.

---

## Verificación final del Plan 1

- [ ] `pnpm dev` levanta servidor.
- [ ] `/login` muestra form.
- [ ] Login con SEED_ADMIN funciona.
- [ ] `pnpm test:unit` PASS (5 tests).
- [ ] `pnpm tsc --noEmit` sin errores.
- [ ] CI verde en GitHub.
- [ ] Tablas en Supabase dev: usuario, obra, rubro, presupuesto, item_presupuesto, audit_log, proveedor, cuenta, movimiento + 2 triggers.

**Salida**: app que se loguea pero todavía no tiene UI de dominio. Lista para Plan 2.
