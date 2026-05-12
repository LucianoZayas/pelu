'use server';

import { requireRole } from '@/lib/auth/require';
import { parseFile } from '@/../scripts/import-sheets/parse';
import { commitImport, type CommitImportArgs } from '@/../scripts/import-sheets/ejecutor';
import { revalidatePath } from 'next/cache';
import type { ItemPreview, ResultadoParseoXlsx } from './types';

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
