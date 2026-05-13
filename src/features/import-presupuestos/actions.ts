'use server';

import { requireRole } from '@/lib/auth/require';
import { parseFile } from '@/../scripts/import-sheets/parse';
import { commitImport, type CommitImportArgs } from '@/../scripts/import-sheets/ejecutor';
import { revalidatePath } from 'next/cache';
import type { ItemPreview, ResultadoParseoXlsx } from './types';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { obra, presupuesto } from '@/db/schema';
import { logAudit } from '@/features/audit/log';

const MAX_BYTES = 5 * 1024 * 1024;

export type PreviewResult =
  | {
      ok: true;
      items: ItemPreview[];
      descartes: ResultadoParseoXlsx['descartes'];
      cotizacionDetectada: number | null;
      nombreObraDetectado: string | null;
      mapeoColumnas: Record<string, number>;
      metadata: ResultadoParseoXlsx['metadata'];
    }
  | { ok: false; error: string };

export type CommitImportActionResult =
  | { ok: true; obraId: string; presupuestoId: string; itemsCreados: number; redirectTo: string }
  | { ok: false; error: string };

export async function commitImportAction(
  args: Omit<CommitImportArgs, 'adminId'>,
): Promise<CommitImportActionResult> {
  try {
    const session = await requireRole('admin');
    const adminId = session.id;
    const r = await commitImport({ ...args, adminId });
    const redirectTo = `/obras/${r.obraId}/presupuestos/${r.presupuestoId}`;
    revalidatePath('/obras');
    revalidatePath(`/obras/${r.obraId}`);
    return { ok: true, obraId: r.obraId, presupuestoId: r.presupuestoId, itemsCreados: r.itemsCreados, redirectTo };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido' };
  }
}

export async function parsePreview(form: FormData): Promise<PreviewResult> {
  await requireRole('admin');
  const file = form.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'No se recibió archivo' };
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return { ok: false, error: 'El archivo debe ser .xlsx (Excel moderno). Extensión no válida.' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `El archivo supera 5 MB (pesa ${(file.size / 1024 / 1024).toFixed(1)} MB).` };
  }
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const parsed = await parseFile(buf, file.name);
    if (parsed.kind !== 'xlsx') {
      return { ok: false, error: 'Esperado XLSX, recibido CSV (no soportado por la UI).' };
    }
    return {
      ok: true,
      items: parsed.result.items,
      descartes: parsed.result.descartes,
      cotizacionDetectada: parsed.result.cotizacionDetectada,
      nombreObraDetectado: parsed.result.nombreObraDetectado,
      mapeoColumnas: parsed.result.mapeoColumnas,
      metadata: parsed.result.metadata,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido al parsear' };
  }
}

export type ConfirmarImportActionResult =
  | { ok: true; alreadyConfirmed: boolean }
  | { ok: false; error: string };

export async function confirmarImportAction({
  presupuestoId,
}: {
  presupuestoId: string;
}): Promise<ConfirmarImportActionResult> {
  try {
    const session = await requireRole('admin');
    const adminId = session.id;

    const [p] = await db.select().from(presupuesto).where(eq(presupuesto.id, presupuestoId)).limit(1);
    if (!p) return { ok: false, error: 'Presupuesto no encontrado' };
    if (!p.importPendiente) return { ok: true, alreadyConfirmed: true };

    await db.transaction(async (tx) => {
      await tx
        .update(presupuesto)
        .set({ importPendiente: false, updatedBy: adminId, updatedAt: new Date() })
        .where(eq(presupuesto.id, presupuestoId));
      await logAudit({
        entidad: 'presupuesto',
        entidadId: presupuestoId,
        accion: 'editar',
        descripcionHumana: `Import confirmado para presupuesto ${p.tipo} #${p.numero}`,
        usuarioId: adminId,
      });
    });

    revalidatePath(`/obras/${p.obraId}/presupuestos/${presupuestoId}`);
    return { ok: true, alreadyConfirmed: false };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' };
  }
}

export type CancelarImportActionResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

export async function cancelarImportAction({
  presupuestoId,
}: {
  presupuestoId: string;
}): Promise<CancelarImportActionResult> {
  try {
    const session = await requireRole('admin');
    const adminId = session.id;

    const [p] = await db.select().from(presupuesto).where(eq(presupuesto.id, presupuestoId)).limit(1);
    if (!p) return { ok: false, error: 'Presupuesto no encontrado' };
    if (!p.importPendiente) return { ok: false, error: 'No es una importación pendiente' };

    let redirectTo = '';
    await db.transaction(async (tx) => {
      // Caso re-import: the NEW presupuesto has reemplazadoPorImportId pointing to the OLD one
      const anterior = p.reemplazadoPorImportId
        ? (
            await tx
              .select()
              .from(presupuesto)
              .where(eq(presupuesto.id, p.reemplazadoPorImportId))
              .limit(1)
          )[0]
        : undefined;

      if (anterior) {
        // Restore anterior: undo soft-delete and clear reemplazadoPorImportId
        await tx
          .update(presupuesto)
          .set({ deletedAt: null, reemplazadoPorImportId: null })
          .where(eq(presupuesto.id, anterior.id));
      }

      // Hard delete the new presupuesto (cascade cleans up item_presupuesto rows)
      await tx.delete(presupuesto).where(eq(presupuesto.id, presupuestoId));

      // Caso obra nueva: if no presupuestos remain, hard delete the obra too
      const restantes = await tx
        .select()
        .from(presupuesto)
        .where(eq(presupuesto.obraId, p.obraId));

      if (restantes.length === 0) {
        await tx.delete(obra).where(eq(obra.id, p.obraId));
        redirectTo = '/obras';
      } else {
        redirectTo = `/obras/${p.obraId}`;
      }

      await logAudit({
        entidad: 'presupuesto',
        entidadId: presupuestoId,
        accion: 'cancelar',
        descripcionHumana: anterior
          ? 'Import cancelado, presupuesto anterior restaurado'
          : restantes.length === 0
            ? `Import cancelado, obra ${p.obraId} eliminada`
            : 'Import cancelado',
        usuarioId: adminId,
      });
    });

    revalidatePath('/obras');
    return { ok: true, redirectTo };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' };
  }
}
