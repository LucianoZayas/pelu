import 'dotenv/config';
import { execSync } from 'child_process';
import { sql } from 'drizzle-orm';
import { db, pg } from '@/db/client';

export async function resetDb() {
  // TRUNCATE en orden de FKs.
  await db.execute(sql`TRUNCATE TABLE
    audit_log, item_presupuesto, presupuesto, movimiento, obra, rubro, usuario
    RESTART IDENTITY CASCADE`);
}

export async function migrateTestDb() {
  execSync('pnpm db:migrate', { stdio: 'inherit' });
}

afterAll(async () => {
  await pg.end({ timeout: 5 });
});
