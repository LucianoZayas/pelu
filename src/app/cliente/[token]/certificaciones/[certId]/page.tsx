import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getObraByToken } from '@/lib/auth/cliente-token';
import {
  obtenerCertificacionConPresupuesto,
  listarAvancesDeCertificacion,
} from '@/features/certificaciones/queries';
import { D } from '@/lib/money/decimal';

export default async function Page({
  params,
}: {
  params: Promise<{ token: string; certId: string }>;
}) {
  const { token, certId } = await params;
  const obra = await getObraByToken(token);
  if (!obra) notFound();

  const detail = await obtenerCertificacionConPresupuesto(certId);
  if (!detail || detail.obra.id !== obra.id) notFound();

  // Solo certificaciones emitidas o cobradas son visibles al cliente.
  if (detail.cert.estado !== 'emitida' && detail.cert.estado !== 'cobrada') {
    notFound();
  }

  const avances = await listarAvancesDeCertificacion(certId);

  const { cert } = detail;
  const subtotalNeto = D(cert.totalNeto);
  const totalHonorarios = D(cert.totalHonorarios);
  const totalGeneral = D(cert.totalGeneral);

  return (
    <article>
      <Link
        href={`/cliente/${token}`}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-3 transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Volver
      </Link>

      <div className="mb-6 rounded-xl border bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 mb-1">
          Certificación N° {cert.numero}
        </p>
        <h2 className="text-[22px] font-semibold tracking-tight text-foreground">
          {cert.descripcion ?? `Avance de obra al ${cert.fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}`}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground capitalize">
          Estado: {cert.estado}
        </p>
      </div>

      {/* Tabla de avances */}
      <div className="rounded-xl border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden mb-6">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b bg-[#F8F9FB]">
              <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">Item</th>
              <th className="text-right px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 w-24">% Ant.</th>
              <th className="text-right px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 w-24">% Acum.</th>
              <th className="text-right px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 w-36">Monto certificado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {avances.map((a) => {
              if (Number(a.montoNetoFacturado) === 0) return null;
              return (
                <tr key={a.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{a.itemDescripcion}</div>
                    {a.rubroNombre && (
                      <div className="text-[10.5px] text-muted-foreground">{a.rubroNombre}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{Number(a.porcentajeAnterior).toFixed(1)}%</td>
                  <td className="px-4 py-2.5 text-right font-mono">{Number(a.porcentajeAcumulado).toFixed(1)}%</td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {D(a.montoNetoFacturado).toFixed(2)} {cert.moneda}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Desglose final */}
      <div className="flex justify-end mb-6">
        <div className="rounded-xl border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden min-w-[320px]">
          <div className="px-6 py-3 flex justify-between border-b text-[13px]">
            <span className="text-muted-foreground">Subtotal items certificados</span>
            <span className="font-mono">{subtotalNeto.toFixed(2)} {cert.moneda}</span>
          </div>
          <div className="px-6 py-3 flex justify-between border-b text-[13px]">
            <span className="text-muted-foreground">Honorarios profesionales</span>
            <span className="font-mono">{totalHonorarios.toFixed(2)} {cert.moneda}</span>
          </div>
          <div className="px-6 py-4 flex justify-between items-baseline bg-secondary/30">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
              Total a facturar
            </span>
            <span className="font-mono text-[24px] font-bold tracking-tight text-foreground">
              {totalGeneral.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
