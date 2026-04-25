import { db } from '@/db/client';
import { auditLog } from '@/db/schema';

type Entidad = 'obra' | 'presupuesto' | 'item_presupuesto' | 'usuario' | 'cliente_token' | 'rubro';
type Accion = 'crear' | 'editar' | 'eliminar' | 'firmar' | 'cancelar' | 'regenerar_token';

export interface LogAuditInput {
  entidad: Entidad;
  entidadId: string;
  accion: Accion;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  descripcionHumana?: string;
  usuarioId: string;
}

function diffOf(before?: Record<string, unknown> | null, after?: Record<string, unknown> | null) {
  if (!before && !after) return null;
  if (!before) return { after };
  if (!after) return { before };
  const changed: Record<string, { before: unknown; after: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      changed[k] = { before: before[k], after: after[k] };
    }
  }
  return Object.keys(changed).length ? changed : null;
}

export async function logAudit(input: LogAuditInput) {
  const diff = diffOf(input.before, input.after);
  await db.insert(auditLog).values({
    entidad: input.entidad,
    entidadId: input.entidadId,
    accion: input.accion,
    diff,
    descripcionHumana: input.descripcionHumana,
    usuarioId: input.usuarioId,
  });
}
