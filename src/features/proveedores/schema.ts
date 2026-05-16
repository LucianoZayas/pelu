import { z } from 'zod';

export const proveedorInputSchema = z.object({
  nombre: z.string().min(1).max(160),
  cuit: z.string().max(20).optional().nullable(),
  contacto: z.string().max(200).optional().nullable(),
  esContratista: z.boolean().default(false),
  activo: z.boolean().default(true),
});

export type ProveedorInput = z.infer<typeof proveedorInputSchema>;
