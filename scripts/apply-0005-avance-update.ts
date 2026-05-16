// Aplica la migration 0005 (relaja trigger escrito_en_piedra_item para permitir
// porcentaje_avance en items firmados). Idempotente.

import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

async function main() {
  const sqlBody = readFileSync(
    resolve(process.cwd(), 'drizzle/migrations/0005_avance_permite_update.sql'),
    'utf8',
  );
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 });
  try {
    await sql.unsafe(sqlBody);
    console.log('✓ trigger rechazar_edicion_firmado actualizado (permite porcentaje_avance)');
  } finally {
    await sql.end();
  }
}

main();
