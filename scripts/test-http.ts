// Smoke test HTTP de rutas autenticadas.
// Login via Supabase REST -> construye cookie sb-<ref>-auth-token -> fetch con cookie.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const EMAIL = process.env.SEED_ADMIN_EMAIL!;
const PASSWORD = process.env.SEED_ADMIN_PASSWORD!;
const BASE = 'http://localhost:3000';
const REF = new URL(SUPABASE_URL).hostname.split('.')[0];

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data, error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !data.session) {
    console.error('Login fallido:', error?.message);
    process.exit(1);
  }

  const cookieValue = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.session.user,
  });
  const b64 = Buffer.from(cookieValue, 'utf-8').toString('base64');
  const finalValue = `base64-${b64}`;
  const cookies: string[] = [];
  const chunkSize = 3200;
  if (finalValue.length <= chunkSize) {
    cookies.push(`sb-${REF}-auth-token=${finalValue}`);
  } else {
    for (let i = 0; i < finalValue.length; i += chunkSize) {
      const idx = Math.floor(i / chunkSize);
      cookies.push(`sb-${REF}-auth-token.${idx}=${finalValue.slice(i, i + chunkSize)}`);
    }
  }
  const cookieHeader = cookies.join('; ');

  // Obtener un obra id para testear /obras/[id] y /obras/[id]/flujo
  const obras = await fetch(`${BASE}/obras`, { headers: { cookie: cookieHeader }, redirect: 'manual' });
  const html = await obras.text();
  const idMatch = html.match(/\/obras\/([0-9a-f-]{36})/);
  const obraId = idMatch?.[1];

  const rutas = [
    '/obras',
    '/flujo',
    '/movimientos',
    '/movimientos/nuevo',
    '/movimientos?obra=__sin_obra__',
    '/movimientos?tipo=entrada',
    '/flujo?desde=2026-01-01&hasta=2026-12-31',
    '/configuracion/cuentas',
    '/configuracion/conceptos',
    '/configuracion/partes',
    '/configuracion/rubros',
    '/configuracion/usuarios',
    '/configuracion/auditoria',
    ...(obraId ? [`/obras/${obraId}`, `/obras/${obraId}/flujo`] : []),
  ];

  const errores: Array<{ ruta: string; status: number; ms: number; tipo: string }> = [];

  for (const ruta of rutas) {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE}${ruta}`, {
        headers: { cookie: cookieHeader, 'cache-control': 'no-cache' },
        redirect: 'manual',
        signal: AbortSignal.timeout(30000),
      });
      const ms = Date.now() - start;
      const text = await res.text();
      const tieneStackTrace = /at\s+\w+\s*\(/i.test(text) && /Error|Exception/i.test(text);
      const ok = res.status >= 200 && res.status < 400 && !tieneStackTrace;
      const status = ok ? '✓' : '✗';
      const slow = ms > 5000 ? ' ⚠️ SLOW' : '';
      console.log(`${status} ${ruta.padEnd(45)} HTTP ${res.status} in ${ms}ms${slow}`);
      if (!ok) {
        errores.push({ ruta, status: res.status, ms, tipo: tieneStackTrace ? 'stack-trace-in-body' : 'http-error' });
      }
    } catch (e: any) {
      const ms = Date.now() - start;
      console.log(`✗ ${ruta.padEnd(45)} TIMEOUT/ERROR in ${ms}ms — ${e?.message}`);
      errores.push({ ruta, status: 0, ms, tipo: 'timeout' });
    }
  }

  console.log(`\n${errores.length === 0 ? '✓ Todas las rutas OK' : `✗ ${errores.length} ruta(s) con problemas`}`);
  if (errores.length > 0) {
    for (const e of errores) {
      console.log(`  - ${e.ruta} (${e.tipo}, ${e.ms}ms, status=${e.status})`);
    }
  }
  process.exit(errores.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2); });
