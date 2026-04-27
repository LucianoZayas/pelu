import { resetDb } from './setup';
import { makeUsuario, makeObra } from './factories';
import ExcelJS from 'exceljs';
import { buildXlsxObras } from '@/lib/export/xlsx-obras';

describe('xlsx obras', () => {
  beforeEach(async () => { await resetDb(); });

  it('genera xlsx con headers + 1 fila por obra', async () => {
    const u = await makeUsuario('admin');
    await makeObra(u.id, { nombre: 'Casa A', codigo: 'M-2026-001' });
    await makeObra(u.id, { nombre: 'Casa B', codigo: 'M-2026-002' });

    const buf = await buildXlsxObras();
    const wb = new ExcelJS.Workbook();
    // exceljs's `Buffer` typing comes from a stricter Node version; cast through `any`.
    await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet('Obras')!;
    expect(ws.rowCount).toBe(3); // 1 header + 2 obras

    // Find the "M-2026-001" code in the codigo column.
    const codigos = [ws.getRow(2).getCell('codigo').value, ws.getRow(3).getCell('codigo').value];
    expect(codigos).toContain('M-2026-001');
    expect(codigos).toContain('M-2026-002');
  });
});
