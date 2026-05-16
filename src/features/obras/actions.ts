'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { obra } from '@/db/schema';
import { requireRole } from '@/lib/auth/require';
import { logAudit } from '@/features/audit/log';
import { obraInputSchema, type ObraInput } from './schema';
import { siguienteCodigoObra } from './codigo';
import { listarCodigosDelAnio, getObra } from './queries';
import { sincronizarParteDeObra } from '@/features/partes/auto-create';

type OkResult<T extends object = object> = { ok: true } & T;
type ErrResult = { ok: false; error: string };
type Result<T extends object = object> = OkResult<T> | ErrResult;

function generarToken() {
  return randomBytes(32).toString('base64url');
}

export async function crearObra(input: ObraInput): Promise<Result<{ id: string }>> {
  const admin = await requireRole('admin');
  const parsed = obraInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const anio = new Date().getFullYear();
  const existentes = await listarCodigosDelAnio(anio);
  const codigo = siguienteCodigoObra(anio, existentes);
  const token = generarToken();

  const [creada] = await db.insert(obra).values({
    codigo,
    nombre: parsed.data.nombre,
    clienteNombre: parsed.data.clienteNombre,
    clienteEmail: parsed.data.clienteEmail ?? null,
    clienteTelefono: parsed.data.clienteTelefono ?? null,
    ubicacion: parsed.data.ubicacion ?? null,
    superficieM2: parsed.data.superficieM2 ?? null,
    fechaInicio: parsed.data.fechaInicio ?? null,
    fechaFinEstimada: parsed.data.fechaFinEstimada ?? null,
    monedaBase: parsed.data.monedaBase,
    cotizacionUsdInicial: parsed.data.cotizacionUsdInicial ?? null,
    porcentajeHonorarios: parsed.data.porcentajeHonorarios,
    clienteToken: token,
    estado: 'borrador',
    createdBy: admin.id,
    updatedBy: admin.id,
  }).returning();

  await sincronizarParteDeObra(creada.id, {
    nombre: creada.nombre,
    codigo: creada.codigo,
    activo: true,
  });

  await logAudit({
    entidad: 'obra',
    entidadId: creada.id,
    accion: 'crear',
    after: creada as Record<string, unknown>,
    usuarioId: admin.id,
    descripcionHumana: `${admin.nombre} creó la obra ${creada.codigo}`,
  });

  revalidatePath('/obras');
  return { ok: true, id: creada.id };
}

export async function editarObra(id: string, input: ObraInput): Promise<Result> {
  const admin = await requireRole('admin');
  const parsed = obraInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const before = await getObra(id);
  if (!before) return { ok: false, error: 'Obra no encontrada' };

  const [after] = await db.update(obra).set({
    nombre: parsed.data.nombre,
    clienteNombre: parsed.data.clienteNombre,
    clienteEmail: parsed.data.clienteEmail ?? null,
    clienteTelefono: parsed.data.clienteTelefono ?? null,
    ubicacion: parsed.data.ubicacion ?? null,
    superficieM2: parsed.data.superficieM2 ?? null,
    fechaInicio: parsed.data.fechaInicio ?? null,
    fechaFinEstimada: parsed.data.fechaFinEstimada ?? null,
    monedaBase: parsed.data.monedaBase,
    cotizacionUsdInicial: parsed.data.cotizacionUsdInicial ?? null,
    porcentajeHonorarios: parsed.data.porcentajeHonorarios,
    updatedAt: new Date(),
    updatedBy: admin.id,
  }).where(eq(obra.id, id)).returning();

  await sincronizarParteDeObra(after.id, {
    nombre: after.nombre,
    codigo: after.codigo,
    activo: after.estado !== 'cancelada' && !after.deletedAt,
  });

  await logAudit({
    entidad: 'obra',
    entidadId: id,
    accion: 'editar',
    before: before as Record<string, unknown>,
    after: after as Record<string, unknown>,
    usuarioId: admin.id,
    descripcionHumana: `${admin.nombre} editó la obra ${after.codigo}`,
  });

  revalidatePath('/obras');
  revalidatePath(`/obras/${id}`);
  return { ok: true };
}

export async function eliminarObra(id: string): Promise<Result> {
  const admin = await requireRole('admin');
  const before = await getObra(id);
  if (!before) return { ok: false, error: 'Obra no encontrada' };

  await db.update(obra).set({
    deletedAt: new Date(),
    updatedBy: admin.id,
    updatedAt: new Date(),
  }).where(eq(obra.id, id));

  // Archivar la parte espejo (no la borramos por el audit log).
  await sincronizarParteDeObra(before.id, {
    nombre: before.nombre,
    codigo: before.codigo,
    activo: false,
  });

  await logAudit({
    entidad: 'obra',
    entidadId: id,
    accion: 'eliminar',
    before: before as Record<string, unknown>,
    usuarioId: admin.id,
    descripcionHumana: `${admin.nombre} eliminó la obra ${before.codigo}`,
  });

  revalidatePath('/obras');
  return { ok: true };
}

export async function regenerarTokenCliente(id: string): Promise<Result<{ token: string }>> {
  const admin = await requireRole('admin');
  const before = await getObra(id);
  if (!before) return { ok: false, error: 'Obra no encontrada' };

  const token = generarToken();
  await db.update(obra).set({
    clienteToken: token,
    updatedBy: admin.id,
    updatedAt: new Date(),
  }).where(eq(obra.id, id));

  await logAudit({
    entidad: 'cliente_token',
    entidadId: id,
    accion: 'regenerar_token',
    usuarioId: admin.id,
    descripcionHumana: `${admin.nombre} regeneró el link cliente de ${before.codigo}`,
  });

  revalidatePath(`/obras/${id}`);
  return { ok: true, token };
}
