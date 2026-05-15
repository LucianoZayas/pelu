import { db } from '@/db/client';
import { cuenta, movimiento } from '@/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';

export type CuentaConSaldo = {
  id: string;
  nombre: string;
  moneda: 'USD' | 'ARS';
  tipo: string;
  orden: number;
  notas: string | null;
  activo: boolean;
  saldoActual: string;
};

export async function listarCuentas() {
  return db.select().from(cuenta).orderBy(asc(cuenta.orden), asc(cuenta.nombre));
}

export async function listarCuentasActivas() {
  return db.select().from(cuenta).where(eq(cuenta.activo, true)).orderBy(asc(cuenta.orden), asc(cuenta.nombre));
}

// Saldo = entradas + transferencias_entrantes - salidas - transferencias_salientes,
// considerando solo movimientos confirmados.
export async function listarCuentasConSaldo(): Promise<CuentaConSaldo[]> {
  const rows = await db.execute(sql`
    SELECT
      c.id, c.nombre, c.moneda, c.tipo, c.orden, c.notas, c.activo,
      COALESCE(
        (SELECT SUM(m.monto)
         FROM movimiento m
         WHERE m.cuenta_id = c.id
           AND m.estado = 'confirmado'
           AND m.tipo = 'entrada'), 0)
      + COALESCE(
        (SELECT SUM(m.monto_destino)
         FROM movimiento m
         WHERE m.cuenta_destino_id = c.id
           AND m.estado = 'confirmado'
           AND m.tipo = 'transferencia'), 0)
      - COALESCE(
        (SELECT SUM(m.monto)
         FROM movimiento m
         WHERE m.cuenta_id = c.id
           AND m.estado = 'confirmado'
           AND m.tipo IN ('salida', 'transferencia')), 0)
      AS saldo_actual
    FROM cuenta c
    ORDER BY c.orden ASC, c.nombre ASC
  `);
  const list = rows as unknown as Array<Record<string, unknown>>;
  return list.map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre),
    moneda: r.moneda as 'USD' | 'ARS',
    tipo: String(r.tipo),
    orden: Number(r.orden),
    notas: r.notas == null ? null : String(r.notas),
    activo: Boolean(r.activo),
    saldoActual: String(r.saldo_actual ?? '0'),
  }));
}

export async function obtenerCuenta(id: string) {
  const [row] = await db.select().from(cuenta).where(eq(cuenta.id, id));
  return row ?? null;
}
