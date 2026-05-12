import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { obra, presupuesto, itemPresupuesto, rubro } from '@/db/schema';
import { D, toDb } from '@/lib/money/decimal';
import { calcularSnapshotItem, type PresupuestoCtx } from '@/features/presupuestos/services/snapshots';
import { logAudit } from '@/features/audit/log';
import { parseCsv } from './parse-csv';
import { validarFila } from './validate';
import type { ItemPreview } from './tipos';

export interface CommitImportArgs {
  items: ItemPreview[];
  metadatosObra: {
    codigoObra: string;
    nombreObra: string;
    clienteNombre: string;
    monedaBase: 'USD' | 'ARS';
    cotizacionUsd: string;
    markupDefaultPorcentaje: string;
    porcentajeHonorarios?: string;
  };
  importMetadata: Record<string, unknown>;
  adminId: string;
  obraIdExistente?: string;
}

export interface CommitImportResult {
  ok: true;
  obraId: string;
  presupuestoId: string;
  itemsCreados: number;
}

/**
 * Crea obra + presupuesto + items en transacción atómica.
 * Reusable desde CLI legacy (Plan 5) y desde Server Action nueva.
 * NO parsea — recibe items ya preparados.
 */
export async function commitImport(args: CommitImportArgs): Promise<CommitImportResult> {
  return db.transaction(async (tx) => {
    // 1. Resolver rubros (crear faltantes)
    const rubrosCache = new Map<string, string>();
    for (const it of args.items) {
      if (rubrosCache.has(it.rubro)) continue;
      const [existing] = await tx.select().from(rubro).where(eq(rubro.nombre, it.rubro)).limit(1);
      if (existing) {
        rubrosCache.set(it.rubro, existing.id);
      } else {
        const [created] = await tx.insert(rubro).values({
          nombre: it.rubro, orden: 999, activo: true, creadoPorImportador: true,
        }).returning();
        rubrosCache.set(it.rubro, created.id);
      }
    }

    // 2. Resolver obra (existente o nueva)
    let obraId: string;
    if (args.obraIdExistente) {
      obraId = args.obraIdExistente;
    } else {
      const [oCreated] = await tx.insert(obra).values({
        codigo: args.metadatosObra.codigoObra,
        nombre: args.metadatosObra.nombreObra,
        clienteNombre: args.metadatosObra.clienteNombre,
        estado: 'borrador',
        monedaBase: args.metadatosObra.monedaBase,
        porcentajeHonorarios: args.metadatosObra.porcentajeHonorarios ?? '16',
        cotizacionUsdInicial: args.metadatosObra.cotizacionUsd,
        clienteToken: randomBytes(32).toString('base64url'),
        createdBy: args.adminId,
        updatedBy: args.adminId,
      }).returning();
      obraId = oCreated.id;
    }

    // 3. Decidir tipo del presupuesto y soft-delete del anterior si aplica
    let tipoPresupuesto: 'original' | 'adicional' = 'original';
    let reemplazadoPorImportId: string | null = null;

    if (args.obraIdExistente) {
      const presupuestosObra = await tx.select().from(presupuesto)
        .where(eq(presupuesto.obraId, obraId));
      const borradorActivo = presupuestosObra.find((p) => p.estado === 'borrador' && !p.deletedAt && !p.importPendiente);
      const firmadoActivo = presupuestosObra.find((p) => p.estado === 'firmado' && !p.deletedAt);

      if (firmadoActivo) {
        tipoPresupuesto = 'adicional';
      } else if (borradorActivo) {
        // Soft-delete del anterior
        await tx.update(presupuesto).set({ deletedAt: new Date() }).where(eq(presupuesto.id, borradorActivo.id));
        reemplazadoPorImportId = borradorActivo.id;
      }
    }

    // 4. Calcular número del presupuesto
    const presupuestosObra = await tx.select().from(presupuesto).where(eq(presupuesto.obraId, obraId));
    const numero = presupuestosObra.filter((p) => p.tipo === tipoPresupuesto).length + 1;

    // 5. INSERT presupuesto
    const [pCreated] = await tx.insert(presupuesto).values({
      obraId,
      tipo: tipoPresupuesto,
      numero,
      estado: 'borrador',
      markupDefaultPorcentaje: args.metadatosObra.markupDefaultPorcentaje,
      cotizacionUsd: args.metadatosObra.cotizacionUsd,
      version: 1,
      importPendiente: true,
      importMetadata: args.importMetadata,
      reemplazadoPorImportId,
      createdBy: args.adminId,
      updatedBy: args.adminId,
    }).returning();

    // 6. INSERT items con snapshot
    const ctx: PresupuestoCtx = {
      monedaBase: args.metadatosObra.monedaBase,
      cotizacionUsd: D(args.metadatosObra.cotizacionUsd),
      markupDefault: D(args.metadatosObra.markupDefaultPorcentaje),
    };

    let i = 0;
    for (const it of args.items.filter((x) => x.incluido)) {
      const markupPct = it.markupPorcentaje > 0 ? D(String(it.markupPorcentaje * 100)) : null;
      const snap = calcularSnapshotItem({
        cantidad: D(String(it.cantidad)),
        costoUnitario: D(String(it.costoUnitario)),
        costoUnitarioMoneda: it.monedaCosto,
        markupPorcentaje: markupPct,
      }, ctx);

      // Warnings persisten en `notas` con prefix [import]
      const warningsPrefix = it.warnings.length > 0
        ? `[import] ${it.warnings.map((w) => w.mensaje).join('; ')} | `
        : '';

      await tx.insert(itemPresupuesto).values({
        presupuestoId: pCreated.id,
        rubroId: rubrosCache.get(it.rubro)!,
        orden: i++,
        descripcion: it.descripcion,
        ubicacion: it.ubicacion,
        unidad: it.unidad,
        cantidad: String(it.cantidad),
        costoUnitario: String(it.costoUnitario),
        costoUnitarioMoneda: it.monedaCosto,
        costoUnitarioBase: toDb(snap.costoUnitarioBase),
        markupPorcentaje: markupPct ? String(it.markupPorcentaje * 100) : null,
        markupEfectivoPorcentaje: toDb(snap.markupEfectivoPorcentaje, 2),
        precioUnitarioCliente: toDb(snap.precioUnitarioCliente),
        notas: warningsPrefix + (it.notas || ''),
      });
    }

    // 7. Audit log
    await logAudit({
      entidad: 'presupuesto',
      entidadId: pCreated.id,
      accion: 'crear',
      descripcionHumana: `Import XLSX creó presupuesto ${tipoPresupuesto} #${numero} con ${i} items (pendiente de confirmación)`,
      usuarioId: args.adminId,
      after: { importMetadata: args.importMetadata },
    });

    return { ok: true, obraId, presupuestoId: pCreated.id, itemsCreados: i };
  });
}

// ───── CLI legacy compatibility (Plan 5) ─────
export interface EjecutarImportArgs {
  buf: Buffer;
  codigoObra: string;
  adminId: string;
  dryRun: boolean;
  cotizacionUsd: string;
  markupDefault: string;
  monedaBase?: 'USD' | 'ARS';
  nombreObra?: string;
  clienteNombre?: string;
}

export type EjecutarImportResult =
  | { ok: true; obraId?: string; itemsImportados: number }
  | { ok: false; errores: string[] };

export async function ejecutarImport(args: EjecutarImportArgs): Promise<EjecutarImportResult> {
  const filasCsv = await parseCsv(args.buf);

  const errores: string[] = [];
  filasCsv.forEach((f, i) => {
    const v = validarFila(f, i);
    if (!v.ok) errores.push(v.error);
  });
  if (errores.length) return { ok: false, errores };

  const [exists] = await db.select({ id: obra.id }).from(obra).where(eq(obra.codigo, args.codigoObra)).limit(1);
  if (exists) return { ok: false, errores: [`obra con código ${args.codigoObra} ya existe`] };

  if (args.dryRun) {
    const rubrosUnicos = new Set(filasCsv.map((f) => f.rubro.trim())).size;
    console.log(`[dry-run] obra ${args.codigoObra} importaría con ${filasCsv.length} items y ${rubrosUnicos} rubros distintos`);
    return { ok: true, itemsImportados: filasCsv.length };
  }

  // Convertir FilaCsv → ItemPreview para reusar commitImport
  const items: ItemPreview[] = filasCsv.map((f, i) => ({
    filaExcel: i + 1,
    rubro: f.rubro.trim(),
    descripcion: f.descripcion,
    ubicacion: null,
    cantidad: Number(f.cantidad),
    unidad: f.unidad as ItemPreview['unidad'],
    costoUnitario: Number(f.costo_unitario),
    monedaCosto: f.moneda_costo as 'USD' | 'ARS',
    markupPorcentaje: f.markup ? Number(f.markup) / 100 : 0,
    notas: f.notas || '',
    warnings: [],
    estado: 'ok',
    incluido: true,
  }));

  const r = await commitImport({
    items,
    metadatosObra: {
      codigoObra: args.codigoObra,
      nombreObra: args.nombreObra ?? args.codigoObra,
      clienteNombre: args.clienteNombre ?? 'Cliente importado',
      monedaBase: args.monedaBase ?? 'USD',
      cotizacionUsd: args.cotizacionUsd,
      markupDefaultPorcentaje: args.markupDefault,
    },
    importMetadata: { source: 'cli-legacy-csv', filas: filasCsv.length },
    adminId: args.adminId,
  });

  return { ok: true, obraId: r.obraId, itemsImportados: r.itemsCreados };
}
