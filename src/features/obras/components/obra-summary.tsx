import { EstadoBadge } from '@/components/estado-badge';

interface ObraFields {
  codigo: string;
  nombre: string;
  clienteNombre: string;
  estado: string;
  monedaBase: string;
  fechaInicio?: Date | null;
  porcentajeHonorarios?: string | null;
  cotizacionUsdInicial?: string | null;
}

interface MetricProps {
  label: string;
  value: React.ReactNode;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
        {label}
      </span>
      <span className="text-[14px] font-semibold text-foreground leading-snug">{value}</span>
    </div>
  );
}

export function ObraSummary({ obra }: { obra: ObraFields }) {
  const fechaInicioFmt = obra.fechaInicio
    ? new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(obra.fechaInicio)
    : '—';

  return (
    <div className="mb-6 rounded-xl border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.08)] p-5">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
        <Metric label="Cliente" value={obra.clienteNombre} />
        <Metric label="Moneda" value={obra.monedaBase} />
        <Metric label="Fecha inicio" value={fechaInicioFmt} />
        <Metric
          label="Honorarios"
          value={
            obra.porcentajeHonorarios != null
              ? `${obra.porcentajeHonorarios}%`
              : '—'
          }
        />
        <Metric
          label="Cotización USD inicial"
          value={
            obra.cotizacionUsdInicial != null
              ? `$${parseFloat(obra.cotizacionUsdInicial).toLocaleString('es-AR')}`
              : '—'
          }
        />
        <Metric
          label="Estado"
          value={<EstadoBadge estado={obra.estado} />}
        />
      </div>
    </div>
  );
}
