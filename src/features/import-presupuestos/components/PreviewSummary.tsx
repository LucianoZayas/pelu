'use client';

import type { DescarteRow } from '@/../scripts/import-sheets/tipos';
import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Info,
} from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface Props {
  itemsImportados: number;
  itemsConWarning: number;
  totalProyectado: number;
  monedaBase: 'ARS' | 'USD';
  cotizacionDetectada: number | null;
  hojaParseada: string;
  descartes: DescarteRow[];
  rubrosDetectados: string[];
  rubrosNuevos: string[];
}

function groupByCategoria(descartes: DescarteRow[]) {
  const warning: DescarteRow[] = [];
  const informativo: DescarteRow[] = [];
  const estructural: DescarteRow[] = [];
  for (const d of descartes) {
    // Backwards-compat: descartes sin `categoria` cuentan como estructural
    const cat = d.categoria ?? 'estructural';
    if (cat === 'warning') warning.push(d);
    else if (cat === 'informativo') informativo.push(d);
    else estructural.push(d);
  }
  return { warning, informativo, estructural };
}

function summarizeByReason(
  rows: DescarteRow[],
): Array<{ razon: string; count: number; samples: string[] }> {
  const m = new Map<string, { count: number; samples: string[] }>();
  for (const r of rows) {
    let entry = m.get(r.razon);
    if (!entry) {
      entry = { count: 0, samples: [] };
      m.set(r.razon, entry);
    }
    entry.count += 1;
    if (r.detalle && entry.samples.length < 4 && !entry.samples.includes(r.detalle)) {
      entry.samples.push(r.detalle);
    }
  }
  return [...m.entries()]
    .map(([razon, { count, samples }]) => ({ razon, count, samples }))
    .sort((a, b) => b.count - a.count);
}

export function PreviewSummary({
  itemsImportados,
  itemsConWarning,
  totalProyectado,
  monedaBase,
  cotizacionDetectada,
  hojaParseada,
  descartes,
  rubrosNuevos,
}: Props) {
  const [showInformativo, setShowInformativo] = useState(false);
  const [showEstructural, setShowEstructural] = useState(false);

  const { warning, informativo, estructural } = useMemo(
    () => groupByCategoria(descartes),
    [descartes],
  );
  const informativoSummary = useMemo(() => summarizeByReason(informativo), [informativo]);
  const estructuralSummary = useMemo(() => summarizeByReason(estructural), [estructural]);

  const formattedTotal = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: monedaBase,
    maximumFractionDigits: 0,
  }).format(totalProyectado);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="size-5" />
          Resumen de la importación
        </CardTitle>
        <CardDescription>{hojaParseada}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Stats Grid — solo lo que se va a importar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <Check className="size-4 text-green-600" />
              <p className="text-2xl font-bold">{itemsImportados}</p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Ítems a importar
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <AlertTriangle className="size-4 text-yellow-600" />
              <p className="text-2xl font-bold">{itemsConWarning}</p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Con advertencia
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <p className="text-2xl font-bold">{rubrosNuevos.length}</p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Rubros nuevos
            </p>
          </div>
        </div>

        {/* Cotización */}
        {cotizacionDetectada === null ? (
          <Alert variant="default" className="bg-yellow-50 border-yellow-200">
            <AlertTriangle className="size-4 text-yellow-600 mr-2" />
            <AlertDescription className="text-yellow-800">
              No se detectó cotización USD en el Excel — completá el campo abajo
            </AlertDescription>
          </Alert>
        ) : (
          <div className="text-sm text-muted-foreground">
            Cotización detectada: 1 USD = {cotizacionDetectada} {monedaBase}
          </div>
        )}

        {/* Total Proyectado */}
        <div className="space-y-1">
          <p className="text-sm font-medium">Total proyectado</p>
          <p className="text-3xl font-bold">{formattedTotal}</p>
        </div>

        {/* Rubros nuevos */}
        {rubrosNuevos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Nuevos rubros a crear:
            </p>
            <div className="flex flex-wrap gap-2">
              {rubrosNuevos.map((rubro) => (
                <Badge key={rubro} variant="secondary">
                  Se va a crear: {rubro}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* ⚠️ WARNINGS — siempre visibles, prominentes */}
        {warning.length > 0 && (
          <Alert variant="default" className="bg-yellow-50 border-yellow-200">
            <AlertTriangle className="size-4 text-yellow-700 mr-2" />
            <AlertDescription className="text-yellow-900">
              <p className="font-semibold mb-2">
                {warning.length === 1
                  ? '1 fila requiere revisión'
                  : `${warning.length} filas requieren revisión`}
              </p>
              <ul className="space-y-1 text-xs">
                {warning.slice(0, 8).map((d) => (
                  <li key={`${d.filaExcel}-${d.razon}`}>
                    <span className="font-mono text-yellow-700">fila {d.filaExcel}</span>{' '}
                    — {d.razon}
                    {d.detalle ? (
                      <span className="text-yellow-800/80"> · "{d.detalle.slice(0, 60)}"</span>
                    ) : null}
                  </li>
                ))}
                {warning.length > 8 && (
                  <li className="text-yellow-800/70">
                    ... y {warning.length - 8} más
                  </li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* ℹ️ INFORMATIVO + ESTRUCTURAL — colapsado por default */}
        {(informativo.length > 0 || estructural.length > 0) && (
          <div className="space-y-3 border-t pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="size-3.5" aria-hidden />
              Filas que no se importan (esperado por el formato del Excel):
            </p>

            {informativo.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowInformativo((v) => !v)}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showInformativo ? (
                    <ChevronDown className="size-3.5" aria-hidden />
                  ) : (
                    <ChevronRight className="size-3.5" aria-hidden />
                  )}
                  <span>
                    {informativo.length} {informativo.length === 1 ? 'subtotal/total/planilla' : 'subtotales / totales / planillas'}
                  </span>
                </button>
                {showInformativo && (
                  <ul className="mt-2 ml-5 space-y-1 text-xs text-muted-foreground">
                    {informativoSummary.map((s) => (
                      <li key={s.razon}>
                        <span className="font-mono">{s.count}×</span> {s.razon}
                        {s.count > 1 && s.samples.length > 0 && (
                          <span className="text-muted-foreground/70">
                            {' '}
                            · {s.samples.slice(0, 3).map((x) => `"${x.slice(0, 30)}"`).join(', ')}
                            {s.samples.length > 3 ? '…' : ''}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {estructural.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowEstructural((v) => !v)}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showEstructural ? (
                    <ChevronDown className="size-3.5" aria-hidden />
                  ) : (
                    <ChevronRight className="size-3.5" aria-hidden />
                  )}
                  <span>
                    {estructural.length} {estructural.length === 1 ? 'fila estructural' : 'filas estructurales'} (headers, placeholders, descripciones consolidadas)
                  </span>
                </button>
                {showEstructural && (
                  <ul className="mt-2 ml-5 space-y-1 text-xs text-muted-foreground">
                    {estructuralSummary.map((s) => (
                      <li key={s.razon}>
                        <span className="font-mono">{s.count}×</span> {s.razon}
                        {s.count > 1 && s.samples.length > 0 && (
                          <span className="text-muted-foreground/70">
                            {' '}
                            · {s.samples.slice(0, 3).map((x) => `"${x.slice(0, 30)}"`).join(', ')}
                            {s.samples.length > 3 ? '…' : ''}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
