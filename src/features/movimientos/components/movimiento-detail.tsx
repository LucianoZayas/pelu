import Link from 'next/link';
import {
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Calendar, Wallet, Building2,
  User, FileText, AlertCircle, ExternalLink, History,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatMoney, formatDate, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { MovimientoRow } from '../queries';
import type { AuditLogRow } from '@/features/audit/queries';

const TIPO_META = {
  entrada: { Icon: ArrowDownToLine, label: 'Ingreso', tone: 'border-emerald-300 bg-emerald-50 text-emerald-800', barTone: 'bg-emerald-500' },
  salida: { Icon: ArrowUpFromLine, label: 'Egreso', tone: 'border-red-300 bg-red-50 text-red-800', barTone: 'bg-red-500' },
  transferencia: { Icon: ArrowLeftRight, label: 'Transferencia', tone: 'border-blue-300 bg-blue-50 text-blue-800', barTone: 'bg-blue-500' },
};

const ACCION_LABEL: Record<string, string> = {
  crear: 'Creó',
  editar: 'Editó',
  eliminar: 'Eliminó',
  anular: 'Anuló',
  restaurar: 'Restauró',
  firmar: 'Firmó',
  cancelar: 'Canceló',
  regenerar_token: 'Regeneró token',
};

export function MovimientoDetail({
  mov,
  auditEntries,
}: {
  mov: MovimientoRow;
  auditEntries: AuditLogRow[];
}) {
  const meta = TIPO_META[mov.tipo];
  const Icon = meta.Icon;
  const isAnulado = mov.estado === 'anulado';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      {/* Main card */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
        <div className={cn('h-1', meta.barTone)} />
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-2">
            <Badge variant="outline" className={cn('font-normal gap-1', meta.tone)}>
              <Icon className="size-3" aria-hidden />
              {meta.label}
            </Badge>
            {isAnulado ? (
              <Badge variant="outline" className="font-normal border-red-300 bg-red-50 text-red-800">
                Anulado
              </Badge>
            ) : mov.estado === 'previsto' ? (
              <Badge variant="outline" className="font-normal border-amber-300 bg-amber-50 text-amber-800">
                Previsto
              </Badge>
            ) : (
              <Badge variant="outline" className="font-normal border-emerald-300 bg-emerald-50 text-emerald-800">
                Confirmado
              </Badge>
            )}
          </div>

          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-[0.06em] mb-1">Monto</div>
            <div className={cn(
              'text-[32px] font-semibold font-mono tabular-nums leading-tight',
              isAnulado && 'line-through text-muted-foreground',
            )}>
              {mov.tipo === 'salida' ? '−' : mov.tipo === 'entrada' ? '+' : ''}{formatMoney(mov.monto, mov.moneda)}
            </div>
            {mov.tipo === 'transferencia' && mov.montoDestino && mov.cuentaDestinoMoneda && mov.cuentaDestinoMoneda !== mov.moneda && (
              <div className="mt-1 text-[14px] text-muted-foreground">
                → {formatMoney(mov.montoDestino, mov.cuentaDestinoMoneda)}
                {mov.cotizacionUsd && <span className="ml-2 font-mono text-[12px]">@ {mov.cotizacionUsd}</span>}
              </div>
            )}
          </div>

          {isAnulado && mov.anuladoMotivo && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800 flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden />
              <div>
                <div className="font-medium">Motivo de anulación</div>
                <div className="opacity-90">{mov.anuladoMotivo}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-2">
            <Row icon={FileText} label="Concepto">
              <span className="font-medium">{mov.conceptoNombre ?? '—'}</span>
              {mov.conceptoCodigo && (
                <span className="font-mono text-[11px] text-muted-foreground ml-1.5">{mov.conceptoCodigo}</span>
              )}
            </Row>
            <Row icon={Calendar} label="Fecha">{formatDate(mov.fecha)}</Row>
            <Row icon={Wallet} label={mov.tipo === 'transferencia' ? 'Cuenta origen' : 'Cuenta'}>
              {mov.cuentaNombre ?? '—'}
              {mov.cuentaMoneda && (
                <span className="font-mono text-[11px] text-muted-foreground ml-1.5">{mov.cuentaMoneda}</span>
              )}
            </Row>
            {mov.cuentaDestinoNombre && (
              <Row icon={Wallet} label="Cuenta destino">
                {mov.cuentaDestinoNombre}
                {mov.cuentaDestinoMoneda && (
                  <span className="font-mono text-[11px] text-muted-foreground ml-1.5">{mov.cuentaDestinoMoneda}</span>
                )}
              </Row>
            )}
            {mov.obraNombre && (
              <Row icon={Building2} label="Obra">
                <Link href={`/obras/${mov.obraId}`} className="hover:underline">
                  {mov.obraCodigo && <span className="font-mono text-[11px] text-muted-foreground mr-1.5">{mov.obraCodigo}</span>}
                  {mov.obraNombre}
                </Link>
              </Row>
            )}
            {mov.proveedorNombre && (
              <Row icon={User} label="Proveedor">{mov.proveedorNombre}</Row>
            )}
            {mov.parteOrigenNombre && (
              <Row icon={User} label="Origen">{mov.parteOrigenNombre}</Row>
            )}
            {mov.parteDestinoNombre && (
              <Row icon={User} label="Destino">{mov.parteDestinoNombre}</Row>
            )}
            {mov.numeroComprobante && (
              <Row icon={FileText} label="N° comprobante">
                <span className="font-mono">{mov.numeroComprobante}</span>
              </Row>
            )}
          </div>

          {mov.descripcion && (
            <div className="pt-3 border-t">
              <div className="text-[11px] text-muted-foreground uppercase tracking-[0.06em] mb-1">Notas</div>
              <div className="text-[13.5px] text-foreground whitespace-pre-wrap">{mov.descripcion}</div>
            </div>
          )}

          {mov.comprobanteUrl && (
            <div className="pt-3 border-t">
              <a
                href={mov.comprobanteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                Ver comprobante adjunto
              </a>
            </div>
          )}

          {mov.esNoRecuperable && (
            <Badge variant="outline" className="font-normal border-orange-300 bg-orange-50 text-orange-800">
              Gasto no recuperable — absorbido por la empresa
            </Badge>
          )}

          <div className="pt-3 border-t text-[11.5px] text-muted-foreground">
            Cargado por {mov.createdByNombre ?? 'usuario eliminado'} · {formatRelativeTime(mov.createdAt)}
            <span className="ml-3 font-mono">v{mov.version}</span>
          </div>
        </div>
      </div>

      {/* Audit log sidebar */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] h-fit lg:sticky lg:top-7">
        <div className="px-5 py-3 border-b bg-muted/30 flex items-center gap-2">
          <History className="size-3.5 text-muted-foreground" aria-hidden />
          <h3 className="text-[13px] font-semibold">Historial</h3>
        </div>
        {auditEntries.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12.5px] text-muted-foreground">
            Sin eventos registrados.
          </div>
        ) : (
          <ol className="divide-y">
            {auditEntries.map((e) => (
              <li key={e.id} className="px-5 py-3">
                <div className="flex items-start gap-2.5">
                  <span className={cn(
                    'mt-1 size-2 rounded-full shrink-0',
                    e.accion === 'anular' ? 'bg-red-500' :
                    e.accion === 'restaurar' ? 'bg-emerald-500' :
                    e.accion === 'crear' ? 'bg-primary' :
                    'bg-muted-foreground/40',
                  )} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px]">
                      <span className="font-medium">{ACCION_LABEL[e.accion] ?? e.accion}</span>
                      <span className="text-muted-foreground"> por {e.usuarioNombre ?? e.usuarioEmail ?? '—'}</span>
                    </div>
                    {e.descripcionHumana && (
                      <div className="text-[11.5px] text-muted-foreground mt-0.5 italic">
                        {e.descripcionHumana}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground/70 mt-1">
                      {formatRelativeTime(e.timestamp)} · {formatDate(e.timestamp, { withTime: true })}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Row({
  icon: Icon, label, children,
}: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="size-3.5 text-muted-foreground/60 mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] text-muted-foreground uppercase tracking-[0.06em] mb-0.5">{label}</div>
        <div className="text-[13.5px] text-foreground">{children}</div>
      </div>
    </div>
  );
}
