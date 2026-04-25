# Macna · Sistema de Gestión de Obras — Spec de Diseño Fase 0 + Fase 1

**Fecha**: 2026-04-25
**Alcance**: Fase 0 (Fundaciones) + Fase 1 (MVP Presupuesto con doble vista)
**Estado**: aprobado para pasar a plan de implementación

---

## 1. Contexto y objetivos

Macna es una empresa constructora argentina que hoy gestiona sus obras en planillas de Google Sheets. El objetivo es reemplazar gradualmente esas planillas por un sistema web propio, **sin cortar la operación**. El roadmap completo tiene 5 fases. Este spec cubre las dos primeras:

- **Fase 0 — Fundaciones**: modelo de datos core, stack técnico, importador de Sheets.
- **Fase 1 — MVP Presupuesto**: CRUD de obras/rubros/tareas, doble vista (cliente vs interna), markup configurable, link mágico para cliente, exportar PDF.

Las Fases 2–5 (cash flow, multimoneda completa, dashboard global, mobile/OCR) se brainstormean cada una por separado.

### Criterios de éxito de Fase 1

- Es posible armar un presupuesto nuevo en el sistema en lugar de Sheets, con doble vista (cliente / interna).
- El cliente recibe un link público de solo lectura con el presupuesto firmado y un PDF descargable.
- El importador puede levantar una obra existente desde un CSV exportado de la planilla actual.
- Una obra piloto opera en paralelo con Sheets durante todo F1; se considera "validado" cuando hay 3 cierres semanales consecutivos con coincidencia exacta de totales.

### Principios transversales (a respetar en todas las fases)

- **Auditoría desde el día 1**: cada cambio importante con autor + timestamp.
- **No-lock-in**: exportación a Excel siempre disponible.
- **Backups automáticos** vía Supabase Pro (Point-in-Time Recovery 7 días).
- **Una obra piloto en paralelo** durante F1–F2; no migrar todo de golpe.
- **No replicar la planilla pixel por pixel**: cosas como la "franja negra" se resuelven con permisos, no con columnas.

---

## 2. Decisiones de producto

### 2.1 Tenancy

Single-tenant. Una sola instancia, una sola DB. Sin `empresa_id` en el modelo. Si en el futuro hay venta a otras constructoras, se reevalúa.

### 2.2 Versionado de presupuestos

El presupuesto firmado es **inmutable**. Los cambios se modelan como **presupuestos adicionales** separados (cada uno con su propio PDF firmable). Una Obra acumula 1 presupuesto original + N adicionales. Total de la obra = suma de presupuestos firmados.

Estados del presupuesto: `borrador` | `firmado` | `cancelado`.
- En `borrador`: editable. Cambios al markup default o a la cotización USD recalculan los snapshots de los ítems.
- Al firmar: estado pasa a `firmado` y los snapshots quedan congelados. No se permiten más mutaciones.
- Si hay error grave: se cancela (estado `cancelado`) y se reemite uno nuevo.

### 2.3 Cuantificación de ítems

Modelo `cantidad × precio_unitario` con `unidad` (m², m³, hs, gl, u, ml, kg). Estándar de cómputo y presupuesto en construcción. Permite reportes por unidad y, en F3, imputar consumo real contra acopios.

### 2.4 Mecánica de markup

`precio_unitario_cliente = costo_unitario_base × (1 + markup_efectivo / 100)`

- `costo_unitario_base`: el `costo_unitario` convertido a la `moneda_base` de la Obra usando `Presupuesto.cotizacion_usd`.
- `markup_efectivo`: el `markup_porcentaje` del ítem si está seteado; si es null, hereda `Presupuesto.markup_default_porcentaje`.
- Tanto `costo_unitario_base`, `markup_efectivo_porcentaje` como `precio_unitario_cliente` se **persisten** en la DB (snapshots), no se calculan al vuelo. Mientras el presupuesto está en borrador, los snapshots se actualizan en cada save. Al firmar, quedan congelados para siempre.

### 2.5 Multimoneda en Fase 1

- Presupuestos en USD por default (configurable a ARS por obra).
- Costos por ítem pueden estar en USD o ARS. Se convierten a la moneda base usando `Presupuesto.cotizacion_usd` (TC ingresado por el Admin al crear/editar el presupuesto).
- Movimientos multimoneda completos (cada gasto con su moneda y TC del día) llegan en Fase 3. En F1 modelamos `Movimiento`/`Cuenta`/`Proveedor` en el schema pero sin UI.

### 2.6 Acceso del cliente

Cliente accede vía **link mágico**: URL con token aleatorio por obra. No crea cuenta. Solo lectura.

- Token: 32 bytes random codificado en base64url (43 caracteres).
- Regenerable por el Admin desde la pantalla de la obra. La regeneración **invalida el token anterior inmediatamente** (sin período de gracia).
- El cliente accede en `/cliente/[token]` y ve solo esa obra (presupuestos firmados + PDFs).

### 2.7 Roles y permisos

Dos roles internos:

- **Admin** (vos + tu socio): acceso total. Crea/edita/cierra obras, edita presupuestos, certifica avances, ve márgenes, gestiona usuarios y configuración global.
- **Operador** (administración): rol operativo. Carga movimientos, sube comprobantes, ve Vista Cliente. NO ve Vista Interna, NO edita presupuestos, NO certifica avance, NO gestiona usuarios.

| Acción | Admin | Operador |
|---|---|---|
| Crear/editar/cerrar obras | ✓ | ✗ |
| Editar presupuesto y markup | ✓ | ✗ |
| Ver Vista Interna (costos/márgenes) | ✓ | ✗ |
| Ver Vista Cliente | ✓ | ✓ |
| Cargar movimientos / subir comprobantes | ✓ | ✓ |
| Certificar avance | ✓ | ✗ |
| Generar/regenerar link cliente | ✓ | ✗ |
| Gestionar usuarios y configuración global | ✓ | ✗ |

### 2.8 Preview de Vista Cliente para Admins

Botón "Previsualizar como cliente" abre la URL pública (`/cliente/[token]`) en pestaña nueva. Sin componentes embebidos ni split-views — la URL pública es la única implementación de la Vista Cliente.

---

## 3. Modelo de datos

```
Usuario
  id (uuid), email (unique), rol ('admin' | 'operador'),
  nombre, activo (bool, default true),
  created_at
  // password_hash lo gestiona Supabase Auth

Obra
  id (uuid), codigo (unique, ej "M-2026-001"),
  nombre,
  cliente_nombre, cliente_email, cliente_telefono,
  ubicacion (text),
  superficie_m2 (decimal, nullable),
  fecha_inicio (date), fecha_fin_estimada (date), fecha_fin_real (date, nullable),
  moneda_base ('USD' | 'ARS', default 'USD'),
  cotizacion_usd_inicial (decimal, nullable — TC al armar presupuesto original, para análisis),
  porcentaje_honorarios (decimal — guardado pero sin lógica activa en F1),
  estado ('borrador' | 'activa' | 'pausada' | 'cerrada' | 'cancelada'),
  cliente_token (string, 43 chars base64url, regenerable),
  created_at, created_by (FK Usuario), updated_at, updated_by (FK Usuario), deleted_at (nullable)

Rubro  -- catálogo global jerárquico
  id (uuid), nombre,
  id_padre (FK Rubro, nullable — habilita jerarquías como Instalaciones > Gas/Agua/Electricidad),
  orden (int), activo (bool)

Presupuesto
  id (uuid), obra_id (FK Obra),
  tipo ('original' | 'adicional'),
  numero (int — original es 1; adicionales 2, 3, ...),
  descripcion,
  fecha_emision, fecha_firma (nullable),
  estado ('borrador' | 'firmado' | 'cancelado'),
  markup_default_porcentaje (decimal),
  cotizacion_usd (decimal — TC vigente para ESTE presupuesto),
  template_version (int, default 1 — versión del template del PDF; preserva visualización histórica),
  version (int, default 1 — control de concurrencia optimista; sube +1 en cada save),
  total_cliente_calculado (decimal, nullable — snapshot al firmar),
  total_costo_calculado (decimal, nullable — snapshot al firmar),
  created_at, created_by, updated_at, updated_by, deleted_at

ItemPresupuesto
  id (uuid), presupuesto_id (FK Presupuesto), rubro_id (FK Rubro),
  orden (int),
  descripcion,
  unidad ('m2' | 'm3' | 'hs' | 'gl' | 'u' | 'ml' | 'kg'),
  cantidad (decimal),
  costo_unitario (decimal), costo_unitario_moneda ('USD' | 'ARS'),
  costo_unitario_base (decimal — snapshot, costo convertido a moneda_base con cotizacion_usd),
  markup_porcentaje (decimal, nullable — si null hereda Presupuesto.markup_default_porcentaje),
  markup_efectivo_porcentaje (decimal — snapshot del markup usado al calcular precio),
  precio_unitario_cliente (decimal — snapshot, calculado y persistido),
  notas (text, nullable),
  deleted_at (nullable)

AuditLog
  id (uuid),
  entidad ('obra' | 'presupuesto' | 'item_presupuesto' | 'usuario' | 'cliente_token'),
  entidad_id,
  accion ('crear' | 'editar' | 'eliminar' | 'firmar' | 'cancelar' | 'regenerar_token'),
  diff (jsonb — before/after de campos cambiados),
  descripcion_humana (text, nullable — ej "Juan firmó el Presupuesto Original M-2026-001"),
  usuario_id (FK Usuario),
  timestamp
```

### Modelos definidos pero sin UI en F1

Se incluyen en el schema desde Fase 0 para evitar migraciones disruptivas en F2:

- `Movimiento` (entrada/salida con moneda, TC, rubro, obra)
- `Proveedor` / `Contratista`
- `Cuenta` (caja USD, caja física ARS, cuentas bancarias)

### Garantía "escrito en piedra"

Defensa en profundidad sobre presupuestos firmados:

1. **UI**: deshabilita botones de editar.
2. **Server Action**: valida `Presupuesto.estado !== 'firmado'` antes de mutar. Si está firmado, lanza error.
3. **Trigger Postgres**: rechaza UPDATE sobre cualquier `ItemPresupuesto` cuyo `Presupuesto` esté firmado. Última línea de defensa, también bloquea importadores y manipulación directa con `psql`.

### Concurrencia optimista en borradores

Si dos Admins editan el mismo presupuesto en borrador a la vez, queremos detectar la colisión, no perder cambios silenciosamente.

- `Presupuesto.version` (int) sube +1 en cada save de cualquier campo del presupuesto o de sus ítems (la Server Action toca al `Presupuesto` aunque el cambio sea sobre un ítem).
- Cliente envía la `version` que vio al cargar. Server Action hace `UPDATE ... WHERE id = ? AND version = ?` y verifica `rowCount === 1`. Si es 0, alguien más editó: la action devuelve un error tipado (`STALE_VERSION`) y la UI muestra "Otro usuario editó este presupuesto. Recargá para ver los cambios". Sin overwrites silenciosos.
- En el editor, después de cada save exitoso, el cliente recibe la nueva `version` y la usa en el próximo intento.

### Soft delete

`deleted_at` en Obra, Presupuesto, ItemPresupuesto. Hard delete solo en presupuestos en borrador que nunca fueron firmados.

---

## 4. Stack técnico

| Capa | Elección |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| DB | Postgres gestionado por Supabase |
| ORM | **Drizzle ORM + Drizzle Kit** |
| Money / decimales | `decimal.js` (toda la lógica financiera) |
| Form state (editor de presupuesto) | `react-hook-form` + `useFieldArray` |
| Virtualización (tablas grandes) | `@tanstack/react-virtual` |
| UI | shadcn/ui + Tailwind CSS |
| Auth | Supabase Auth (email/password + OAuth Google + Apple) |
| Storage | Supabase Storage (comprobantes, PDFs futuros) |
| Hosting | Vercel (app) + Supabase (DB + storage) |
| Testing | Jest + React Testing Library + Playwright |
| PDF | `@react-pdf/renderer` (server-side) |
| Skills aplicables | `vercel-react-best-practices`, `supabase-postgres-best-practices`, `shadcn`, `frontend-design`, `nodejs-backend-patterns` |

### 4.1 Por qué Drizzle (y no Prisma)

- **Cold starts en serverless**: Drizzle es código TypeScript puro, sin motor binario externo. Arranque inmediato en Vercel Functions vs el peso del query engine de Prisma.
- **SQL-first**: la API es casi SQL puro — si sabés SQL, sabés Drizzle. Prisma inventa su propio DSL.
- **Soft deletes sin workarounds**: vistas filtradas y helpers que omiten `deleted_at IS NOT NULL` se escriben en pocas líneas, sin la "magia" oculta de Prisma.
- **Migraciones SQL transparentes**: Drizzle Kit genera SQL puro versionado (`drizzle/migrations/0001_init.sql`) — fácil de auditar, mergear, revisar en PRs.
- **Postgres-native**: soporte de primera para tipos avanzados (jsonb, arrays, generated columns, vistas materializadas, full-text search) sin escapes a `$queryRaw`.

### 4.2 Decimales y dinero

Toda la lógica financiera (`services/markup.ts`, `currency.ts`, `snapshots.ts`, totales) usa **`decimal.js`**. Nunca el tipo `number` de JS (el clásico `0.1 + 0.2 = 0.30000000000000004` arruinaría totales). Las columnas Postgres `decimal(18, 4)` se cargan como string desde Drizzle y se convierten a `Decimal` antes de cualquier operación. La serialización a JSON para el cliente convierte de vuelta a string para preservar precisión.

### 4.3 Conexión a DB

- `DATABASE_URL` → Supabase pooler (PgBouncer) para queries normales.
- `DIRECT_URL` → conexión directa, solo para `drizzle-kit migrate`.
- Cliente Drizzle singleton vía `globalThis` para evitar reconectar en hot-reload.

---

## 5. Arquitectura

### 5.1 Estructura del repo (feature-first)

```
src/
  app/                              # Next.js App Router
    (auth)/login/                   # Rutas públicas de auth
    (internal)/                     # App interna — requiere sesión
      layout.tsx                    # Auth check + sidebar
      obras/
        page.tsx                    # Lista
        [id]/
          page.tsx                  # Dashboard de obra
          presupuestos/[presId]/page.tsx   # Editor (requiere admin)
      configuracion/
        rubros/page.tsx             # Admin only
        usuarios/page.tsx           # Admin only
        auditoria/page.tsx          # Admin only
    cliente/[token]/                # Ruta pública — Vista Cliente
      page.tsx
    cliente/expirado/page.tsx       # Página de token inválido / regenerado
    api/
      pdf/[presupuestoId]/route.ts  # Genera PDF (binario)

  features/                         # Por dominio
    obras/      { schema.ts, queries.ts, actions.ts, components/ }
    presupuestos/
      services/   { markup.ts, currency.ts, snapshots.ts }
      schema.ts, queries.ts, actions.ts, components/
    rubros/, usuarios/, audit/

  db/                               # Drizzle
    schema.ts                       # Definición de tablas y relaciones (TS)
    client.ts                       # Cliente Drizzle singleton
    seed.ts                         # Rubros default + admin inicial

  lib/
    supabase/              # Clients server/browser/admin
    auth/                  # requireSession, requireRole, getClienteFromToken
    money/                 # Wrappers decimal.js (parse, format, ops)
    pdf/                   # Templates y generación

  components/ui/           # shadcn/ui primitives
  middleware.ts            # Sesión + cliente token

drizzle/                   # Generado por drizzle-kit
  migrations/
  meta/

scripts/
  import-sheets.ts         # Importador one-shot

tests/{unit,integration,e2e}
```

### 5.2 Renderizado y mutaciones

- **Server Components por default**. Páginas hacen `await queries.getX()` directo. Sin React Query salvo en el editor de presupuesto donde hay interactividad fina.
- **Server Actions** para todas las mutaciones internas. Validación con Zod. Tipo-safe, integradas con Next.
- **API routes** solo para: generación de PDF (binario), endpoint público de cliente si conviene separar de SA, webhooks futuros.
- Aplicamos `vercel-react-best-practices`: rules `async-parallel`, `async-api-routes`, `server-auth-actions`, etc.

### 5.3 Lógica de negocio en `services/`

Funciones puras (sin DB, sin React) testables con Jest:

```ts
// features/presupuestos/services/markup.ts
calcularPrecioCliente(costoBase: Decimal, markupPct: Decimal): Decimal

// features/presupuestos/services/currency.ts
convertirAMonedaBase(monto: Decimal, monedaOrigen, monedaBase, cotizacionUsd: Decimal): Decimal

// features/presupuestos/services/snapshots.ts
calcularSnapshotItem(item, presupuesto, obra): ItemSnapshot
```

Las Server Actions orquestan: cargar datos → llamar servicio → persistir → escribir audit log.

### 5.4 Auditoría centralizada

```ts
// features/audit/log.ts
async function logAudit({
  entidad, entidadId, accion, before, after,
  descripcionHumana, userId
})
```

Llamada explícita desde cada Server Action que muta. Sin middleware automático — explicitness > magic.

---

## 6. Auth y permisos

### 6.1 Métodos

- **Email/password** (Supabase Auth nativo).
- **OAuth**: Google + Apple. Configuración de providers en Supabase con dominios autorizados (`prod.macna.app`, `dev.macna.app`, etc.).

### 6.2 Sesión y autorización

- Sesión vía cookie HttpOnly gestionada por `@supabase/ssr`.
- `middleware.ts` valida sesión en `/(internal)/*`. Sin sesión → redirect a `/login`.
- Helpers en `lib/auth/`:
  - `requireSession()` — lanza redirect si no hay sesión
  - `requireRole('admin')` — lanza 403 si rol no es admin
  - `getClienteFromToken(token)` — busca `Obra.cliente_token`, devuelve la obra o null

### 6.3 Vista Interna

Páginas y Server Actions que muestran/editan costos, markups o márgenes invocan `requireRole('admin')` al inicio. Operador que intente acceder recibe 403.

### 6.4 Acceso del cliente

- Middleware matchea `/cliente/[token]/*`.
- Lookup de `Obra.cliente_token = token` (con índice unique).
- Si encuentra: permite acceder a esa obra (read-only).
- Si NO encuentra (token regenerado, mal copiado, expirado): **redirect a `/cliente/expirado`**. Esa página explica claramente "Este enlace de acceso ha expirado o fue regenerado. Por favor, solicitá el enlace actualizado a la administración" con datos de contacto. Nunca devolvemos 404 crudo — eso comunica "sistema roto" cuando en realidad es un evento esperado del flujo.
- Cliente puede: ver presupuestos firmados, descargar PDF. No puede: ver borradores, ver costos/márgenes, modificar nada.

### 6.5 Setup inicial de usuarios

- Seed script (`prisma/seed.ts`) crea el primer Admin (email del dueño) con password temporal.
- Admins crean nuevos usuarios desde `Configuración > Usuarios`. Generan invitación con email + password temporal vía Supabase Auth API.
- Recuperación de contraseña: vía link de Supabase al email. UI default, sin custom.

### 6.6 Postgres RLS

**OFF en Fase 1**. Razón: Prisma se conecta desde el server, no exponemos la DB al cliente. La autorización vive 100% en la app (Server Actions + middleware). Re-evaluamos cuando entren clientes externos directos a Supabase (potencial F4/F5).

---

## 7. UI

### 7.1 Editor de presupuesto (Vista Interna)

**Layout**: acordeón por rubro a nivel de navegación. Cada rubro es una sección colapsable con su total visible. Dentro de cada rubro abierto: tabla densa estilo hoja de cálculo con columnas `Descripción / Cant / Unidad / Costo U. / Moneda / Markup / Precio U. / Subtotal`. Soporta jerarquía de rubros (acordeones anidados).

Justificación de la combinación: el acordeón resuelve la organización por rubro (refleja cómputo y presupuesto real de obra). La tabla densa adentro respeta el muscle memory de quien viene de Excel — navegación con Tab/Enter, edición inline, alta densidad de información.

**Estado del formulario**: `react-hook-form` + `useFieldArray` por rubro. Crítico para escalar a 80–500 ítems sin "re-render hell": al tipear en la fila 42, solo se re-renderiza la fila 42, no todo el presupuesto.

**Renderizado**: cuando un rubro tiene más de ~30 ítems, el contenedor usa virtualización con `@tanstack/react-virtual`. Solo se montan en el DOM las filas visibles + un buffer; el resto se reciclan al hacer scroll. Garantiza 60 FPS aunque la obra tenga 500 tareas.

**Save**: explícito por presupuesto (botón "Guardar borrador") + autosave en background cada 30s mientras hay cambios pendientes. Cada save manda la `version` actual; el backend valida y devuelve la nueva. Si hay conflicto de versión, la UI muestra banner "Otro Admin editó. Recargá para ver" y bloquea más cambios hasta refresh.

**Acciones**: agregar ítem (foco automático en la nueva fila), eliminar ítem, drag-and-drop para reordenar (opcional F1, nice-to-have), botón "Firmar presupuesto" (transición de estado, no reversible salvo cancelación; pide confirmación con preview del PDF).

### 7.2 Vista Cliente

Layout: **documento formal**, una sola tabla agrupada por rubro, subtotales por rubro y total destacado al final. Estilo coherente con el PDF descargable. Header con datos de la obra y fecha. Botón "Descargar PDF firmado".

Justificación: el cliente que firma un presupuesto formal espera ver algo formal. Coincide visualmente con el PDF (consistencia con el papel firmado). En F2 se sumará una sección de "Avance" *aparte*, sin tocar la sección de presupuesto.

### 7.3 Layouts no detallados

Lista de Obras, Detalle de Obra, Configuración (Rubros, Usuarios, Auditoría) y Login son patrones estándar de admin app. Se resuelven en implementación con shadcn/ui sin riesgo de diseño.

---

## 8. Generación de PDF

- Librería: **`@react-pdf/renderer`**. JSX declarativo, generación server-side, sin Chromium headless.
- Endpoint: `app/api/pdf/[presupuestoId]/route.ts`. Devuelve `Content-Type: application/pdf`.
- **El PDF se construye SIEMPRE desde los snapshots de `ItemPresupuesto`** (`costo_unitario_base`, `markup_efectivo_porcentaje`, `precio_unitario_cliente`). Nunca recalcula al vuelo.
- **`template_version`** en `Presupuesto`: si en el futuro el template cambia, los presupuestos viejos siguen rendereando con su versión original. La función de generación ramifica por `template_version`.
- En F1: PDF generado on-demand, no se persiste.
- En F2 (preparado, no implementado): persistencia en Supabase Storage con hash SHA-256 del contenido para validar integridad.

### 8.1 Límite de tiempo en Vercel

`@react-pdf/renderer` puede tomar 3–5 segundos en presupuestos grandes (10+ páginas). Vercel Serverless tiene timeout default de 10s en Hobby, 15s en Pro. Mitigaciones:

- **Assets ligeros**: logos en SVG inline o PNG ≤30 KB. Tipografías embebidas mínimas (1 family, máximo 2 weights).
- **Caché de assets**: tipografías y logo se cargan una vez al inicio del módulo, no por request.
- **`maxDuration` explícito** en el route handler: `export const maxDuration = 60;` (en Pro). Si superamos eso, delegamos a un background job (queue + Supabase Storage), pero eso es problema F2.
- **Test de performance**: en CI, generar PDF de un presupuesto fixture con 100 ítems debe completarse en < 5s. Si falla, alerta.

---

## 9. Importador de Sheets

- **Script CLI one-shot**: `pnpm import-sheets <csv-path> --codigo-obra M-2026-001 [--dry-run]`.
- Formato esperado: CSV con columnas `rubro, descripcion, unidad, cantidad, costo_unitario, moneda_costo, markup, notas`.
- **Modo `--dry-run`**: parsea, valida y reporta lo que crearía, **sin escribir en la DB**. Reporta errores por fila (rubro inválido, moneda no soportada, etc.).
- **Idempotencia**: si `codigo_obra` ya existe en la DB, el script aborta. Para reimportar hay que eliminar la obra primero (manual, intencional).
- **Manejo de rubros**: si un rubro del CSV no existe en el catálogo, lo crea con flag `creado_por_importador = true` para que el Admin revise y dedupe después.
- **Out of scope F1**: integración con Google Sheets API. CSV es suficiente y desacopla el formato.
- **Pendiente para implementación**: el usuario debe compartir 1 planilla representativa para validar el mapeo exacto de columnas.

---

## 10. Auditoría y observabilidad

### 10.1 AuditLog

Tabla universal `AuditLog` con `diff` JSONB y `descripcion_humana` opcional. Llamada explícita desde Server Actions (no middleware automático).

**Eventos críticos a auditar en F1**:
- Firmar presupuesto
- Cancelar presupuesto
- Crear/editar/eliminar obra
- Crear/editar/eliminar usuario
- Regenerar `cliente_token`
- Eliminar presupuesto

### 10.2 UI de auditoría

Pantalla `/(internal)/configuracion/auditoria` (solo Admin):
- Tabla con filtros por entidad, usuario, rango de fechas, acción.
- Vista de detalle expandible por evento (muestra diff JSON formateado).
- Sin exportación de auditoría en F1 (la propia tabla con filtros alcanza).

### 10.3 Exportación a Excel (anti lock-in)

Botón "Exportar XLSX" en:
- Lista de obras → exporta resumen de todas las obras.
- Detalle de obra → exporta presupuestos + ítems.
- Auditoría → exporta filtro actual.

**Estructura del export**: idéntica a la planilla actual de la empresa, garantizando portabilidad. Esto es **requisito**: el usuario nunca debe sentirse "encerrado" en el sistema.

### 10.4 Logs y monitoreo

- `console.log` / `console.error` recogidos por Vercel.
- Vercel Analytics (incluido) para tráfico y core web vitals.
- Supabase dashboard para métricas de DB.
- Sin Datadog/Sentry en F1.

### 10.5 Backups

Supabase Pro: backups automáticos diarios + Point-in-Time Recovery 7 días. Sin nada custom.

---

## 11. Testing

### 11.1 Unit tests (Jest)

Cobertura objetivo F1: **90%+** en `features/*/services/`. Estos son módulos puros (sin DB, sin React) — son los que más se benefician del testing aislado.

- `markup.ts`: cálculo de precio cliente.
- `currency.ts`: conversión USD ↔ ARS.
- `snapshots.ts`: cálculo de snapshots completos por ítem.
- Validadores Zod de schemas.
- **Test de precisión decimal obligatorio**: casos canónicos como `0.1 + 0.2 === 0.3` (con `decimal.js`), markups con 4 decimales, conversiones que generan más decimales que los soportados, redondeos al persistir. Garantiza que ningún cálculo financiero pasa por `number` de JS.

### 11.2 Integration tests (Jest + Prisma con DB de test)

- Setup: `drizzle-kit migrate` contra DB de test antes de cada suite, fixtures via factories.
- Cobertura: smoke de cada Server Action crítico (crear obra, agregar ítem, firmar presupuesto, regenerar token, etc.).
- **Test de inmutabilidad obligatorio**: intentar UPDATE directo en `ItemPresupuesto` con presupuesto firmado → el trigger Postgres debe rechazarlo.
- **Test de concurrencia obligatorio**: dos saves del mismo presupuesto borrador con la misma `version` inicial. El primero gana, el segundo recibe `STALE_VERSION`. Sin overwrites silenciosos.
- **Test de token expirado**: request a `/cliente/<token-invalidado>` → redirect a `/cliente/expirado`, no 404.

### 11.3 E2E (Playwright)

Mínimo en F1:
- **Happy path**: login Admin → crear obra → cargar presupuesto con 3 ítems en 2 rubros → firmar → generar PDF → abrir Vista Cliente con el token.
- **Test de seguridad**: login Operador → intentar acceder a la URL del editor (Vista Interna) → recibe 403.

Más E2E queda para post-piloto.

### 11.4 CI

GitHub Actions:
- En cada push: lint + unit + integration.
- En cada PR a `main`: además E2E.

---

## 12. Deploy y migración

### 12.1 Infraestructura

- **Vercel**: app Next.js. Branch `main` autodeploya a production. Feature branches autodeployan a preview environments.
- **Supabase**: dos proyectos — `prod` y `dev`. Variables de entorno por entorno (Vercel env vars).

### 12.2 Migraciones

- `drizzle-kit migrate` se corre en el build de Vercel (script `npm run db:migrate` invocado en `vercel-build`).
- Migraciones generadas con `drizzle-kit generate` viven en `drizzle/migrations/` como SQL puro versionado, revisables en PRs.
- **Solo migraciones forward**. Prohibido editar migraciones ya aplicadas a producción. Si hay un bug, se revierte con una nueva migración que lo corrija.
- Rollback de app: Vercel mantiene historial de deploys, rollback con un click. La DB no rollbackea (las migraciones son forward).

### 12.3 Plan de cutover (transición desde Sheets)

- **Obra piloto**: una obra real arranca en el sistema *en paralelo* a Sheets. Durante toda la Fase 1, los datos se cargan en ambos.
- **Criterio de éxito para promoverla a "fuente de verdad"**: coincidencia exacta de totales (costo total + total cliente) en **3 cierres semanales consecutivos** vs Sheets.
- Cuando se cumple: la planilla queda como histórico de solo lectura. La siguiente obra se carga directo en el sistema.

### 12.4 Backups

Supabase Pro plan: backups automáticos diarios + Point-in-Time Recovery (PITR) 7 días. Cubre F1 sin problemas.

---

## 13. Pendientes para implementación (no bloquean este spec)

- **Config OAuth providers**: Google + Apple en Supabase (credenciales, dominios autorizados, callbacks).
- **Planilla representativa de Sheets**: el usuario debe compartir al menos 1 obra real exportada a CSV para validar el mapeo del importador.
- **Catálogo inicial de rubros**: definir los rubros estándar a sembrar (demoliciones, albañilería, sanitarios, gas, electricidad, etc.) y su jerarquía.
- **Numeración de obras (`codigo`)**: definir formato (auto-incremental "M-2026-NNN") y reset anual o secuencial global.
- **Dirección de email del primer Admin** y password inicial para el seed.

---

## 14. Out of scope (Fase 1)

Lo siguiente NO está en este spec; se brainstormea por separado al iniciar cada fase:

- **Fase 2**: Cash flow, movimientos, certificaciones de avance, reportes de gasto por rubro.
- **Fase 3**: Multimoneda completa de movimientos, honorarios automáticos, acopios, alertas.
- **Fase 4**: Dashboard consolidado de cuentas, transferencias, conciliación, cierre mensual.
- **Fase 5**: App mobile, OCR de facturas, portal cliente con login, integración homebanking, firma digital.
- Real-time updates (websockets), notificaciones push, multi-idioma, dark/light theme custom.

---

## 15. Anexo — Decisiones cerradas en brainstorming

Para referencia rápida, la lista compacta de las elecciones tomadas:

| Tema | Decisión |
|---|---|
| Tenancy | Single-tenant |
| Multimoneda | USD/ARS desde día 1 en modelo; UI completa en F3 |
| Markup | Configurable, precio derivado, snapshots persistidos |
| Cliente | Link mágico (32 bytes base64url), sin grace period al regenerar |
| Roles | Admin + Operador (2 roles) |
| Operador certifica avance | NO |
| Stack | Next.js + TS + Postgres (Supabase) + **Drizzle ORM** + shadcn + Tailwind + Vercel |
| Decimales / dinero | `decimal.js` en toda la lógica financiera (nunca JS `number`) |
| Editor de presupuesto (estado) | `react-hook-form` + `useFieldArray` |
| Editor de presupuesto (render) | Virtualización con `@tanstack/react-virtual` |
| Concurrencia en borradores | Optimista vía `Presupuesto.version` (rechaza overwrites silenciosos) |
| Token cliente inválido | Redirect a `/cliente/expirado` con explicación, no 404 |
| Vercel timeout PDF | `maxDuration` configurado, assets cacheados, test de perf en CI |
| Auth | Supabase Auth: email/password + Google + Apple |
| RLS | OFF en F1 |
| Versionado de presupuesto | Firmados inmutables; cambios = adicionales |
| Cuantificación | `cantidad × precio_unitario` con `unidad` |
| Server Actions vs API routes | Server Actions por default; API solo para PDF y futuros públicos |
| Naming | Dominio en español, infra en inglés |
| Trigger Postgres anti-edit firmado | SÍ (defensa en profundidad) |
| Estructura repo | Feature-first (`features/<dominio>/`) |
| Preview de Vista Cliente | Pestaña nueva (sin embed/split) |
| Editor de presupuesto | Acordeón por rubro |
| Vista Cliente | Documento formal |
| PDF | `@react-pdf/renderer`, on-demand, desde snapshots, con `template_version` |
| Importador | CLI one-shot, CSV, `--dry-run`, idempotente por `codigo_obra` |
| Auditoría | AuditLog explícito + UI con filtros |
| Export | XLSX con estructura idéntica a planilla actual |
| Cutover | Piloto en paralelo, 3 cierres semanales coincidentes |
