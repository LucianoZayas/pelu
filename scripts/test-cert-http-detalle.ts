// Test HTTP de las rutas de detalle de certificación (admin + cliente).
// Crea una cert temporal, hace los hits, y limpia.

import { createClient } from '@supabase/supabase-js';
import { db, pg } from '../src/db/client';
import {
  obra, presupuesto, itemPresupuesto, rubro, certificacion, avanceItem, parte, usuario,
} from '../src/db/schema';
import { eq, and } from 'drizzle-orm';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const REF = new URL(SUPABASE_URL).hostname.split('.')[0];

async function detectarPuerto(): Promise<string> {
  for (const port of [3000, 3002, 3003]) {
    try {
      const r = await fetch(`http://localhost:${port}/cliente/expirado`, { signal: AbortSignal.timeout(2000) });
      if (r.status === 200) return `http://localhost:${port}`;
    } catch {}
  }
  throw new Error('No dev server');
}

async function login(): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data } = await supabase.auth.signInWithPassword({
    email: process.env.SEED_ADMIN_EMAIL!,
    password: process.env.SEED_ADMIN_PASSWORD!,
  });
  const cookieValue = JSON.stringify({
    access_token: data!.session!.access_token,
    refresh_token: data!.session!.refresh_token,
    expires_at: data!.session!.expires_at,
    expires_in: data!.session!.expires_in,
    token_type: data!.session!.token_type,
    user: data!.session!.user,
  });
  const b64 = Buffer.from(cookieValue, 'utf-8').toString('base64');
  return `sb-${REF}-auth-token=base64-${b64}`;
}

async function main() {
  const BASE = await detectarPuerto();
  console.log(`Testing contra ${BASE}\n`);

  const cookie = await login();

  // --- Setup datos ---
  const [admin] = await db.select().from(usuario).limit(1);
  const [rubroAny] = await db.select().from(rubro).limit(1);

  const codigo = `M-9999-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  const tokenRandom = `httpcert_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const [o] = await db.insert(obra).values({
    codigo, nombre: '__TEST_HTTP_CERT__',
    clienteNombre: '__TEST_HTTP_CERT__ Cliente',
    monedaBase: 'ARS', porcentajeHonorarios: '16',
    clienteToken: tokenRandom, estado: 'activa',
    createdBy: admin.id, updatedBy: admin.id,
  }).returning();
  await db.insert(parte).values({ tipo: 'obra', nombre: codigo, obraId: o.id, activo: true });
  await db.insert(parte).values({ tipo: 'cliente', nombre: o.clienteNombre, obraId: o.id, activo: true });

  const [p] = await db.insert(presupuesto).values({
    obraId: o.id, tipo: 'original', numero: 1,
    markupDefaultPorcentaje: '30', cotizacionUsd: '1000',
    estado: 'firmado', fechaFirma: new Date(), version: 2,
    totalClienteCalculado: '10000', totalCostoCalculado: '7000',
    createdBy: admin.id, updatedBy: admin.id,
  }).returning();

  const [it1] = await db.insert(itemPresupuesto).values({
    presupuestoId: p.id, rubroId: rubroAny.id, orden: 0,
    descripcion: 'Item test 1', unidad: 'gl', cantidad: '2',
    costoUnitario: '5000', costoUnitarioMoneda: 'ARS',
    costoUnitarioBase: '5000', markupEfectivoPorcentaje: '0',
    precioUnitarioCliente: '5000', porcentajeHonorarios: '16',
  }).returning();

  const [cert] = await db.insert(certificacion).values({
    presupuestoId: p.id, numero: 1, moneda: 'ARS',
    estado: 'emitida', fechaEmision: new Date(),
    totalNeto: '5000', totalHonorarios: '800', totalGeneral: '5800',
    createdBy: admin.id, updatedBy: admin.id,
  }).returning();
  await db.insert(avanceItem).values({
    certificacionId: cert.id, itemPresupuestoId: it1.id,
    porcentajeAcumulado: '50', porcentajeAnterior: '0',
    montoNetoFacturado: '5000', montoHonorariosFacturado: '800',
    porcentajeHonorariosAplicado: '16',
  });

  console.log(`Setup OK: obra=${o.id.slice(0,8)} cert=${cert.id.slice(0,8)} token=${tokenRandom.slice(0,20)}…\n`);

  try {
    const rutas = [
      `/obras/${o.id}/certificaciones/${cert.id}`,
      `/cliente/${tokenRandom}`,
      `/cliente/${tokenRandom}/certificaciones/${cert.id}`,
      `/cliente/${tokenRandom}/${p.id}`,
    ];

    let errores = 0;
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
        const hasError = /at\s+\w+\s*\(/i.test(text) && /Error|Exception/i.test(text);
        const ok = res.status >= 200 && res.status < 400 && !hasError;
        const flag = ok ? '✓' : '✗';
        const tag = r.startsWith('/cliente') ? '(cliente)' : '(admin)';
        console.log(`${flag} ${r.padEnd(75)} HTTP ${res.status} in ${ms}ms ${tag}`);
        if (!ok) {
          errores++;
          if (hasError) console.log(`  body excerpt: ${text.slice(0, 200).replace(/\n/g, ' ')}…`);
        }
      } catch (e: any) {
        console.log(`✗ ${r}: ${e.message}`);
        errores++;
      }
    }
    console.log(`\n${errores === 0 ? '✓ Todas OK' : `✗ ${errores} con error`}`);
  } finally {
    // Cleanup
    await pg`ALTER TABLE item_presupuesto DISABLE TRIGGER escrito_en_piedra_item`;
    await pg`ALTER TABLE presupuesto DISABLE TRIGGER escrito_en_piedra_presupuesto`;
    await db.delete(avanceItem).where(eq(avanceItem.certificacionId, cert.id));
    await db.delete(certificacion).where(eq(certificacion.id, cert.id));
    await db.delete(itemPresupuesto).where(eq(itemPresupuesto.presupuestoId, p.id));
    await db.delete(presupuesto).where(eq(presupuesto.id, p.id));
    await pg`ALTER TABLE item_presupuesto ENABLE TRIGGER escrito_en_piedra_item`;
    await pg`ALTER TABLE presupuesto ENABLE TRIGGER escrito_en_piedra_presupuesto`;
    await db.delete(parte).where(eq(parte.obraId, o.id));
    await db.delete(obra).where(eq(obra.id, o.id));
    await pg.end();
  }
}

main().catch(async (e) => { console.error('FATAL:', e.message); await pg.end(); process.exit(1); });
