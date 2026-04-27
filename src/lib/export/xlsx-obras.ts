import ExcelJS from 'exceljs';
import { listarObras } from '@/features/obras/queries';

export async function buildXlsxObras(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Obras');
  ws.columns = [
    { header: 'Código', key: 'codigo', width: 14 },
    { header: 'Nombre', key: 'nombre', width: 40 },
    { header: 'Cliente', key: 'clienteNombre', width: 30 },
    { header: 'Email cliente', key: 'clienteEmail', width: 26 },
    { header: 'Estado', key: 'estado', width: 12 },
    { header: 'Moneda base', key: 'monedaBase', width: 10 },
    { header: 'Fecha inicio', key: 'fechaInicio', width: 14 },
    { header: 'Fecha fin estim.', key: 'fechaFinEstimada', width: 16 },
    { header: 'Honorarios %', key: 'porcentajeHonorarios', width: 12 },
    { header: 'Creado', key: 'createdAt', width: 16 },
  ];
  ws.getRow(1).font = { bold: true };

  const obras = await listarObras();
  for (const o of obras) {
    ws.addRow({
      codigo: o.codigo,
      nombre: o.nombre,
      clienteNombre: o.clienteNombre,
      clienteEmail: o.clienteEmail,
      estado: o.estado,
      monedaBase: o.monedaBase,
      fechaInicio: o.fechaInicio?.toISOString().slice(0, 10),
      fechaFinEstimada: o.fechaFinEstimada?.toISOString().slice(0, 10),
      porcentajeHonorarios: o.porcentajeHonorarios,
      createdAt: o.createdAt.toISOString().slice(0, 10),
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
