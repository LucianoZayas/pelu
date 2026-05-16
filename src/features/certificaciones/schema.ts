import { z } from 'zod';

export const crearCertificacionInputSchema = z.object({
  presupuestoId: z.string().uuid(),
  descripcion: z.string().max(500).optional().nullable(),
});
export type CrearCertificacionInput = z.infer<typeof crearCertificacionInputSchema>;

// Avance acumulado por item dentro de una certificación.
export const avanceInputSchema = z.object({
  itemPresupuestoId: z.string().uuid(),
  porcentajeAcumulado: z.coerce.number().min(0).max(100),
});

export const actualizarAvanceInputSchema = z.object({
  certificacionId: z.string().uuid(),
  avances: z.array(avanceInputSchema).min(1),
  descripcion: z.string().max(500).optional().nullable(),
});
export type ActualizarAvanceInput = z.infer<typeof actualizarAvanceInputSchema>;

export const emitirInputSchema = z.object({
  certificacionId: z.string().uuid(),
});
export type EmitirInput = z.infer<typeof emitirInputSchema>;

export const cobrarInputSchema = z.object({
  certificacionId: z.string().uuid(),
  cuentaId: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Conceptos que se aplican a los 2 movimientos auto-creados. Si no se pasa,
  // el action busca por código por defecto (COBRO_CERTIFICACION para neto, HO
  // para honorarios). Si no existen, devuelve error claro.
  conceptoNetoId: z.string().uuid().optional(),
  conceptoHonorariosId: z.string().uuid().optional(),
});
export type CobrarInput = z.infer<typeof cobrarInputSchema>;

export const anularCertInputSchema = z.object({
  certificacionId: z.string().uuid(),
  motivo: z.string().min(3).max(300),
});
export type AnularCertInput = z.infer<typeof anularCertInputSchema>;
