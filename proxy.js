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

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const publicPaths = new Set([
    '/access',
    '/api/access/verify',
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
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (isValidSession(token, process.env.ENOTES_SESSION_SECRET)) return NextResponse.next();

  const url = new URL('/access', request.url);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
