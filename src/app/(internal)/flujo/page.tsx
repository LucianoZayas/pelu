import { requireSession } from '@/lib/auth/require';
import { PageHeader } from '@/components/page-header';

export default async function Page() {
  await requireSession();
  return (
    <div className="px-8 py-7 max-w-[1400px]">
      <PageHeader
        kicker="Flujo de caja"
        title="Dashboard"
        description="Vista panorámica del flujo de caja: KPIs, gráfico, breakdown por concepto, actividad reciente."
      />
      <div className="rounded-xl border bg-card px-6 py-12 text-center text-muted-foreground">
        Dashboard en construcción (Fase 3 del plan UX).
      </div>
    </div>
  );
}
