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
- [ ] **5.2 Verificar variables de entorno en Vercel** — confirmar que estén cargadas las mismas de `.env.local` en Production / Preview / Development.
  - **OJO**: `NEXT_PUBLIC_APP_URL` en producción es la URL real (`https://macna-xxx.vercel.app` o tu dominio).
  - **OJO**: `DIRECT_URL` debe ser el **Session pooler** (puerto 5432, host `aws-1-us-east-1.pooler.supabase.com`) — la "Direct connection" `db.<ref>.supabase.co` es IPv6-only y falla desde Vercel.
- [ ] **5.3 Confirmar build command** = `pnpm vercel-build` (corre `drizzle-kit migrate && next build`). Ya está en `package.json`.
- [ ] **5.4 Primer deploy verde** — un build de prueba que pase migraciones contra Supabase prod.

---

## 6. Planilla representativa de Sheets ⏳ RECIBIDA, parser pendiente

Archivo recibido (2026-05-12): `/Users/lzayas/Downloads/MACNA ADMINISTRACION - Lucho (1).xlsx`.

**Hallazgo**: el archivo es la administración **completa** de Macna (caja, proyecciones, gastos indirectos, P&L por obra), no solo presupuestos. 8 hojas:
1. `MACNA - FLUJO DE CAJA` — caja general empresa (F2)
2. `PROYECCIONES` — forecast por obra (F3)
3. `F.c - LOZANO` — flujo de caja obra Lozano (F2)
4. `Res - LOZANO` — P&L obra Lozano (F2)
5. `GASTOS GENERALES INDIRECTOS - P/O` — payroll (F3)
6. `Copia de FLUJO DE CAJA - JUNCAL` — caja obra Juncal (F2)
7. **`Copia de JUNCAL 3706` — presupuesto obra Juncal (F1 — único compatible con el importer actual)**

Las primeras 6 hojas son funcionalidad fuera del alcance de F1 — ver `docs/ROADMAP.md` § 2 para roadmap completo.

- [ ] **6.1 Adaptar el parser a la estructura real de `Copia de JUNCAL 3706`**
  - Columnas reales: `RUBRO | UBICACIÓN | DETALLE | COSTO PARCIAL | COSTO TOTAL | MANO OBRA PARCIAL | ...`
  - Columnas esperadas por el importer: `rubro, descripcion, unidad, cantidad, costo_unitario, moneda_costo, markup, notas`
  - **Decisión pendiente** (necesita brainstorming): (a) extender parser a XLSX + mapeo flexible, (b) preparar CSV "limpio", o (c) script auxiliar de transformación.
- [ ] **6.2 Validar `--dry-run` contra la obra real**
  - Correr el importer y comparar total con lo que da Sheets. Diferencias > $0.01 → investigar.
- [ ] **6.3 Decidir cómo manejar la columna "UBICACIÓN"** — no existe en el modelo actual. Brainstorming: ¿campo nuevo en `ItemPresupuesto` o se diluye en `descripcion`? Afecta reportes futuros.

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

## 9. Manual smoke testing ⏳ PENDIENTE

Los implementers no pueden clickear UI, así que estas verificaciones siguen sin ejecutar:

- [ ] **9.1 Login flow** — `/login` con `admin@macna.local` / `ChangeMe!Local2026`.
- [ ] **9.2 CRUD Plan 2** — obras (verificar código auto `M-YYYY-NNN`), rubros (árbol jerárquico), usuarios (invitar via Supabase Auth).
- [ ] **9.3 Editor de presupuesto Plan 3** — agregar items, cambiar markup, autosave a los 30s, firmar → readonly.
- [ ] **9.4 Vista cliente Plan 4** — regenerar token, abrir `/cliente/<token>` en incógnito, descargar PDF, probar token inválido → `/cliente/expirado`.
- [ ] **9.5 Auditoría + export Plan 5** — `/configuracion/auditoria` con filtros, exportar XLSX desde obras y auditoría.

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
