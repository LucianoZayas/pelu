import { z } from 'zod';
export const invitarUsuarioSchema = z.object({
  email: z.string().email(),
  nombre: z.string().min(1).max(120),
  rol: z.enum(['admin', 'operador']),
});
export type InvitarUsuarioInput = z.infer<typeof invitarUsuarioSchema>;

export const editarUsuarioSchema = z.object({
  nombre: z.string().min(1).max(120),
  rol: z.enum(['admin', 'operador']),
  activo: z.boolean(),
});
export type EditarUsuarioInput = z.infer<typeof editarUsuarioSchema>;
