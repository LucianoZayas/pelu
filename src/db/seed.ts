import 'dotenv/config';
import { db } from './client';
import { usuario, rubro, cuenta, conceptoMovimiento, parte } from './schema';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { RUBROS_BASE, CUENTAS_BASE, CONCEPTOS_BASE, PARTES_BASE } from './seed-data';
import { eq } from 'drizzle-orm';

async function seedRubros() {
  for (const r of RUBROS_BASE) {
    const [exists] = await db.select().from(rubro).where(eq(rubro.nombre, r.nombre)).limit(1);
    if (exists) continue;
    const [created] = await db.insert(rubro).values({ nombre: r.nombre, orden: r.orden }).returning();
    if ('hijos' in r && r.hijos) {
      for (const h of r.hijos) {
        await db.insert(rubro).values({ nombre: h.nombre, orden: h.orden, idPadre: created.id });
      }
    }
  }
  console.log('✓ Rubros sembrados');
}

async function seedCuentas() {
  for (const c of CUENTAS_BASE) {
    const [exists] = await db.select().from(cuenta).where(eq(cuenta.nombre, c.nombre)).limit(1);
    if (exists) continue;
    await db.insert(cuenta).values(c);
  }
  console.log('✓ Cuentas sembradas');
}

async function seedConceptos() {
  for (const c of CONCEPTOS_BASE) {
    const [exists] = await db.select().from(conceptoMovimiento).where(eq(conceptoMovimiento.codigo, c.codigo)).limit(1);
    if (exists) continue;
    await db.insert(conceptoMovimiento).values(c);
  }
  console.log('✓ Conceptos de movimiento sembrados');
}

async function seedPartes() {
  for (const p of PARTES_BASE) {
    const [exists] = await db.select().from(parte)
      .where(eq(parte.nombre, p.nombre)).limit(1);
    if (exists) continue;
    await db.insert(parte).values(p);
  }
  console.log('✓ Partes fijas sembradas');
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD requeridos en .env.local');
  }

  const admin = createSupabaseAdminClient();
  let userId: string;
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list.users.find((u) => u.email === email);
  if (existing) {
    userId = existing.id;
    console.log('✓ Admin ya existía en Supabase Auth');
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log('✓ Admin creado en Supabase Auth');
  }

  const [exists] = await db.select().from(usuario).where(eq(usuario.id, userId)).limit(1);
  if (!exists) {
    await db.insert(usuario).values({
      id: userId, email, nombre: 'Admin Macna', rol: 'admin', activo: true,
    });
    console.log('✓ Admin espejado en tabla usuario');
  }
}

async function syncPartesEspejo() {
  const { backfillPartesEspejo } = await import('@/features/partes/auto-create');
  const r = await backfillPartesEspejo();
  console.log(`✓ Partes espejo sincronizadas: ${r.obras} obras, ${r.proveedores} proveedores`);
}

async function main() {
  await seedRubros();
  await seedCuentas();
  await seedConceptos();
  await seedPartes();
  await seedAdmin();
  await syncPartesEspejo();
  console.log('Seed completado.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
