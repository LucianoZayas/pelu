import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  pg: ReturnType<typeof postgres> | undefined;
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL no configurada');

export const pg = globalForDb.pg ?? postgres(url, { prepare: false, max: 10 });
export const db = globalForDb.db ?? drizzle(pg, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pg = pg;
  globalForDb.db = db;
}

export type DB = typeof db;
