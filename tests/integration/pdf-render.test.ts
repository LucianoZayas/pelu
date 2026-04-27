import { resetDb } from './setup';
import { makeUsuario, makeRubro, makeObra } from './factories';
import { db } from '@/db/client';
import { presupuesto, itemPresupuesto } from '@/db/schema';
import { renderPresupuestoPdfStream } from '@/lib/pdf/render';
import { randomUUID } from 'crypto';

async function consumeStream(s: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of s as AsyncIterable<Buffer>) chunks.push(c);
  return Buffer.concat(chunks);
}

describe('pdf render', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('render <5s para 100 items, devuelve PDF válido', async () => {
    const admin = await makeUsuario('admin');
    const o = await makeObra(admin.id);
    const ru = await makeRubro();

    const [p] = await db
      .insert(presupuesto)
      .values({
        obraId: o.id,
        tipo: 'original',
        numero: 1,
        estado: 'firmado',
        markupDefaultPorcentaje: '30',
        cotizacionUsd: '1200',
        version: 2,
        fechaFirma: new Date(),
        totalClienteCalculado: '13000',
        totalCostoCalculado: '10000',
        createdBy: admin.id,
        updatedBy: admin.id,
      })
      .returning();

    await db.insert(itemPresupuesto).values(
      Array.from({ length: 100 }, (_, i) => ({
        id: randomUUID(),
        presupuestoId: p.id,
        rubroId: ru.id,
        orden: i,
        descripcion: `Item ${i}`,
        unidad: 'gl' as const,
        cantidad: '1.0000',
        costoUnitario: '100.0000',
        costoUnitarioMoneda: 'USD' as const,
        costoUnitarioBase: '100.0000',
        markupPorcentaje: null,
        markupEfectivoPorcentaje: '30.00',
        precioUnitarioCliente: '130.0000',
      })),
    );

    const t0 = Date.now();
    const stream = await renderPresupuestoPdfStream(p.id);
    const buf = await consumeStream(stream!);
    const elapsed = Date.now() - t0;

    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    expect(elapsed).toBeLessThan(5000);
  }, 15_000);
});
