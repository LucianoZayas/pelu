'use client';

import type { DescarteRow } from '@/../scripts/import-sheets/tipos';
import { useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
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

export function PreviewSummary({
  itemsImportados,
  itemsConWarning,
  totalProyectado,
  monedaBase,
  cotizacionDetectada,
  hojaParseada,
  descartes,
  rubrosDetectados,
  rubrosNuevos,
}: Props) {
  const [isDescarteExpanded, setIsDescarteExpanded] = useState(false);

  const descartesCount = descartes.length;
  const itemsDescartados = descartesCount;

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

      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          {/* Ítems Importados */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <Check className="size-4 text-green-600" />
              <p className="text-2xl font-bold">{itemsImportados}</p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Ítems importados
            </p>
          </div>

          {/* Con Warning */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <AlertCircle className="size-4 text-yellow-600" />
              <p className="text-2xl font-bold">{itemsConWarning}</p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Con advertencia
            </p>
          </div>

          {/* Descartados */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <p className="text-2xl font-bold">{itemsDescartados}</p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Descartados
            </p>
          </div>

          {/* Rubros Nuevos */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <p className="text-2xl font-bold">{rubrosNuevos.length}</p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Rubros nuevos
            </p>
          </div>
        </div>

        {/* Cotización Alert */}
        {cotizacionDetectada === null ? (
          <Alert variant="default" className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="size-4 text-yellow-600 mr-2" />
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

        {/* Rubros Nuevos Badges */}
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

        {/* Expandable Descartes */}
        {descartesCount > 0 && (
          <div className="space-y-2 border-t pt-4">
            <button
              onClick={() => setIsDescarteExpanded(!isDescarteExpanded)}
              className="flex items-center gap-2 text-sm font-medium hover:text-foreground/80"
            >
              {isDescarteExpanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
              Ver {descartesCount} {descartesCount === 1 ? 'fila descartada' : 'filas descartadas'}
            </button>

            {isDescarteExpanded && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {descartes.slice(0, 20).map((row) => (
                  <li key={`${row.filaExcel}-${row.razon}`}>
                    r{row.filaExcel} — {row.razon}
                    {row.detalle && ` · "${row.detalle.slice(0, 60)}"`}
                  </li>
                ))}
                {descartesCount > 20 && (
                  <li className="text-muted-foreground/70">
                    ... y {descartesCount - 20} más
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
