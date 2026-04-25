import { db } from '@/db/client';
import { usuario, rubro, obra } from '@/db/schema';
import { randomBytes, randomUUID } from 'crypto';

export async function makeUsuario(rol: 'admin' | 'operador' = 'admin') {
  const id = randomUUID();
  const [u] = await db.insert(usuario).values({
    id, email: `${id}@test.local`, nombre: `Test ${rol}`, rol, activo: true,
  }).returning();
  return u;
}

export async function makeRubro(nombre = `Rubro-${Date.now()}`) {
  const [r] = await db.insert(rubro).values({ nombre, orden: 0 }).returning();
  return r;
}

export function makeToken() {
  return randomBytes(32).toString('base64url');
}

export async function makeObra(adminId: string, overrides: Partial<typeof obra.$inferInsert> = {}) {
  const [o] = await db.insert(obra).values({
    codigo: `T-${Date.now()}`,
    nombre: 'Obra test',
    clienteNombre: 'Cliente test',
    estado: 'borrador',
    monedaBase: 'USD',
    porcentajeHonorarios: '16',
    clienteToken: makeToken(),
    createdBy: adminId,
    updatedBy: adminId,
    ...overrides,
  }).returning();
  return o;
}
