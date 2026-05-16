import { and, desc, eq, gte, lte, SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditLog, usuario } from '@/db/schema';

type EntidadAudit = typeof auditLog.$inferSelect['entidad'];
type AccionAudit = typeof auditLog.$inferSelect['accion'];

export interface BuscarFiltros {
  entidad?: EntidadAudit;
  accion?: AccionAudit;
  usuarioId?: string;
  desde?: Date;
  hasta?: Date;
  limit?: number;
  offset?: number;
}

export type AuditLogRow = {
  id: string;
  entidad: EntidadAudit;
  entidadId: string;
  accion: AccionAudit;
  diff: unknown;
  descripcionHumana: string | null;
  usuarioId: string;
  usuarioNombre: string | null;
  usuarioEmail: string | null;
  timestamp: Date;
};

export async function listarAuditDeEntidad(
  entidad: EntidadAudit,
  entidadId: string,
): Promise<AuditLogRow[]> {
  const rows = await db
    .select({
      id: auditLog.id,
      entidad: auditLog.entidad,
      entidadId: auditLog.entidadId,
      accion: auditLog.accion,
      diff: auditLog.diff,
      descripcionHumana: auditLog.descripcionHumana,
      usuarioId: auditLog.usuarioId,
      usuarioNombre: usuario.nombre,
      usuarioEmail: usuario.email,
      timestamp: auditLog.timestamp,
    })
    .from(auditLog)
    .leftJoin(usuario, eq(usuario.id, auditLog.usuarioId))
    .where(and(eq(auditLog.entidad, entidad), eq(auditLog.entidadId, entidadId)))
    .orderBy(desc(auditLog.timestamp));

  return rows as AuditLogRow[];
}

export async function buscarLogs(f: BuscarFiltros) {
  const conds: SQL[] = [];
  if (f.entidad) conds.push(eq(auditLog.entidad, f.entidad));
  if (f.accion) conds.push(eq(auditLog.accion, f.accion));
  if (f.usuarioId) conds.push(eq(auditLog.usuarioId, f.usuarioId));
  if (f.desde) conds.push(gte(auditLog.timestamp, f.desde));
  if (f.hasta) conds.push(lte(auditLog.timestamp, f.hasta));

  return db.select({
    log: auditLog,
    usuarioNombre: usuario.nombre,
    usuarioEmail: usuario.email,
  }).from(auditLog)
    .leftJoin(usuario, eq(auditLog.usuarioId, usuario.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLog.timestamp))
    .limit(f.limit ?? 100)
    .offset(f.offset ?? 0);
}
