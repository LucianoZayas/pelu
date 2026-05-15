import { z } from 'zod';

export const conceptoMovimientoInputSchema = z.object({
  codigo: z.string().min(1).max(60).regex(/^[A-Z][A-Z0-9_]*$/, {
    message: 'El código debe estar en MAYÚSCULAS, sin espacios. Ej: HO, MO_BENEFICIO.',
  }),
  nombre: z.string().min(1).max(120),
  tipo: z.enum(['ingreso', 'egreso', 'transferencia']),
  requiereObra: z.boolean().default(false),
  requiereProveedor: z.boolean().default(false),
  esNoRecuperable: z.boolean().default(false),
  orden: z.number().int().min(0).default(0),
  activo: z.boolean().default(true),
});

export type ConceptoMovimientoInput = z.infer<typeof conceptoMovimientoInputSchema>;
