# ROADMAP — Macna camino a "producto final"

> **Propósito de este documento**: dejar registro durable de todo lo que falta para considerar el sistema Macna un "producto final", de modo que cualquier conversación futura (con o sin contexto previo) pueda retomar desde acá sin tener que reconstruir lo decidido en sesiones anteriores.
>
> **Cómo usarlo**: cada ítem está clasificado por **prioridad** (P0/P1/P2/P3) y **fase conceptual** (Piloto / F2 / F3 / F4 / F5 / Transversal). Antes de empezar a trabajar en un ítem, hacer brainstorming dedicado para refinar requisitos y diseño (no implementar directo desde acá — esta es una lista de temas, no specs).
>
> **Fecha base**: 2026-05-12. **Estado al cierre de los 5 planes originales**: código completo y testeado (63 commits, tsc clean, 33/33 unit tests, build OK). Lo que sigue NO está en el código aún.

---

## 0. Mapa rápido

| Bloque | Estado | Prioridad |
|---|---|---|
| [1. Cierre del piloto](#1-cierre-del-piloto-p0) | en curso | P0 |
| [2. Gap funcional vs Excel actual de Macna](#2-gap-funcional-vs-excel-actual) | flujo caja MVP hecho · P&L, proyecciones, payroll pendiente | P1 |
| [3. Gaps técnicos del producto](#3-gaps-técnicos-del-producto) | sin iniciar | P1–P2 |
| [4. Polish / UX](#4-polish--ux) | sin iniciar | P2 |
| [5. Infraestructura / Seguridad / Observabilidad](#5-infraestructura--seguridad--observabilidad) | sin iniciar | P1–P2 |
| [6. Compliance / Legal](#6-compliance--legal) | sin iniciar | P2 |
| [7. Documentación de usuario y operación](#7-documentación-de-usuario-y-operación) | sin iniciar | P2 |
| [8. Cleanup deferred](#8-cleanup-diferido) | identificado | P3 |

**Prioridades**:
- **P0** = bloquea el piloto / la operación real arranca con esto.
- **P1** = bloquea la promoción "Macna deja Sheets de forma definitiva".
- **P2** = necesario antes de invitar usuarios externos / declarar "producto".
- **P3** = nice-to-have, no bloquea nada.

---

## 1. Cierre del piloto (P0)

Lo que falta para que la primera obra real entre al sistema y arranque el "paralelo con Sheets" definido en `docs/cutover-piloto.md`.

### 1.1bis Refinamiento del parser XLSX **[P1 · hecho 2026-05-15]**

Después del primer roundtrip con el XLSX real, el usuario detectó que `192 descartes` era alarmante y que se perdían items reales. Tres mejoras hechas en una sola sesión:

- **Categorización de descartes** (`estructural`/`informativo`/`warning`): los SUBTOTAL/headers/placeholders dejaron de aparecer como warnings y se agrupan como "esperado del Excel". Sólo quedan ~10 warnings reales (orphan costs, #REF!).
- **Fallback PARCIAL → TOTAL**: si `COSTO TOTAL` está vacío pero `COSTO PARCIAL` tiene valor, se usa parcial (con flag `costo_solo_parcial`). Recupera ~8 items que el parser anterior tiraba (R118 "Techo de chapa", R124-126 MUEBLES, R142 "Bacha lavadero", etc.).
- **Consolidación de TOTAL MANO DE OBRA**: las ~90 filas descriptivas de mano de obra que no tienen costo individual (la suma vive en una sola fila TOTAL MANO DE OBRA) ahora se importan como **1 item** con todas las descripciones bundleadas en `notas` markdown agrupadas por sub-rubro. Cero pérdida de info, cero trabajo manual.

Doc nuevo: `docs/import-excel-inconsistencias.md` — anota 10 patrones del template Excel de Macna que conviene validar contra otros archivos cuando lleguen (col 15 = USD?, MARMOLERIA con opcion1/opcion2, INSUMOS con #REF!, etc.).

Tests: 84/84 unit (13 suites). Tipos: `DescarteRow.categoria` (`estructural`|`informativo`|`warning`), nuevos `WarningItem.tipo` (`costo_solo_parcial`, `mo_consolidada`, `costo_huerfano`).

### 1.1 Mapear el XLSX real al importer **[P0 · bloqueante del piloto]**

**Archivo recibido**: `/Users/lzayas/Downloads/MACNA ADMINISTRACION - Lucho (1).xlsx` (584 KB, 8 hojas).

**Hallazgo crítico**: el archivo es la administración **completa** de Macna (caja, proyecciones, gastos indirectos, resultados por obra), no solo presupuestos. Las 8 hojas:

| Hoja | Contenido | Fase aplicable |
|---|---|---|
| `MACNA - FLUJO DE CAJA` | Caja USD + Caja física ARS de la empresa, 191 filas | F2 |
| `PROYECCIONES` | Forecast mensual por obra (1018 filas, 41 col) | F3 |
| `F.c - LOZANO` | Flujo de caja por obra "Lozano" | F2 |
| `Res - LOZANO` | Resultados (P&L) de obra "Lozano" | F2 |
| `GASTOS GENERALES INDIRECTOS - P` | Payroll y estructura fija | F3 |
| `GASTOS GENERALES INDIRECTOS - O` | (idem, otra variante o socio) | F3 |
| `Copia de FLUJO DE CAJA - JUNCAL` | Caja de otra obra | F2 |
| `Copia de JUNCAL 3706` | **Presupuesto de obra** — esto es lo único que entra al importer actual | F1 |

**Estado**: ✅ **HECHO (2026-05-12)**. Spec: `docs/superpowers/specs/2026-05-12-importer-xlsx-real-design.md`. Plan ejecutado: `docs/superpowers/plans/2026-05-12-plan-importer-xlsx-real.md`. 33 commits en branch `importer-xlsx-real` mergeada a `main` el 2026-05-12.

**Implementado**:
- Parser XLSX integrado con `exceljs` (acepta `.csv` y `.xlsx`). 30 unit tests.
- UI web completa: `/obras/importar` (nueva obra) + `/obras/[id]/importar` (a obra existente) + botones de entrada admin-only.
- Schema migration 0002: `presupuesto.import_pendiente`, `import_metadata`, `reemplazado_por_import_id`, `item_presupuesto.ubicacion`, índice parcial.
- 4 Server Actions (`parsePreview`, `commitImportAction`, `confirmarImportAction`, `cancelarImportAction`). 16 integration tests.
- 7 componentes UI nuevos en `src/features/import-presupuestos/components/`.
- Editor existente (Plan 3) extendido: banner sticky cuando `import_pendiente=true`, columna Estado por item con chip + tooltip de warnings, permisos operador read-only.
- Una fila Excel con material + MO → **dos** `ItemPresupuesto` (C.2). Refactor a `mano_obra_costo` queda en backlog post-piloto (§ 1.5).
- 3 E2E Playwright (happy path / re-import borrador / cancelar). 4/4 passing.

**Pendiente para cerrar piloto** (smoke manual — solo el usuario lo puede hacer):
- Subir el XLSX real desde `/obras` → "Nueva obra desde Excel" → preview → confirmar → verificar que el total proyectado coincide con lo que reporta Sheets. Diferencias > $0.01 investigar.
- Probar también permisos operador con `lucho.2835@macna.local` (credenciales en memoria).

### 1.2 Smoke manual end-to-end **[P0]**

Los implementers no pueden clickear UI. Antes del piloto, validar a mano:
- Login con `admin@macna.local` / `ChangeMe!Local2026` (o el email real).
- CRUD obras (verificar autogeneración `M-YYYY-NNN`), rubros (árbol), usuarios.
- Editor de presupuesto: autosave 30s, firmar → readonly, conflicto de versión.
- Vista cliente: regenerar token, abrir en incógnito, descargar PDF, probar token inválido → `/cliente/expirado`.
- Auditoría + export XLSX desde obras y auditoría.

### 1.3 Catálogo de rubros real **[P1]**

Hoy `src/db/seed-data.ts` tiene los típicos de construcción AR (Albañilería, Demoliciones, Hormigón, etc.). Mirando el XLSX, los rubros reales que usa Macna en el presupuesto JUNCAL incluyen `DEMOLICION`, `ALBAÑILERIA`, además de una dimensión `UBICACIÓN` (`GENERAL`, `LIV - COM - COC`) que el modelo actual NO contempla.

**Resuelto en spec § 1.1**: `item_presupuesto.ubicacion` (text NULL) con autocomplete de valores ya usados. La migration entra junto con el resto del importer XLSX.

### 1.4 Bug del integration test harness **[P1]**

Bloquea las 11 suites de integration tests. No afecta unit/build/runtime. Dos fixes concretos en `SETUP_PENDIENTE.md` punto 8:
1. `jest.config.ts:22` cambiar `setupFiles: ['dotenv/config']` → cargar `.env.local` explícitamente.
2. `tests/integration/setup.ts` mockear `next/cache` para que `revalidatePath` no rompa fuera de un request store de Next 16.

Después: habilitar la flag `RUN_INTEGRATION` en GitHub Actions y validar que la suite pasa contra una DB de test.

---

### 1.5 Backlog post-piloto derivado del importer XLSX **[P2, post-piloto]**

Cuando cierre 1.1 quedan pendientes (detallados en el spec § 10):

- **C.3 — Refactor a `mano_obra_costo` en schema** (P2): hoy una fila Excel con material + MO genera 2 `ItemPresupuesto`. Post-piloto, consolidar a 1 item por fila con columna nueva `mano_obra_unitario` / `mano_obra_unitario_base`. Implica refactor de `calcularSnapshotItem`, editor (dos columnas) y migration de back-fill para items existentes generados con C.2.
- **Wizard inteligente de diff** (P2): hoy re-import = reemplazo total. Cambiar a UI tipo git-diff que matchea items por (rubro, descripción, ubicación) y permite mergear cambios. Habilita re-import sobre presupuesto firmado → adicional solo con diferencias.
- **Config visual del importer** (P3): pantalla `/configuracion/importer` con regex de descartes y mapeo de columnas editables.
- **Multimoneda por fila** (P3): hoy una moneda default por import. Soportar columna `MONEDA` opcional en el Excel.
- **Histórico de imports** (P3): pantalla dedicada que liste imports de la obra (creados, cancelados, reemplazados) con archivo origen y diff.
- **`import_warnings jsonb`** (P3): hoy los warnings por item viven en `notas` con prefix `[import]`. Migrar a columna estructurada si el patrón crece.

---

## 2. Gap funcional vs Excel actual

Lo que **Macna ya hace en Sheets pero el sistema todavía no cubre**. Identificado mirando las hojas del XLSX. Cada bloque necesita un brainstorming + spec + plan propios.

### 2.1 + 2.2 Flujo de caja MVP **[P1 · F2 · MVP HECHO 2026-05-15]**

**Estado**: ✅ MVP completo mergeable. Spec: `docs/superpowers/specs/2026-05-15-flujo-caja-design.md`. Branch `feat/flujo-caja` (3 commits + foundations).

**Implementado**:
- Migration 0003: tablas `parte`, `concepto_movimiento` + extensión de `movimiento` (concepto_id, parte_origen/destino, cuenta_destino, monto_destino, estado, version, anulado_*). CHECK constraints para transferencias y refs `parte ↔ obra/proveedor`.
- Seed: 4 cuentas, 13 conceptos del Excel real, 6 partes fijas (Macna + Cris + Frank + Dani + Financiera + Consultora).
- ABM cuentas (`/configuracion/cuentas`) con saldo en vivo calculado SQL.
- ABM conceptos (`/configuracion/conceptos`) con tipo + flags requerimiento.
- ABM partes (`/configuracion/partes`) con filtros por tipo. Las tipo obra/proveedor se autogeneran (TODO: trigger desde Obras y Proveedores — ver §3.0bis abajo).
- Movimientos CRUD (`/movimientos`, `/movimientos/nuevo`): form dinámico por concepto, transferencias con cambio de moneda, anular/restaurar (admin), optimistic lock con `version`.
- Vistas: `/movimientos` con saldos + filtros URL, `/obras/[id]/flujo` con resumen ingresos/egresos/saldo neto USD+ARS, `/flujo/empresa` con movimientos sin obra.
- Sidebar extendido. Audit log en cada server action.

**Iteración UX 2026-05-15 PM** (✅ hecha en branch `feat/flujo-caja`):
- /movimientos y /flujo/empresa eran redundantes → eliminado /flujo/empresa, filtro 'Sin obra' en /movimientos.
- /flujo ahora es un dashboard interactivo (KPIs período, saldos detalle, gráfico recharts ARS/USD, breakdown top 5 conceptos, actividad reciente) con PeriodoSelector (Mes/Mes pasado/Últimos 30/Año/personalizado).
- /movimientos/nuevo: form lineal reemplazado por stepper de 3 pasos (Tipo → Datos → Detalles) con preview en vivo lateral, búsqueda searchable de concepto, atajos teclado.

**Quedó out-of-scope del MVP (sub-tareas futuras)**:
- **Upload de comprobantes a Supabase Storage**: campo `comprobante_url` existe pero sin UI de upload. Necesita: bucket `comprobantes` privado, policy de Storage, signed URLs, componente `<ComprobanteUpload>`.
- **Auto-creación de `parte` tipo obra al crear obra**: hoy el form de movimiento usa `obra_id` directo. Si se quiere filtrar movimientos por "parte origen = obra X", hace falta que cada obra tenga su `parte` espejo. Trigger Postgres o hook en `crearObra` action.
- **Auto-creación de `parte` tipo proveedor**: idem, al crear proveedor. Y crear ABM `/configuracion/proveedores` (hoy se pueden crear solo desde script o vía SQL).
- **Tests unit + integration + E2E**: ninguno escrito para movimientos. Casos críticos a cubrir: validación zod por tipo, cálculo de saldos, transferencia balanceada, optimistic lock, permisos operador.
- **Edición de movimiento existente desde UI**: action `editarMovimiento` existe pero no hay form de edición (solo crear). Reutilizar `MovimientoFormStepper` con valores prellenados + version expected.
- **Detalle del movimiento (drawer/modal)** con audit log inline.
- **Dashboard: alertas + resumen top 5 obras**: se postergaron en la iteración UX 2026-05-15. Agregar cuentas en negativo, gastos no recuperables del mes, obras con más actividad.

### 2.2bis Bug histórico Excel ORIGEN

Detectado al explorar el XLSX: la columna ORIGEN en `MACNA - FLUJO DE CAJA` tiene fechas serializadas en lugar de nombres (corrupción Sheets). El sistema nuevo previene esto por integridad referencial. Histórico NO se importa automáticamente — el usuario empieza a cargar desde fecha de cutover; Sheets queda como referencia.

### 2.3 Presupuestos adicionales (validar que ya funciona) **[P1 · F1+]**

El schema tiene `Presupuesto.tipo IN ('original', 'adicional')` y la spec dice que las modificaciones a un presupuesto firmado se modelan como adicionales separados. **Verificar manualmente** que el flujo "crear adicional para obra X" anda end-to-end (UI, PDF, vista cliente con presupuesto original + adicionales sumados).

Si hay gap: completar el flujo. Si está bien: cerrar este ítem.

### 2.4 Certificaciones de avance **[P1 · F2]**

**Qué hace el Excel**: no se vio directamente en las hojas inspeccionadas pero la spec lo lista en F2. Es estándar en construcción: cada mes se "certifica" un porcentaje de avance por rubro/ítem para facturar al cliente.

**Modelo sugerido (pendiente brainstorming)**:
- Tabla `certificacion` (id, presupuesto_id, fecha, periodo).
- Tabla `avance_item` (id, certificacion_id, item_presupuesto_id, porcentaje_acumulado).
- Vista "Histórico de avances" por presupuesto.
- Generar PDF de certificación firmable.

### 2.5 Resultados por obra (P&L) **[P1 · F2]**

**Qué hace el Excel**: hoja `Res - LOZANO`. Muestra rentabilidad: presupuestado vs gastado real, por rubro, con margen actual.

**Por implementar**:
- Vista "Resultados de obra X" que cruce `ItemPresupuesto.costo_unitario_base × cantidad` con `Movimiento.monto WHERE obra_id = X AND rubro_id = Y`.
- Drilldown por rubro: presupuestado / certificado / cobrado / gastado / margen.
- Export XLSX con el detalle.

### 2.6 Proyecciones (forecast por obra) **[P1 · F3]**

**Qué hace el Excel**: hoja `PROYECCIONES` — calendario mensual por obra con USD estimado a cobrar y gastar mes a mes.

**Por implementar**:
- Modelo de "hito de pago" o "cronograma" por obra.
- Vista timeline con ingresos/egresos proyectados.
- Comparativa proyectado vs realizado.

### 2.7 Gastos generales indirectos / Payroll **[P1 · F3]**

**Qué hace el Excel**: hojas `GASTOS GENERALES INDIRECTOS - P` y `... - O`. Lista personal con puesto, sueldo, aporte sobre el 100%, carga social/monotributo. Calcula gastos indirectos de estructura que se prorratean entre obras activas.

**Por implementar**:
- ABM de empleados / honorarios fijos mensuales.
- Cálculo del costo indirecto mensual total.
- Regla de prorrateo por obra (¿proporcional al volumen presupuestado? ¿manual?).
- Imputación automática mensual como `Movimiento` tipo "salida" con descripción "Costo indirecto mes XX".

### 2.8 Multimoneda completa **[P2 · F3]**

**Qué hace el Excel**: cada movimiento puede tener su propia cotización USD del día. Hoy en F1 hay una sola `cotizacion_usd` por presupuesto.

**Por implementar**:
- En cada `Movimiento`, capturar `cotizacion_usd` del día (ya está en schema).
- Carga manual o semi-automática de TC diario (¿API del BCRA? ¿pegar a mano?).
- Reportes que respeten el TC del día al consolidar.

### 2.9 Honorarios automáticos **[P2 · F3]**

El campo `Obra.porcentaje_honorarios` ya está pero sin lógica. Cuando esté F2.5 (P&L), generar automáticamente la línea "Honorarios Macna" como % del total facturado al cliente.

### 2.10 Acopios **[P2 · F3]**

Compras de materiales que aún no se imputaron a una obra específica. Permite comprar al por mayor con descuento y después "salir" del acopio hacia obras. Modelo: tabla `acopio` (material, cantidad disponible, costo unitario promedio) + movimiento de "salida de acopio" hacia obra.

### 2.11 Dashboard consolidado de cuentas **[P2 · F4]**

Vista única con: saldo de cada cuenta (USD, ARS, bancos), obras activas y su estado, alertas (presupuesto firmado sin certificar en X días, cobranza atrasada, etc.). Necesita F2 (movimientos) operando primero.

### 2.12 Cierre mensual **[P2 · F4]**

"Foto" mensual: balance de cuentas, P&L por obra, certificaciones cobradas, gastos indirectos imputados. Genera reporte PDF/XLSX y cierra el mes (snapshot inmutable). Necesita F2 + F3 funcionando.

### 2.13 Móvil + OCR de facturas **[P3 · F5]**

App móvil (PWA o React Native) para cargar movimientos desde el lugar de trabajo y subir foto de factura → OCR → pre-cargado del `Movimiento`. Necesita un sistema operando estable primero.

### 2.14 Portal cliente con login **[P3 · F5]**

Hoy el cliente accede por magic-link (sin password). En F5 evaluar: portal con cuenta propia, capacidad de ver histórico de adicionales, chatear con admin, firma digital del presupuesto desde la web. Brainstorming separado.

### 2.15 Firma digital del presupuesto **[P3 · F5]**

Hoy "firmar" es un cambio de estado en la DB + audit log. No hay firma criptográfica ni integración con DocuSign/firma digital AFIP. Si se pretende valor legal real, brainstorming aparte sobre proveedores.

### 2.16 Integración homebanking **[P3 · F5]**

Bajar movimientos bancarios reales (CSV exportado o API Galicia/Santander/etc.) y conciliarlos con los `Movimiento` cargados a mano. Big project.

---

## 3. Gaps técnicos del producto

### 3.0 Rubros: merge / fusión de duplicados **[P2, descubierto 2026-05-15]**

Al rediseñar `/configuracion/rubros` se ve que conviven duplicados de casing (ej. `Albañilería` del seed con `ALBAÑILERIA` venido del importer Excel). La UI los detecta con chip "duplicado" pero no permite fusionarlos. Implementar `mergeRubros(idA, idB)`: re-asigna `item_presupuesto.rubro_id` de B a A y archiva/borra B. Necesita tx + audit log + verificación de FK. UX: botón "Fusionar con [otro]" en el chip duplicado, dialog con confirm.

También: definir convención de casing (¿UPPER, Title, libre?) — hoy el seed es Title Case (`Demoliciones`, `Albañilería`) pero los imports vienen UPPER. Decidir si normalizar a una sola forma en input.

### 3.1 Drag-and-drop para reordenar items **[P3 · F1]**

Era nice-to-have de F1 según spec, no se implementó. El editor tiene `useFieldArray` que soporta `move(from, to)`. Estimación baja, pero no bloquea nada.

### 3.1.5 Coherencia Firmar ↔ importPendiente **[P1 · BUG · ✅ hecho 2026-05-15]**

Resuelto con 3 fixes en cadena (commit `76a82fc`, en main):
- `firmarPresupuesto` rechaza si `importPendiente=true` (code `IMPORT_PENDIENTE`), forzando al admin a confirmar primero.
- Defensa en profundidad: `firmarPresupuesto` también resetea `importPendiente=false` al firmar, para que nunca quede en estado inconsistente.
- `cancelarImportAction` rechaza si `estado='firmado'` — protección crítica contra el bug que permitía hard-delete de firmados vía cancel-import.
- `FirmarDialog` deshabilita el botón con tooltip "Confirmá la importación primero" cuando `importPendiente=true`.

Se eligió la opción A (bloquear firmar hasta confirmar import) sobre la B (firmar implícitamente confirma) por mayor claridad de auditoría — la confirmación queda como evento separado.

Brainstorming + spec corto antes de tocar.

### 3.1.6 Empty rows del editor rompen "Datos inválidos" **[P1 · BUG · ✅ hecho 2026-05-15]**

Resuelto en commit `76a82fc` (en main):
1. **Auto-discard de filas vacías** en el cliente: helper `esItemVacio()` filtra filas sin descripción ni montos antes de mandar al server. Resuelve el caso "le di agregar por accidente".
2. **Mensaje de error con contexto**: el server action mapea `z.ZodError.issues[0]` a un mensaje humano `Fila N · campo X: <issue.message>` en lugar del opaco "Datos inválidos".
3. **Banner inline** dismissible reemplaza el `alert()` crudo del editor.

Pendiente como follow-up nice-to-have: bordear en rojo el input específico que falló (necesita propagar `path` completo al UI). Para el MVP el mensaje "Fila N · campo X" alcanza.

### 3.2 Rol Operador testeado en flujo real **[P1]**

El código implementa el rol `operador` con permisos limitados (`requireRole('admin')` bloquea editor, costos, markups, usuarios). **No hay test E2E** que valide que un operador real no puede ver/hacer lo que no debe. Antes del piloto, smoke + E2E del rol operador.

### 3.3 Soft-delete recovery UI **[P2]**

Obras, presupuestos e items tienen `deleted_at`. No hay UI para ver lo borrado ni restaurar. Si alguien elimina por error, hoy hay que ir a la DB. Brainstorming: ¿cualquier admin restaura, o solo super-admin? ¿tiempo de retención antes del hard-delete?

### 3.4 Configuración global **[P2]**

Hoy hay valores hardcoded o como constantes:
- TC USD/ARS default al crear presupuesto.
- Markup default (¿hay un default empresa o solo per-presupuesto?).
- Moneda base default (USD).
- Formato del código de obra (`M-YYYY-NNN`).

UI de "Configuración → Global" para que el admin los ajuste sin tocar código. Necesita brainstorming sobre qué setting es global vs por-obra.

### 3.5 Búsqueda global **[P2]**

Hoy no hay búsqueda. Cuando haya 50+ obras, buscar por nombre cliente / código / descripción de item / texto en audit log será necesario. Postgres FTS es suficiente; brainstorming sobre alcance (¿solo obras? ¿items? ¿audit?).

### 3.6 Reportes ad-hoc **[P2]**

- PDF "Reporte de obra completa" (presupuesto + adicionales + certificaciones + saldo a la fecha).
- Reporte mensual de empresa (todas las obras activas, totales, saldos).
- Export XLSX de "movimientos del mes" filtrable.

Llega después de F2 (movimientos).

### 3.7 Notificaciones por email **[P2]**

- Cliente recibe email cuando se firma el presupuesto y se le manda link.
- Admin recibe email cuando un operador carga un movimiento alto / sin comprobante.
- Recordatorios de certificaciones pendientes.

Supabase tiene SMTP; brainstorming sobre qué notificaciones son útiles vs ruido.

### 3.8 Tablero de actividad / "qué pasó hoy" **[P3]**

Pantalla home para admins con: presupuestos firmados hoy/semana, movimientos cargados por operadores, alertas. Resumen ejecutivo simple. Llega después de F2.

---

## 4. Polish / UX

### 4.0 Validación del template Excel contra otras obras **[P2, descubierto 2026-05-15]**

`docs/import-excel-inconsistencias.md` lista 10 patrones detectados en el XLSX de prueba (col 15 ambigua, MARMOLERIA con opcion1/opcion2, R106 con números bajos sospechosos, etc.). Cuando lleguen otros Excel reales, revalidar: ¿son **únicos** de ese archivo (ignorar), **recurrentes** (parchear parser), o **errores de Macna** (corregir el template en Sheets)? Documento queda como checklist viva.

### 4.1 Mobile responsive **[P1]**

El editor de presupuesto (tabla densa con virtualización) está pensado para desktop. La vista cliente y los reportes deberían funcionar en móvil. Verificar con Playwright + viewports mobile.

### 4.2 Estados de loading y error consistentes **[P2]**

Hoy cada Server Action devuelve errores tipados pero la UI los muestra de forma inconsistente (toasts vs banners vs inline). Pasada de UX para unificar.

### 4.3 Dark mode **[P3]**

Out-of-scope de F1 según spec. Si después se pide, shadcn lo soporta nativo (`next-themes` + clases dark).

### 4.4 Onboarding del primer admin **[P2]**

Hoy el primer admin sale del seed. Si Macna onboardea más empresas (o si se invita a un partner contable), un wizard de primera-vez sería útil.

---

## 5. Infraestructura / Seguridad / Observabilidad

### 5.1 Error tracking (Sentry o equivalente) **[P1]**

F1 lo descartó explícitamente ("Sin Datadog/Sentry en F1"). Antes de operar real conviene tenerlo — los Server Actions tragan errores si no se loguean bien. Sentry o Highlight; brainstorming sobre cuál.

### 5.2 Rate limiting **[P1]**

Endpoints públicos sin protección:
- `/cliente/[token]` — fácil de scrapear si se filtra un token.
- `/api/pdf/[presupuestoId]` — generación pesada, costo de Vercel.

Vercel tiene rate limiting nativo (Edge Config) o Upstash Ratelimit. Brainstorming sobre límites razonables.

### 5.3 Restore drill **[P1]**

Supabase PITR existe pero **nunca se probó restaurar**. Antes de operar real: simular un "ups borré la DB", restaurar a t-1h, verificar que todo vuelve. Documentar el runbook.

### 5.4 Logs estructurados con request ID **[P2]**

`console.log` actual va a Vercel Logs pero sin correlación request → action → query. Pino o Vercel logs con metadata.

### 5.5 Secrets management por entorno **[P1]**

Confirmar que Production / Preview / Development en Vercel tienen credenciales **separadas** (no compartir `dev` con `prod`). Documentar rotación de service_role keys.

### 5.6 CSP / security headers **[P2]**

`next.config.ts` sin Content-Security-Policy custom. Antes de invitar usuarios externos, definir CSP / HSTS / X-Frame-Options / Referrer-Policy.

### 5.7 2FA para admins **[P2]**

Supabase Auth lo soporta nativo. Habilitar y forzar para rol admin antes de F2 (cuando empiece a haber movimientos de dinero).

### 5.8 RLS (Row-Level Security) **[P3]**

F1 lo desactivó explícitamente porque la app es el único cliente de la DB. Revisar si vale prenderlo como defensa-en-profundidad (auditoría de seguridad lo flag-eará tarde o temprano).

### 5.9 Integration tests en CI **[P2]**

Hoy gateado por `vars.RUN_INTEGRATION = false`. Tras [1.4] (fix del harness), habilitar.

### 5.10 E2E en CI con DB efímera **[P2]**

Los E2E de Playwright corren solo si hay un Supabase de test. Brainstorming: ¿usar Supabase branching? ¿levantar Postgres en GitHub Actions con docker?

---

## 6. Compliance / Legal

### 6.1 Política de privacidad y T&C en vista cliente **[P2]**

`/cliente/[token]` muestra datos del cliente final. Antes de mandar a clientes reales: link a privacy policy + términos.

### 6.2 Retención de datos **[P2]**

¿Cuánto tiempo se guarda el `AuditLog`? ¿Las obras eliminadas (soft) se purgan después de X meses? Definir y documentar.

### 6.3 Export de datos del cliente final **[P3]**

Si un cliente pide "dame todo lo que tenés de mí", endpoint que entregue ZIP con presupuestos + PDFs + audit relevante. Solo si aplica a la jurisdicción.

---

## 7. Documentación de usuario y operación

### 7.1 Manual operativo Macna **[P1]**

Documento orientado a usuarios (admin + operador) explicando paso a paso: cómo cargar una obra, cómo armar un presupuesto, cómo firmarlo, cómo regenerar token, cómo invitar usuarios. Idealmente con screenshots.

### 7.2 Runbook (operación del sistema) **[P2]**

Documento orientado a ti (o quien opere el sistema): qué hacer si Vercel está caído, cómo restaurar la DB, cómo rotar secrets, cómo reimportar una obra, cómo debuggear "el cliente no puede abrir su link".

### 7.3 ADRs (Architecture Decision Records) **[P3]**

Las decisiones grandes están en la spec (`docs/superpowers/specs/2026-04-25-fase0-fase1-design.md`), pero las decisiones nuevas que vayan saliendo en F2+ conviene capturarlas como ADRs cortos (`docs/adr/NNNN-titulo.md`).

---

## 8. Cleanup diferido

### 8.1 ~~Eliminar Apple OAuth~~ ✅ HECHO (2026-05-12)

Apple OAuth descartado y código eliminado. `login/page.tsx` y `login/actions.ts` ya no tienen referencias. Razón: $99/año + Service ID + key no se justifican.

### 8.2 Limpiar referencias a "Prisma" en docs **[P3]**

La spec menciona Prisma en algunos lugares (sección 6.5 "Setup inicial de usuarios → Seed script (`prisma/seed.ts`)" — pero el seed está en `src/db/seed.ts`, no Prisma). Pasada de doc cleanup cuando haya tiempo.

### 8.3 Memorias antiguas obsoletas **[P3]**

Las memorias en `~/.claude/projects/-Users-lzayas-Desktop-Pelu/memory/` tienen warnings de 17 días de antigüedad. Refrescar `project_phasing.md` con el estado real (5 planes completos, no "paused at Plan 2").

---

## Pendientes externos (no son código)

Estos requieren acción del usuario, no del sistema:

| Ítem | Bloquea | Estado |
|---|---|---|
| Configurar Google OAuth en Google Cloud + Supabase | Botón "Continuar con Google" | ⏳ ítem 3.1 de SETUP_PENDIENTE |
| Smoke manual end-to-end | Confianza en la cadena completa | ⏳ ítem 9 de SETUP_PENDIENTE |
| Decidir email real del primer admin (en vez del default) | Recovery de password | ⏳ ítem 2 de SETUP_PENDIENTE |
| Habilitar `RUN_INTEGRATION` en GitHub Actions vars | Correr integration tests en CI | depende de fix [1.4] |

---

## Cómo retomar este roadmap en una conversación futura

1. Leer este archivo (`docs/ROADMAP.md`) primero.
2. Leer `SETUP_PENDIENTE.md` para saber el estado de las cosas externas.
3. Leer la spec `docs/superpowers/specs/2026-04-25-fase0-fase1-design.md` para entender el modelo de datos y decisiones de F1.
4. Leer los 5 plans en `docs/superpowers/plans/2026-04-25-plan-{1,2,3,4,5}-*.md` para ver qué se implementó.
5. Elegir un ítem de este roadmap. **Hacer brainstorming dedicado antes de tocar código** — esto es una lista, no una spec.
6. Cuando se cierre un ítem, actualizar este archivo (mover a "Hecho" o tachar) y commit.
