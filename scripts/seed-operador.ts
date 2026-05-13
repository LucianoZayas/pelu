import 'dotenv/config';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { usuario } from '@/db/schema';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function generatePassword(): string {
  // 16 chars: letters + digits + a few symbols, safe for Supabase
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#!';
  const bytes = randomBytes(16);
  let out = '';
  for (let i = 0; i < 16; i++) out += charset[bytes[i] % charset.length];
  return out;
}

async function main() {
  const nombre = 'Lucho';
  // Random 4-digit suffix to keep emails unique across multiple seeds.
  const suffix = randomBytes(2).readUInt16BE(0).toString().padStart(4, '0').slice(0, 4);
  const email = `lucho.${suffix}@macna.local`;
  const password = generatePassword();

  console.log('Generated credentials:');
  console.log('  email:    ', email);
  console.log('  password: ', password);
  console.log('  nombre:   ', nombre);
  console.log('  rol:      ', 'operador');
  console.log();

  const admin = createSupabaseAdminClient();

  // 1. Create user in Supabase Auth
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    console.error('Error creando user en Supabase Auth:', error.message);
    process.exit(1);
  }
  const userId = data.user.id;
  console.log('✓ Supabase Auth user created:', userId);

  // 2. Mirror to usuario table with rol=operador
  const [existing] = await db.select().from(usuario).where(eq(usuario.id, userId)).limit(1);
  if (!existing) {
    await db.insert(usuario).values({
      id: userId,
      email,
      nombre,
      rol: 'operador',
      activo: true,
    });
    console.log('✓ Usuario espejado en tabla usuario con rol=operador');
  } else {
    console.log('(Usuario ya existía en tabla usuario, no se duplicó)');
  }

  console.log();
  console.log('==== ANOTÁ ESTAS CREDENCIALES ====');
  console.log('email:   ', email);
  console.log('password:', password);
  console.log('===================================');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
