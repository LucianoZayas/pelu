import { requireRole } from '@/lib/auth/require';
import { listarCuentasConSaldo } from '@/features/cuentas/queries';
import { CuentasManager } from '@/features/cuentas/components/cuentas-manager';
import { PageHeader } from '@/components/page-header';

export default async function Page() {
  await requireRole('admin');
  const cuentas = await listarCuentasConSaldo();
  return (
    <div className="px-8 py-7 max-w-[1080px]">
      <PageHeader
        kicker="Configuración"
        title="Cuentas"
        description="Cajas y bancos que usás para registrar movimientos. El saldo se calcula a partir de los movimientos confirmados."
      />
      <CuentasManager cuentas={cuentas} />
    </div>
  );
}
