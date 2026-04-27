import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { presupuesto } from '@/db/schema';
import { getObraByToken } from '@/lib/auth/cliente-token';
import { getSessionUser } from '@/lib/auth/require';
import { renderPresupuestoPdfStream } from '@/lib/pdf/render';

export const runtime = 'nodejs';
export const maxDuration = 60; // segundos; Vercel Pro permite hasta 300.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ presupuestoId: string }> },
) {
  const { presupuestoId } = await params;
  const token = req.nextUrl.searchParams.get('token');

  // Cargar el presupuesto + obra para autorización.
  const [p] = await db
    .select()
    .from(presupuesto)
    .where(eq(presupuesto.id, presupuestoId))
    .limit(1);
  if (!p) return new NextResponse('Not found', { status: 404 });
  if (p.estado !== 'firmado') return new NextResponse('Not signed', { status: 403 });

  // Autorización: o bien token público válido para esta obra, o bien sesión interna.
  let authorized = false;
  if (token) {
    const obra = await getObraByToken(token);
    if (obra && obra.id === p.obraId) authorized = true;
  }
  if (!authorized) {
    const user = await getSessionUser();
    if (user) authorized = true;
  }
  if (!authorized) return new NextResponse('Unauthorized', { status: 401 });

  const stream = await renderPresupuestoPdfStream(presupuestoId);
  if (!stream) return new NextResponse('Render failed', { status: 500 });

  // @ts-expect-error react-pdf devuelve un stream que satisface ReadableStream para NextResponse
  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="presupuesto-${p.numero}.pdf"`,
      'Cache-Control': 'private, no-cache',
    },
  });
}
