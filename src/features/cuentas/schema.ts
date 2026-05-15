import { z } from 'zod';

export const cuentaInputSchema = z.object({
  nombre: z.string().min(1).max(120),
  moneda: z.enum(['USD', 'ARS']),
  tipo: z.enum(['caja', 'banco']),
  orden: z.number().int().min(0).default(0),
  notas: z.string().max(500).nullable().optional(),
  activo: z.boolean().default(true),
});

export type CuentaInput = z.infer<typeof cuentaInputSchema>;
