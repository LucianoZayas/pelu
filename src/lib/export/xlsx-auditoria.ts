import ExcelJS from 'exceljs';
import { buscarLogs } from '@/features/audit/queries';

export async function buildXlsxAuditoria(filtros: Parameters<typeof buscarLogs>[0]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Auditoría');
  ws.columns = [
    { header: 'Timestamp', key: 'timestamp', width: 22 },
    { header: 'Usuario', key: 'usuario', width: 30 },
    { header: 'Entidad', key: 'entidad', width: 14 },
    { header: 'Entidad ID', key: 'entidadId', width: 38 },
    { header: 'Acción', key: 'accion', width: 14 },
    { header: 'Descripción', key: 'descripcion', width: 60 },
    { header: 'Diff', key: 'diff', width: 60 },
  ];
  ws.getRow(1).font = { bold: true };
  const rows = await buscarLogs({ ...filtros, limit: 10_000 });
  for (const r of rows) {
    ws.addRow({
      timestamp: r.log.timestamp.toISOString(),
      usuario: r.usuarioNombre ?? r.usuarioEmail,
      entidad: r.log.entidad,
      entidadId: r.log.entidadId,
      accion: r.log.accion,
      descripcion: r.log.descripcionHumana,
      diff: r.log.diff != null ? JSON.stringify(r.log.diff) : '',
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
