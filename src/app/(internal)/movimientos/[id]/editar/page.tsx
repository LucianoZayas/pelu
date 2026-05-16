import { notFound, redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth/require';
import { listarConceptosActivos } from '@/features/conceptos-movimiento/queries';
import { listarCuentasActivas } from '@/features/cuentas/queries';
import { listarPartesActivas } from '@/features/partes/queries';
import { listarObras } from '@/features/obras/queries';
import { obtenerMovimiento } from '@/features/movimientos/queries';
import { db } from '@/db/client';
import { proveedor } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import {
  MovimientoFormStepper,
  type MovimientoInitialValues,
} from '@/features/movimientos/components/movimiento-form-stepper';
import { PageHeader } from '@/components/page-header';

function isoDate(d: Date | string | null): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;

  const mov = await obtenerMovimiento(id);
  if (!mov) notFound();
  if (mov.estado === 'anulado') {
    // No se edita un anulado; redirigir al detalle.
    redirect(`/movimientos/${id}`);
  }
  // Operador solo puede editar lo propio (mismo guard que la action).
  if (user.rol !== 'admin' && mov.createdBy !== user.id) {
    redirect(`/movimientos/${id}`);
  }

  const [conceptos, cuentas, obras, partes, proveedores] = await Promise.all([
    listarConceptosActivos(),
    listarCuentasActivas(),
    listarObras(),
    listarPartesActivas(),
    db.select().from(proveedor).where(eq(proveedor.activo, true)).orderBy(asc(proveedor.nombre)),
  ]);

  const initial: MovimientoInitialValues = {
    id: mov.id,
    version: mov.version,
    tipoOp: mov.tipo,
    conceptoId: mov.conceptoId ?? '',
    fecha: isoDate(mov.fecha),
    cuentaId: mov.cuentaId ?? '',
    cuentaDestinoId: mov.cuentaDestinoId ?? '',
    monto: mov.monto ?? '',
    montoDestino: mov.montoDestino ?? '',
    cotizacion: mov.cotizacionUsd ?? '',
    obraId: mov.obraId ?? '',
    proveedorId: mov.proveedorId ?? '',
    parteOrigenId: mov.parteOrigenId ?? '',
    parteDestinoId: mov.parteDestinoId ?? '',
    descripcion: mov.descripcion ?? '',
    numeroComprobante: mov.numeroComprobante ?? '',
    esNoRecuperable: mov.esNoRecuperable,
  };

  return (
    <div className="px-8 py-7 max-w-[1280px]">
      <PageHeader
        kicker="Flujo de caja · Edición"
        title="Editar movimiento"
        description="Modificá los datos del movimiento. La cuenta y el tipo no se pueden cambiar; si necesitás cambiar el tipo, anulá este movimiento y cargá uno nuevo."
      />
      <MovimientoFormStepper
        conceptos={conceptos.map((c) => ({
          id: c.id,
          codigo: c.codigo,
          nombre: c.nombre,
          tipo: c.tipo,
          requiereObra: c.requiereObra,
          requiereProveedor: c.requiereProveedor,
          esNoRecuperable: c.esNoRecuperable,
        }))}
        cuentas={cuentas.map((c) => ({ id: c.id, nombre: c.nombre, moneda: c.moneda, tipo: c.tipo }))}
        obras={obras.map((o) => ({ id: o.id, codigo: o.codigo, nombre: o.nombre }))}
        partes={partes.map((p) => ({ id: p.id, nombre: p.nombre, tipo: p.tipo }))}
        proveedores={proveedores.map((p) => ({ id: p.id, nombre: p.nombre }))}
        edit={initial}
      />
    </div>
  );
}
