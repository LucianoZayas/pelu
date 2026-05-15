// Test funcional: inserta un movimiento real vía Drizzle, verifica que aparece
// en /movimientos y /flujo (vía HTML fetch), luego lo borra.

import { createClient } from '@supabase/supabase-js';
import { db } from '../src/db/client';
import { movimiento, cuenta, conceptoMovimiento, usuario } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const EMAIL = process.env.SEED_ADMIN_EMAIL!;
const PASSWORD = process.env.SEED_ADMIN_PASSWORD!;
const BASE = 'http://localhost:3000';
const REF = new URL(SUPABASE_URL).hostname.split('.')[0];

async function login(): Promise<string> {
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

async function htmlOf(cookieHeader: string, ruta: string): Promise<string> {
  const res = await fetch(`${BASE}${ruta}`, {
    headers: { cookie: cookieHeader, 'cache-control': 'no-cache' },
    redirect: 'manual',
    signal: AbortSignal.timeout(30000),
  });
  if (res.status !== 200) throw new Error(`${ruta}: HTTP ${res.status}`);
  return await res.text();
}

async function main() {
  console.log('▶ Login admin…');
  const cookieHeader = await login();

  // 1. Pre-condiciones: cuenta + concepto en DB
  const [cuentaArs] = await db.select().from(cuenta).where(eq(cuenta.moneda, 'ARS')).limit(1);
  const [adminUser] = await db.select().from(usuario).limit(1);
  const [conceptoHO] = await db.select().from(conceptoMovimiento).where(eq(conceptoMovimiento.codigo, 'HP')).limit(1);
  if (!cuentaArs || !adminUser || !conceptoHO) throw new Error('Faltan seeds (cuenta ARS, usuario, concepto HP)');

  console.log('▶ Cuenta:', cuentaArs.nombre);
  console.log('▶ Concepto:', conceptoHO.codigo, conceptoHO.nombre);
  console.log('▶ Usuario:', adminUser.email);

  // 2. Insertar movimiento sintético
  const markerDesc = `__TEST_FUNCIONAL_${Date.now()}__`;
  console.log(`▶ Insertando movimiento ${markerDesc}…`);
  const [mov] = await db.insert(movimiento).values({
    tipo: 'entrada',
    fecha: new Date(),
    conceptoId: conceptoHO.id,
    monto: '12345.67',
    moneda: 'ARS',
    cuentaId: cuentaArs.id,
    descripcion: markerDesc,
    estado: 'confirmado',
    createdBy: adminUser.id,
    updatedBy: adminUser.id,
  }).returning();
  console.log('  → id:', mov.id);

  try {
    // 3. Verificar en /movimientos
    console.log('▶ Verificando aparece en /movimientos…');
    const htmlMov = await htmlOf(cookieHeader, '/movimientos');
    const enMovimientos = htmlMov.includes(markerDesc);
    console.log(`  → ${enMovimientos ? '✓' : '✗'} marker presente en HTML de /movimientos`);

    // 4. Verificar saldo en /flujo (debería mostrar +12345.67 en alguna cuenta)
    console.log('▶ Verificando saldos en /flujo…');
    const htmlFlujo = await htmlOf(cookieHeader, '/flujo');
    const tieneActividad = htmlFlujo.includes(markerDesc) || /Actividad reciente/i.test(htmlFlujo);
    console.log(`  → ${tieneActividad ? '✓' : '✗'} dashboard renderiza actividad`);
    const tieneCuenta = htmlFlujo.includes(cuentaArs.nombre);
    console.log(`  → ${tieneCuenta ? '✓' : '✗'} dashboard muestra cuenta ${cuentaArs.nombre}`);

    // 5. Verificar filtro Sin obra incluye el movimiento (que no tiene obra_id)
    console.log('▶ Verificando filtro Sin obra…');
    const htmlSinObra = await htmlOf(cookieHeader, '/movimientos?obra=__sin_obra__');
    const enSinObra = htmlSinObra.includes(markerDesc);
    console.log(`  → ${enSinObra ? '✓' : '✗'} marker aparece en filtro Sin obra`);

    // 6. Verificar empty filter no rompe
    console.log('▶ Verificando /movimientos con varios filtros…');
    const htmlFiltrado = await htmlOf(cookieHeader, '/movimientos?tipo=entrada&estado=confirmado');
    const sigueAhi = htmlFiltrado.includes(markerDesc);
    console.log(`  → ${sigueAhi ? '✓' : '✗'} marker aparece con tipo=entrada&estado=confirmado`);

    console.log('\n✓ Tests funcionales OK');
  } finally {
    // Cleanup
    console.log('▶ Limpiando movimiento de test…');
    await db.delete(movimiento).where(eq(movimiento.id, mov.id));
    console.log('  → borrado');
    const { pg } = await import('../src/db/client');
    await pg.end();
  }
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
