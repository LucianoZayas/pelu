import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  // /cliente/expirado: público, no toca sesión.
  if (path === '/cliente/expirado') return response;

  // /cliente/<token>/...: público, valida token contra DB.
  // Token inválido → redirect a /cliente/expirado (NO 404).
  const clienteMatch = /^\/cliente\/([^/]+)/.exec(path);
  if (clienteMatch) {
    const token = clienteMatch[1];
    const { getObraByToken } = await import('@/lib/auth/cliente-token');
    const obra = await getObraByToken(token);
    if (!obra) {
      const url = request.nextUrl.clone();
      url.pathname = '/cliente/expirado';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Resto: sesión interna (Plan 1).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const publicPaths = ['/login', '/auth/callback', '/preview-importer'];
  const isPublic = publicPaths.some((p) => path === p || path.startsWith(p + '/'));

  if (!isPublic && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  if (user && (path === '/login' || path === '/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/obras';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/pdf).*)'],
};
