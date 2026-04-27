import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/require';
import { buildXlsxObra } from '@/lib/export/xlsx-obra';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const buf = await buildXlsxObra(id);
  if (!buf) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="obra-${id}.xlsx"`,
    },
  });
}
