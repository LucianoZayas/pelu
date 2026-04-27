import { and, desc, eq, gte, lte, SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditLog, usuario } from '@/db/schema';

export interface BuscarFiltros {
  entidad?: 'obra' | 'presupuesto' | 'item_presupuesto' | 'usuario' | 'cliente_token' | 'rubro';
  accion?: 'crear' | 'editar' | 'eliminar' | 'firmar' | 'cancelar' | 'regenerar_token';
  usuarioId?: string;
  desde?: Date;
  hasta?: Date;
  limit?: number;
  offset?: number;
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
