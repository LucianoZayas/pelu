import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth/require';
import { listarConceptosActivos } from '@/features/conceptos-movimiento/queries';
import { listarCuentasActivas } from '@/features/cuentas/queries';
import { listarPartesActivas } from '@/features/partes/queries';
import { listarObras } from '@/features/obras/queries';
import { db } from '@/db/client';
import { proveedor } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { MovimientoFormStepper } from '@/features/movimientos/components/movimiento-form-stepper';
import { PageHeader } from '@/components/page-header';

type SearchParamsRaw = Promise<Record<string, string | string[] | undefined>>;

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function Page({ searchParams }: { searchParams: SearchParamsRaw }) {
  const user = await requireSession();
  if (user.rol !== 'admin' && user.rol !== 'operador') redirect('/obras');

  const sp = await searchParams;
  const obraIdPreset = asString(sp.obra);

  const [conceptos, cuentas, obras, partes, proveedores] = await Promise.all([
    listarConceptosActivos(),
    listarCuentasActivas(),
    listarObras(),
    listarPartesActivas(),
    db.select().from(proveedor).where(eq(proveedor.activo, true)).orderBy(asc(proveedor.nombre)),
  ]);

  // Si el query param trae una obra válida, la pre-seleccionamos.
  const obraIdInicial = obraIdPreset && obras.some((o) => o.id === obraIdPreset)
    ? obraIdPreset
    : undefined;

  return (
    <div className="px-8 py-7 max-w-[1280px]">
      <PageHeader
        kicker="Flujo de caja"
        title="Nuevo movimiento"
        description="Cargá un ingreso, egreso o transferencia. Los saldos se actualizan automáticamente."
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
        obraIdInicial={obraIdInicial}
      />
    </div>
  );
}
