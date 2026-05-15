import { db } from '@/db/client';
import { sql } from 'drizzle-orm';

/**
 * Queries del dashboard /flujo. Todas reciben un rango [desde, hasta] inclusivo
 * (formato YYYY-MM-DD). Filtran solo movimientos en estado 'confirmado'.
 *
 * Las transferencias NO se cuentan como ingreso ni egreso a nivel empresa
 * (son movimientos internos entre cuentas propias).
 */

export type Kpis = {
  ingresosArs: string;
  egresosArs: string;
  balanceNetoArs: string;
  ingresosUsd: string;
  egresosUsd: string;
  balanceNetoUsd: string;
};

export type CuentaConDetalle = {
  id: string;
  nombre: string;
  moneda: 'USD' | 'ARS';
  tipo: string;
  orden: number;
  activo: boolean;
  saldoActual: string;
  ingresoMes: string;
  egresoMes: string;
  ultimoMovimientoFecha: Date | null;
};

export type FlujoPorDia = {
  fecha: string; // YYYY-MM-DD
  ingresoArs: string;
  egresoArs: string;
  ingresoUsd: string;
  egresoUsd: string;
};

export type ConceptoBreakdown = {
  conceptoId: string;
  codigo: string;
  nombre: string;
  tipo: 'ingreso' | 'egreso' | 'transferencia';
  totalArs: string;
  totalUsd: string;
  cantidad: number;
};

export type ActividadItem = {
  id: string;
  tipo: 'entrada' | 'salida' | 'transferencia';
  fecha: Date;
  monto: string;
  moneda: 'USD' | 'ARS';
  conceptoNombre: string | null;
  conceptoCodigo: string | null;
  obraId: string | null;
  obraCodigo: string | null;
  obraNombre: string | null;
  parteOrigenNombre: string | null;
  parteDestinoNombre: string | null;
  cuentaNombre: string | null;
  cuentaDestinoNombre: string | null;
  descripcion: string | null;
};

function rowsOf<T>(result: unknown): T[] {
  return (result as unknown as T[]) ?? [];
}

export async function obtenerKpisDelPeriodo(desde: string, hasta: string): Promise<Kpis> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN tipo = 'entrada' AND moneda = 'ARS' THEN monto END), 0) AS ingresos_ars,
      COALESCE(SUM(CASE WHEN tipo = 'salida'  AND moneda = 'ARS' THEN monto END), 0) AS egresos_ars,
      COALESCE(SUM(CASE WHEN tipo = 'entrada' AND moneda = 'USD' THEN monto END), 0) AS ingresos_usd,
      COALESCE(SUM(CASE WHEN tipo = 'salida'  AND moneda = 'USD' THEN monto END), 0) AS egresos_usd
    FROM movimiento
    WHERE estado = 'confirmado'
      AND tipo IN ('entrada', 'salida')
      AND fecha >= ${desde}::date
      AND fecha <= ${hasta}::date
  `);
  const rows = rowsOf<Record<string, unknown>>(result);
  const r = rows[0] ?? {};
  const iArs = String(r.ingresos_ars ?? '0');
  const eArs = String(r.egresos_ars ?? '0');
  const iUsd = String(r.ingresos_usd ?? '0');
  const eUsd = String(r.egresos_usd ?? '0');
  return {
    ingresosArs: iArs,
    egresosArs: eArs,
    balanceNetoArs: String(Number(iArs) - Number(eArs)),
    ingresosUsd: iUsd,
    egresosUsd: eUsd,
    balanceNetoUsd: String(Number(iUsd) - Number(eUsd)),
  };
}

export async function obtenerSaldosConDetalle(
  desde: string,
  hasta: string,
): Promise<CuentaConDetalle[]> {
  const result = await db.execute(sql`
    SELECT
      c.id, c.nombre, c.moneda, c.tipo, c.orden, c.activo,
      -- saldo actual = ingresos totales + transf entrantes - egresos totales - transf salientes
      COALESCE(
        (SELECT SUM(m.monto) FROM movimiento m
         WHERE m.cuenta_id = c.id AND m.estado = 'confirmado' AND m.tipo = 'entrada'), 0)
      + COALESCE(
        (SELECT SUM(m.monto_destino) FROM movimiento m
         WHERE m.cuenta_destino_id = c.id AND m.estado = 'confirmado' AND m.tipo = 'transferencia'), 0)
      - COALESCE(
        (SELECT SUM(m.monto) FROM movimiento m
         WHERE m.cuenta_id = c.id AND m.estado = 'confirmado' AND m.tipo IN ('salida', 'transferencia')), 0)
        AS saldo_actual,
      -- ingreso del período (solo entradas en esta cuenta)
      COALESCE(
        (SELECT SUM(m.monto) FROM movimiento m
         WHERE m.cuenta_id = c.id AND m.estado = 'confirmado' AND m.tipo = 'entrada'
           AND m.fecha >= ${desde}::date AND m.fecha <= ${hasta}::date), 0)
      + COALESCE(
        (SELECT SUM(m.monto_destino) FROM movimiento m
         WHERE m.cuenta_destino_id = c.id AND m.estado = 'confirmado' AND m.tipo = 'transferencia'
           AND m.fecha >= ${desde}::date AND m.fecha <= ${hasta}::date), 0)
        AS ingreso_mes,
      -- egreso del período (salidas + transferencias salientes)
      COALESCE(
        (SELECT SUM(m.monto) FROM movimiento m
         WHERE m.cuenta_id = c.id AND m.estado = 'confirmado' AND m.tipo IN ('salida', 'transferencia')
           AND m.fecha >= ${desde}::date AND m.fecha <= ${hasta}::date), 0)
        AS egreso_mes,
      -- última fecha de movimiento sobre esta cuenta (origen o destino)
      (SELECT MAX(m.fecha) FROM movimiento m
       WHERE (m.cuenta_id = c.id OR m.cuenta_destino_id = c.id)
         AND m.estado = 'confirmado')
        AS ultimo_movimiento_fecha
    FROM cuenta c
    ORDER BY c.orden ASC, c.nombre ASC
  `);
  return rowsOf<Record<string, unknown>>(result).map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre),
    moneda: r.moneda as 'USD' | 'ARS',
    tipo: String(r.tipo),
    orden: Number(r.orden),
    activo: Boolean(r.activo),
    saldoActual: String(r.saldo_actual ?? '0'),
    ingresoMes: String(r.ingreso_mes ?? '0'),
    egresoMes: String(r.egreso_mes ?? '0'),
    ultimoMovimientoFecha: r.ultimo_movimiento_fecha
      ? new Date(r.ultimo_movimiento_fecha as string)
      : null,
  }));
}

// Devuelve un punto por día del rango — incluye días sin movimiento con valores en 0.
// Para rangos > 60 días, el front puede decidir agrupar por semana.
export async function obtenerFlujoPorDia(desde: string, hasta: string): Promise<FlujoPorDia[]> {
  const result = await db.execute(sql`
    WITH dias AS (
      SELECT generate_series(${desde}::date, ${hasta}::date, '1 day'::interval)::date AS fecha
    ),
    agregados AS (
      SELECT
        fecha,
        COALESCE(SUM(CASE WHEN tipo='entrada' AND moneda='ARS' THEN monto END), 0) AS ing_ars,
        COALESCE(SUM(CASE WHEN tipo='salida'  AND moneda='ARS' THEN monto END), 0) AS eg_ars,
        COALESCE(SUM(CASE WHEN tipo='entrada' AND moneda='USD' THEN monto END), 0) AS ing_usd,
        COALESCE(SUM(CASE WHEN tipo='salida'  AND moneda='USD' THEN monto END), 0) AS eg_usd
      FROM movimiento
      WHERE estado='confirmado' AND tipo IN ('entrada', 'salida')
        AND fecha >= ${desde}::date AND fecha <= ${hasta}::date
      GROUP BY fecha
    )
    SELECT
      to_char(d.fecha, 'YYYY-MM-DD') AS fecha,
      COALESCE(a.ing_ars, 0) AS ing_ars,
      COALESCE(a.eg_ars,  0) AS eg_ars,
      COALESCE(a.ing_usd, 0) AS ing_usd,
      COALESCE(a.eg_usd,  0) AS eg_usd
    FROM dias d
    LEFT JOIN agregados a USING (fecha)
    ORDER BY d.fecha ASC
  `);
  return rowsOf<Record<string, unknown>>(result).map((r) => ({
    fecha: String(r.fecha),
    ingresoArs: String(r.ing_ars ?? '0'),
    egresoArs: String(r.eg_ars ?? '0'),
    ingresoUsd: String(r.ing_usd ?? '0'),
    egresoUsd: String(r.eg_usd ?? '0'),
  }));
}

export async function obtenerBreakdownPorConcepto(
  desde: string,
  hasta: string,
  topN = 5,
): Promise<ConceptoBreakdown[]> {
  const result = await db.execute(sql`
    SELECT
      c.id AS concepto_id,
      c.codigo,
      c.nombre,
      c.tipo,
      COALESCE(SUM(CASE WHEN m.moneda = 'ARS' THEN m.monto END), 0) AS total_ars,
      COALESCE(SUM(CASE WHEN m.moneda = 'USD' THEN m.monto END), 0) AS total_usd,
      COUNT(*) AS cantidad
    FROM movimiento m
    JOIN concepto_movimiento c ON c.id = m.concepto_id
    WHERE m.estado = 'confirmado'
      AND m.tipo IN ('entrada', 'salida')
      AND m.fecha >= ${desde}::date
      AND m.fecha <= ${hasta}::date
    GROUP BY c.id, c.codigo, c.nombre, c.tipo
    ORDER BY (
      COALESCE(SUM(CASE WHEN m.moneda = 'ARS' THEN m.monto END), 0)
      + COALESCE(SUM(CASE WHEN m.moneda = 'USD' THEN m.monto END), 0) * 1000  -- aprox para que USD pese más que ARS
    ) DESC
    LIMIT ${topN}
  `);
  return rowsOf<Record<string, unknown>>(result).map((r) => ({
    conceptoId: String(r.concepto_id),
    codigo: String(r.codigo),
    nombre: String(r.nombre),
    tipo: r.tipo as 'ingreso' | 'egreso' | 'transferencia',
    totalArs: String(r.total_ars ?? '0'),
    totalUsd: String(r.total_usd ?? '0'),
    cantidad: Number(r.cantidad ?? 0),
  }));
}

export async function obtenerActividadReciente(limit = 10): Promise<ActividadItem[]> {
  const result = await db.execute(sql`
    SELECT
      m.id,
      m.tipo,
      m.fecha,
      m.monto,
      m.moneda,
      m.descripcion,
      m.obra_id,
      cm.codigo AS concepto_codigo,
      cm.nombre AS concepto_nombre,
      o.codigo AS obra_codigo,
      o.nombre AS obra_nombre,
      po.nombre AS parte_origen_nombre,
      pd.nombre AS parte_destino_nombre,
      cu.nombre AS cuenta_nombre,
      cd.nombre AS cuenta_destino_nombre
    FROM movimiento m
    LEFT JOIN concepto_movimiento cm ON cm.id = m.concepto_id
    LEFT JOIN obra o ON o.id = m.obra_id
    LEFT JOIN parte po ON po.id = m.parte_origen_id
    LEFT JOIN parte pd ON pd.id = m.parte_destino_id
    LEFT JOIN cuenta cu ON cu.id = m.cuenta_id
    LEFT JOIN cuenta cd ON cd.id = m.cuenta_destino_id
    WHERE m.estado = 'confirmado'
    ORDER BY m.created_at DESC
    LIMIT ${limit}
  `);
  return rowsOf<Record<string, unknown>>(result).map((r) => ({
    id: String(r.id),
    tipo: r.tipo as 'entrada' | 'salida' | 'transferencia',
    fecha: new Date(r.fecha as string),
    monto: String(r.monto),
    moneda: r.moneda as 'USD' | 'ARS',
    conceptoNombre: r.concepto_nombre ? String(r.concepto_nombre) : null,
    conceptoCodigo: r.concepto_codigo ? String(r.concepto_codigo) : null,
    obraId: r.obra_id ? String(r.obra_id) : null,
    obraCodigo: r.obra_codigo ? String(r.obra_codigo) : null,
    obraNombre: r.obra_nombre ? String(r.obra_nombre) : null,
    parteOrigenNombre: r.parte_origen_nombre ? String(r.parte_origen_nombre) : null,
    parteDestinoNombre: r.parte_destino_nombre ? String(r.parte_destino_nombre) : null,
    cuentaNombre: r.cuenta_nombre ? String(r.cuenta_nombre) : null,
    cuentaDestinoNombre: r.cuenta_destino_nombre ? String(r.cuenta_destino_nombre) : null,
    descripcion: r.descripcion ? String(r.descripcion) : null,
  }));
}
