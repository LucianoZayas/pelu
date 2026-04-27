import { parseCsv } from '@/../scripts/import-sheets/parse';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('import.parseCsv', () => {
  it('parsea fixture con 3 filas', async () => {
    const buf = readFileSync(resolve(process.cwd(), 'fixtures/obra-ejemplo.csv'));
    const filas = await parseCsv(buf);
    expect(filas).toHaveLength(3);
    expect(filas[0].rubro).toBe('Demoliciones');
    expect(filas[2].rubro).toBe('Instalaciones / Eléctrica');
    expect(filas[0].markup).toBe('');
    expect(filas[1].markup).toBe('30');
  });

  it('lanza si falta columna obligatoria', async () => {
    const csv = Buffer.from('rubro,descripcion\nA,B');
    await expect(parseCsv(csv)).rejects.toThrow();
  });
});
