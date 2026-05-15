import { z } from 'zod';

// Tipos manualmente editables desde la UI. Las partes tipo 'obra' y 'proveedor'
// se autogeneran al crear obra/proveedor, no se crean por este formulario.
export const TIPOS_MANUALES = ['empresa', 'socio', 'empleado', 'externo'] as const;
export type TipoPartManual = typeof TIPOS_MANUALES[number];

export const parteInputSchema = z.object({
  tipo: z.enum(TIPOS_MANUALES),
  nombre: z.string().min(1).max(120),
  datos: z.object({
    cuit: z.string().max(20).optional().nullable(),
    contacto: z.string().max(200).optional().nullable(),
    notas: z.string().max(500).optional().nullable(),
  }).optional().nullable(),
  activo: z.boolean().default(true),
});

export type ParteInput = z.infer<typeof parteInputSchema>;
