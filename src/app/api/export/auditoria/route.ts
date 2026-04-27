import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require';
import { buildXlsxAuditoria } from '@/lib/export/xlsx-auditoria';
import type { BuscarFiltros } from '@/features/audit/queries';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  await requireRole('admin');
  const sp = req.nextUrl.searchParams;
  const buf = await buildXlsxAuditoria({
    entidad: (sp.get('entidad') as BuscarFiltros['entidad']) || undefined,
    accion: (sp.get('accion') as BuscarFiltros['accion']) || undefined,
    desde: sp.get('desde') ? new Date(sp.get('desde')!) : undefined,
    hasta: sp.get('hasta') ? new Date(sp.get('hasta')! + 'T23:59:59') : undefined,
  });
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="auditoria.xlsx"`,
    },
  });
}
