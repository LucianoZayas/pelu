import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/require';
import { buildXlsxObras } from '@/lib/export/xlsx-obras';

export const runtime = 'nodejs';

export async function GET() {
  await requireSession();
  const buf = await buildXlsxObras();
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="obras.xlsx"`,
    },
  });
}
