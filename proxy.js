import { NextResponse } from 'next/server';
import { COOKIE_NAME, isValidSession } from './lib/access-session.js';

function withSecurityHeaders(response) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export function proxy(request) {
  const { pathname } = request.nextUrl;
  // Reject cross-origin browser mutations. Requests without Origin (for example,
  // trusted server-to-server calls) remain governed by the session gate.
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) {
      return withSecurityHeaders(NextResponse.json(
        { error: 'Cross-origin requests are not allowed.' },
        { status: 403 },
      ));
    }
  }
  const publicPaths = new Set([
    '/access',
    '/api/access/verify',
    '/api/access/logout',
    '/style.css',
    '/extra.css',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
  ]);

  if (publicPaths.has(pathname)) {
    if (pathname === '/access') {
      const token = request.cookies.get(COOKIE_NAME)?.value;
      if (isValidSession(token, process.env.ENOTES_SESSION_SECRET)) {
        return withSecurityHeaders(NextResponse.redirect(new URL('/', request.url)));
      }
    }
    return withSecurityHeaders(NextResponse.next());
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (isValidSession(token, process.env.ENOTES_SESSION_SECRET)) return withSecurityHeaders(NextResponse.next());

  const url = new URL('/access', request.url);
  return withSecurityHeaders(NextResponse.redirect(url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
