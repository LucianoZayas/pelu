import fs from 'fs';
import path from 'path';
import { parsePreview } from '@/features/import-presupuestos/actions';

jest.mock('@/lib/auth/require', () => ({
  requireRole: jest.fn().mockResolvedValue(undefined),
}));

const FIXTURE = path.join(process.cwd(), 'scripts/import-sheets/__fixtures__/synthetic-small.xlsx');

describe('parsePreview server action', () => {
  test('archivo XLSX válido devuelve preview con items y descartes', async () => {
    const buf = await fs.promises.readFile(FIXTURE);
    const file = new File([buf], 'synthetic-small.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const form = new FormData();
    form.append('file', file);

    const r = await parsePreview(form);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.cotizacionDetectada).toBe(1500);
  });

  test('archivo no XLSX devuelve error', async () => {
    const file = new File(['hola'], 'test.pdf', { type: 'application/pdf' });
    const form = new FormData();
    form.append('file', file);

    const r = await parsePreview(form);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/extensión|xlsx/i);
  });

  test('archivo > 5MB devuelve error', async () => {
    const bigBuf = Buffer.alloc(6 * 1024 * 1024);
    const file = new File([bigBuf], 'big.xlsx');
    const form = new FormData();
    form.append('file', file);

    const r = await parsePreview(form);
    expect(r.ok).toBe(false);
  });
});
