import { z } from 'zod';

export const obraInputSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(200),
  clienteNombre: z.string().min(1, 'Cliente requerido').max(200),
  clienteEmail: z.string().email().nullable().optional(),
  clienteTelefono: z.string().max(50).nullable().optional(),
  ubicacion: z.string().max(500).nullable().optional(),
  superficieM2: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  fechaInicio: z.coerce.date().nullable().optional(),
  fechaFinEstimada: z.coerce.date().nullable().optional(),
  monedaBase: z.enum(['USD', 'ARS']).default('USD'),
  cotizacionUsdInicial: z.string().regex(/^\d+(\.\d{1,4})?$/).nullable().optional(),
  porcentajeHonorarios: z.string().regex(/^\d+(\.\d{1,2})?$/).default('16'),
});

export type ObraInput = z.infer<typeof obraInputSchema>;
