import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  pg: ReturnType<typeof postgres> | undefined;
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

// En dev usamos DIRECT_URL (session pooler port 5432) en vez del transaction
// pooler (port 6543) para evitar statement_timeout en queries iniciales y otros
// problemas del pgbouncer transaction mode con prepared statements / HMR.
const isDev = process.env.NODE_ENV !== 'production';
const url = isDev
  ? (process.env.DIRECT_URL ?? process.env.DATABASE_URL)
  : process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL no configurada');

export const pg = globalForDb.pg ?? postgres(url, {
  prepare: false,
  max: 10,
  idle_timeout: isDev ? 10 : 30,
  connect_timeout: 10,
});
export const db = globalForDb.db ?? drizzle(pg, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pg = pg;
  globalForDb.db = db;
}

export type DB = typeof db;
