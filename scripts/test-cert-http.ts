// HTTP tests de las rutas nuevas del feature certificaciones.
// Usa el dev server existente (puerto 3000 o 3002).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const EMAIL = process.env.SEED_ADMIN_EMAIL!;
const PASSWORD = process.env.SEED_ADMIN_PASSWORD!;
const REF = new URL(SUPABASE_URL).hostname.split('.')[0];

async function detectarPuerto(): Promise<string> {
  for (const port of [3000, 3002, 3003]) {
    try {
      const r = await fetch(`http://localhost:${port}/cliente/expirado`, { signal: AbortSignal.timeout(2000) });
      if (r.status === 200) return `http://localhost:${port}`;
    } catch { /* try next */ }
  }
  throw new Error('No encontré dev server corriendo en 3000/3002/3003');
}

async function login(BASE: string): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data, error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !data.session) throw new Error('login failed: ' + error?.message);
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
  const chunks: string[] = [];
  const chunkSize = 3200;
  if (finalValue.length <= chunkSize) chunks.push(`sb-${REF}-auth-token=${finalValue}`);
  else for (let i = 0; i < finalValue.length; i += chunkSize) chunks.push(`sb-${REF}-auth-token.${Math.floor(i / chunkSize)}=${finalValue.slice(i, i + chunkSize)}`);
  return chunks.join('; ');
}

async function main() {
  const BASE = await detectarPuerto();
  console.log(`▶ Testeando contra ${BASE}\n`);
  const cookie = await login(BASE);

  // Obtener un obraId
  const obrasRes = await fetch(`${BASE}/obras`, { headers: { cookie }, redirect: 'manual' });
  const obrasHtml = await obrasRes.text();
  const obraId = obrasHtml.match(/\/obras\/([0-9a-f-]{36})/)?.[1];

  // Obtener un cliente token
  const tokenRes = await fetch(`${BASE}/obras`, { headers: { cookie }, redirect: 'manual' });
  const tokenHtml = await tokenRes.text();
  // Buscar cualquier token de cliente en el HTML (no aparece directo; usamos obras + getObra a mano).
  // Más simple: query directo a DB para obtener el token.
  const postgres = (await import('postgres')).default;
  const pgConn = postgres(process.env.DIRECT_URL!, { max: 1 });
  const obrasRows = await pgConn`SELECT id, cliente_token FROM obra WHERE deleted_at IS NULL LIMIT 1`;
  const clienteToken = (obrasRows as unknown as Array<{ id: string; cliente_token: string }>)[0]?.cliente_token;
  await pgConn.end();

  const rutas = [
    '/obras',
    '/flujo',
    '/movimientos',
    '/configuracion/cuentas',
    '/configuracion/proveedores',
    '/configuracion/partes',
    ...(obraId ? [
      `/obras/${obraId}`,
      `/obras/${obraId}/certificaciones`,
    ] : []),
    ...(clienteToken ? [
      `/cliente/${clienteToken}`,
    ] : []),
  ];

  const errores: string[] = [];
  for (const r of rutas) {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE}${r}`, {
        headers: { cookie, 'cache-control': 'no-cache' },
        redirect: 'manual',
        signal: AbortSignal.timeout(30000),
      });
      const ms = Date.now() - start;
      const text = await res.text();
      const hasStack = /at\s+\w+\s*\(/i.test(text) && /Error|Exception/i.test(text);
      const ok = res.status >= 200 && res.status < 400 && !hasStack;
      const status = ok ? '✓' : '✗';
      const slow = ms > 5000 ? ' ⚠️' : '';
      console.log(`${status} ${r.padEnd(50)} HTTP ${res.status} in ${ms}ms${slow}`);
      if (!ok) errores.push(r);
    } catch (e: any) {
      const ms = Date.now() - start;
      console.log(`✗ ${r.padEnd(50)} TIMEOUT in ${ms}ms — ${e?.message}`);
      errores.push(r);
    }
  }

  console.log(`\n${errores.length === 0 ? '✓ Todas OK' : `✗ ${errores.length} con error`}`);
  process.exit(errores.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
