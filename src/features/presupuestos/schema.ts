import { z } from 'zod';

const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/);

export const itemInputSchema = z.object({
  id: z.string().uuid().optional(),
  rubroId: z.string().uuid(),
  orden: z.number().int().min(0),
  descripcion: z.string().min(1).max(500),
  unidad: z.enum(['m2', 'm3', 'hs', 'gl', 'u', 'ml', 'kg']),
  cantidad: decimalString,
  costoUnitario: decimalString,
  costoUnitarioMoneda: z.enum(['USD', 'ARS']),
  markupPorcentaje: decimalString.nullable(),
  notas: z.string().max(1000).nullable(),
});
export type ItemInput = z.infer<typeof itemInputSchema>;

export const nuevoPresupuestoSchema = z.object({
  obraId: z.string().uuid(),
  tipo: z.enum(['original', 'adicional']),
  descripcion: z.string().max(500).nullable(),
  markupDefaultPorcentaje: decimalString.default('30'),
  cotizacionUsd: decimalString,
});
export type NuevoPresupuestoInput = z.infer<typeof nuevoPresupuestoSchema>;

export const guardarPresupuestoSchema = z.object({
  presupuestoId: z.string().uuid(),
  version: z.number().int().min(1),
  descripcion: z.string().max(500).nullable(),
  markupDefaultPorcentaje: decimalString,
  cotizacionUsd: decimalString,
  items: z.array(itemInputSchema),
});
export type GuardarPresupuestoInput = z.infer<typeof guardarPresupuestoSchema>;
