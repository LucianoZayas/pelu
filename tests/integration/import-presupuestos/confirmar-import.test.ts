/**
 * Integration tests for confirmarImportAction (Task 14)
 *
 * Test cases:
 *   1. Happy path: import_pendiente=true → returns { ok: true, alreadyConfirmed: false }, DB updated
 *   2. Audit log: audit_log entry created with accion='editar' + descripcionHumana contains 'Import confirmado'
 *   3. Idempotency: import_pendiente=false → returns { ok: true, alreadyConfirmed: true }, no audit log added
 *   4. Not found: invalid presupuestoId → returns { ok: false, error }
 */

import 'dotenv/config';
import { db } from '@/db/client';
import { obra, presupuesto, itemPresupuesto, auditLog, usuario } from '@/db/schema';
import { eq, inArray, like } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth/require', () => ({
  requireRole: jest.fn(),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

// ── Import action AFTER mocks are set up ─────────────────────────────────────

import { confirmarImportAction } from '@/features/import-presupuestos/actions';
import * as auth from '@/lib/auth/require';

// ── State ─────────────────────────────────────────────────────────────────────

let adminUser: typeof usuario.$inferSelect;
const createdObraIds: string[] = [];
const createdPresupuestoIds: string[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCodigoObra() {
  return `IMPORTTEST-CONF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function seedObraAndPresupuesto({
  importPendiente,
}: {
  importPendiente: boolean;
}): Promise<{ obraId: string; presupuestoId: string }> {
  const codigoObra = makeCodigoObra();
  const [obraCreada] = await db
    .insert(obra)
    .values({
      codigo: codigoObra,
      nombre: `Obra Confirmar Test ${codigoObra}`,
      clienteNombre: 'Cliente Test Confirmar',
      monedaBase: 'ARS',
      estado: 'borrador',
      clienteToken: randomUUID(),
      createdBy: adminUser.id,
      updatedBy: adminUser.id,
    })
    .returning({ id: obra.id });

  createdObraIds.push(obraCreada.id);

  const [pCreado] = await db
    .insert(presupuesto)
    .values({
      obraId: obraCreada.id,
      tipo: 'original',
      numero: 1,
      estado: 'borrador',
      cotizacionUsd: '1500',
      importPendiente,
      createdBy: adminUser.id,
      updatedBy: adminUser.id,
    })
    .returning({ id: presupuesto.id });

  createdPresupuestoIds.push(pCreado.id);

  return { obraId: obraCreada.id, presupuestoId: pCreado.id };
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  const [found] = await db
    .select()
    .from(usuario)
    .where(eq(usuario.email, 'admin@macna.local'))
    .limit(1);
  if (!found) throw new Error('Admin user not found — run seed first (admin@macna.local)');
  adminUser = found;

  (auth.requireRole as jest.Mock).mockResolvedValue({
    id: adminUser.id,
    email: adminUser.email,
    nombre: adminUser.nombre,
    rol: adminUser.rol,
  });
});

afterAll(async () => {
  // Clean up created test data
  const allPIds = [...createdPresupuestoIds];

  // Also clean up by prefix to cover any leftover from previous failed runs
  const obrasFromPrefix = await db
    .select({ id: obra.id })
    .from(obra)
    .where(like(obra.codigo, 'IMPORTTEST-CONF-%'));
  const prefixObraIds = obrasFromPrefix.map((o) => o.id);
  const allObraIds = [...new Set([...createdObraIds, ...prefixObraIds])];

  if (allObraIds.length > 0) {
    const presupuestosFromObras = await db
      .select({ id: presupuesto.id })
      .from(presupuesto)
      .where(inArray(presupuesto.obraId, allObraIds));
    const obraPIds = presupuestosFromObras.map((p) => p.id);
    const allPIdsToDelete = [...new Set([...allPIds, ...obraPIds])];

    if (allPIdsToDelete.length > 0) {
      await db.delete(auditLog).where(inArray(auditLog.entidadId, allPIdsToDelete));
      await db.delete(itemPresupuesto).where(inArray(itemPresupuesto.presupuestoId, allPIdsToDelete));
      await db.delete(presupuesto).where(inArray(presupuesto.id, allPIdsToDelete));
    }

    await db.delete(obra).where(inArray(obra.id, allObraIds));
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('confirmarImportAction', () => {
  test('T1: happy path — import_pendiente=true → returns { ok: true, alreadyConfirmed: false }, DB updated to false', async () => {
    const { presupuestoId } = await seedObraAndPresupuesto({ importPendiente: true });

    const result = await confirmarImportAction({ presupuestoId });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.alreadyConfirmed).toBe(false);

    // DB row updated
    const [p] = await db.select().from(presupuesto).where(eq(presupuesto.id, presupuestoId));
    expect(p.importPendiente).toBe(false);
  });

  test('T2: audit log — entry created with accion=editar and descripcionHumana containing "Import confirmado"', async () => {
    const { presupuestoId } = await seedObraAndPresupuesto({ importPendiente: true });

    // Count existing audit entries before
    const logsBefore = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entidadId, presupuestoId));

    const result = await confirmarImportAction({ presupuestoId });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);

    const logsAfter = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entidadId, presupuestoId));

    expect(logsAfter.length).toBe(logsBefore.length + 1);

    const newLog = logsAfter[logsAfter.length - 1];
    expect(newLog.accion).toBe('editar');
    expect(newLog.entidad).toBe('presupuesto');
    expect(newLog.usuarioId).toBe(adminUser.id);
    expect(newLog.descripcionHumana).toContain('Import confirmado');
  });

  test('T3: idempotency — import_pendiente=false → returns { ok: true, alreadyConfirmed: true }, no new audit log', async () => {
    const { presupuestoId } = await seedObraAndPresupuesto({ importPendiente: false });

    const logsBefore = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entidadId, presupuestoId));

    const result = await confirmarImportAction({ presupuestoId });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.alreadyConfirmed).toBe(true);

    // No new audit log entry
    const logsAfter = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entidadId, presupuestoId));

    expect(logsAfter.length).toBe(logsBefore.length);
  });

  test('T4: not found — invalid presupuestoId returns { ok: false, error }', async () => {
    const fakeId = randomUUID();

    const result = await confirmarImportAction({ presupuestoId: fakeId });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected action to fail on not-found');
    expect(result.error).toBeTruthy();
  });
});
