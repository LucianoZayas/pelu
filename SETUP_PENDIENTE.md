# SETUP PENDIENTE — Macna

> Cosas que **vos** tenés que hacer / aportar para destrabar la implementación. Cuando un ítem esté listo, marcalo `[x]`.

> **Para roadmap completo post-piloto** (lo que falta para llegar a "producto final"), ver [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Estado actual del repo (al 2026-05-12)

- **Plan 1 (Fundaciones + Auth) ✅ COMPLETO** — código + DB real validada (migrate + seed contra Supabase `macna-dev`).
- **Plan 2 (CRUD obras + rubros + usuarios) ✅ COMPLETO en código** — falta validación manual de UI con login real.
- **Plan 3 (Editor presupuesto) ✅ COMPLETO en código** — 14 commits. Editor con `react-hook-form` + `useFieldArray` + `@tanstack/react-virtual` (>30 items), acordeón por rubro, autosave 30s, sign/cancel dialogs, totales en vivo, concurrencia optimista (`STALE_VERSION`), trigger Postgres "escrito en piedra".
- **Plan 4 (Vista cliente + PDF) ✅ COMPLETO en código** — 11 commits. `/cliente/[token]` público, `/cliente/expirado`, regenerar token UI, `@react-pdf/renderer` + template v1, `/api/pdf/[presupuestoId]` con dual auth (token público o sesión admin), Playwright E2E specs (happy path + seguridad). Migración `middleware.ts` → `proxy.ts` hecha (Next.js 16).
- **Plan 5 (Importador + auditoría + export) ✅ COMPLETO en código** — 10 commits. UI auditoría con filtros + diff expandible, export XLSX (obras lista + obra detalle + auditoría) con API routes, importador CSV (parse + validate + ejecutor + CLI con `--dry-run` y idempotencia), README + plan de cutover documentados.
- **Total**: 63 commits locales · `pnpm tsc --noEmit` ✅ sin errores · `pnpm test:unit` ✅ 33/33 (markup, currency, snapshots, totales, money, codigo-obra, import-parse, import-validate) · `pnpm build` ✅ todas las rutas compilan.
- 11 archivos de tests de integración escritos pero **bloqueados** por bug preexistente del harness (ver punto 8 abajo).

---

## 1. Proyecto Supabase ✅ HECHO (`macna-dev`)

- [x] **1.1 Crear proyecto Supabase `macna-dev`** — region `us-east-1`, ref `eisqtumcbocrrtlhktxl`.
- [x] **1.2 Copiar credenciales del proyecto `dev`** — anon, service_role, transaction pooler (6543), session pooler (5432).
- [x] **1.3 Pegar credenciales en `.env.local`** — archivo creado, todas las vars completas y validadas con conexión real a Postgres 17.6.

---

## 2. Datos del primer Admin ✅ HECHO (defaults)

- [x] **2.1 Decidir email + password inicial** — usando los defaults `admin@macna.local` / `ChangeMe!Local2026`. Cambialos cuando quieras a tu email real (recibirá password resets).

---

## 3. OAuth Google ⏳ PENDIENTE (opcional) · Apple ❌ DESCARTADO

- [ ] **3.1 Google OAuth**
  1. https://console.cloud.google.com → crear proyecto → APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application.
  2. Authorized redirect URIs: `https://eisqtumcbocrrtlhktxl.supabase.co/auth/v1/callback`.
  3. Copiar `Client ID` y `Client secret`.
  4. En Supabase: Authentication → Providers → Google → habilitar y pegar los valores.
- [x] ~~**3.2 Apple OAuth**~~ — **DESCARTADO** (no se justifica $99/año + Service ID + key). Código eliminado el 2026-05-12: `login/page.tsx` y `login/actions.ts` ya no tienen referencias a Apple.

> Si no hacés esto ahora, el botón de Google va a estar pero va a tirar error al clickear. Se puede ocultar o prenderlo después.

---

## 4. Repo en GitHub ✅ HECHO

- [x] **4.1 Crear repo en GitHub** — `LucianoZayas/pelu` (privado).
- [x] **4.2 Conectar local con remoto + push** — `origin` configurado, `main` pusheado.
- [ ] **4.3 Variables de entorno en GitHub Actions** — pendiente cuando habilites integration tests en CI.

---

## 5. Vercel ✅ HECHO (parcial)

- [x] **5.1 Proyecto Vercel creado y linkeado a GitHub** — `https://vercel.com/luchos-projects-3af44a2a/macna`. Auto-deploy desde `main` activo.
- [ ] **5.2 Verificar variables de entorno en Vercel** — Settings → Environment Variables. Cargar para los 3 entornos (Production / Preview / Development), copiando valores desde `.env.local`:

  | Variable | Qué es | Notas para Vercel |
  |---|---|---|
  | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | Mismo valor en los 3 entornos (`https://eisqtumcbocrrtlhktxl.supabase.co`) |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (JWT) | Mismo valor en los 3 entornos |
  | `SUPABASE_SERVICE_ROLE_KEY` | Service role key (JWT) | Mismo valor en los 3 entornos. **Sensitive — marcar como secret.** |
  | `DATABASE_URL` | Pooler de transacciones (puerto 6543) | Para queries normales de la app. Mismo valor en los 3. |
  | `DIRECT_URL` | **Session pooler** (puerto 5432) | Para `drizzle-kit migrate`. **OJO**: NO usar `db.<ref>.supabase.co` (IPv6-only, falla desde Vercel). Sí usar `aws-1-us-east-1.pooler.supabase.com:5432`. |
  | `NEXT_PUBLIC_APP_URL` | URL pública de la app | **Distinto por entorno**: en Production = URL real (`https://macna-xxx.vercel.app` o tu dominio). En Preview = `https://$VERCEL_URL` con prefix `https://`. En Development = `http://localhost:3000`. |
  | `SEED_ADMIN_EMAIL` | Email del primer admin | Solo necesario si vas a correr `pnpm db:seed` contra la DB de prod (no se hace en Vercel build, por ahora opcional cargarlo). |
  | `SEED_ADMIN_PASSWORD` | Password inicial | Idem. **Sensitive — marcar como secret.** |

  Total: 8 vars. Las 2 últimas (`SEED_*`) son opcionales en Vercel si ya seedeaste la DB de prod desde local.
- [ ] **5.3 Confirmar build command** = `pnpm vercel-build` (corre `drizzle-kit migrate && next build`). Ya está en `package.json`.
- [ ] **5.4 Primer deploy verde** — un build de prueba que pase migraciones contra Supabase prod.

---

## 6. Importer XLSX real ✅ IMPLEMENTADO (2026-05-12)

Archivo de referencia: `/Users/lzayas/Downloads/MACNA ADMINISTRACION - Lucho (1).xlsx`. Fixture copiado a `scripts/import-sheets/__fixtures__/juncal-3706-real.xlsx`.

**Decisiones de diseño**: parser XLSX integrado · UI web completa (no CLI) · campo nuevo `ubicacion` · dos items por fila (material/MO) · editor existente como preview con flag `import_pendiente` · import parcial permitido · re-import con snapshot histórico. Spec: `docs/superpowers/specs/2026-05-12-importer-xlsx-real-design.md`. Plan ejecutado: `docs/superpowers/plans/2026-05-12-plan-importer-xlsx-real.md`.

**Implementación completa (33 commits en branch `importer-xlsx-real`)**:
- ✅ Schema migration `0002_importer_xlsx.sql` (4 columnas + 1 índice parcial) aplicada
- ✅ Parser puro (`scripts/import-sheets/parse-xlsx.ts`) con TDD — 30 unit tests
- ✅ `commitImport` reusable (txn atómica) en `scripts/import-sheets/ejecutor.ts`
- ✅ 4 Server Actions (`parsePreview`, `commitImportAction`, `confirmarImportAction`, `cancelarImportAction`) — 16 integration tests
- ✅ 7 componentes UI en `src/features/import-presupuestos/components/`
- ✅ Páginas `/obras/importar` (nueva obra) y `/obras/[id]/importar` (a obra existente)
- ✅ Botones de entrada admin-only en `/obras` y `/obras/[id]`
- ✅ Integración en editor existente (banner sticky + columna Estado + permisos operador)
- ✅ 3 E2E (happy path, re-import borrador, cancelar) — 4/4 passing
- ✅ Usuario operador seedeado para tests E2E (script `scripts/seed-operador.ts`)
- ✅ Bugs encontrados durante E2E corregidos (cancelarImportAction query inversa, banner sin router.push)

**Pendiente**:
- [ ] **6.1 Smoke manual end-to-end en producción** — login admin → `/obras` → "Nueva obra desde Excel" → subir el XLSX real → revisar preview → confirmar → verificar editor + audit log + total proyectado matchea Sheets (diferencias > $0.01 investigar). Probar también re-import sobre borrador y cancelar.
  - **Nuevo (2026-05-15)**: validar el nuevo preview categorizado (warnings prominentes, estructural/informativo colapsado) + revisar que el item consolidado "TOTAL MANO DE OBRA" se ve OK en el editor con todas las descripciones en notas.
- [ ] **6.2 Probar permisos operador** — login con `lucho.2835@macna.local` (creado 2026-05-12, password en memoria `~/.claude/projects/-Users-lzayas-Desktop-Pelu/memory/project_test_credentials.md`) → verificar que NO ve botones de import + que si abre un presupuesto con `import_pendiente=true` ve banner read-only sin botones Confirmar/Cancelar.
- [ ] **6.3 Probar nuevo /configuracion/rubros** (2026-05-15) — login admin → ver lista de rubros del seed → crear uno con espacio al inicio "  Test " → verificar que aparece chip "espacios" + botón "Normalizar" → clickear y verificar que se renombra a "Test" → archivar y restaurar. También verificar chip "duplicado" si conviven rubros tipo "ALBAÑILERIA" y "Albañilería" en la DB.
- [ ] **6.4 Probar /obras con fila clickeable** (2026-05-15) — clickear en cualquier columna de la fila (cliente, estado, moneda) y verificar que navega a `/obras/[id]`. También verificar tab/enter desde teclado.

---

## 7. Catálogo de rubros final ⏳ NICE TO HAVE

- [ ] **7.1 Revisar `src/db/seed-data.ts`** y ajustar la lista a la jerarquía real que usás en Macna. El seed default trae los típicos de construcción argentina.

---

## 8. Bug preexistente: integration test harness ⏳ FOLLOW-UP

Detectado por los implementers de Plan 3 y 5. Bloquea **todos** los integration tests del repo (Plan 1, 2, 3, 4, 5 — 11 suites). No afecta unit tests, build, ni dev/prod en runtime.

Dos issues separados:

1. **`jest.config.ts` no carga `.env.local`** — el `setupFiles: ['dotenv/config']` carga `.env` por defecto, no `.env.local`. Fix: cambiar a `setupFiles: [require.resolve('dotenv/config')]` con `dotenv_config_path=.env.local`, o usar `dotenv-cli` como hace `pnpm db:migrate`.
2. **Next.js 16 `revalidatePath` requiere request store** — los Server Actions que llaman `revalidatePath` rompen al correrse desde un test puro de jest con `Invariant: static generation store missing`. Fix: mockear `next/cache` en `tests/integration/setup.ts`, o envolver el action body con un request shim.

CI ya tiene un job condicional gateado por `vars.RUN_INTEGRATION` que está apagado, así que no rompe la pipeline de PR.

---

## 9bis. Supabase Storage bucket `comprobantes` ⏳ PENDIENTE

Necesario para que los movimientos puedan adjuntar comprobante. El schema ya tiene la columna `movimiento.comprobante_url`, pero falta la infraestructura de Storage:

- [ ] **9bis.1 Crear bucket privado `comprobantes` en Supabase** (Dashboard → Storage → New bucket → Private).
- [ ] **9bis.2 Crear policies del bucket** (Storage → Policies):
  - `INSERT`: usuarios autenticados con rol `admin` u `operador` (joinear contra `usuario` table).
  - `SELECT`: solo signed URLs (TTL ~1h).
  - `DELETE`: solo `admin`.
- [ ] **9bis.3 Smoke**: desde el form de movimiento subir una imagen y verificar que vive en `comprobantes/movimientos/<id>/<filename>` y que se accede vía signed URL.

Esto desbloquea el feature de comprobantes (hoy el campo existe pero sin UI de upload).

## 9. Manual smoke testing ⏳ PENDIENTE

Los implementers no pueden clickear UI, así que estas verificaciones siguen sin ejecutar:

- [ ] **9.1 Login flow** — `/login` con `admin@macna.local` / `ChangeMe!Local2026`.
- [ ] **9.2 CRUD Plan 2** — obras (verificar código auto `M-YYYY-NNN`), rubros (árbol jerárquico), usuarios (invitar via Supabase Auth).
- [ ] **9.3 Editor de presupuesto Plan 3** — agregar items, cambiar markup, autosave a los 30s, firmar → readonly.
- [ ] **9.4 Vista cliente Plan 4** — regenerar token, abrir `/cliente/<token>` en incógnito, descargar PDF, probar token inválido → `/cliente/expirado`.
- [ ] **9.5 Auditoría + export Plan 5** — `/configuracion/auditoria` con filtros, exportar XLSX desde obras y auditoría.
- [ ] **9.6 Flujo de caja MVP** (2026-05-15) — `pnpm db:migrate` aplicará 0003_flujo_caja contra `macna-dev`. Después: login admin → `/configuracion/cuentas` ver las 4 cuentas seedeadas → `/configuracion/conceptos` ver los 13 conceptos → `/movimientos/nuevo` → cargar 1 ingreso (HO con obra), 1 egreso (sueldo a Dani), 1 transferencia USD→ARS con cotización. Validar que saldos por cuenta se actualizan. Probar anular + restaurar. Login operador → cargar un mov propio, verificar que NO puede editar el de admin, NO ve botón anular.

---

## Referencia rápida — qué desbloquea qué

| Pendiente | Desbloquea |
|---|---|
| 3.1 (Google OAuth) | Botón "Continuar con Google" funcional |
| 5.2–5.4 (Vercel env + deploy) | Primer deploy verde en producción |
| 6.1–6.3 (parser XLSX + mapeo) | Importar obra real y arrancar piloto |
| 8 (integration test harness) | Correr `pnpm test:integration` y la job de CI |
| 9.x (manual smoke) | Confianza en que la cadena completa anda |

---

## Post-piloto

Cuando se cierre todo lo de arriba y el piloto esté operando en paralelo con Sheets, el siguiente paso es trabajar el backlog de "producto final" — ver [`docs/ROADMAP.md`](docs/ROADMAP.md).
