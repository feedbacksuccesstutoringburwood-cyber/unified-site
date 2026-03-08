import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // allow public assets, api, and login
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname === '/favicon.ico' || pathname === '/login') {
    return NextResponse.next();
  }
  const authed = req.cookies.get('st_auth');
  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/|api/|favicon.ico).*)']
};
