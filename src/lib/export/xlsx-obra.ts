import ExcelJS from 'exceljs';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { presupuesto, itemPresupuesto, rubro } from '@/db/schema';
import { getObra } from '@/features/obras/queries';

export async function buildXlsxObra(obraId: string): Promise<Buffer | null> {
  const obra = await getObra(obraId);
  if (!obra) return null;

  const wb = new ExcelJS.Workbook();
  const wsResumen = wb.addWorksheet('Resumen');
  wsResumen.addRows([
    ['Código', obra.codigo],
    ['Nombre', obra.nombre],
    ['Cliente', obra.clienteNombre],
    ['Estado', obra.estado],
    ['Moneda', obra.monedaBase],
  ]);

  const presupuestos = await db.select().from(presupuesto)
    .where(eq(presupuesto.obraId, obraId))
    .orderBy(asc(presupuesto.numero));
  for (const p of presupuestos) {
    const ws = wb.addWorksheet(`Presupuesto ${p.numero}`);
    ws.addRow(['Tipo', p.tipo]);
    ws.addRow(['Estado', p.estado]);
    ws.addRow(['Cotización USD', p.cotizacionUsd]);
    ws.addRow(['Markup default %', p.markupDefaultPorcentaje]);
    ws.addRow(['Total cliente', p.totalClienteCalculado ?? '-']);
    ws.addRow([]);

    ws.addRow(['Rubro', 'Descripción', 'Unidad', 'Cantidad', 'Costo U.', 'Moneda costo', 'Markup %', 'Precio U. cliente', 'Subtotal']);
    ws.getRow(7).font = { bold: true };
    const items = await db.select({ item: itemPresupuesto, rubro }).from(itemPresupuesto)
      .leftJoin(rubro, eq(itemPresupuesto.rubroId, rubro.id))
      .where(eq(itemPresupuesto.presupuestoId, p.id))
      .orderBy(asc(itemPresupuesto.orden));
    for (const { item, rubro: r } of items) {
      ws.addRow([
        r?.nombre, item.descripcion, item.unidad, item.cantidad,
        item.costoUnitario, item.costoUnitarioMoneda,
        item.markupEfectivoPorcentaje, item.precioUnitarioCliente,
        Number(item.precioUnitarioCliente) * Number(item.cantidad),
      ]);
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
