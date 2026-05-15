# Spec: Flujo de Caja MACNA (MVP)

> Spec congelada. Si encontrás errores, agregar nota al final con fecha; no reescribir secciones cerradas.

**Fecha**: 2026-05-15  
**Cubre**: ROADMAP §2.1 (Flujo de caja por obra) + §2.2 (Flujo de caja general empresa)  
**Plan de ejecución**: `docs/superpowers/plans/2026-05-15-plan-flujo-caja.md` (a crear)  
**Contexto extenso**: ver `/Users/lzayas/.claude/plans/vamos-a-hacer-un-virtual-starlight.md` (plan inicial)

---

## 1. Propósito y alcance

Macna administra hoy toda su plata en un Excel (`MACNA ADMINISTRACION - Lucho (1).xlsx`) con 4 hojas: caja general empresa, flujo por obra (LOZANO, JUNCAL), y P&L por obra. Este spec define un sistema que **reemplaza la carga manual de movimientos** en la app, con tres capacidades:

1. **Caja general empresa**: cobros de honorarios, gastos indirectos, sueldos, cobros de socios, transferencias entre cuentas.
2. **Flujo de caja por obra**: cobros del cliente, pagos a contratistas/proveedores, materiales, gastos directos asignables.
3. **Saldos por cuenta** en tiempo real (4 cuentas iniciales: Caja USD, Caja Física ARS, Banco Cris, Banco Frank).

**No cubre** (queda fuera del MVP, va a ROADMAP):
- HO automático del 16% al firmar presupuesto (§2.9).
- P&L cruzando movimiento × presupuesto (§2.5).
- Proyecciones / forecast (§2.6).
- Gastos indirectos prorrateados / payroll (§2.7).
- TC automático del BCRA (§2.8 parcial).
- Acopios (§2.10), Dashboard (§2.11), Cierre mensual (§2.12), OCR (§2.13), Homebanking (§2.16).
- Migración automática del histórico desde Excel: arranca con cuentas vacías, el usuario carga movimientos nuevos desde la fecha de cutover.

---

## 2. Decisiones cerradas

| # | Decisión | Razón |
|---|---|---|
| D1 | **Categorías como tabla configurable** (`concepto_movimiento`) | Mismo patrón que `rubro`. Admin agrega/desactiva sin deploy. |
| D2 | **Transferencias = un solo movimiento** con `cuenta_origen_id` + `cuenta_destino_id` + `monto_origen` + `monto_destino` + `cotizacion`. | Una fila = un evento. Reportes y auditoría más limpios que dos filas linkeadas. |
| D3 | **HO Honorarios manual en MVP** | Auto-cálculo necesita P&L y movimientos previstos vs reales. Plan futuro. |
| D4 | **Origen/Destino normalizados con tabla `parte`** | Tipo: `empresa|obra|socio|empleado|proveedor|externo`. `EMPRESA` es entidad fija seedeada. |
| D5 | **Anulación, no hard-delete**: campo `anulado bool` + `anulado_motivo` + `anulado_at` + `anulado_by`. Restaurable por admin. | Audit completo, no perder histórico. |
| D6 | **Optimistic locking con `version` int** | Mismo patrón que presupuestos. Evita concurrent edits silenciosos. |
| D7 | **Balances negativos**: permitido, warning visual | No bloquear, solo informar. Macna a veces opera en rojo temporal. |
| D8 | **`proveedor` se mantiene como tabla independiente** | No se mergea en `parte`. Razón: `proveedor` tiene atributos propios (cuit, contacto, es_contratista) y patrones futuros (catálogo de proveedores con histórico). `parte` referencia `proveedor_id` cuando `tipo='proveedor'`. |
| D9 | **Honorarios pendientes**: campo `estado` del movimiento (`previsto|confirmado|anulado`). Default = `confirmado` al cargar. | Permite cargar "esperado" y luego "liquidar". MVP solo usa `confirmado` por defecto. |
| D10 | **Comprobantes**: campo `comprobante_url` en `movimiento` + bucket `comprobantes` privado en Supabase Storage. | Opcional al cargar. Signed URL al verlo. |
| D11 | **Filtros con URL searchParams** | Server Component lee `searchParams`. Patrón futuro replicable en obras / auditoría. |
| D12 | **Cálculo de saldos en cada page load** (sin cache) | OK hasta ~1000 movimientos. Si crece, materializar después. |
| D13 | **`movimiento.cuenta_id` se renombra a `cuenta_origen_id`** en migration 0003 | Para claridad cuando hay transferencias. |
| D14 | **`movimiento.tipo` se extiende** de `entrada|salida` a `entrada|salida|transferencia` | Nuevo valor de enum. |

---

## 3. Modelo de datos

### 3.1 Nuevas tablas

#### `parte`

Origen o destinatario de un movimiento. Una sola tabla normalizada por todos los tipos.

```sql
CREATE TYPE tipo_parte AS ENUM ('empresa', 'obra', 'socio', 'empleado', 'proveedor', 'externo');

CREATE TABLE parte (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        tipo_parte NOT NULL,
  nombre      text NOT NULL,
  obra_id     uuid REFERENCES obra(id),         -- solo si tipo='obra'
  proveedor_id uuid REFERENCES proveedor(id),    -- solo si tipo='proveedor'
  datos       jsonb,                            -- {cuit, contacto, notas, etc.}
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- Constraints
  CONSTRAINT parte_obra_ref CHECK (
    (tipo = 'obra' AND obra_id IS NOT NULL) OR (tipo != 'obra' AND obra_id IS NULL)
  ),
  CONSTRAINT parte_proveedor_ref CHECK (
    (tipo = 'proveedor' AND proveedor_id IS NOT NULL) OR (tipo != 'proveedor' AND proveedor_id IS NULL)
  )
);
CREATE INDEX parte_tipo_idx ON parte(tipo) WHERE activo = true;
CREATE UNIQUE INDEX parte_obra_uniq ON parte(obra_id) WHERE obra_id IS NOT NULL;
CREATE UNIQUE INDEX parte_proveedor_uniq ON parte(proveedor_id) WHERE proveedor_id IS NOT NULL;
```

**Notas**:
- `EMPRESA` se seedea como una parte fija con `tipo='empresa'`, `nombre='Macna'`. Servirá como contraparte default.
- Cada `obra` tiene una `parte` correspondiente creada automáticamente al crear obra (trigger o lógica en server action). El usuario nunca crea partes tipo `obra` a mano.
- Cada `proveedor` tiene una `parte` correspondiente (similar).
- `socio` / `empleado` / `externo`: el admin las crea manualmente desde `/configuracion/partes`.

#### `concepto_movimiento`

Categoría del movimiento. Define qué campos son requeridos.

```sql
CREATE TYPE tipo_concepto AS ENUM ('ingreso', 'egreso', 'transferencia');

CREATE TABLE concepto_movimiento (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo              text NOT NULL UNIQUE,    -- 'HO', 'MO_BENEFICIO', etc.
  nombre              text NOT NULL,           -- humano
  tipo                tipo_concepto NOT NULL,
  requiere_obra       boolean NOT NULL DEFAULT false,
  requiere_proveedor  boolean NOT NULL DEFAULT false,
  es_no_recuperable   boolean NOT NULL DEFAULT false,
  orden               integer NOT NULL DEFAULT 0,
  activo              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX concepto_movimiento_activo_idx ON concepto_movimiento(activo, orden);
```

**Notas**:
- `codigo` es UNIQUE — usado para lookup en seed y para audit log.
- `requiere_obra`: si true, el movimiento DEBE tener `obra_id`. Si false, opcional.
- `requiere_proveedor`: idem para `proveedor_id`.
- `es_no_recuperable`: flag por defecto del concepto. Override por movimiento existe.
- `tipo='transferencia'` activa el form especial de 2 cuentas.

#### `estado_movimiento` (nuevo enum)

```sql
CREATE TYPE estado_movimiento AS ENUM ('previsto', 'confirmado', 'anulado');
```

### 3.2 Cambios a `movimiento`

```sql
-- Extender enum tipo_movimiento (de 'entrada','salida' a también 'transferencia')
ALTER TYPE tipo_movimiento ADD VALUE 'transferencia';

-- Renombrar cuenta_id → cuenta_origen_id
ALTER TABLE movimiento RENAME COLUMN cuenta_id TO cuenta_origen_id;

-- Nuevas columnas
ALTER TABLE movimiento
  ADD COLUMN concepto_id          uuid REFERENCES concepto_movimiento(id),
  ADD COLUMN parte_origen_id      uuid REFERENCES parte(id),
  ADD COLUMN parte_destino_id     uuid REFERENCES parte(id),
  ADD COLUMN cuenta_destino_id    uuid REFERENCES cuenta(id),
  ADD COLUMN monto_destino        numeric(18,4),
  ADD COLUMN es_no_recuperable    boolean NOT NULL DEFAULT false,
  ADD COLUMN numero_comprobante   text,
  ADD COLUMN estado               estado_movimiento NOT NULL DEFAULT 'confirmado',
  ADD COLUMN anulado_motivo       text,
  ADD COLUMN anulado_at           timestamptz,
  ADD COLUMN anulado_by           uuid REFERENCES usuario(id),
  ADD COLUMN version              integer NOT NULL DEFAULT 1,
  ADD COLUMN updated_at           timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_by           uuid REFERENCES usuario(id);

-- Constraints
ALTER TABLE movimiento ADD CONSTRAINT movimiento_transferencia_check CHECK (
  (tipo != 'transferencia') OR (cuenta_destino_id IS NOT NULL AND cuenta_origen_id IS NOT NULL)
);
ALTER TABLE movimiento ADD CONSTRAINT movimiento_transferencia_distintas CHECK (
  cuenta_destino_id IS NULL OR cuenta_destino_id != cuenta_origen_id
);

-- Hacer concepto_id NOT NULL después del backfill (la migration lo manejará)
-- Por ahora se permite NULL para que apliquen al schema existente sin movimientos.

-- Índices nuevos
CREATE INDEX movimiento_obra_fecha_idx ON movimiento(obra_id, fecha DESC);
CREATE INDEX movimiento_cuenta_origen_fecha_idx ON movimiento(cuenta_origen_id, fecha DESC);
CREATE INDEX movimiento_cuenta_destino_fecha_idx ON movimiento(cuenta_destino_id, fecha DESC) WHERE cuenta_destino_id IS NOT NULL;
CREATE INDEX movimiento_concepto_fecha_idx ON movimiento(concepto_id, fecha DESC);
CREATE INDEX movimiento_parte_origen_fecha_idx ON movimiento(parte_origen_id, fecha DESC) WHERE parte_origen_id IS NOT NULL;
CREATE INDEX movimiento_parte_destino_fecha_idx ON movimiento(parte_destino_id, fecha DESC) WHERE parte_destino_id IS NOT NULL;
CREATE INDEX movimiento_estado_idx ON movimiento(estado) WHERE estado != 'confirmado';
```

### 3.3 Cambios al audit log

Extender `entidadAuditEnum` con:
- `'movimiento'`, `'cuenta'`, `'concepto_movimiento'`, `'parte'`, `'proveedor'`

Extender `accionAuditEnum` con:
- `'anular'`, `'restaurar'`

### 3.4 Cambios menores

- `cuenta`: agregar `orden int default 0` para ordenar en UI.
- `cuenta`: agregar `notas text` para descripciones largas.

---

## 4. Seed inicial

### 4.1 Cuentas (4)

```ts
[
  { nombre: 'Caja USD', moneda: 'USD', tipo: 'caja', orden: 1 },
  { nombre: 'Caja Física ARS', moneda: 'ARS', tipo: 'caja', orden: 2 },
  { nombre: 'Banco Cris', moneda: 'ARS', tipo: 'banco', orden: 3 },
  { nombre: 'Banco Frank', moneda: 'ARS', tipo: 'banco', orden: 4 },
]
```

(Nombres "Cris" y "Frank" son los socios de Macna; confirmar con el usuario los nombres reales al seedear contra `macna-dev`.)

### 4.2 Conceptos (13)

```ts
[
  // INGRESOS
  { codigo: 'HO',                       nombre: 'Honorarios de Obra (16%)',  tipo: 'ingreso',   requiere_obra: true,  orden: 1 },
  { codigo: 'MO_BENEFICIO',             nombre: 'Mano de Obra · Beneficio',  tipo: 'ingreso',   requiere_obra: true,  orden: 2 },
  { codigo: 'MAT_BENEFICIO',            nombre: 'Materiales · Beneficio',    tipo: 'ingreso',   requiere_obra: true,  orden: 3 },
  { codigo: 'HP',                       nombre: 'Honorarios de Proyecto',    tipo: 'ingreso',   requiere_obra: false, orden: 4 },
  { codigo: 'COMISION',                 nombre: 'Comisión',                  tipo: 'ingreso',   requiere_obra: false, orden: 5 },
  { codigo: 'RECUPERO',                 nombre: 'Recupero',                  tipo: 'ingreso',   requiere_obra: true,  orden: 6 },
  // EGRESOS
  { codigo: 'COBRO_SOCIO',              nombre: 'Cobro de Socio',            tipo: 'egreso',    requiere_obra: false, orden: 10 },
  { codigo: 'SUELDO',                   nombre: 'Sueldo',                    tipo: 'egreso',    requiere_obra: false, orden: 11 },
  { codigo: 'PAGOS_CONSULTORA',         nombre: 'Pagos Consultora',          tipo: 'egreso',    requiere_obra: false, orden: 12 },
  { codigo: 'MARKETING',                nombre: 'Marketing',                 tipo: 'egreso',    requiere_obra: false, orden: 13 },
  { codigo: 'GASTO_VARIO',              nombre: 'Gasto Vario',               tipo: 'egreso',    requiere_obra: false, orden: 14 },
  { codigo: 'GASTO_NO_RECUPERABLE',     nombre: 'Gasto No Recuperable',      tipo: 'egreso',    requiere_obra: true,  es_no_recuperable: true, orden: 15 },
  // TRANSFERENCIA
  { codigo: 'MOVIMIENTO_ENTRE_CUENTAS', nombre: 'Movimiento entre Cuentas',  tipo: 'transferencia', requiere_obra: false, orden: 20 },
]
```

### 4.3 Partes fijas

```ts
[
  { tipo: 'empresa', nombre: 'Macna' },
  { tipo: 'socio',   nombre: 'Cris' },
  { tipo: 'socio',   nombre: 'Frank' },
  { tipo: 'empleado', nombre: 'Dani' },
  { tipo: 'externo', nombre: 'Financiera' },
  { tipo: 'externo', nombre: 'Consultora' },
]
```

Las partes tipo `obra` y `proveedor` se autogeneran (no van en seed manual).

---

## 5. Reglas de negocio

### 5.1 Validación al crear `movimiento`

1. `concepto_id` requerido.
2. Si `concepto.tipo='ingreso'`:
   - `parte_origen_id` requerido (de dónde viene la plata).
   - `cuenta_origen_id` requerido (a qué cuenta entra — sí, el nombre `origen` es contra-intuitivo para ingresos; lo aceptamos como "cuenta principal del movimiento").
   - `monto` > 0.
3. Si `concepto.tipo='egreso'`:
   - `parte_destino_id` requerido.
   - `cuenta_origen_id` requerido (de qué cuenta sale).
   - `monto` > 0.
4. Si `concepto.tipo='transferencia'`:
   - `cuenta_origen_id` y `cuenta_destino_id` requeridos, distintos.
   - `monto` (origen) > 0.
   - Si `cuenta_origen.moneda != cuenta_destino.moneda`: `monto_destino` requerido + `cotizacion_usd` requerido.
   - Si misma moneda: `monto_destino = monto`, `cotizacion_usd` opcional.
5. Si `concepto.requiere_obra = true`: `obra_id` requerido.
6. Si `concepto.requiere_proveedor = true`: `proveedor_id` requerido (vía `parte` tipo proveedor).
7. `fecha` requerida, no futura > 90 días (warning, no block).
8. `comprobante_url` opcional; si presente, validar que el archivo está en bucket `comprobantes`.

### 5.2 Cálculo de saldos

```ts
// Por cuenta, hasta fecha (default: now)
saldo_cuenta(cuentaId, fecha?) =
  SUM(monto WHERE tipo='entrada' AND cuenta_origen_id=cuentaId AND estado='confirmado' AND fecha<=...)
  + SUM(monto_destino WHERE tipo='transferencia' AND cuenta_destino_id=cuentaId AND estado='confirmado' AND fecha<=...)
  - SUM(monto WHERE tipo='salida' AND cuenta_origen_id=cuentaId AND estado='confirmado' AND fecha<=...)
  - SUM(monto WHERE tipo='transferencia' AND cuenta_origen_id=cuentaId AND estado='confirmado' AND fecha<=...)
```

Movimientos `previsto` o `anulado` NO entran en saldo.

### 5.3 Permisos

| Acción | admin | operador |
|---|---|---|
| Listar movimientos | ✅ | ✅ (solo de obras donde tiene acceso — TBD, simplificar a "todos" en MVP) |
| Crear movimiento | ✅ | ✅ |
| Editar movimiento propio (created_by = self) | ✅ | ✅ |
| Editar movimiento ajeno | ✅ | ❌ |
| Anular movimiento | ✅ | ❌ (request to admin) |
| Restaurar anulado | ✅ | ❌ |
| ABM Cuentas / Conceptos / Partes / Proveedores | ✅ | ❌ |
| Ver vista flujo empresa | ✅ | ✅ |
| Ver vista flujo por obra | ✅ | ✅ |

### 5.4 Concurrencia (optimistic lock)

Cada `editarMovimiento(id, input)` recibe `expected_version`. Si `db.version != expected_version` → error `STALE_VERSION`. UI muestra dialog "Otra persona modificó este movimiento, recargar".

### 5.5 Anulación

`anularMovimiento(id, motivo)`:
- requireRole('admin')
- Set `estado='anulado'`, `anulado_motivo=motivo`, `anulado_at=now()`, `anulado_by=admin.id`, `version+=1`.
- Audit log: `accion='anular'`.
- NO toca otros campos. Restaurable después.

`restaurarMovimiento(id)`:
- requireRole('admin')
- Set `estado='confirmado'`, clear `anulado_*`, `version+=1`.
- Audit log: `accion='restaurar'`.

---

## 6. UI / Páginas

### 6.1 Configuración (admin)

- **`/configuracion/cuentas`**: tabla con nombre, moneda, tipo, saldo actual, activo. Botón "Nueva cuenta". Edit inline.
- **`/configuracion/conceptos-movimiento`**: tabla con código, nombre, tipo, flags, activo. Edit inline.
- **`/configuracion/partes`**: tabla con tipo (filtro), nombre, datos. Botón "Nueva parte". Edit inline.
- **`/configuracion/proveedores`**: tabla con nombre, cuit, contacto, es_contratista, activo. Edit inline. (Crear `parte` espejo automáticamente.)

### 6.2 Movimientos

- **`/movimientos`** (server component con searchParams):
  - Header: saldos de cada cuenta (4 chips).
  - Filtros (URL params): obra, cuenta, concepto, parte, tipo, desde, hasta, estado, search (descripción).
  - Tabla paginada (default 50). Columnas: fecha, concepto, parte_origen, parte_destino, cuenta_origen, cuenta_destino (si transferencia), monto, moneda, obra (link), estado, acciones.
  - Acciones: ver (drawer con detalle + comprobante), editar (admin/owner), anular (admin).
  - Botón "Nuevo movimiento" (admin/operador).
  - Botón "Exportar XLSX" → genera con filtros actuales.
- **`/movimientos/nuevo`**:
  - Step 1: elegir concepto (combobox con tipos agrupados).
  - Step 2: form dinámico según `concepto.tipo`:
    - `ingreso`/`egreso`: campos clásicos.
    - `transferencia`: form especial con 2 cuentas, cotización automática.
  - Upload de comprobante (Supabase Storage signed URL).
  - Submit → redirect a `/movimientos`.
- **`/movimientos/[id]`** (drawer): detalle + audit log.

### 6.3 Vistas agregadas

- **`/obras/[id]/flujo`**: tabla filtrada por `obra_id`, saldos por cuenta IN ESA obra, totales.
- **`/flujo/empresa`**: caja general empresa (sin `obra_id`). Filtros por concepto/cuenta/fecha.

### 6.4 Sidebar nuevo item

- "Flujo de Caja" como sección con submenús: Movimientos · Caja Empresa · Cuentas (config).
- Permisos: visible para admin y operador. ABMs solo para admin.

---

## 7. Casos de test críticos

### 7.1 Unit

- `validar movimiento ingreso requiere parte_origen_id`
- `validar movimiento transferencia rechaza si cuenta_origen == cuenta_destino`
- `validar movimiento transferencia con cambio moneda requiere monto_destino + cotizacion`
- `calcular saldo cuenta suma entradas, resta salidas, considera transferencias en ambos extremos`
- `concepto con requiere_obra=true rechaza si obra_id missing`
- `optimistic lock rechaza con expected_version vieja`

### 7.2 Integration (cuando esté fixed el harness)

- `crearMovimiento ingreso completo + audit log row creado`
- `crearMovimiento transferencia + saldos de 2 cuentas actualizan correcto`
- `anularMovimiento no borra fila, marca estado='anulado', audit`
- `editar movimiento ajeno como operador → forbidden`

### 7.3 E2E (Playwright)

- `flujo-caja-cargar-ingreso.spec.ts`: login admin → crear movimiento HO con obra → ver en tabla.
- `flujo-caja-transferencia-fx.spec.ts`: crear transferencia USD→ARS con cotización → ver saldos cambiar.
- `flujo-caja-operador.spec.ts`: operador carga propio, NO ve botón anular, NO puede editar movimiento de admin.
- `flujo-caja-export.spec.ts`: aplicar filtros, descargar XLSX, validar columnas.

---

## 8. Riesgos y consideraciones

### 8.1 Migración de movimiento existente

El schema actual tiene `movimiento.cuenta_id` y `movimiento.tipo` con valores `entrada|salida`. La migration:
1. Renombra `cuenta_id` → `cuenta_origen_id`.
2. Extiende enum `tipo_movimiento` con `transferencia`.
3. Hace nuevas columnas nullable inicialmente; si hay rows existentes (no debería haber en producción), se quedan con `concepto_id=NULL`.
4. Después del deploy + backfill manual (no esperamos rows), agregar `NOT NULL` en `concepto_id` como migration 0004 separada si hace falta.

### 8.2 Storage policies

Bucket `comprobantes` privado. Policy:
- `INSERT`: authenticated users con rol admin u operador.
- `SELECT`: signed URL solamente (TTL 1h).
- `DELETE`: admin only.

Requiere migration aparte de Storage (no Drizzle).

### 8.3 Performance de saldos

Saldos calculados on-demand con queries `SUM(...)`. Hasta ~1000 movimientos, < 100ms con índices. Si crece a 10k+:
- Opción A: tabla `cuenta_saldo_snapshot` actualizada con trigger.
- Opción B: vista materializada refrescada nightly.

Decisión deferida — medir antes de optimizar.

### 8.4 Bugs P1 postergados

§3.1.5 (Firmar↔importPendiente) y §3.1.6 (Empty rows) están abiertos. El usuario eligió postergarlos. Smoke del flujo de caja NO debería tocar firmar/import. Si el operador toca firmar después del flujo de caja, atención: `cancelarImportAction` puede borrar firmados.

### 8.5 Histórico del Excel

Decisión: NO importar histórico desde Excel automáticamente. El usuario carga movimientos nuevos desde la fecha de cutover. El Excel queda como referencia histórica. Reportes "todo histórico" no aplican en MVP.

---

## 9. Plan de validación end-to-end

1. **Migration**: `pnpm db:migrate` en `macna-dev`. Validar con `psql` que las tablas existen y los seeds entran. Validar que no rompió presupuestos / obras.
2. **ABMs**: crear/editar/archivar cuenta, concepto, parte, proveedor. Audit log en cada caso.
3. **Movimiento ingreso simple**: HO con obra. Saldo cuenta sube. Audit log.
4. **Movimiento egreso**: SUELDO a empleado. Saldo cuenta baja.
5. **Transferencia USD→ARS**: con cotización. Saldo USD baja, saldo ARS sube.
6. **Anular**: ver que estado cambia, saldos se ajustan (movimiento ya no cuenta).
7. **Restaurar**: vuelve a contar.
8. **Comprobante**: upload imagen, ver linkeada al movimiento, signed URL al hacer click.
9. **Operador**: carga movimiento, NO puede editar ajeno, NO ve anular.
10. **Filtros + Export**: aplicar filtros en `/movimientos`, exportar XLSX, validar columnas.
11. **Smoke contra Excel**: cargar 10 movimientos representativos del XLSX real, comparar saldos.

---

## 10. Notas de implementación (Fase 1 — schema)

- Migration `0003_flujo_caja.sql` en `drizzle/migrations/`.
- Convención de naming: snake_case para SQL, camelCase para TS (Drizzle).
- Seed actualizado en `src/db/seed-data.ts` + `src/db/seed.ts` (extender la lógica para llamar a los nuevos seeds).
- Schema TS en `src/db/schema.ts` siguiendo patrón existente (relations() para foreign keys).

---

## Changelog

- 2026-05-15 · Spec inicial. Decisiones D1-D14 cerradas. Out-of-scope explícito.
