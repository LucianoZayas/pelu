# Plan 3 — Editor de Presupuesto

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Asume:** Planes 1 y 2 mergeados.

**Goal:** Admin puede crear presupuestos (original + adicionales), agregar/editar/eliminar items con markup + conversión USD/ARS, snapshots persistidos, concurrencia optimista (`version`), firmar/cancelar. Trigger Postgres bloquea ediciones de items en presupuestos firmados (verificado por test). Editor con acordeón por rubro, tabla virtualizada, autosave.

**Architecture:** Toda la lógica financiera vive en `features/presupuestos/services/` como funciones puras tomando/retornando `Decimal`. Las Server Actions orquestan: cargar → validar `version` → llamar servicios → persistir → audit. El editor cliente usa `react-hook-form` + `useFieldArray` por rubro con virtualización `@tanstack/react-virtual`. Conflicto de versión devuelve error `STALE_VERSION` y la UI bloquea hasta refresh.

**Tech Stack:** decimal.js, Drizzle, react-hook-form, @tanstack/react-virtual, zod, shadcn/ui.

---

## File Structure

```
src/features/presupuestos/
  services/
    markup.ts             # calcularPrecioCliente
    currency.ts           # convertirAMonedaBase
    snapshots.ts          # calcularSnapshotItem, recalcularSnapshotsPresupuesto
  errors.ts               # StaleVersionError, ImmutableError, ItemValidationError
  schema.ts               # Zod schemas: NuevoPresupuestoInput, ItemInput, GuardarPresupuestoInput
  queries.ts              # getPresupuesto(id), listarPresupuestosDeObra, getItemsConRubros
  actions.ts              # crearPresupuesto, guardarPresupuesto (con version), firmar, cancelar
  totales.ts              # función pura: calcular totales agregados
  components/
    presupuesto-editor.tsx   # <Suspense>boundary del editor cliente
    editor-form.tsx          # client component principal
    rubro-acordeon.tsx       # acordeón colapsable por rubro
    items-tabla.tsx          # tabla con virtualización
    item-row.tsx             # fila editable (memoizada)
    firmar-dialog.tsx        # modal de confirmación con preview
    cancelar-dialog.tsx
    stale-version-banner.tsx
    totales-footer.tsx
  hooks/
    use-autosave.ts
    use-rubros-options.ts

src/app/(internal)/obras/[id]/presupuestos/
  nuevo/page.tsx
  [presId]/page.tsx

tests/unit/
  markup.test.ts
  currency.test.ts
  snapshots.test.ts
  totales.test.ts

tests/integration/
  presupuestos-crud.test.ts
  presupuestos-concurrency.test.ts
  presupuestos-trigger.test.ts
  presupuestos-firmar.test.ts
```

---

## Task 1: Errores tipados

**Files:**
- Create: `src/features/presupuestos/errors.ts`

- [ ] **Step 1: Definir clases**

```ts
export class StaleVersionError extends Error {
  readonly code = 'STALE_VERSION' as const;
  constructor(public readonly currentVersion: number) {
    super('El presupuesto fue editado por otro usuario. Recargá para ver los cambios.');
  }
}

export class ImmutableError extends Error {
  readonly code = 'IMMUTABLE' as const;
  constructor() { super('Este presupuesto está firmado y no puede modificarse.'); }
}

export class ItemValidationError extends Error {
  readonly code = 'ITEM_VALIDATION' as const;
  constructor(public readonly issues: { item: number; field: string; message: string }[]) {
    super('Hay errores en los items.');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/presupuestos/errors.ts
git commit -m "feat(presupuestos): typed errors"
```

---

## Task 2: Service `markup.ts` (TDD)

**Files:**
- Create: `src/features/presupuestos/services/markup.ts`, `tests/unit/markup.test.ts`

- [ ] **Step 1: Test fallido**

```ts
// tests/unit/markup.test.ts
import { D } from '@/lib/money/decimal';
import { calcularPrecioCliente, markupEfectivo } from '@/features/presupuestos/services/markup';

describe('markup service', () => {
  it('precio cliente = costoBase × (1 + markup/100)', () => {
    const precio = calcularPrecioCliente(D('100'), D('30'));
    expect(precio.toFixed(4)).toBe('130.0000');
  });

  it('markup 0 → precio = costo', () => {
    expect(calcularPrecioCliente(D('99.99'), D('0')).toFixed(4)).toBe('99.9900');
  });

  it('markup negativo (descuento) válido', () => {
    expect(calcularPrecioCliente(D('100'), D('-10')).toFixed(4)).toBe('90.0000');
  });

  it('markupEfectivo: usa markup item si está, si no el del presupuesto', () => {
    expect(markupEfectivo(null, D('30')).toFixed(2)).toBe('30.00');
    expect(markupEfectivo(D('45.5'), D('30')).toFixed(2)).toBe('45.50');
    expect(markupEfectivo(D('0'), D('30')).toFixed(2)).toBe('0.00'); // markup explícito 0 NO hereda
  });

  it('precisión: 33.33% sobre 99.99', () => {
    const precio = calcularPrecioCliente(D('99.99'), D('33.33'));
    // 99.99 * 1.3333 = 133.316667
    expect(precio.toFixed(6)).toBe('133.316667');
  });
});
```

- [ ] **Step 2: Verificar fail**

Run: `pnpm test:unit -- markup`
Expected: FAIL.

- [ ] **Step 3: Implementación**

```ts
// src/features/presupuestos/services/markup.ts
import Decimal from 'decimal.js';
import { D } from '@/lib/money/decimal';

export function markupEfectivo(itemMarkup: Decimal | null, defaultMarkup: Decimal): Decimal {
  return itemMarkup ?? defaultMarkup;
}

export function calcularPrecioCliente(costoBase: Decimal, markupPct: Decimal): Decimal {
  const factor = D(1).plus(markupPct.div(100));
  return costoBase.times(factor);
}
```

- [ ] **Step 4: Run + commit**

Run: `pnpm test:unit -- markup` → PASS.

```bash
git add src/features/presupuestos/services/markup.ts tests/unit/markup.test.ts
git commit -m "feat(presupuestos): markup service + tests"
```

---

## Task 3: Service `currency.ts` (TDD)

**Files:**
- Create: `src/features/presupuestos/services/currency.ts`, `tests/unit/currency.test.ts`

- [ ] **Step 1: Test fallido**

```ts
// tests/unit/currency.test.ts
import { D } from '@/lib/money/decimal';
import { convertirAMonedaBase } from '@/features/presupuestos/services/currency';

describe('currency.convertirAMonedaBase', () => {
  it('USD→USD identidad', () => {
    expect(convertirAMonedaBase(D('100'), 'USD', 'USD', D('1200')).toFixed(4)).toBe('100.0000');
  });

  it('ARS→ARS identidad', () => {
    expect(convertirAMonedaBase(D('120000'), 'ARS', 'ARS', D('1200')).toFixed(4)).toBe('120000.0000');
  });

  it('ARS→USD: monto / cotizacion', () => {
    // 120000 ARS / 1200 = 100 USD
    expect(convertirAMonedaBase(D('120000'), 'ARS', 'USD', D('1200')).toFixed(4)).toBe('100.0000');
  });

  it('USD→ARS: monto * cotizacion', () => {
    expect(convertirAMonedaBase(D('100'), 'USD', 'ARS', D('1200')).toFixed(4)).toBe('120000.0000');
  });

  it('lanza si cotizacion es 0', () => {
    expect(() => convertirAMonedaBase(D('100'), 'ARS', 'USD', D('0'))).toThrow();
  });

  it('preserva precisión en conversiones grandes', () => {
    // 1234.5678 USD * 1234.5678 = 1524155.6585...
    const r = convertirAMonedaBase(D('1234.5678'), 'USD', 'ARS', D('1234.5678'));
    expect(r.toFixed(4)).toBe('1524155.6586');
  });
});
```

- [ ] **Step 2: Implementación**

```ts
// src/features/presupuestos/services/currency.ts
import Decimal from 'decimal.js';

export type Moneda = 'USD' | 'ARS';

export function convertirAMonedaBase(
  monto: Decimal,
  origen: Moneda,
  base: Moneda,
  cotizacionUsd: Decimal,
): Decimal {
  if (origen === base) return monto;
  if (cotizacionUsd.isZero()) {
    throw new Error('cotizacion_usd no puede ser 0 cuando hay conversión');
  }
  if (origen === 'ARS' && base === 'USD') return monto.div(cotizacionUsd);
  if (origen === 'USD' && base === 'ARS') return monto.times(cotizacionUsd);
  throw new Error(`Conversión no soportada ${origen}→${base}`);
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm test:unit -- currency
git add src/features/presupuestos/services/currency.ts tests/unit/currency.test.ts
git commit -m "feat(presupuestos): currency service + tests"
```

---

## Task 4: Service `snapshots.ts` (TDD)

**Files:**
- Create: `src/features/presupuestos/services/snapshots.ts`, `tests/unit/snapshots.test.ts`

- [ ] **Step 1: Test fallido**

```ts
// tests/unit/snapshots.test.ts
import { D } from '@/lib/money/decimal';
import { calcularSnapshotItem, type ItemRaw, type PresupuestoCtx } from '@/features/presupuestos/services/snapshots';

const ctx: PresupuestoCtx = {
  monedaBase: 'USD',
  cotizacionUsd: D('1200'),
  markupDefault: D('30'),
};

describe('snapshots.calcularSnapshotItem', () => {
  it('caso simple USD obra USD costo', () => {
    const item: ItemRaw = {
      cantidad: D('10'), costoUnitario: D('100'), costoUnitarioMoneda: 'USD',
      markupPorcentaje: null,
    };
    const s = calcularSnapshotItem(item, ctx);
    expect(s.costoUnitarioBase.toFixed(4)).toBe('100.0000');
    expect(s.markupEfectivoPorcentaje.toFixed(2)).toBe('30.00');
    expect(s.precioUnitarioCliente.toFixed(4)).toBe('130.0000');
  });

  it('costo ARS, obra USD, conversión vía cotizacion', () => {
    const item: ItemRaw = {
      cantidad: D('1'), costoUnitario: D('120000'), costoUnitarioMoneda: 'ARS',
      markupPorcentaje: null,
    };
    const s = calcularSnapshotItem(item, ctx);
    expect(s.costoUnitarioBase.toFixed(4)).toBe('100.0000'); // 120000 / 1200
    expect(s.precioUnitarioCliente.toFixed(4)).toBe('130.0000');
  });

  it('markup override por item', () => {
    const item: ItemRaw = {
      cantidad: D('1'), costoUnitario: D('100'), costoUnitarioMoneda: 'USD',
      markupPorcentaje: D('50'),
    };
    const s = calcularSnapshotItem(item, ctx);
    expect(s.markupEfectivoPorcentaje.toFixed(2)).toBe('50.00');
    expect(s.precioUnitarioCliente.toFixed(4)).toBe('150.0000');
  });

  it('subtotal = cantidad × precio cliente', () => {
    const item: ItemRaw = {
      cantidad: D('3.5'), costoUnitario: D('100'), costoUnitarioMoneda: 'USD',
      markupPorcentaje: null,
    };
    const s = calcularSnapshotItem(item, ctx);
    expect(s.subtotalCliente.toFixed(4)).toBe('455.0000'); // 3.5 * 130
    expect(s.subtotalCosto.toFixed(4)).toBe('350.0000');
  });

  it('precisión: items con muchos decimales', () => {
    const item: ItemRaw = {
      cantidad: D('1.7777'), costoUnitario: D('123.4567'),
      costoUnitarioMoneda: 'USD', markupPorcentaje: D('33.33'),
    };
    const s = calcularSnapshotItem(item, ctx);
    // costoBase = 123.4567
    // precioCliente = 123.4567 * 1.3333 = 164.5961...
    // subtotal = 1.7777 * precioCliente
    expect(s.precioUnitarioCliente.toFixed(6)).toBe('164.596120');
    expect(s.subtotalCliente.toFixed(6)).toBe('292.604724');
  });
});
```

- [ ] **Step 2: Implementación**

```ts
// src/features/presupuestos/services/snapshots.ts
import Decimal from 'decimal.js';
import { convertirAMonedaBase, type Moneda } from './currency';
import { calcularPrecioCliente, markupEfectivo } from './markup';

export interface ItemRaw {
  cantidad: Decimal;
  costoUnitario: Decimal;
  costoUnitarioMoneda: Moneda;
  markupPorcentaje: Decimal | null;
}

export interface PresupuestoCtx {
  monedaBase: Moneda;
  cotizacionUsd: Decimal;
  markupDefault: Decimal;
}

export interface ItemSnapshot {
  costoUnitarioBase: Decimal;
  markupEfectivoPorcentaje: Decimal;
  precioUnitarioCliente: Decimal;
  subtotalCosto: Decimal;
  subtotalCliente: Decimal;
}

export function calcularSnapshotItem(item: ItemRaw, ctx: PresupuestoCtx): ItemSnapshot {
  const costoBase = convertirAMonedaBase(
    item.costoUnitario, item.costoUnitarioMoneda, ctx.monedaBase, ctx.cotizacionUsd,
  );
  const markupPct = markupEfectivo(item.markupPorcentaje, ctx.markupDefault);
  const precio = calcularPrecioCliente(costoBase, markupPct);
  return {
    costoUnitarioBase: costoBase,
    markupEfectivoPorcentaje: markupPct,
    precioUnitarioCliente: precio,
    subtotalCosto: costoBase.times(item.cantidad),
    subtotalCliente: precio.times(item.cantidad),
  };
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm test:unit -- snapshots
git add src/features/presupuestos/services/snapshots.ts tests/unit/snapshots.test.ts
git commit -m "feat(presupuestos): snapshots service + tests"
```

---

## Task 5: Totales agregados (TDD)

**Files:**
- Create: `src/features/presupuestos/totales.ts`, `tests/unit/totales.test.ts`

- [ ] **Step 1: Test**

```ts
// tests/unit/totales.test.ts
import { D } from '@/lib/money/decimal';
import { calcularTotales } from '@/features/presupuestos/totales';

describe('totales', () => {
  it('suma de subtotales por rubro', () => {
    const items = [
      { rubroId: 'r1', subtotalCosto: D('100'), subtotalCliente: D('130') },
      { rubroId: 'r1', subtotalCosto: D('50'), subtotalCliente: D('65') },
      { rubroId: 'r2', subtotalCosto: D('200'), subtotalCliente: D('260') },
    ];
    const t = calcularTotales(items);
    expect(t.totalCosto.toFixed(2)).toBe('350.00');
    expect(t.totalCliente.toFixed(2)).toBe('455.00');
    expect(t.porRubro['r1'].subtotalCliente.toFixed(2)).toBe('195.00');
    expect(t.porRubro['r2'].subtotalCliente.toFixed(2)).toBe('260.00');
  });
});
```

- [ ] **Step 2: Implementación**

```ts
// src/features/presupuestos/totales.ts
import Decimal from 'decimal.js';
import { D, add } from '@/lib/money/decimal';

export interface ItemAgg {
  rubroId: string;
  subtotalCosto: Decimal;
  subtotalCliente: Decimal;
}

export interface Totales {
  totalCosto: Decimal;
  totalCliente: Decimal;
  porRubro: Record<string, { subtotalCosto: Decimal; subtotalCliente: Decimal }>;
}

export function calcularTotales(items: ItemAgg[]): Totales {
  const porRubro: Totales['porRubro'] = {};
  let totalCosto = D(0);
  let totalCliente = D(0);
  for (const i of items) {
    if (!porRubro[i.rubroId]) porRubro[i.rubroId] = { subtotalCosto: D(0), subtotalCliente: D(0) };
    porRubro[i.rubroId].subtotalCosto = porRubro[i.rubroId].subtotalCosto.plus(i.subtotalCosto);
    porRubro[i.rubroId].subtotalCliente = porRubro[i.rubroId].subtotalCliente.plus(i.subtotalCliente);
    totalCosto = totalCosto.plus(i.subtotalCosto);
    totalCliente = totalCliente.plus(i.subtotalCliente);
  }
  return { totalCosto, totalCliente, porRubro };
}
```

- [ ] **Step 3: Commit**

```bash
pnpm test:unit -- totales
git add src/features/presupuestos/totales.ts tests/unit/totales.test.ts
git commit -m "feat(presupuestos): totales aggregator"
```

---

## Task 6: Schema Zod + queries

**Files:**
- Create: `src/features/presupuestos/schema.ts`, `queries.ts`

- [ ] **Step 1: Schemas Zod**

```ts
// src/features/presupuestos/schema.ts
import { z } from 'zod';

const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/);

export const itemInputSchema = z.object({
  id: z.string().uuid().optional(),
  rubroId: z.string().uuid(),
  orden: z.number().int().min(0),
  descripcion: z.string().min(1).max(500),
  unidad: z.enum(['m2', 'm3', 'hs', 'gl', 'u', 'ml', 'kg']),
  cantidad: decimalString,
  costoUnitario: decimalString,
  costoUnitarioMoneda: z.enum(['USD', 'ARS']),
  markupPorcentaje: decimalString.nullable(),
  notas: z.string().max(1000).nullable(),
});
export type ItemInput = z.infer<typeof itemInputSchema>;

export const nuevoPresupuestoSchema = z.object({
  obraId: z.string().uuid(),
  tipo: z.enum(['original', 'adicional']),
  descripcion: z.string().max(500).nullable(),
  markupDefaultPorcentaje: decimalString.default('30'),
  cotizacionUsd: decimalString,
});
export type NuevoPresupuestoInput = z.infer<typeof nuevoPresupuestoSchema>;

export const guardarPresupuestoSchema = z.object({
  presupuestoId: z.string().uuid(),
  version: z.number().int().min(1),
  descripcion: z.string().max(500).nullable(),
  markupDefaultPorcentaje: decimalString,
  cotizacionUsd: decimalString,
  items: z.array(itemInputSchema),
});
export type GuardarPresupuestoInput = z.infer<typeof guardarPresupuestoSchema>;
```

- [ ] **Step 2: Queries**

```ts
// src/features/presupuestos/queries.ts
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { presupuesto, itemPresupuesto, rubro, obra } from '@/db/schema';

export async function listarPresupuestosDeObra(obraId: string) {
  return db.select().from(presupuesto)
    .where(and(eq(presupuesto.obraId, obraId), isNull(presupuesto.deletedAt)))
    .orderBy(asc(presupuesto.numero));
}

export async function getPresupuesto(id: string) {
  const [p] = await db.select().from(presupuesto)
    .where(and(eq(presupuesto.id, id), isNull(presupuesto.deletedAt))).limit(1);
  if (!p) return null;
  const [o] = await db.select().from(obra).where(eq(obra.id, p.obraId));
  return { ...p, obra: o };
}

export async function getItemsConRubros(presupuestoId: string) {
  return db.select({
    item: itemPresupuesto,
    rubro: rubro,
  }).from(itemPresupuesto)
    .leftJoin(rubro, eq(itemPresupuesto.rubroId, rubro.id))
    .where(and(eq(itemPresupuesto.presupuestoId, presupuestoId), isNull(itemPresupuesto.deletedAt)))
    .orderBy(asc(itemPresupuesto.orden));
}

export async function getMaxNumero(obraId: string): Promise<number> {
  const rows = await db.select({ numero: presupuesto.numero }).from(presupuesto)
    .where(eq(presupuesto.obraId, obraId)).orderBy(desc(presupuesto.numero)).limit(1);
  return rows[0]?.numero ?? 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/presupuestos/schema.ts src/features/presupuestos/queries.ts
git commit -m "feat(presupuestos): zod + queries"
```

---

## Task 7: Server Actions — crear, guardar, firmar, cancelar (TDD)

**Files:**
- Create: `src/features/presupuestos/actions.ts`, `tests/integration/presupuestos-crud.test.ts`

- [ ] **Step 1: Test integración (CRUD básico)**

```ts
// tests/integration/presupuestos-crud.test.ts
import { resetDb } from './setup';
import { makeUsuario, makeRubro, makeObra } from './factories';
import { db } from '@/db/client';
import { presupuesto, itemPresupuesto } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as actions from '@/features/presupuestos/actions';

jest.mock('@/lib/auth/require', () => ({ requireRole: jest.fn() }));
import * as auth from '@/lib/auth/require';

describe('presupuestos CRUD', () => {
  beforeEach(async () => { await resetDb(); jest.clearAllMocks(); });

  it('crea presupuesto original con numero=1, version=1', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);
    const o = await makeObra(admin.id);

    const r = await actions.crearPresupuesto({
      obraId: o.id, tipo: 'original',
      descripcion: 'Original', markupDefaultPorcentaje: '30', cotizacionUsd: '1200',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [p] = await db.select().from(presupuesto).where(eq(presupuesto.id, r.id));
    expect(p.numero).toBe(1);
    expect(p.tipo).toBe('original');
    expect(p.estado).toBe('borrador');
    expect(p.version).toBe(1);
  });

  it('un segundo presupuesto en la misma obra es adicional con numero=2', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);
    const o = await makeObra(admin.id);
    await actions.crearPresupuesto({ obraId: o.id, tipo: 'original', descripcion: null, markupDefaultPorcentaje: '30', cotizacionUsd: '1200' });
    const r2 = await actions.crearPresupuesto({ obraId: o.id, tipo: 'adicional', descripcion: 'Ad 1', markupDefaultPorcentaje: '30', cotizacionUsd: '1300' });
    if (!r2.ok) throw new Error();
    const [p2] = await db.select().from(presupuesto).where(eq(presupuesto.id, r2.id));
    expect(p2.numero).toBe(2);
    expect(p2.tipo).toBe('adicional');
  });

  it('guarda items con snapshots calculados y persistidos', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);
    const o = await makeObra(admin.id);
    const ru = await makeRubro();
    const r = await actions.crearPresupuesto({ obraId: o.id, tipo: 'original', descripcion: null, markupDefaultPorcentaje: '30', cotizacionUsd: '1200' });
    if (!r.ok) throw new Error();

    const guard = await actions.guardarPresupuesto({
      presupuestoId: r.id, version: 1,
      descripcion: null, markupDefaultPorcentaje: '30', cotizacionUsd: '1200',
      items: [{
        rubroId: ru.id, orden: 0, descripcion: 'Demolición muro',
        unidad: 'm2', cantidad: '20', costoUnitario: '100',
        costoUnitarioMoneda: 'USD', markupPorcentaje: null, notas: null,
      }],
    });
    expect(guard.ok).toBe(true);

    const items = await db.select().from(itemPresupuesto).where(eq(itemPresupuesto.presupuestoId, r.id));
    expect(items).toHaveLength(1);
    expect(items[0].costoUnitarioBase).toBe('100.0000');
    expect(items[0].markupEfectivoPorcentaje).toBe('30.00');
    expect(items[0].precioUnitarioCliente).toBe('130.0000');
  });
});
```

- [ ] **Step 2: Implementación**

```ts
// src/features/presupuestos/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { presupuesto, itemPresupuesto } from '@/db/schema';
import { requireRole } from '@/lib/auth/require';
import { logAudit } from '@/features/audit/log';
import { D, toDb } from '@/lib/money/decimal';
import { calcularSnapshotItem, type PresupuestoCtx } from './services/snapshots';
import { calcularTotales } from './totales';
import {
  nuevoPresupuestoSchema, guardarPresupuestoSchema,
  type NuevoPresupuestoInput, type GuardarPresupuestoInput,
} from './schema';
import { getMaxNumero, getPresupuesto, getItemsConRubros } from './queries';
import { StaleVersionError, ImmutableError } from './errors';

type Result<T = void> = ({ ok: true } & (T extends { id: string } ? { id: string } : object)) | { ok: false; error: string; code?: string };

export async function crearPresupuesto(input: NuevoPresupuestoInput): Promise<Result<{ id: string }>> {
  const admin = await requireRole('admin');
  const parsed = nuevoPresupuestoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const tieneOriginal = (await db.select({ id: presupuesto.id }).from(presupuesto)
    .where(and(eq(presupuesto.obraId, parsed.data.obraId), eq(presupuesto.tipo, 'original'), isNull(presupuesto.deletedAt)))
    .limit(1)).length > 0;
  if (parsed.data.tipo === 'original' && tieneOriginal) {
    return { ok: false, error: 'La obra ya tiene presupuesto original' };
  }
  if (parsed.data.tipo === 'adicional' && !tieneOriginal) {
    return { ok: false, error: 'No se puede crear adicional sin original previo' };
  }

  const numero = (await getMaxNumero(parsed.data.obraId)) + 1;

  const [p] = await db.insert(presupuesto).values({
    obraId: parsed.data.obraId, tipo: parsed.data.tipo, numero,
    descripcion: parsed.data.descripcion ?? null,
    markupDefaultPorcentaje: parsed.data.markupDefaultPorcentaje,
    cotizacionUsd: parsed.data.cotizacionUsd,
    estado: 'borrador', version: 1,
    createdBy: admin.id, updatedBy: admin.id,
  }).returning();

  await logAudit({
    entidad: 'presupuesto', entidadId: p.id, accion: 'crear',
    after: p, usuarioId: admin.id,
    descripcionHumana: `${admin.nombre} creó presupuesto #${numero} (${parsed.data.tipo})`,
  });

  revalidatePath(`/obras/${parsed.data.obraId}`);
  return { ok: true, id: p.id };
}

export async function guardarPresupuesto(input: GuardarPresupuestoInput): Promise<Result> {
  const admin = await requireRole('admin');
  const parsed = guardarPresupuestoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const p = await getPresupuesto(parsed.data.presupuestoId);
  if (!p) return { ok: false, error: 'Presupuesto no encontrado' };
  if (p.estado === 'firmado') return { ok: false, error: 'Presupuesto firmado, no editable', code: 'IMMUTABLE' };

  const ctx: PresupuestoCtx = {
    monedaBase: p.obra.monedaBase,
    cotizacionUsd: D(parsed.data.cotizacionUsd),
    markupDefault: D(parsed.data.markupDefaultPorcentaje),
  };

  // Calcular snapshots
  const itemsConSnapshots = parsed.data.items.map((it) => {
    const snap = calcularSnapshotItem({
      cantidad: D(it.cantidad),
      costoUnitario: D(it.costoUnitario),
      costoUnitarioMoneda: it.costoUnitarioMoneda,
      markupPorcentaje: it.markupPorcentaje ? D(it.markupPorcentaje) : null,
    }, ctx);
    return { input: it, snap };
  });

  // Concurrencia optimista + transacción
  const newVersion = parsed.data.version + 1;

  try {
    await db.transaction(async (tx) => {
      // UPDATE presupuesto WHERE version = ?
      const updated = await tx.update(presupuesto).set({
        descripcion: parsed.data.descripcion,
        markupDefaultPorcentaje: parsed.data.markupDefaultPorcentaje,
        cotizacionUsd: parsed.data.cotizacionUsd,
        version: newVersion,
        updatedAt: new Date(), updatedBy: admin.id,
      }).where(and(
        eq(presupuesto.id, parsed.data.presupuestoId),
        eq(presupuesto.version, parsed.data.version),
        isNull(presupuesto.deletedAt),
      )).returning({ id: presupuesto.id });

      if (updated.length === 0) {
        throw new StaleVersionError(parsed.data.version);
      }

      // Strategy: borrar todos los items existentes y reinsertar.
      // Razón: simplifica diff con UI, edge cases mínimos (presupuestos típicos < 500 items).
      await tx.delete(itemPresupuesto).where(eq(itemPresupuesto.presupuestoId, parsed.data.presupuestoId));

      if (itemsConSnapshots.length > 0) {
        await tx.insert(itemPresupuesto).values(itemsConSnapshots.map(({ input: it, snap }) => ({
          presupuestoId: parsed.data.presupuestoId,
          rubroId: it.rubroId, orden: it.orden, descripcion: it.descripcion,
          unidad: it.unidad, cantidad: it.cantidad,
          costoUnitario: it.costoUnitario, costoUnitarioMoneda: it.costoUnitarioMoneda,
          costoUnitarioBase: toDb(snap.costoUnitarioBase),
          markupPorcentaje: it.markupPorcentaje,
          markupEfectivoPorcentaje: toDb(snap.markupEfectivoPorcentaje, 2),
          precioUnitarioCliente: toDb(snap.precioUnitarioCliente),
          notas: it.notas,
        })));
      }
    });
  } catch (e) {
    if (e instanceof StaleVersionError) return { ok: false, error: e.message, code: 'STALE_VERSION' };
    throw e;
  }

  await logAudit({
    entidad: 'presupuesto', entidadId: parsed.data.presupuestoId, accion: 'editar',
    usuarioId: admin.id,
  });
  revalidatePath(`/obras/${p.obraId}/presupuestos/${p.id}`);
  return { ok: true };
}

export async function firmarPresupuesto(presupuestoId: string, version: number): Promise<Result> {
  const admin = await requireRole('admin');
  const p = await getPresupuesto(presupuestoId);
  if (!p) return { ok: false, error: 'No existe' };
  if (p.estado === 'firmado') return { ok: false, error: 'Ya estaba firmado' };
  if (p.estado === 'cancelado') return { ok: false, error: 'Está cancelado' };

  // Calcular totales para snapshot.
  const items = await getItemsConRubros(presupuestoId);
  const tot = calcularTotales(items.map(({ item }) => ({
    rubroId: item.rubroId, subtotalCosto: D(item.costoUnitarioBase).times(item.cantidad),
    subtotalCliente: D(item.precioUnitarioCliente).times(item.cantidad),
  })));

  const updated = await db.update(presupuesto).set({
    estado: 'firmado', fechaFirma: new Date(),
    totalCostoCalculado: toDb(tot.totalCosto),
    totalClienteCalculado: toDb(tot.totalCliente),
    version: version + 1,
    updatedAt: new Date(), updatedBy: admin.id,
  }).where(and(
    eq(presupuesto.id, presupuestoId),
    eq(presupuesto.version, version),
    eq(presupuesto.estado, 'borrador'),
  )).returning();

  if (updated.length === 0) {
    return { ok: false, error: 'Versión obsoleta o estado cambió. Recargá.', code: 'STALE_VERSION' };
  }

  await logAudit({
    entidad: 'presupuesto', entidadId: presupuestoId, accion: 'firmar',
    after: updated[0], usuarioId: admin.id,
    descripcionHumana: `${admin.nombre} firmó el Presupuesto #${p.numero} de ${p.obra.codigo}`,
  });

  revalidatePath(`/obras/${p.obraId}`);
  return { ok: true };
}

export async function cancelarPresupuesto(presupuestoId: string, version: number): Promise<Result> {
  const admin = await requireRole('admin');
  const p = await getPresupuesto(presupuestoId);
  if (!p) return { ok: false, error: 'No existe' };
  if (p.estado === 'cancelado') return { ok: false, error: 'Ya cancelado' };

  // Cancelar bypassa el trigger (sólo bloquea estado=firmado→firmado, NO firmado→cancelado).
  // Si el trigger lo impide, refinar: Plan 1 Task 8 ya lo permite.
  const updated = await db.update(presupuesto).set({
    estado: 'cancelado', version: version + 1, updatedAt: new Date(), updatedBy: admin.id,
  }).where(and(eq(presupuesto.id, presupuestoId), eq(presupuesto.version, version))).returning();

  if (updated.length === 0) {
    return { ok: false, error: 'Versión obsoleta', code: 'STALE_VERSION' };
  }

  await logAudit({
    entidad: 'presupuesto', entidadId: presupuestoId, accion: 'cancelar',
    after: updated[0], usuarioId: admin.id,
    descripcionHumana: `${admin.nombre} canceló el Presupuesto #${p.numero}`,
  });

  revalidatePath(`/obras/${p.obraId}`);
  return { ok: true };
}
```

> **Importante**: el trigger Postgres del Plan 1 bloquea `firmado → firmado`. Para `firmado → cancelado` o `borrador → firmado`, debe permitir. Verificar revisando el trigger `rechazar_edicion_presupuesto_firmado` — solo lanza si `OLD.estado = 'firmado' AND NEW.estado = 'firmado'`. ✓ correcto.

- [ ] **Step 3: Run tests**

```bash
pnpm test:integration -- presupuestos-crud
```

Expected: 3 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/presupuestos/actions.ts tests/integration/presupuestos-crud.test.ts
git commit -m "feat(presupuestos): server actions (CRUD + firmar/cancelar)"
```

---

## Task 8: Test de concurrencia optimista

**Files:**
- Create: `tests/integration/presupuestos-concurrency.test.ts`

- [ ] **Step 1: Test**

```ts
// tests/integration/presupuestos-concurrency.test.ts
import { resetDb } from './setup';
import { makeUsuario, makeRubro, makeObra } from './factories';
import * as actions from '@/features/presupuestos/actions';

jest.mock('@/lib/auth/require', () => ({ requireRole: jest.fn() }));
import * as auth from '@/lib/auth/require';

describe('concurrencia optimista', () => {
  beforeEach(async () => { await resetDb(); jest.clearAllMocks(); });

  it('dos saves con la misma version: el segundo recibe STALE_VERSION', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);
    const o = await makeObra(admin.id);
    const ru = await makeRubro();
    const c = await actions.crearPresupuesto({ obraId: o.id, tipo: 'original', descripcion: null, markupDefaultPorcentaje: '30', cotizacionUsd: '1200' });
    if (!c.ok) throw new Error();

    const payload = {
      presupuestoId: c.id, version: 1, descripcion: null,
      markupDefaultPorcentaje: '30', cotizacionUsd: '1200',
      items: [{
        rubroId: ru.id, orden: 0, descripcion: 'X', unidad: 'm2' as const,
        cantidad: '1', costoUnitario: '100', costoUnitarioMoneda: 'USD' as const,
        markupPorcentaje: null, notas: null,
      }],
    };

    const r1 = await actions.guardarPresupuesto(payload);
    expect(r1.ok).toBe(true);

    const r2 = await actions.guardarPresupuesto(payload); // misma version=1
    expect(r2.ok).toBe(false);
    if (r2.ok) return;
    expect(r2.code).toBe('STALE_VERSION');
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
pnpm test:integration -- presupuestos-concurrency
git add tests/integration/presupuestos-concurrency.test.ts
git commit -m "test(presupuestos): concurrencia optimista (STALE_VERSION)"
```

---

## Task 9: Test del trigger "escrito en piedra"

**Files:**
- Create: `tests/integration/presupuestos-trigger.test.ts`

- [ ] **Step 1: Test**

```ts
// tests/integration/presupuestos-trigger.test.ts
import { resetDb } from './setup';
import { makeUsuario, makeRubro, makeObra } from './factories';
import { db } from '@/db/client';
import { itemPresupuesto, presupuesto } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as actions from '@/features/presupuestos/actions';

jest.mock('@/lib/auth/require', () => ({ requireRole: jest.fn() }));
import * as auth from '@/lib/auth/require';

describe('trigger escrito en piedra', () => {
  beforeEach(async () => { await resetDb(); jest.clearAllMocks(); });

  it('UPDATE directo a item de presupuesto firmado es rechazado por Postgres', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);
    const o = await makeObra(admin.id);
    const ru = await makeRubro();

    const c = await actions.crearPresupuesto({ obraId: o.id, tipo: 'original', descripcion: null, markupDefaultPorcentaje: '30', cotizacionUsd: '1200' });
    if (!c.ok) throw new Error();
    await actions.guardarPresupuesto({
      presupuestoId: c.id, version: 1, descripcion: null,
      markupDefaultPorcentaje: '30', cotizacionUsd: '1200',
      items: [{
        rubroId: ru.id, orden: 0, descripcion: 'X', unidad: 'm2',
        cantidad: '1', costoUnitario: '100', costoUnitarioMoneda: 'USD',
        markupPorcentaje: null, notas: null,
      }],
    });
    await actions.firmarPresupuesto(c.id, 2);

    const [it] = await db.select().from(itemPresupuesto).where(eq(itemPresupuesto.presupuestoId, c.id));

    await expect(
      db.update(itemPresupuesto).set({ cantidad: '999' }).where(eq(itemPresupuesto.id, it.id)),
    ).rejects.toThrow(/firmado/);
  });

  it('UPDATE a presupuesto firmado (mismo estado) es rechazado por Postgres', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);
    const o = await makeObra(admin.id);
    const c = await actions.crearPresupuesto({ obraId: o.id, tipo: 'original', descripcion: null, markupDefaultPorcentaje: '30', cotizacionUsd: '1200' });
    if (!c.ok) throw new Error();
    await actions.firmarPresupuesto(c.id, 1);

    await expect(
      db.update(presupuesto).set({ descripcion: 'cambio prohibido' }).where(eq(presupuesto.id, c.id)),
    ).rejects.toThrow(/firmado/);
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
pnpm test:integration -- presupuestos-trigger
git add tests/integration/presupuestos-trigger.test.ts
git commit -m "test(presupuestos): trigger Postgres rechaza edición de firmado"
```

---

## Task 10: Componentes del editor — fila + tabla virtualizada

**Files:**
- Create: `src/features/presupuestos/components/item-row.tsx`, `items-tabla.tsx`

- [ ] **Step 1: Instalar virtualization**

```bash
pnpm add @tanstack/react-virtual react-hook-form
```

- [ ] **Step 2: Fila memoizada**

```tsx
// src/features/presupuestos/components/item-row.tsx
'use client';
import { memo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

type Props = {
  rubroIdx: number;
  itemIdx: number;
  onRemove: () => void;
  rubrosOptions: { id: string; nombre: string }[];
  disabled: boolean;
};

export const ItemRow = memo(function ItemRow({ rubroIdx, itemIdx, onRemove, rubrosOptions, disabled }: Props) {
  const { register, control } = useFormContext();
  const path = `rubros.${rubroIdx}.items.${itemIdx}` as const;
  return (
    <tr className="border-b">
      <td className="p-1"><Input {...register(`${path}.descripcion` as const)} disabled={disabled} className="h-8" /></td>
      <td className="p-1 w-20"><Input type="number" step="0.0001" {...register(`${path}.cantidad` as const)} disabled={disabled} className="h-8" /></td>
      <td className="p-1 w-16">
        <Controller name={`${path}.unidad` as const} control={control} render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(['m2','m3','hs','gl','u','ml','kg'] as const).map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        )} />
      </td>
      <td className="p-1 w-24"><Input type="number" step="0.0001" {...register(`${path}.costoUnitario` as const)} disabled={disabled} className="h-8" /></td>
      <td className="p-1 w-16">
        <Controller name={`${path}.costoUnitarioMoneda` as const} control={control} render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="ARS">ARS</SelectItem>
            </SelectContent>
          </Select>
        )} />
      </td>
      <td className="p-1 w-20"><Input type="number" step="0.01" placeholder="default" {...register(`${path}.markupPorcentaje` as const)} disabled={disabled} className="h-8" /></td>
      <td className="p-1">
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={disabled}>×</Button>
      </td>
    </tr>
  );
});
```

- [ ] **Step 3: Tabla virtualizada**

```tsx
// src/features/presupuestos/components/items-tabla.tsx
'use client';
import { useRef } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/components/ui/button';
import { ItemRow } from './item-row';

type Props = {
  rubroIdx: number;
  rubrosOptions: { id: string; nombre: string }[];
  disabled: boolean;
};

export function ItemsTabla({ rubroIdx, rubrosOptions, disabled }: Props) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: `rubros.${rubroIdx}.items` });
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualize = fields.length > 30;

  const rowVirtualizer = useVirtualizer({
    count: fields.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 8,
  });

  const addEmpty = () =>
    append({
      descripcion: '', unidad: 'gl', cantidad: '1',
      costoUnitario: '0', costoUnitarioMoneda: 'USD',
      markupPorcentaje: null, notas: null,
      rubroId: rubrosOptions[rubroIdx]?.id, orden: fields.length,
    });

  return (
    <div>
      {virtualize ? (
        <div ref={parentRef} className="max-h-[600px] overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left p-1">Descripción</th>
                <th className="text-left p-1">Cant</th>
                <th className="text-left p-1">Un.</th>
                <th className="text-left p-1">Costo</th>
                <th className="text-left p-1">Mon</th>
                <th className="text-left p-1">Markup %</th>
                <th></th>
              </tr>
            </thead>
            <tbody style={{ height: rowVirtualizer.getTotalSize() }}>
              {rowVirtualizer.getVirtualItems().map((v) => (
                <ItemRow key={fields[v.index].id} rubroIdx={rubroIdx} itemIdx={v.index} onRemove={() => remove(v.index)} rubrosOptions={rubrosOptions} disabled={disabled} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-1">Descripción</th>
              <th className="text-left p-1">Cant</th>
              <th className="text-left p-1">Un.</th>
              <th className="text-left p-1">Costo</th>
              <th className="text-left p-1">Mon</th>
              <th className="text-left p-1">Markup %</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <ItemRow key={f.id} rubroIdx={rubroIdx} itemIdx={i} onRemove={() => remove(i)} rubrosOptions={rubrosOptions} disabled={disabled} />
            ))}
          </tbody>
        </table>
      )}
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addEmpty} disabled={disabled}>+ Agregar item</Button>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/presupuestos/components/item-row.tsx src/features/presupuestos/components/items-tabla.tsx
git commit -m "feat(presupuestos): virtualized items table"
```

---

## Task 11: Acordeón por rubro + form principal + autosave

**Files:**
- Create: `rubro-acordeon.tsx`, `editor-form.tsx`, `presupuesto-editor.tsx`, `stale-version-banner.tsx`, `totales-footer.tsx`, `firmar-dialog.tsx`, `cancelar-dialog.tsx`, `hooks/use-autosave.ts`

- [ ] **Step 1: Hook autosave**

```ts
// src/features/presupuestos/hooks/use-autosave.ts
'use client';
import { useEffect, useRef } from 'react';

export function useAutosave(dirty: boolean, save: () => void, delay = 30_000) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, delay);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [dirty, save, delay]);
}
```

- [ ] **Step 2: Banner de stale**

```tsx
// src/features/presupuestos/components/stale-version-banner.tsx
export function StaleVersionBanner() {
  return (
    <div className="border-l-4 border-red-500 bg-red-50 p-4 mb-4">
      <p className="font-semibold">Otro Admin editó este presupuesto.</p>
      <p className="text-sm">Recargá la página para ver los cambios. Hasta entonces, no se puede guardar.</p>
    </div>
  );
}
```

- [ ] **Step 3: Footer de totales (vivos)**

```tsx
// src/features/presupuestos/components/totales-footer.tsx
'use client';
import { useFormContext, useWatch } from 'react-hook-form';
import { D } from '@/lib/money/decimal';
import { calcularSnapshotItem } from '@/features/presupuestos/services/snapshots';

export function TotalesFooter({ monedaBase }: { monedaBase: 'USD' | 'ARS' }) {
  const { control } = useFormContext();
  const data = useWatch({ control });
  let totCosto = D(0); let totCliente = D(0);
  const cot = D(data.cotizacionUsd ?? '0');
  const def = D(data.markupDefaultPorcentaje ?? '0');
  for (const r of data.rubros ?? []) {
    for (const it of r.items ?? []) {
      try {
        const s = calcularSnapshotItem({
          cantidad: D(it.cantidad || '0'),
          costoUnitario: D(it.costoUnitario || '0'),
          costoUnitarioMoneda: it.costoUnitarioMoneda,
          markupPorcentaje: it.markupPorcentaje ? D(it.markupPorcentaje) : null,
        }, { monedaBase, cotizacionUsd: cot, markupDefault: def });
        totCosto = totCosto.plus(s.subtotalCosto);
        totCliente = totCliente.plus(s.subtotalCliente);
      } catch { /* mientras se tipea, valores intermedios pueden tirar */ }
    }
  }
  return (
    <footer className="sticky bottom-0 bg-white border-t p-4 flex justify-end gap-8">
      <div><span className="text-muted-foreground text-sm">Costo total: </span><span className="font-semibold">{totCosto.toFixed(2)} {monedaBase}</span></div>
      <div><span className="text-muted-foreground text-sm">Cliente total: </span><span className="font-semibold text-lg">{totCliente.toFixed(2)} {monedaBase}</span></div>
    </footer>
  );
}
```

- [ ] **Step 4: Acordeón por rubro**

```tsx
// src/features/presupuestos/components/rubro-acordeon.tsx
'use client';
import { useState } from 'react';
import { ItemsTabla } from './items-tabla';

type Props = {
  rubroIdx: number;
  rubroNombre: string;
  rubrosOptions: { id: string; nombre: string }[];
  disabled: boolean;
};

export function RubroAcordeon({ rubroIdx, rubroNombre, rubrosOptions, disabled }: Props) {
  const [open, setOpen] = useState(rubroIdx < 3);
  return (
    <section className="border rounded mb-2">
      <button type="button" className="w-full text-left p-3 font-semibold flex justify-between" onClick={() => setOpen(!open)}>
        <span>{rubroNombre}</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="p-3 border-t">
          <ItemsTabla rubroIdx={rubroIdx} rubrosOptions={rubrosOptions} disabled={disabled} />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Dialogs**

```tsx
// src/features/presupuestos/components/firmar-dialog.tsx
'use client';
import { useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { firmarPresupuesto } from '../actions';

export function FirmarDialog({ presupuestoId, version, dirty }: { presupuestoId: string; version: number; dirty: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button disabled={dirty}>{dirty ? 'Guardá primero' : 'Firmar presupuesto'}</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle>Firmar presupuesto</DialogTitle>
        <p className="text-sm text-muted-foreground">Una vez firmado, no se puede editar. Si hay errores, hay que cancelarlo y reemitir.</p>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={pending} onClick={() => start(async () => {
            const r = await firmarPresupuesto(presupuestoId, version);
            if (!r.ok) setErr(r.error);
            else setOpen(false);
          })}>{pending ? 'Firmando...' : 'Confirmar firma'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

```tsx
// src/features/presupuestos/components/cancelar-dialog.tsx
'use client';
import { useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cancelarPresupuesto } from '../actions';

export function CancelarDialog({ presupuestoId, version }: { presupuestoId: string; version: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="destructive">Cancelar presupuesto</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle>Cancelar presupuesto</DialogTitle>
        <p className="text-sm">¿Seguro? El presupuesto pasará a estado "cancelado". Para reemplazarlo, creá uno nuevo.</p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>Volver</Button>
          <Button variant="destructive" disabled={pending} onClick={() => start(async () => {
            await cancelarPresupuesto(presupuestoId, version); setOpen(false);
          })}>{pending ? 'Cancelando...' : 'Confirmar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Form principal**

```tsx
// src/features/presupuestos/components/editor-form.tsx
'use client';

import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { guardarPresupuesto } from '../actions';
import { RubroAcordeon } from './rubro-acordeon';
import { StaleVersionBanner } from './stale-version-banner';
import { TotalesFooter } from './totales-footer';
import { FirmarDialog } from './firmar-dialog';
import { CancelarDialog } from './cancelar-dialog';
import { useAutosave } from '../hooks/use-autosave';

type Item = {
  id?: string; rubroId: string; orden: number;
  descripcion: string; unidad: string; cantidad: string;
  costoUnitario: string; costoUnitarioMoneda: 'USD' | 'ARS';
  markupPorcentaje: string | null; notas: string | null;
};

type RubroGrupo = { rubroId: string; rubroNombre: string; items: Item[] };

type Props = {
  presupuestoId: string;
  initialVersion: number;
  initialDescripcion: string | null;
  initialMarkupDefault: string;
  initialCotizacion: string;
  initialEstado: 'borrador' | 'firmado' | 'cancelado';
  monedaBase: 'USD' | 'ARS';
  rubros: { id: string; nombre: string }[];
  initialGrupos: RubroGrupo[];
};

export function EditorForm(props: Props) {
  const router = useRouter();
  const [version, setVersion] = useState(props.initialVersion);
  const [stale, setStale] = useState(false);
  const [saving, setSaving] = useState(false);

  const methods = useForm({
    defaultValues: {
      descripcion: props.initialDescripcion ?? '',
      markupDefaultPorcentaje: props.initialMarkupDefault,
      cotizacionUsd: props.initialCotizacion,
      rubros: props.initialGrupos,
    },
  });

  const dirty = methods.formState.isDirty;
  const disabled = props.initialEstado !== 'borrador' || stale;

  async function save() {
    if (disabled) return;
    setSaving(true);
    const v = methods.getValues();
    const items = v.rubros.flatMap((r) => r.items.map((it, idx) => ({ ...it, rubroId: r.rubroId, orden: idx })));
    const r = await guardarPresupuesto({
      presupuestoId: props.presupuestoId,
      version,
      descripcion: v.descripcion || null,
      markupDefaultPorcentaje: v.markupDefaultPorcentaje,
      cotizacionUsd: v.cotizacionUsd,
      items,
    });
    setSaving(false);
    if (r.ok) {
      setVersion((v) => v + 1);
      methods.reset(v); // limpia dirty
      router.refresh();
    } else if (r.code === 'STALE_VERSION') {
      setStale(true);
    } else {
      alert(r.error);
    }
  }

  useAutosave(dirty && !stale && !saving, save, 30_000);

  return (
    <FormProvider {...methods}>
      {stale && <StaleVersionBanner />}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div><Label>Descripción</Label><Input {...methods.register('descripcion')} disabled={disabled} /></div>
        <div><Label>Markup default %</Label><Input type="number" step="0.01" {...methods.register('markupDefaultPorcentaje')} disabled={disabled} /></div>
        <div><Label>Cotización USD</Label><Input type="number" step="0.0001" {...methods.register('cotizacionUsd')} disabled={disabled} /></div>
      </div>

      {props.initialGrupos.map((g, idx) => (
        <RubroAcordeon
          key={g.rubroId}
          rubroIdx={idx}
          rubroNombre={g.rubroNombre}
          rubrosOptions={props.rubros}
          disabled={disabled}
        />
      ))}

      <TotalesFooter monedaBase={props.monedaBase} />

      <div className="flex gap-2 mt-4">
        <Button onClick={save} disabled={!dirty || saving || disabled}>{saving ? 'Guardando...' : 'Guardar borrador'}</Button>
        {props.initialEstado === 'borrador' && (
          <>
            <FirmarDialog presupuestoId={props.presupuestoId} version={version} dirty={dirty} />
            <CancelarDialog presupuestoId={props.presupuestoId} version={version} />
          </>
        )}
      </div>
    </FormProvider>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/features/presupuestos/components/ src/features/presupuestos/hooks/
git commit -m "feat(presupuestos): editor form + acordeón + autosave + dialogs"
```

---

## Task 12: Páginas — nuevo presupuesto, editor

**Files:**
- Create: `src/app/(internal)/obras/[id]/presupuestos/nuevo/page.tsx`, `[presId]/page.tsx`

- [ ] **Step 1: Crear (form simple)**

```tsx
// src/app/(internal)/obras/[id]/presupuestos/nuevo/page.tsx
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { crearPresupuesto } from '@/features/presupuestos/actions';

export default async function NuevoPresupuestoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole('admin');

  async function action(fd: FormData) {
    'use server';
    const r = await crearPresupuesto({
      obraId: id,
      tipo: fd.get('tipo') as 'original' | 'adicional',
      descripcion: String(fd.get('descripcion') ?? '') || null,
      markupDefaultPorcentaje: String(fd.get('markupDefaultPorcentaje') ?? '30'),
      cotizacionUsd: String(fd.get('cotizacionUsd') ?? '1'),
    });
    if (!r.ok) throw new Error(r.error);
    redirect(`/obras/${id}/presupuestos/${r.id}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Nuevo presupuesto</h1>
      <form action={action} className="grid gap-4 max-w-md">
        <div><Label>Tipo</Label>
          <Select name="tipo" defaultValue="original">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="original">Original</SelectItem>
              <SelectItem value="adicional">Adicional</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Descripción (opcional)</Label><Input name="descripcion" /></div>
        <div><Label>Markup default %</Label><Input name="markupDefaultPorcentaje" type="number" step="0.01" defaultValue="30" /></div>
        <div><Label>Cotización USD</Label><Input name="cotizacionUsd" type="number" step="0.0001" required /></div>
        <Button type="submit">Crear</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Editor**

```tsx
// src/app/(internal)/obras/[id]/presupuestos/[presId]/page.tsx
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth/require';
import { getPresupuesto, getItemsConRubros } from '@/features/presupuestos/queries';
import { listarRubrosPlanos } from '@/features/rubros/queries';
import { EditorForm } from '@/features/presupuestos/components/editor-form';

export default async function EditorPage({ params }: { params: Promise<{ id: string; presId: string }> }) {
  const { id, presId } = await params;
  const user = await requireSession();
  if (user.rol !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }

  const p = await getPresupuesto(presId);
  if (!p || p.obraId !== id) notFound();

  const [items, rubros] = await Promise.all([
    getItemsConRubros(presId),
    listarRubrosPlanos(),
  ]);

  // Agrupar items por rubro, asegurando un grupo por cada rubro activo (aunque vacío) para que se pueda agregar.
  const gruposMap = new Map<string, { rubroId: string; rubroNombre: string; items: any[] }>();
  for (const r of rubros.filter((r) => r.activo)) {
    gruposMap.set(r.id, { rubroId: r.id, rubroNombre: r.nombre, items: [] });
  }
  for (const { item } of items) {
    const g = gruposMap.get(item.rubroId);
    if (g) g.items.push({
      id: item.id, rubroId: item.rubroId, orden: item.orden,
      descripcion: item.descripcion, unidad: item.unidad, cantidad: item.cantidad,
      costoUnitario: item.costoUnitario, costoUnitarioMoneda: item.costoUnitarioMoneda,
      markupPorcentaje: item.markupPorcentaje, notas: item.notas,
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">{p.obra.codigo} · Presupuesto #{p.numero} ({p.tipo})</h1>
      <p className="text-sm text-muted-foreground mb-6">Estado: <strong>{p.estado}</strong></p>
      <EditorForm
        presupuestoId={p.id}
        initialVersion={p.version}
        initialDescripcion={p.descripcion}
        initialMarkupDefault={p.markupDefaultPorcentaje}
        initialCotizacion={p.cotizacionUsd}
        initialEstado={p.estado}
        monedaBase={p.obra.monedaBase}
        rubros={rubros.filter((r) => r.activo).map((r) => ({ id: r.id, nombre: r.nombre }))}
        initialGrupos={Array.from(gruposMap.values())}
      />
    </div>
  );
}
```

- [ ] **Step 3: Smoke manual**

Run: `pnpm dev`. Login Admin, crear obra, crear presupuesto, agregar 2-3 items en distintos rubros, guardar, refrescar, verificar que persisten. Firmar. Verificar que se bloquea edición.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(internal\)/obras/\[id\]/presupuestos/
git commit -m "feat(presupuestos): editor pages"
```

---

## Task 13: Listar presupuestos en detalle de obra

**Files:**
- Modify: `src/app/(internal)/obras/[id]/page.tsx`

- [ ] **Step 1: Agregar lista**

Reemplazar la sección "Presupuestos" placeholder con:

```tsx
import { listarPresupuestosDeObra } from '@/features/presupuestos/queries';
// ...
const presupuestos = await listarPresupuestosDeObra(id);

// dentro del JSX:
<section className="border rounded p-4">
  <h2 className="font-semibold mb-2">Presupuestos</h2>
  {presupuestos.length === 0 ? (
    <p className="text-muted-foreground text-sm">No hay presupuestos. Creá el original.</p>
  ) : (
    <ul className="space-y-1">
      {presupuestos.map((p) => (
        <li key={p.id}>
          <Link href={`/obras/${id}/presupuestos/${p.id}`} className="hover:underline">
            #{p.numero} · {p.tipo} · <span className="text-xs">{p.estado}</span>
            {p.descripcion ? ` · ${p.descripcion}` : ''}
          </Link>
        </li>
      ))}
    </ul>
  )}
</section>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(internal\)/obras/\[id\]/page.tsx
git commit -m "feat(obras): lista presupuestos en detalle"
```

---

## Verificación final del Plan 3

- [ ] Tests unit verdes: markup, currency, snapshots, totales.
- [ ] Tests integration verdes: crud, concurrency, trigger.
- [ ] Editor manual: agregar/editar/eliminar items, autosave dispara a 30s, totales en vivo.
- [ ] Firmar: pasa a `firmado`, todo readonly, totales snapshot.
- [ ] Concurrencia: dos pestañas Admin sobre el mismo presupuesto → la segunda recibe banner stale.

**Salida**: Admin puede armar y firmar presupuestos. El cliente todavía no los ve. Listo para Plan 4.
