import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

const COOKIE_NAME = 'enotes_access';

function isValidSession(token, secret) {
  if (!token || !secret) return false;
  const [expiresAtText, signature, ...extra] = token.split('.');
  if (extra.length || !/^\d+$/.test(expiresAtText || '') || !/^[a-f0-9]{64}$/.test(signature || '')) return false;

  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;

  const expected = createHmac('sha256', secret).update(`enotes-access:${expiresAtText}`).digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

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
