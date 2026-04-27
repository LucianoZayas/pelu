import { resetDb } from './setup';
import { makeUsuario, makeObra } from './factories';
import { getObraByToken } from '@/lib/auth/cliente-token';

describe('cliente-token', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('encuentra obra por token válido', async () => {
    const admin = await makeUsuario('admin');
    const o = await makeObra(admin.id);
    const found = await getObraByToken(o.clienteToken);
    expect(found?.id).toBe(o.id);
  });

  it('devuelve null para token inexistente', async () => {
    const found = await getObraByToken('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    expect(found).toBeNull();
  });

  it('ignora tokens muy cortos / mal formados', async () => {
    expect(await getObraByToken('')).toBeNull();
    expect(await getObraByToken('abc')).toBeNull();
  });

  it('ignora obras eliminadas (deletedAt)', async () => {
    const admin = await makeUsuario('admin');
    const o = await makeObra(admin.id, { deletedAt: new Date() });
    expect(await getObraByToken(o.clienteToken)).toBeNull();
  });
});
