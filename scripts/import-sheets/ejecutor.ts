import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { obra, presupuesto, itemPresupuesto, rubro } from '@/db/schema';
import { D, toDb } from '@/lib/money/decimal';
import { calcularSnapshotItem, type PresupuestoCtx } from '@/features/presupuestos/services/snapshots';
import { logAudit } from '@/features/audit/log';
import { parseCsv } from './parse';
import { validarFila } from './validate';

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
  const filas = await parseCsv(args.buf);

  // Validación por fila
  const errores: string[] = [];
  filas.forEach((f, i) => {
    const v = validarFila(f, i);
    if (!v.ok) errores.push(v.error);
  });
  if (errores.length) return { ok: false, errores };

  // Idempotencia por código de obra
  const [exists] = await db.select({ id: obra.id }).from(obra).where(eq(obra.codigo, args.codigoObra)).limit(1);
  if (exists) return { ok: false, errores: [`obra con código ${args.codigoObra} ya existe`] };

  // Resolución de rubros (crear los faltantes)
  const rubrosCache = new Map<string, string>();
  for (const f of filas) {
    const nombre = f.rubro.trim();
    if (rubrosCache.has(nombre)) continue;
    const [existing] = await db.select().from(rubro).where(eq(rubro.nombre, nombre)).limit(1);
    if (existing) {
      rubrosCache.set(nombre, existing.id);
    } else if (!args.dryRun) {
      const [created] = await db.insert(rubro).values({
        nombre, orden: 999, activo: true, creadoPorImportador: true,
      }).returning();
      rubrosCache.set(nombre, created.id);
    } else {
      rubrosCache.set(nombre, '__DRY__');
    }
  }

  if (args.dryRun) {
    const rubrosUnicos = new Set(filas.map((f) => f.rubro.trim())).size;
    console.log(`[dry-run] obra ${args.codigoObra} importaría con ${filas.length} items y ${rubrosUnicos} rubros distintos`);
    return { ok: true, itemsImportados: filas.length };
  }

  // Creación de obra
  const monedaBase = args.monedaBase ?? 'USD';
  const [oCreated] = await db.insert(obra).values({
    codigo: args.codigoObra,
    nombre: args.nombreObra ?? args.codigoObra,
    clienteNombre: args.clienteNombre ?? 'Cliente importado',
    estado: 'borrador',
    monedaBase,
    porcentajeHonorarios: '16',
    cotizacionUsdInicial: args.cotizacionUsd,
    clienteToken: randomBytes(32).toString('base64url'),
    createdBy: args.adminId,
    updatedBy: args.adminId,
  }).returning();

  // Presupuesto original
  const [pCreated] = await db.insert(presupuesto).values({
    obraId: oCreated.id,
    tipo: 'original',
    numero: 1,
    estado: 'borrador',
    markupDefaultPorcentaje: args.markupDefault,
    cotizacionUsd: args.cotizacionUsd,
    version: 1,
    createdBy: args.adminId,
    updatedBy: args.adminId,
  }).returning();

  const ctx: PresupuestoCtx = {
    monedaBase: oCreated.monedaBase,
    cotizacionUsd: D(args.cotizacionUsd),
    markupDefault: D(args.markupDefault),
  };

  // Items con snapshots
  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    const markupPct = f.markup ? D(f.markup) : null;
    const snap = calcularSnapshotItem({
      cantidad: D(f.cantidad),
      costoUnitario: D(f.costo_unitario),
      costoUnitarioMoneda: f.moneda_costo as 'USD' | 'ARS',
      markupPorcentaje: markupPct,
    }, ctx);
    await db.insert(itemPresupuesto).values({
      presupuestoId: pCreated.id,
      rubroId: rubrosCache.get(f.rubro.trim())!,
      orden: i,
      descripcion: f.descripcion,
      unidad: f.unidad as 'm2' | 'm3' | 'hs' | 'gl' | 'u' | 'ml' | 'kg',
      cantidad: f.cantidad,
      costoUnitario: f.costo_unitario,
      costoUnitarioMoneda: f.moneda_costo as 'USD' | 'ARS',
      costoUnitarioBase: toDb(snap.costoUnitarioBase),
      markupPorcentaje: f.markup || null,
      markupEfectivoPorcentaje: toDb(snap.markupEfectivoPorcentaje, 2),
      precioUnitarioCliente: toDb(snap.precioUnitarioCliente),
      notas: f.notas || null,
    });
  }

  await logAudit({
    entidad: 'obra',
    entidadId: oCreated.id,
    accion: 'crear',
    descripcionHumana: `Importador creó obra ${args.codigoObra} con ${filas.length} items`,
    usuarioId: args.adminId,
  });

  return { ok: true, obraId: oCreated.id, itemsImportados: filas.length };
}
