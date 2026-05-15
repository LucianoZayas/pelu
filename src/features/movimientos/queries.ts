import { db } from '@/db/client';
import {
  movimiento, conceptoMovimiento, cuenta, obra, parte, proveedor, usuario,
} from '@/db/schema';
import { and, asc, desc, eq, gte, lte, or, sql, inArray, ilike } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export type ListarMovimientosFiltros = {
  obraId?: string;
  cuentaId?: string;
  conceptoId?: string;
  parteId?: string;
  tipo?: 'entrada' | 'salida' | 'transferencia';
  estado?: 'previsto' | 'confirmado' | 'anulado';
  desde?: string; // YYYY-MM-DD
  hasta?: string; // YYYY-MM-DD
  search?: string;
  limit?: number;
  offset?: number;
};

export type MovimientoRow = {
  id: string;
  tipo: 'entrada' | 'salida' | 'transferencia';
  fecha: Date;
  descripcion: string | null;
  numeroComprobante: string | null;
  comprobanteUrl: string | null;
  monto: string;
  moneda: 'USD' | 'ARS';
  montoDestino: string | null;
  cotizacionUsd: string | null;
  esNoRecuperable: boolean;
  estado: 'previsto' | 'confirmado' | 'anulado';
  anuladoMotivo: string | null;
  version: number;
  conceptoId: string | null;
  conceptoCodigo: string | null;
  conceptoNombre: string | null;
  conceptoTipo: 'ingreso' | 'egreso' | 'transferencia' | null;
  cuentaId: string | null;
  cuentaNombre: string | null;
  cuentaMoneda: 'USD' | 'ARS' | null;
  cuentaDestinoId: string | null;
  cuentaDestinoNombre: string | null;
  cuentaDestinoMoneda: 'USD' | 'ARS' | null;
  obraId: string | null;
  obraCodigo: string | null;
  obraNombre: string | null;
  parteOrigenId: string | null;
  parteOrigenNombre: string | null;
  parteDestinoId: string | null;
  parteDestinoNombre: string | null;
  proveedorId: string | null;
  proveedorNombre: string | null;
  createdBy: string | null;
  createdByNombre: string | null;
  createdAt: Date;
};

export async function listarMovimientos(filtros: ListarMovimientosFiltros = {}): Promise<MovimientoRow[]> {
  const cuentaDestino = alias(cuenta, 'cuenta_destino');
  const parteOrigen = alias(parte, 'parte_origen');
  const parteDestino = alias(parte, 'parte_destino');

  const whereParts = [];
  if (filtros.obraId) whereParts.push(eq(movimiento.obraId, filtros.obraId));
  if (filtros.cuentaId) {
    whereParts.push(or(eq(movimiento.cuentaId, filtros.cuentaId), eq(movimiento.cuentaDestinoId, filtros.cuentaId)));
  }
  if (filtros.conceptoId) whereParts.push(eq(movimiento.conceptoId, filtros.conceptoId));
  if (filtros.parteId) {
    whereParts.push(or(eq(movimiento.parteOrigenId, filtros.parteId), eq(movimiento.parteDestinoId, filtros.parteId)));
  }
  if (filtros.tipo) whereParts.push(eq(movimiento.tipo, filtros.tipo));
  if (filtros.estado) whereParts.push(eq(movimiento.estado, filtros.estado));
  if (filtros.desde) whereParts.push(gte(movimiento.fecha, new Date(filtros.desde)));
  if (filtros.hasta) whereParts.push(lte(movimiento.fecha, new Date(filtros.hasta)));
  if (filtros.search?.trim()) {
    const pattern = `%${filtros.search.trim()}%`;
    whereParts.push(or(
      ilike(movimiento.descripcion, pattern),
      ilike(movimiento.numeroComprobante, pattern),
    ));
  }

  const rows = await db
    .select({
      id: movimiento.id,
      tipo: movimiento.tipo,
      fecha: movimiento.fecha,
      descripcion: movimiento.descripcion,
      numeroComprobante: movimiento.numeroComprobante,
      comprobanteUrl: movimiento.comprobanteUrl,
      monto: movimiento.monto,
      moneda: movimiento.moneda,
      montoDestino: movimiento.montoDestino,
      cotizacionUsd: movimiento.cotizacionUsd,
      esNoRecuperable: movimiento.esNoRecuperable,
      estado: movimiento.estado,
      anuladoMotivo: movimiento.anuladoMotivo,
      version: movimiento.version,
      conceptoId: movimiento.conceptoId,
      conceptoCodigo: conceptoMovimiento.codigo,
      conceptoNombre: conceptoMovimiento.nombre,
      conceptoTipo: conceptoMovimiento.tipo,
      cuentaId: movimiento.cuentaId,
      cuentaNombre: cuenta.nombre,
      cuentaMoneda: cuenta.moneda,
      cuentaDestinoId: movimiento.cuentaDestinoId,
      cuentaDestinoNombre: cuentaDestino.nombre,
      cuentaDestinoMoneda: cuentaDestino.moneda,
      obraId: movimiento.obraId,
      obraCodigo: obra.codigo,
      obraNombre: obra.nombre,
      parteOrigenId: movimiento.parteOrigenId,
      parteOrigenNombre: parteOrigen.nombre,
      parteDestinoId: movimiento.parteDestinoId,
      parteDestinoNombre: parteDestino.nombre,
      proveedorId: movimiento.proveedorId,
      proveedorNombre: proveedor.nombre,
      createdBy: movimiento.createdBy,
      createdByNombre: usuario.nombre,
      createdAt: movimiento.createdAt,
    })
    .from(movimiento)
    .leftJoin(conceptoMovimiento, eq(conceptoMovimiento.id, movimiento.conceptoId))
    .leftJoin(cuenta, eq(cuenta.id, movimiento.cuentaId))
    .leftJoin(cuentaDestino, eq(cuentaDestino.id, movimiento.cuentaDestinoId))
    .leftJoin(obra, eq(obra.id, movimiento.obraId))
    .leftJoin(parteOrigen, eq(parteOrigen.id, movimiento.parteOrigenId))
    .leftJoin(parteDestino, eq(parteDestino.id, movimiento.parteDestinoId))
    .leftJoin(proveedor, eq(proveedor.id, movimiento.proveedorId))
    .leftJoin(usuario, eq(usuario.id, movimiento.createdBy))
    .where(whereParts.length > 0 ? and(...whereParts) : undefined)
    .orderBy(desc(movimiento.fecha), desc(movimiento.createdAt))
    .limit(filtros.limit ?? 100)
    .offset(filtros.offset ?? 0);

  return rows as MovimientoRow[];
}

export async function contarMovimientos(filtros: ListarMovimientosFiltros = {}): Promise<number> {
  const whereParts = [];
  if (filtros.obraId) whereParts.push(eq(movimiento.obraId, filtros.obraId));
  if (filtros.cuentaId) {
    whereParts.push(or(eq(movimiento.cuentaId, filtros.cuentaId), eq(movimiento.cuentaDestinoId, filtros.cuentaId)));
  }
  if (filtros.conceptoId) whereParts.push(eq(movimiento.conceptoId, filtros.conceptoId));
  if (filtros.parteId) {
    whereParts.push(or(eq(movimiento.parteOrigenId, filtros.parteId), eq(movimiento.parteDestinoId, filtros.parteId)));
  }
  if (filtros.tipo) whereParts.push(eq(movimiento.tipo, filtros.tipo));
  if (filtros.estado) whereParts.push(eq(movimiento.estado, filtros.estado));
  if (filtros.desde) whereParts.push(gte(movimiento.fecha, new Date(filtros.desde)));
  if (filtros.hasta) whereParts.push(lte(movimiento.fecha, new Date(filtros.hasta)));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(movimiento)
    .where(whereParts.length > 0 ? and(...whereParts) : undefined);
  return count ?? 0;
}

export async function obtenerMovimiento(id: string) {
  const [row] = await db.select().from(movimiento).where(eq(movimiento.id, id));
  return row ?? null;
}
