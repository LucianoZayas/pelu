# SETUP PENDIENTE — Macna

> Cosas que **vos** tenés que hacer / aportar para destrabar la implementación. Cuando un ítem esté listo, marcalo `[x]`.

---

## 1. Proyecto Supabase (BLOQUEA: Plan 1 · Task 7, 17 · y todo Plan 2+)

Necesitamos **dos** proyectos separados: `dev` para desarrollar, `prod` para más adelante. Empezá por `dev`.

- [ ] **1.1 Crear proyecto Supabase `macna-dev`**
  1. Ir a https://supabase.com/dashboard → "New project".
  2. Org: la que uses; **Name**: `macna-dev`; **DB Password**: generá uno fuerte y guardalo en tu password manager (lo vamos a necesitar abajo); **Region**: South America (São Paulo) — más cerca = menos latencia.
  3. Plan: Free está bien para arrancar. Cuando vayamos a producción cambiamos a Pro (PITR + backups).

- [ ] **1.2 Copiar credenciales del proyecto `dev`**

  En el dashboard del proyecto:
  - **Settings → API** → copiar:
    - `Project URL` → será `NEXT_PUBLIC_SUPABASE_URL`
    - `anon public` key → será `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `service_role` key (¡secreta!) → será `SUPABASE_SERVICE_ROLE_KEY`
  - **Settings → Database → Connection string**:
    - Tab **"Transaction"** (puerto 6543) → será `DATABASE_URL`. Reemplazar `[YOUR-PASSWORD]` por la pass del paso 1.1.
    - Tab **"Session"** o **"Direct connection"** (puerto 5432) → será `DIRECT_URL`. Mismo reemplazo.

- [ ] **1.3 Pegar credenciales en `.env.local`** (crear el archivo en la raíz del repo cuando exista)

  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
  SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
  DATABASE_URL=postgresql://postgres.xxxxx:PASS@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
  DIRECT_URL=postgresql://postgres:PASS@db.xxxxx.supabase.co:5432/postgres
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  SEED_ADMIN_EMAIL=admin@macna.local
  SEED_ADMIN_PASSWORD=ChangeMe!Local2026
  ```

  > El archivo está en `.gitignore`, no se sube al repo.

---

## 2. Datos del primer Admin (BLOQUEA: Plan 1 · Task 17)

- [ ] **2.1 Decidir email + password inicial**

  Lo carga el seed en `auth.users` y en la tabla `usuario`. Sugerencias:
  - Email: el real tuyo o el de tu socio (recibirá los recuperos de contraseña).
  - Password temporal de 16+ caracteres; cambialo apenas entres por primera vez.

  Pegalos en `.env.local` como `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`.

---

## 3. OAuth Google + Apple (OPCIONAL en F1 — el form login con email/password ya alcanza)

Si querés tener el botón "Continuar con Google" funcional desde el día 1:

- [ ] **3.1 Google OAuth**
  1. https://console.cloud.google.com → crear proyecto → APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application.
  2. Authorized redirect URIs: `https://xxxxx.supabase.co/auth/v1/callback` (la URL del paso 1.2 + `/auth/v1/callback`).
  3. Copiar `Client ID` y `Client secret`.
  4. En Supabase: Authentication → Providers → Google → habilitar y pegar los valores.

- [ ] **3.2 Apple OAuth** — más arduo (requiere Apple Developer Account, $99/año, generar key + Service ID). Saltear si no es prioridad. La doc oficial: https://supabase.com/docs/guides/auth/social-login/auth-apple.

> Si no hacés esto ahora, el botón de login con Google/Apple va a estar pero va a tirar error. Se puede ocultar con un comentario en el code y prenderlo después.

---

## 4. Repo en GitHub (BLOQUEA: Plan 1 · Task 18 push, no la creación del workflow)

- [ ] **4.1 Crear repo en GitHub**
  1. https://github.com/new → name: `macna`, **Private**, sin README/license/.gitignore (lo crea Next.js).
  2. Copiar la URL del repo (ej. `git@github.com:tu-user/macna.git`).

- [ ] **4.2 Conectar local con remoto** (cuando ya esté `git init` corrido por el subagente)

  ```bash
  cd /Users/lzayas/Desktop/Pelu
  git remote add origin git@github.com:tu-user/macna.git
  git branch -M main
  git push -u origin main
  ```

- [ ] **4.3 Variables de entorno en GitHub Actions** (para que CI tenga acceso si las llega a necesitar)
  - Repo → Settings → Secrets and variables → Actions → New repository secret
  - Por ahora el CI usa placeholders, no necesita secrets reales hasta que agreguemos integration tests.

---

## 5. Vercel (BLOQUEA: deploy real, no necesario para desarrollo local)

- [ ] **5.1 Crear proyecto en Vercel**
  1. https://vercel.com/new → importar el repo `macna` de GitHub.
  2. Framework preset: Next.js (autodetectado).
  3. **NO deployar todavía** — primero cargar env vars (paso 5.2).

- [ ] **5.2 Pegar todas las variables de env de `.env.local` en Vercel**
  - Settings → Environment Variables → cargar las mismas de `.env.local` para Production / Preview / Development.
  - **OJO**: `NEXT_PUBLIC_APP_URL` en producción es la URL real (`https://macna-xxx.vercel.app` o tu dominio).

- [ ] **5.3 Build command**: `pnpm vercel-build` (corre `drizzle-kit migrate && next build`).

---

## 6. Planilla representativa de Sheets (BLOQUEA: Plan 5 · Importador)

- [ ] **6.1 Compartir 1 obra real exportada a CSV**

  Antes de implementar el importador, necesito ver una planilla real para validar el mapeo de columnas (`rubro`, `descripcion`, `unidad`, `cantidad`, `costo_unitario`, `moneda_costo`, `markup`, `notas`). Si las columnas reales tienen otros nombres o estructura, lo ajustamos antes de codear.

  Pasos:
  1. Abrir una obra representativa en Sheets.
  2. File → Download → Comma-separated values (.csv).
  3. Pegar el archivo en `docs/superpowers/samples/` (creá la carpeta) y avisame.

---

## 7. Catálogo de rubros final (NICE TO HAVE — el seed ya trae uno default)

- [ ] **7.1 Revisar `src/db/seed-data.ts` cuando exista** y ajustar la lista a la jerarquía real que usás en Macna. El seed que dejé tiene los típicos de construcción argentina.

---

## Referencia rápida — qué desbloquea qué

| Pendiente | Desbloquea |
|---|---|
| 1.1 + 1.2 + 1.3 (Supabase dev + creds) | `pnpm db:migrate`, `pnpm db:seed`, login real, todas las queries |
| 2.1 (admin creds) | `pnpm db:seed` |
| 3.1 (Google OAuth) | Botón "Continuar con Google" funcional |
| 4.1 + 4.2 (GitHub repo) | `git push`, CI corriendo en GitHub Actions |
| 5.x (Vercel) | Deploy a un entorno real |
| 6.1 (CSV de Sheets) | Plan 5 — Importador |
