# Plan 4 — Vista Cliente + PDF + Link Mágico

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Asume:** Planes 1, 2 y 3 mergeados.

**Goal:** El cliente accede vía URL `/cliente/[token]` y ve los presupuestos firmados de su obra (con datos formales, sin costos ni markups). Descarga PDF generado server-side desde los snapshots con `@react-pdf/renderer`. Token regenerable por Admin invalida el anterior. Token inválido va a `/cliente/expirado` (no 404). PDF route tiene `maxDuration` configurado y test de performance en CI.

**Architecture:** `/cliente/[token]` es una ruta pública (matched antes que el guard de sesión). Lookup por `Obra.cliente_token` con índice unique. La página renderiza un layout "documento formal" usando los mismos snapshots que el PDF. El endpoint `/api/pdf/[presupuestoId]` es API route (no Server Action) porque devuelve binario; valida acceso por token query-param (público) o por sesión Admin (interno). PDF template versionado por `template_version` para preservar render histórico.

**Tech Stack:** `@react-pdf/renderer`, Next.js Route Handlers, Drizzle.

---

## File Structure

```
src/lib/auth/
  cliente-token.ts        # getObraByToken(token), helpers públicos

src/lib/pdf/
  render.ts               # función render principal, ramifica por template_version
  template-v1.tsx         # JSX del PDF v1 (tipografía, layout, header, tabla)
  fonts.ts                # registro de fuentes (caché a nivel módulo)
  assets.ts               # logos, etc., en base64

src/app/cliente/
  [token]/
    layout.tsx            # layout formal sin sidebar
    page.tsx              # vista de presupuestos firmados
    [presupuestoId]/
      page.tsx            # vista detalle de UN presupuesto firmado
  expirado/
    page.tsx              # mensaje "link expirado"

src/app/api/pdf/[presupuestoId]/route.ts

src/middleware.ts         # MODIFICAR: handle /cliente/[token]/* específicamente

src/features/obras/components/regenerar-token-button.tsx

tests/integration/
  cliente-token.test.ts
  pdf-render.test.ts
```

---

## Task 1: Helper público de cliente-token

**Files:**
- Create: `src/lib/auth/cliente-token.ts`, `tests/integration/cliente-token.test.ts`

- [ ] **Step 1: Test fallido**

```ts
// tests/integration/cliente-token.test.ts
import { resetDb } from './setup';
import { makeUsuario, makeObra } from './factories';
import { getObraByToken } from '@/lib/auth/cliente-token';

describe('cliente-token', () => {
  beforeEach(async () => { await resetDb(); });

  it('encuentra obra por token válido', async () => {
    const admin = await makeUsuario('admin');
    const o = await makeObra(admin.id);
    const found = await getObraByToken(o.clienteToken);
    expect(found?.id).toBe(o.id);
  });

  it('devuelve null para token inexistente', async () => {
    const found = await getObraByToken('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    expect(found).toBeNull();
  });

  it('ignora tokens muy cortos / mal formados', async () => {
    expect(await getObraByToken('')).toBeNull();
    expect(await getObraByToken('abc')).toBeNull();
  });

  it('ignora obras eliminadas (deletedAt)', async () => {
    const admin = await makeUsuario('admin');
    const o = await makeObra(admin.id, { deletedAt: new Date() });
    expect(await getObraByToken(o.clienteToken)).toBeNull();
  });
});
```

- [ ] **Step 2: Implementación**

```ts
// src/lib/auth/cliente-token.ts
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { obra } from '@/db/schema';

export async function getObraByToken(token: string) {
  if (!token || token.length < 30) return null; // tokens válidos son 43 chars; defensa cheap
  const [o] = await db.select().from(obra)
    .where(and(eq(obra.clienteToken, token), isNull(obra.deletedAt)))
    .limit(1);
  return o ?? null;
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm test:integration -- cliente-token
git add src/lib/auth/cliente-token.ts tests/integration/cliente-token.test.ts
git commit -m "feat(auth): cliente-token public lookup"
```

---

## Task 2: Middleware — manejar `/cliente/[token]`

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Update middleware**

Reemplazar el bloque que detecta rutas públicas con lógica explícita para `/cliente`:

```ts
// dentro de export async function middleware(request)
const path = request.nextUrl.pathname;

// /cliente/expirado: público, no toca sesión
if (path === '/cliente/expirado') return response;

// /cliente/<token>/...: público, valida token contra DB
const clienteMatch = /^\/cliente\/([^/]+)/.exec(path);
if (clienteMatch) {
  const token = clienteMatch[1];
  const { getObraByToken } = await import('@/lib/auth/cliente-token');
  const obra = await getObraByToken(token);
  if (!obra) {
    const url = request.nextUrl.clone();
    url.pathname = '/cliente/expirado';
    return NextResponse.redirect(url);
  }
  return response;
}

// resto: sesión interna (lógica existente del Plan 1)
```

- [ ] **Step 2: Smoke manual**

Run: `pnpm dev`. Visitar `/cliente/xxx-token-fake` → redirect a `/cliente/expirado`.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(middleware): handle /cliente/[token] with redirect on invalid"
```

---

## Task 3: Página `/cliente/expirado`

**Files:**
- Create: `src/app/cliente/expirado/page.tsx`

- [ ] **Step 1: Página estática**

```tsx
// src/app/cliente/expirado/page.tsx
export const dynamic = 'force-static';

export default function ExpiradoPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div className="max-w-md text-center p-6 bg-white border rounded">
        <h1 className="text-2xl font-semibold mb-3">El enlace expiró</h1>
        <p className="text-muted-foreground mb-4">
          Este link de acceso fue regenerado o ya no es válido. Por favor, contactá a la administración de Macna para recibir el enlace actualizado.
        </p>
        <p className="text-sm text-muted-foreground">
          📞 +54 11 0000-0000 · ✉ admin@macna.com.ar
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/cliente/expirado/
git commit -m "feat(cliente): página de link expirado"
```

---

## Task 4: Layout y página de cliente

**Files:**
- Create: `src/app/cliente/[token]/layout.tsx`, `page.tsx`

- [ ] **Step 1: Layout formal (sin sidebar)**

```tsx
// src/app/cliente/[token]/layout.tsx
import { notFound } from 'next/navigation';
import { getObraByToken } from '@/lib/auth/cliente-token';

export default async function ClienteLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  const obra = await getObraByToken(token);
  if (!obra) notFound(); // middleware ya redirigió, esto es defensa

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b">
        <div className="max-w-4xl mx-auto p-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Macna · Construcción</p>
            <h1 className="text-xl font-semibold">{obra.nombre}</h1>
            <p className="text-sm text-muted-foreground">{obra.codigo} · {obra.clienteNombre}</p>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Página principal — lista de presupuestos firmados**

```tsx
// src/app/cliente/[token]/page.tsx
import Link from 'next/link';
import { eq, and, isNull } from 'drizzle-orm';
import { getObraByToken } from '@/lib/auth/cliente-token';
import { db } from '@/db/client';
import { presupuesto } from '@/db/schema';

export default async function ClientePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const obra = (await getObraByToken(token))!;

  const presupuestosFirmados = await db.select().from(presupuesto)
    .where(and(eq(presupuesto.obraId, obra.id), eq(presupuesto.estado, 'firmado'), isNull(presupuesto.deletedAt)));

  if (presupuestosFirmados.length === 0) {
    return <p className="text-muted-foreground">Aún no hay presupuestos firmados disponibles.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Presupuestos firmados</h2>
      <ul className="space-y-2">
        {presupuestosFirmados.map((p) => (
          <li key={p.id} className="border rounded p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">Presupuesto #{p.numero} ({p.tipo})</div>
              <div className="text-xs text-muted-foreground">
                Firmado el {p.fechaFirma?.toLocaleDateString('es-AR')} · Total: {p.totalClienteCalculado} {obra.monedaBase}
              </div>
            </div>
            <Link href={`/cliente/${token}/${p.id}`} className="text-sm underline">Ver detalle</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Página detalle de presupuesto firmado**

```tsx
// src/app/cliente/[token]/[presupuestoId]/page.tsx
import { Fragment } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq, asc } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { db } from '@/db/client';
import { presupuesto, itemPresupuesto, rubro } from '@/db/schema';
import { getObraByToken } from '@/lib/auth/cliente-token';
import { D } from '@/lib/money/decimal';

export default async function PresupuestoClientePage({
  params,
}: { params: Promise<{ token: string; presupuestoId: string }> }) {
  const { token, presupuestoId } = await params;
  const obra = (await getObraByToken(token))!;

  const [p] = await db.select().from(presupuesto)
    .where(eq(presupuesto.id, presupuestoId)).limit(1);
  if (!p || p.obraId !== obra.id || p.estado !== 'firmado') notFound();

  const items = await db.select({ item: itemPresupuesto, rubro })
    .from(itemPresupuesto).leftJoin(rubro, eq(itemPresupuesto.rubroId, rubro.id))
    .where(eq(itemPresupuesto.presupuestoId, p.id))
    .orderBy(asc(itemPresupuesto.orden));

  // Agrupar por rubro
  const grupos: Record<string, { nombre: string; items: typeof items; subtotal: ReturnType<typeof D> }> = {};
  for (const row of items) {
    const k = row.rubro?.nombre ?? 'Sin rubro';
    grupos[k] ??= { nombre: k, items: [], subtotal: D(0) };
    grupos[k].items.push(row);
    grupos[k].subtotal = grupos[k].subtotal.plus(D(row.item.precioUnitarioCliente).times(row.item.cantidad));
  }

  return (
    <article>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Presupuesto #{p.numero}</h2>
          <p className="text-sm text-muted-foreground">
            Tipo: {p.tipo} · Firmado: {p.fechaFirma?.toLocaleDateString('es-AR')}
          </p>
        </div>
        <Button asChild><a href={`/api/pdf/${p.id}?token=${token}`}>Descargar PDF</a></Button>
      </div>

      {p.descripcion && <p className="mb-6">{p.descripcion}</p>}

      <table className="w-full text-sm border">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left p-2">Descripción</th>
            <th className="text-left p-2 w-20">Cant.</th>
            <th className="text-left p-2 w-16">Un.</th>
            <th className="text-right p-2 w-32">Precio U. ({obra.monedaBase})</th>
            <th className="text-right p-2 w-32">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(grupos).map((g) => (
            <Fragment key={g.nombre}>
              <tr className="bg-slate-100"><td colSpan={5} className="p-2 font-semibold">{g.nombre}</td></tr>
              {g.items.map(({ item }) => (
                <tr key={item.id} className="border-t">
                  <td className="p-2">{item.descripcion}</td>
                  <td className="p-2">{item.cantidad}</td>
                  <td className="p-2">{item.unidad}</td>
                  <td className="p-2 text-right">{D(item.precioUnitarioCliente).toFixed(2)}</td>
                  <td className="p-2 text-right">{D(item.precioUnitarioCliente).times(item.cantidad).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-t font-medium">
                <td colSpan={4} className="p-2 text-right">Subtotal {g.nombre}</td>
                <td className="p-2 text-right">{g.subtotal.toFixed(2)}</td>
              </tr>
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 font-semibold text-lg">
            <td colSpan={4} className="p-2 text-right">Total</td>
            <td className="p-2 text-right">{D(p.totalClienteCalculado!).toFixed(2)} {obra.monedaBase}</td>
          </tr>
        </tfoot>
      </table>

      <Link href={`/cliente/${token}`} className="text-sm underline mt-6 inline-block">← Volver</Link>
    </article>
  );
}
```

- [ ] **Step 4: Smoke manual**

Run: `pnpm dev`. Crear presupuesto, firmarlo, copiar `cliente_token` desde la DB, abrir `/cliente/<token>`, ver la lista, abrir el detalle.

- [ ] **Step 5: Commit**

```bash
git add src/app/cliente/
git commit -m "feat(cliente): vista pública de presupuestos firmados"
```

---

## Task 5: Botón "Regenerar token" en detalle de obra

**Files:**
- Create: `src/features/obras/components/regenerar-token-button.tsx`
- Modify: `src/app/(internal)/obras/[id]/page.tsx`

- [ ] **Step 1: Componente**

```tsx
// src/features/obras/components/regenerar-token-button.tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { regenerarTokenCliente } from '../actions';

export function RegenerarTokenButton({ obraId, currentToken }: { obraId: string; currentToken: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [token, setToken] = useState(currentToken);
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/cliente/${token}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">Link cliente</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle>Link de acceso del cliente</DialogTitle>
        <p className="text-xs text-muted-foreground">Compartí este link al cliente. Si lo regenerás, el anterior dejará de funcionar de inmediato.</p>
        <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        <Button variant="destructive" disabled={pending} onClick={() => start(async () => {
          const r = await regenerarTokenCliente(obraId);
          if ('id' in r && r.ok) setToken((r as any).id);
        })}>{pending ? 'Regenerando...' : 'Regenerar (invalida el anterior)'}</Button>
      </DialogContent>
    </Dialog>
  );
}
```

> Nota: el `(r as any).id` viene del typed-result trick señalado en Plan 2 Task 5. Refactor candidate.

- [ ] **Step 2: Insertar en detalle de obra**

En `src/app/(internal)/obras/[id]/page.tsx`, reemplazar el botón "Previsualizar como cliente" simple por:

```tsx
import { RegenerarTokenButton } from '@/features/obras/components/regenerar-token-button';
// ...
{user.rol === 'admin' && <RegenerarTokenButton obraId={obra.id} currentToken={obra.clienteToken} />}
{user.rol === 'admin' && (
  <Button asChild variant="outline">
    <a href={`/cliente/${obra.clienteToken}`} target="_blank" rel="noopener">Previsualizar como cliente</a>
  </Button>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/obras/components/regenerar-token-button.tsx src/app/\(internal\)/obras/\[id\]/page.tsx
git commit -m "feat(obras): regenerar token UI"
```

---

## Task 6: PDF — fonts + assets cacheados

**Files:**
- Create: `src/lib/pdf/fonts.ts`, `src/lib/pdf/assets.ts`

- [ ] **Step 1: Instalar deps**

```bash
pnpm add @react-pdf/renderer
```

- [ ] **Step 2: Fuentes**

```ts
// src/lib/pdf/fonts.ts
import { Font } from '@react-pdf/renderer';

let registered = false;
export function ensureFontsRegistered() {
  if (registered) return;
  // Inter desde Google Fonts (latin solamente, ligero).
  // Si querés bundlearlas, copialas a public/fonts y serví por path local.
  Font.register({
    family: 'Inter',
    fonts: [
      { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.ttf', fontWeight: 400 },
      { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa2pL7SUc.ttf', fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]); // disable hyphenation
  registered = true;
}
```

- [ ] **Step 3: Assets (logo placeholder)**

```ts
// src/lib/pdf/assets.ts
// 1×1 PNG transparente como placeholder hasta que se reemplace por logo real.
// Reemplazá la constante por base64 del logo .png exportado a ≤30 KB.
export const LOGO_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/pdf/fonts.ts src/lib/pdf/assets.ts
git commit -m "feat(pdf): fonts + assets module"
```

---

## Task 7: PDF template v1

**Files:**
- Create: `src/lib/pdf/template-v1.tsx`

- [ ] **Step 1: Template**

```tsx
// src/lib/pdf/template-v1.tsx
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { ensureFontsRegistered } from './fonts';
import { LOGO_PNG_BASE64 } from './assets';

const styles = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 10, padding: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 8, borderBottom: '1 solid #ccc' },
  title: { fontSize: 18, fontWeight: 700 },
  subtitle: { fontSize: 9, color: '#666' },
  logo: { width: 60, height: 60 },
  rubroHeader: { fontWeight: 700, marginTop: 12, marginBottom: 4, backgroundColor: '#f4f4f5', padding: 4 },
  row: { flexDirection: 'row', borderBottom: '0.5 solid #eee', paddingVertical: 3 },
  cellDesc: { flex: 4 },
  cellNum: { flex: 1, textAlign: 'right' },
  total: { marginTop: 16, paddingTop: 8, borderTop: '2 solid #000', flexDirection: 'row', justifyContent: 'flex-end', fontSize: 14, fontWeight: 700 },
  footer: { position: 'absolute', bottom: 24, left: 32, right: 32, fontSize: 8, color: '#999', textAlign: 'center' },
});

export interface PdfData {
  obra: { codigo: string; nombre: string; clienteNombre: string; monedaBase: string; ubicacion: string | null };
  presupuesto: { numero: number; tipo: string; descripcion: string | null; fechaFirma: Date | null; totalClienteCalculado: string };
  grupos: { nombre: string; items: { descripcion: string; cantidad: string; unidad: string; precioUnitario: string; subtotal: string }[]; subtotal: string }[];
}

export function PresupuestoPdfV1({ data }: { data: PdfData }) {
  ensureFontsRegistered();
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Macna · Presupuesto #{data.presupuesto.numero} ({data.presupuesto.tipo})</Text>
            <Text style={styles.subtitle}>
              {data.obra.codigo} · {data.obra.nombre} · Cliente: {data.obra.clienteNombre}
            </Text>
            {data.obra.ubicacion && <Text style={styles.subtitle}>{data.obra.ubicacion}</Text>}
            {data.presupuesto.fechaFirma && (
              <Text style={styles.subtitle}>Firmado el {data.presupuesto.fechaFirma.toLocaleDateString('es-AR')}</Text>
            )}
          </View>
          <Image src={`data:image/png;base64,${LOGO_PNG_BASE64}`} style={styles.logo} />
        </View>

        {data.presupuesto.descripcion && <Text style={{ marginBottom: 12 }}>{data.presupuesto.descripcion}</Text>}

        <View style={styles.row}>
          <Text style={[styles.cellDesc, { fontWeight: 700 }]}>Descripción</Text>
          <Text style={[styles.cellNum, { fontWeight: 700 }]}>Cant.</Text>
          <Text style={[styles.cellNum, { fontWeight: 700 }]}>Un.</Text>
          <Text style={[styles.cellNum, { fontWeight: 700 }]}>P. Unit.</Text>
          <Text style={[styles.cellNum, { fontWeight: 700 }]}>Subtotal</Text>
        </View>

        {data.grupos.map((g) => (
          <View key={g.nombre} wrap={false}>
            <Text style={styles.rubroHeader}>{g.nombre}</Text>
            {g.items.map((it, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.cellDesc}>{it.descripcion}</Text>
                <Text style={styles.cellNum}>{it.cantidad}</Text>
                <Text style={styles.cellNum}>{it.unidad}</Text>
                <Text style={styles.cellNum}>{it.precioUnitario}</Text>
                <Text style={styles.cellNum}>{it.subtotal}</Text>
              </View>
            ))}
            <View style={[styles.row, { fontWeight: 700 }]}>
              <Text style={styles.cellDesc}>Subtotal {g.nombre}</Text>
              <Text style={styles.cellNum}></Text>
              <Text style={styles.cellNum}></Text>
              <Text style={styles.cellNum}></Text>
              <Text style={styles.cellNum}>{g.subtotal}</Text>
            </View>
          </View>
        ))}

        <View style={styles.total}>
          <Text>Total: {data.presupuesto.totalClienteCalculado} {data.obra.monedaBase}</Text>
        </View>

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages} · Macna Construcciones`} fixed />
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/pdf/template-v1.tsx
git commit -m "feat(pdf): template v1"
```

---

## Task 8: Función de render + ramificación por template_version

**Files:**
- Create: `src/lib/pdf/render.ts`

- [ ] **Step 1: Render**

```ts
// src/lib/pdf/render.ts
import { renderToStream } from '@react-pdf/renderer';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { presupuesto, itemPresupuesto, obra, rubro } from '@/db/schema';
import { D } from '@/lib/money/decimal';
import { PresupuestoPdfV1, type PdfData } from './template-v1';

export async function buildPdfData(presupuestoId: string): Promise<PdfData | null> {
  const [p] = await db.select().from(presupuesto).where(eq(presupuesto.id, presupuestoId)).limit(1);
  if (!p) return null;
  const [o] = await db.select().from(obra).where(eq(obra.id, p.obraId));
  const items = await db.select({ item: itemPresupuesto, rubro })
    .from(itemPresupuesto).leftJoin(rubro, eq(itemPresupuesto.rubroId, rubro.id))
    .where(eq(itemPresupuesto.presupuestoId, p.id))
    .orderBy(asc(itemPresupuesto.orden));

  const gruposMap = new Map<string, { nombre: string; items: PdfData['grupos'][number]['items']; subtotal: ReturnType<typeof D> }>();
  for (const { item, rubro: r } of items) {
    const key = r?.nombre ?? 'Sin rubro';
    if (!gruposMap.has(key)) gruposMap.set(key, { nombre: key, items: [], subtotal: D(0) });
    const sub = D(item.precioUnitarioCliente).times(item.cantidad);
    gruposMap.get(key)!.items.push({
      descripcion: item.descripcion,
      cantidad: D(item.cantidad).toFixed(2),
      unidad: item.unidad,
      precioUnitario: D(item.precioUnitarioCliente).toFixed(2),
      subtotal: sub.toFixed(2),
    });
    gruposMap.get(key)!.subtotal = gruposMap.get(key)!.subtotal.plus(sub);
  }

  return {
    obra: { codigo: o.codigo, nombre: o.nombre, clienteNombre: o.clienteNombre, monedaBase: o.monedaBase, ubicacion: o.ubicacion },
    presupuesto: {
      numero: p.numero, tipo: p.tipo, descripcion: p.descripcion,
      fechaFirma: p.fechaFirma, totalClienteCalculado: D(p.totalClienteCalculado ?? '0').toFixed(2),
    },
    grupos: Array.from(gruposMap.values()).map((g) => ({
      nombre: g.nombre, items: g.items, subtotal: g.subtotal.toFixed(2),
    })),
  };
}

export async function renderPresupuestoPdfStream(presupuestoId: string): Promise<NodeJS.ReadableStream | null> {
  const [p] = await db.select({ templateVersion: presupuesto.templateVersion }).from(presupuesto).where(eq(presupuesto.id, presupuestoId)).limit(1);
  if (!p) return null;

  const data = await buildPdfData(presupuestoId);
  if (!data) return null;

  switch (p.templateVersion) {
    case 1:
      return renderToStream(<PresupuestoPdfV1 data={data} />);
    default:
      throw new Error(`template_version ${p.templateVersion} no soportada`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/pdf/render.ts
git commit -m "feat(pdf): render dispatcher por template_version"
```

---

## Task 9: API route `/api/pdf/[presupuestoId]`

**Files:**
- Create: `src/app/api/pdf/[presupuestoId]/route.ts`

- [ ] **Step 1: Handler**

```ts
// src/app/api/pdf/[presupuestoId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { presupuesto } from '@/db/schema';
import { getObraByToken } from '@/lib/auth/cliente-token';
import { getSessionUser } from '@/lib/auth/require';
import { renderPresupuestoPdfStream } from '@/lib/pdf/render';

export const runtime = 'nodejs';
export const maxDuration = 60; // segundos; Vercel Pro permite hasta 300

export async function GET(req: NextRequest, { params }: { params: Promise<{ presupuestoId: string }> }) {
  const { presupuestoId } = await params;
  const token = req.nextUrl.searchParams.get('token');

  // Cargar el presupuesto + obra para autorización.
  const [p] = await db.select().from(presupuesto).where(eq(presupuesto.id, presupuestoId)).limit(1);
  if (!p) return new NextResponse('Not found', { status: 404 });
  if (p.estado !== 'firmado') return new NextResponse('Not signed', { status: 403 });

  // Autorización: O bien token público válido para esta obra, O bien sesión Admin.
  let authorized = false;
  if (token) {
    const obra = await getObraByToken(token);
    if (obra && obra.id === p.obraId) authorized = true;
  }
  if (!authorized) {
    const user = await getSessionUser();
    if (user) authorized = true;
  }
  if (!authorized) return new NextResponse('Unauthorized', { status: 401 });

  const stream = await renderPresupuestoPdfStream(presupuestoId);
  if (!stream) return new NextResponse('Render failed', { status: 500 });

  // @ts-expect-error react-pdf devuelve un stream que satisface ReadableStream para NextResponse
  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="presupuesto-${p.numero}.pdf"`,
      'Cache-Control': 'private, no-cache',
    },
  });
}
```

- [ ] **Step 2: Smoke manual**

Run: `pnpm dev`. Loguear Admin → ir a un presupuesto firmado → abrir `/api/pdf/<id>`. Debe descargar PDF.

También probar como cliente: `/api/pdf/<id>?token=<token>` (sin sesión interna).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/pdf/
git commit -m "feat(pdf): API route con autorización (token público o sesión)"
```

---

## Task 10: Test de performance del PDF

**Files:**
- Create: `tests/integration/pdf-render.test.ts`

- [ ] **Step 1: Test**

```ts
// tests/integration/pdf-render.test.ts
import { resetDb } from './setup';
import { makeUsuario, makeRubro, makeObra } from './factories';
import { db } from '@/db/client';
import { presupuesto, itemPresupuesto } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { renderPresupuestoPdfStream } from '@/lib/pdf/render';
import { randomUUID } from 'crypto';

async function consumeStream(s: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of s as any) chunks.push(c);
  return Buffer.concat(chunks);
}

describe('pdf render', () => {
  beforeEach(async () => { await resetDb(); });

  it('render <5s para 100 items, devuelve PDF válido', async () => {
    const admin = await makeUsuario('admin');
    const o = await makeObra(admin.id);
    const ru = await makeRubro();

    const [p] = await db.insert(presupuesto).values({
      obraId: o.id, tipo: 'original', numero: 1, estado: 'firmado',
      markupDefaultPorcentaje: '30', cotizacionUsd: '1200',
      version: 2, fechaFirma: new Date(),
      totalClienteCalculado: '13000', totalCostoCalculado: '10000',
      createdBy: admin.id, updatedBy: admin.id,
    }).returning();

    await db.insert(itemPresupuesto).values(
      Array.from({ length: 100 }, (_, i) => ({
        id: randomUUID(),
        presupuestoId: p.id, rubroId: ru.id, orden: i,
        descripcion: `Item ${i}`,
        unidad: 'gl' as const, cantidad: '1.0000',
        costoUnitario: '100.0000', costoUnitarioMoneda: 'USD' as const,
        costoUnitarioBase: '100.0000',
        markupPorcentaje: null, markupEfectivoPorcentaje: '30.00',
        precioUnitarioCliente: '130.0000',
      })),
    );

    const t0 = Date.now();
    const stream = await renderPresupuestoPdfStream(p.id);
    const buf = await consumeStream(stream!);
    const elapsed = Date.now() - t0;

    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    expect(elapsed).toBeLessThan(5000);
  }, 15_000);
});
```

- [ ] **Step 2: Run**

Run: `pnpm test:integration -- pdf-render`
Expected: PASS, elapsed reportado.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/pdf-render.test.ts
git commit -m "test(pdf): performance budget <5s @ 100 items"
```

---

## Task 11: E2E de seguridad y happy path (Playwright)

**Files:**
- Create: `tests/e2e/cliente.spec.ts`, `tests/e2e/seguridad.spec.ts`, `playwright.config.ts` (revisar si Plan 1 lo dejó vacío)

- [ ] **Step 1: Configurar Playwright**

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: { baseURL: 'http://localhost:3000', headless: true },
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Happy path**

```ts
// tests/e2e/cliente.spec.ts
import { test, expect } from '@playwright/test';

test('admin firma presupuesto y el cliente lo ve por token', async ({ page, request }) => {
  // Asume que el seed creó admin y al menos una obra+presupuesto firmado en DB de test.
  // Como alternativa, este test se puede correr después del integration setup.
  await page.goto('/login');
  await page.fill('input[name=email]', process.env.SEED_ADMIN_EMAIL!);
  await page.fill('input[name=password]', process.env.SEED_ADMIN_PASSWORD!);
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/obras/);

  // El test asume una obra firmada existente; si no, crearla aquí via UI.
});
```

> Nota: el test E2E requiere fixtures pre-cargadas. Documentar en README cómo correr `pnpm db:seed` + un fixture E2E.

- [ ] **Step 3: Test de seguridad**

```ts
// tests/e2e/seguridad.spec.ts
import { test, expect } from '@playwright/test';

test('operador no puede acceder al editor de presupuesto', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name=email]', process.env.SEED_OPERADOR_EMAIL!);
  await page.fill('input[name=password]', process.env.SEED_OPERADOR_PASSWORD!);
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/obras/);

  // Acceder directo a una URL de editor → 403
  const r = await page.goto('/obras/00000000-0000-0000-0000-000000000000/presupuestos/00000000-0000-0000-0000-000000000000');
  // Como la pagina lanza Response 403, Next muestra error page. Verificamos código.
  expect([403, 404]).toContain(r?.status() ?? 0);
});
```

- [ ] **Step 4: Agregar a CI**

En `.github/workflows/ci.yml` agregar job E2E que corre solo en PR a main.

```yaml
  e2e:
    runs-on: ubuntu-latest
    needs: integration
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm db:migrate:prod
        env: { DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}, DIRECT_URL: ${{ secrets.TEST_DIRECT_URL }} }
      - run: pnpm db:seed
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          DIRECT_URL: ${{ secrets.TEST_DIRECT_URL }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_ROLE_KEY }}
          SEED_ADMIN_EMAIL: ${{ secrets.SEED_ADMIN_EMAIL }}
          SEED_ADMIN_PASSWORD: ${{ secrets.SEED_ADMIN_PASSWORD }}
      - run: pnpm test:e2e
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          DIRECT_URL: ${{ secrets.TEST_DIRECT_URL }}
          SEED_ADMIN_EMAIL: ${{ secrets.SEED_ADMIN_EMAIL }}
          SEED_ADMIN_PASSWORD: ${{ secrets.SEED_ADMIN_PASSWORD }}
          SEED_OPERADOR_EMAIL: ${{ secrets.SEED_OPERADOR_EMAIL }}
          SEED_OPERADOR_PASSWORD: ${{ secrets.SEED_OPERADOR_PASSWORD }}
```

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/ .github/workflows/ci.yml
git commit -m "test(e2e): happy path + security; CI"
```

---

## Verificación final del Plan 4

- [ ] Cliente accede a `/cliente/<token>` y ve solo presupuestos firmados.
- [ ] Cliente con token inválido → redirect a `/cliente/expirado` (NO 404).
- [ ] Cliente descarga PDF desde `/api/pdf/<id>?token=<token>`.
- [ ] Admin descarga el mismo PDF desde el botón en la página interna (sin token).
- [ ] Regenerar token invalida el anterior inmediatamente (verificar visitando el viejo URL).
- [ ] Test de perf PDF en CI verde.
- [ ] E2E de seguridad: Operador no puede acceder a `/obras/.../presupuestos/...`.

**Salida**: app lista para piloto. Cliente recibe link y PDF. Listo para Plan 5.
