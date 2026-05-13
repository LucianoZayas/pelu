'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface MetadatosObraValues {
  codigoObra: string;
  nombreObra: string;
  clienteNombre: string;
  porcentajeHonorarios: string;
  cotizacionUsd: string;
  monedaBase: 'ARS' | 'USD';
  markupDefaultPorcentaje: string;
}

interface Props {
  initialValues: Partial<MetadatosObraValues>;
  onChange: (values: MetadatosObraValues) => void;
  disabled?: boolean;
  cotizacionWarning?: string;
}

const DEFAULTS: MetadatosObraValues = {
  codigoObra: '',
  nombreObra: '',
  clienteNombre: '',
  porcentajeHonorarios: '16',
  cotizacionUsd: '',
  monedaBase: 'ARS',
  markupDefaultPorcentaje: '30',
};

export function FormMetadatosObra({ initialValues, onChange, disabled = false, cotizacionWarning }: Props) {
  const [state, setState] = useState<MetadatosObraValues>({
    ...DEFAULTS,
    ...initialValues,
  });

  const handleChange = (key: keyof MetadatosObraValues, value: string) => {
    const nextState = { ...state, [key]: value };
    setState(nextState);
    onChange(nextState);
  };

  return (
    <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Código de obra */}
      <div>
        <Label htmlFor="codigoObra">
          Código de obra
          <span className="text-destructive">*</span>
        </Label>
        <Input
          id="codigoObra"
          value={state.codigoObra}
          onChange={(e) => handleChange('codigoObra', e.target.value)}
          disabled={disabled}
          placeholder="Ej: OBR-001"
        />
      </div>

      {/* Nombre de la obra */}
      <div>
        <Label htmlFor="nombreObra">
          Nombre de la obra
          <span className="text-destructive">*</span>
        </Label>
        <Input
          id="nombreObra"
          value={state.nombreObra}
          onChange={(e) => handleChange('nombreObra', e.target.value)}
          disabled={disabled}
          placeholder="Ej: Remodelación de cocina"
        />
      </div>

      {/* Cliente */}
      <div>
        <Label htmlFor="clienteNombre">
          Cliente
          <span className="text-destructive">*</span>
        </Label>
        <Input
          id="clienteNombre"
          value={state.clienteNombre}
          onChange={(e) => handleChange('clienteNombre', e.target.value)}
          disabled={disabled}
          placeholder="Ej: Juan Pérez"
        />
      </div>

      {/* Honorarios (%) */}
      <div>
        <Label htmlFor="porcentajeHonorarios">
          Honorarios (%)
          <span className="text-destructive">*</span>
        </Label>
        <Input
          id="porcentajeHonorarios"
          type="number"
          inputMode="decimal"
          step="0.01"
          value={state.porcentajeHonorarios}
          onChange={(e) => handleChange('porcentajeHonorarios', e.target.value)}
          disabled={disabled}
          placeholder="16"
        />
      </div>

      {/* Cotización USD/ARS */}
      <div>
        <Label htmlFor="cotizacionUsd">
          Cotización USD/ARS
          <span className="text-destructive">*</span>
        </Label>
        <Input
          id="cotizacionUsd"
          type="number"
          inputMode="decimal"
          step="0.0001"
          value={state.cotizacionUsd}
          onChange={(e) => handleChange('cotizacionUsd', e.target.value)}
          disabled={disabled}
          placeholder="Ej: 1000"
        />
        {cotizacionWarning && (
          <p className="mt-1 text-xs text-destructive">{cotizacionWarning}</p>
        )}
      </div>

      {/* Moneda base */}
      <div>
        <Label htmlFor="monedaBase">
          Moneda base
          <span className="text-destructive">*</span>
        </Label>
        <Select value={state.monedaBase} onValueChange={(value) => handleChange('monedaBase', value as 'ARS' | 'USD')} disabled={disabled}>
          <SelectTrigger id="monedaBase" disabled={disabled}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ARS">ARS</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Markup default (%) */}
      <div>
        <Label htmlFor="markupDefaultPorcentaje">
          Markup default (%)
        </Label>
        <Input
          id="markupDefaultPorcentaje"
          type="number"
          inputMode="decimal"
          step="0.01"
          value={state.markupDefaultPorcentaje}
          onChange={(e) => handleChange('markupDefaultPorcentaje', e.target.value)}
          disabled={disabled}
          placeholder="30"
        />
      </div>
    </form>
  );
}
