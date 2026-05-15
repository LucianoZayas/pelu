import {
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Calendar, Wallet, Building2,
  User, FileText, AlertCircle, Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatMoney, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export type PreviewData = {
  tipoOperacion: 'entrada' | 'salida' | 'transferencia' | null;
  conceptoNombre: string | null;
  conceptoCodigo: string | null;
  fecha: string;
  cuentaNombre: string | null;
  cuentaMoneda: 'USD' | 'ARS' | null;
  cuentaDestinoNombre: string | null;
  cuentaDestinoMoneda: 'USD' | 'ARS' | null;
  monto: string;
  montoDestino: string;
  cotizacion: string;
  obraNombre: string | null;
  obraCodigo: string | null;
  proveedorNombre: string | null;
  parteNombre: string | null;
  descripcion: string;
  numeroComprobante: string;
  esNoRecuperable: boolean;
};

const TIPO_META = {
  entrada: { Icon: ArrowDownToLine, label: 'Ingreso', tone: 'border-emerald-300 bg-emerald-50 text-emerald-800', barTone: 'bg-emerald-500' },
  salida: { Icon: ArrowUpFromLine, label: 'Egreso', tone: 'border-red-300 bg-red-50 text-red-800', barTone: 'bg-red-500' },
  transferencia: { Icon: ArrowLeftRight, label: 'Transferencia', tone: 'border-blue-300 bg-blue-50 text-blue-800', barTone: 'bg-blue-500' },
};

export function MovimientoPreview({ data, missingRequired }: { data: PreviewData; missingRequired: string[] }) {
  const isTransfer = data.tipoOperacion === 'transferencia';

  if (!data.tipoOperacion) {
    return (
      <div className="rounded-xl border bg-card p-5 sticky top-7 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-3">
          Vista previa
        </div>
        <div className="text-[13px] text-muted-foreground text-center py-8">
          Elegí el tipo de movimiento para empezar.
        </div>
      </div>
    );
  }

  const meta = TIPO_META[data.tipoOperacion];
  const Icon = meta.Icon;
  const montoNum = Number(data.monto);
  const tieneMonto = montoNum > 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden sticky top-7 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
      <div className={cn('h-1', meta.barTone)} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Vista previa
          </span>
          <Badge variant="outline" className={cn('font-normal gap-1', meta.tone)}>
            <Icon className="size-3" aria-hidden />
            {meta.label}
          </Badge>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-[10.5px] text-muted-foreground uppercase tracking-[0.06em] mb-0.5">Monto</div>
            <div className={cn(
              'text-[22px] font-semibold font-mono tabular-nums leading-tight',
              !tieneMonto && 'text-muted-foreground/50',
            )}>
              {tieneMonto && data.cuentaMoneda
                ? formatMoney(montoNum, data.cuentaMoneda)
                : '—'}
            </div>
            {isTransfer && data.cuentaDestinoMoneda && data.cuentaDestinoMoneda !== data.cuentaMoneda && (
              <div className="mt-1 text-[12px] text-muted-foreground">
                → {Number(data.montoDestino) > 0 ? formatMoney(data.montoDestino, data.cuentaDestinoMoneda) : '—'}
                {data.cotizacion && <span className="ml-2 font-mono">@ {data.cotizacion}</span>}
              </div>
            )}
          </div>

          {data.conceptoNombre && (
            <Row icon={FileText} label="Concepto">
              <span className="text-[13px] font-medium">{data.conceptoNombre}</span>
              {data.conceptoCodigo && (
                <span className="font-mono text-[10.5px] text-muted-foreground ml-1.5">{data.conceptoCodigo}</span>
              )}
            </Row>
          )}

          <Row icon={Calendar} label="Fecha">
            {data.fecha ? formatDate(data.fecha) : '—'}
          </Row>

          {data.cuentaNombre && (
            <Row icon={Wallet} label={isTransfer ? 'Origen' : (data.tipoOperacion === 'entrada' ? 'Cuenta destino' : 'Cuenta origen')}>
              {data.cuentaNombre}
              {data.cuentaMoneda && <span className="font-mono text-[10.5px] text-muted-foreground ml-1.5">{data.cuentaMoneda}</span>}
            </Row>
          )}

          {isTransfer && data.cuentaDestinoNombre && (
            <Row icon={Wallet} label="Destino">
              {data.cuentaDestinoNombre}
              {data.cuentaDestinoMoneda && <span className="font-mono text-[10.5px] text-muted-foreground ml-1.5">{data.cuentaDestinoMoneda}</span>}
            </Row>
          )}

          {data.obraNombre && (
            <Row icon={Building2} label="Obra">
              {data.obraCodigo && <span className="font-mono text-[10.5px] text-muted-foreground mr-1">{data.obraCodigo}</span>}
              {data.obraNombre}
            </Row>
          )}

          {data.proveedorNombre && (
            <Row icon={User} label="Proveedor">
              {data.proveedorNombre}
            </Row>
          )}

          {data.parteNombre && (
            <Row icon={User} label={data.tipoOperacion === 'entrada' ? 'De' : 'A'}>
              {data.parteNombre}
            </Row>
          )}

          {data.numeroComprobante && (
            <Row icon={FileText} label="N° comprobante">
              <span className="font-mono">{data.numeroComprobante}</span>
            </Row>
          )}

          {data.descripcion && (
            <Row icon={FileText} label="Notas">
              <span className="text-[12.5px] text-muted-foreground line-clamp-3">{data.descripcion}</span>
            </Row>
          )}

          {data.esNoRecuperable && (
            <Badge variant="outline" className="font-normal border-orange-300 bg-orange-50 text-orange-800 mt-1">
              Gasto no recuperable
            </Badge>
          )}
        </div>

        {missingRequired.length > 0 ? (
          <div className="mt-4 pt-3 border-t">
            <div className="text-[11px] font-medium text-amber-700 mb-1.5 flex items-center gap-1">
              <AlertCircle className="size-3" aria-hidden /> Falta completar:
            </div>
            <ul className="text-[12px] text-amber-700/90 space-y-0.5">
              {missingRequired.map((m) => (
                <li key={m} className="flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-amber-500" aria-hidden />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        ) : data.cuentaNombre && tieneMonto && (
          <div className="mt-4 pt-3 border-t text-[11.5px] text-emerald-700 flex items-center gap-1.5">
            <Check className="size-3" aria-hidden />
            Listo para guardar.
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  icon: Icon, label, children,
}: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="size-3.5 text-muted-foreground/60 mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] text-muted-foreground uppercase tracking-[0.06em] mb-0.5">{label}</div>
        <div className="text-[13px] text-foreground">{children}</div>
      </div>
    </div>
  );
}
