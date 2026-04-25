import { resetDb } from './setup';
import { makeUsuario } from './factories';
import { db } from '@/db/client';
import { usuario } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as actions from '@/features/usuarios/actions';

jest.mock('@/lib/auth/require', () => ({
  __esModule: true,
  requireRole: jest.fn(),
  requireSession: jest.fn(),
  getSessionUser: jest.fn(),
}));
jest.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    auth: {
      admin: {
        createUser: jest.fn().mockResolvedValue({ data: { user: { id: 'mock-user-id' } }, error: null }),
        generateLink: jest.fn().mockResolvedValue({ data: {}, error: null }),
      },
    },
  }),
}));
import * as auth from '@/lib/auth/require';

describe('usuarios', () => {
  beforeEach(async () => { await resetDb(); jest.clearAllMocks(); });

  it('admin invita operador, queda activo y rol correcto', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);

    const r = await actions.invitarUsuario({
      email: 'op@test.com', nombre: 'Op Uno', rol: 'operador',
    });
    expect(r.ok).toBe(true);

    const [u] = await db.select().from(usuario).where(eq(usuario.id, 'mock-user-id'));
    expect(u.rol).toBe('operador');
    expect(u.activo).toBe(true);
  });

  it('admin no se puede desactivar a sí mismo', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);
    const r = await actions.desactivarUsuario(admin.id);
    expect(r.ok).toBe(false);
  });
});
