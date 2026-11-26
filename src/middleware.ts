import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIES = [
  'session_token',
  '__Secure-session_token',
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
] as const;

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === '/login') {
    return NextResponse.next();
  }

  const hasSessionCookie = SESSION_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value));
  if (!hasSessionCookie) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/' && pathname !== '/overview' && pathname !== '/invite') {
      loginUrl.searchParams.set('returnTo', `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|ico|css|js)$).*)',
  ],
};
