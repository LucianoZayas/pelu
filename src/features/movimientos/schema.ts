import { z } from 'zod';

// El form trabaja con strings (input HTML), las acciones validan acá.
const monedaSchema = z.enum(['USD', 'ARS']);

const baseSchema = z.object({
  conceptoId: z.string().uuid({ message: 'Concepto requerido' }),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha inválida (YYYY-MM-DD)' }),
  descripcion: z.string().max(500).optional().nullable(),
  numeroComprobante: z.string().max(120).optional().nullable(),
  comprobanteUrl: z.string().url().optional().nullable(),
  esNoRecuperable: z.boolean().default(false),
});

// Ingreso o egreso (no transferencia)
export const movimientoSimpleInputSchema = baseSchema.extend({
  tipoOperacion: z.enum(['entrada', 'salida']),
  cuentaId: z.string().uuid({ message: 'Cuenta requerida' }),
  monto: z.coerce.number().positive({ message: 'El monto debe ser mayor a 0' }),
  moneda: monedaSchema,
  cotizacionUsd: z.coerce.number().positive().optional().nullable(),
  parteOrigenId: z.string().uuid().optional().nullable(),
  parteDestinoId: z.string().uuid().optional().nullable(),
  obraId: z.string().uuid().optional().nullable(),
  rubroId: z.string().uuid().optional().nullable(),
  proveedorId: z.string().uuid().optional().nullable(),
});

export const movimientoTransferenciaInputSchema = baseSchema.extend({
  tipoOperacion: z.literal('transferencia'),
  cuentaId: z.string().uuid({ message: 'Cuenta origen requerida' }),
  cuentaDestinoId: z.string().uuid({ message: 'Cuenta destino requerida' }),
  monto: z.coerce.number().positive({ message: 'El monto debe ser mayor a 0' }),
  moneda: monedaSchema,
  montoDestino: z.coerce.number().positive().optional().nullable(),
  cotizacionUsd: z.coerce.number().positive().optional().nullable(),
}).refine((data) => data.cuentaId !== data.cuentaDestinoId, {
  message: 'La cuenta destino debe ser distinta de la cuenta origen',
  path: ['cuentaDestinoId'],
});

export const movimientoInputSchema = z.discriminatedUnion('tipoOperacion', [
  movimientoSimpleInputSchema,
  movimientoTransferenciaInputSchema,
]);

export type MovimientoSimpleInput = z.infer<typeof movimientoSimpleInputSchema>;
export type MovimientoTransferenciaInput = z.infer<typeof movimientoTransferenciaInputSchema>;
export type MovimientoInput = z.infer<typeof movimientoInputSchema>;

export const anularInputSchema = z.object({
  motivo: z.string().min(3, { message: 'Anotá un motivo (mín. 3 caracteres)' }).max(300),
});
export type AnularInput = z.infer<typeof anularInputSchema>;
