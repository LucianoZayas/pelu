import { z } from 'zod';

export const rubroInputSchema = z.object({
  nombre: z.string().min(1).max(120),
  idPadre: z.string().uuid().nullable().optional(),
  orden: z.number().int().min(0).default(0),
  activo: z.boolean().default(true),
});
export type RubroInput = z.infer<typeof rubroInputSchema>;
