import { resetDb } from './setup';
import { makeUsuario } from './factories';
import * as actions from '@/features/rubros/actions';
import { listarRubrosArbol } from '@/features/rubros/queries';

jest.mock('@/lib/auth/require', () => ({
  __esModule: true,
  requireRole: jest.fn(),
  requireSession: jest.fn(),
  getSessionUser: jest.fn(),
}));
import * as auth from '@/lib/auth/require';

describe('rubros', () => {
  beforeEach(async () => { await resetDb(); jest.clearAllMocks(); });

  it('jerarquía padre-hijo se construye correctamente', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);

    const inst = await actions.crearRubro({ nombre: 'Instalaciones', orden: 1, activo: true });
    if (!inst.ok) throw new Error('crear failed');
    await actions.crearRubro({ nombre: 'Gas', idPadre: inst.id, orden: 1, activo: true });
    await actions.crearRubro({ nombre: 'Eléctrica', idPadre: inst.id, orden: 2, activo: true });

    const arbol = await listarRubrosArbol();
    const nodo = arbol.find((n) => n.nombre === 'Instalaciones');
    expect(nodo?.hijos.map((h) => h.nombre)).toEqual(['Gas', 'Eléctrica']);
  });
});
