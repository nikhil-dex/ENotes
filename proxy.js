import { NextResponse } from 'next/server';
import { COOKIE_NAME, getSessionClaims } from './lib/access-session.js';
import { getDatabase } from './lib/mongodb.js';

function withSecurityHeaders(response) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) {
      return withSecurityHeaders(NextResponse.json({ error: 'Cross-origin requests are not allowed.' }, { status: 403 }));
    }
  }
  const publicPaths = new Set([
    '/access', '/api/access/verify', '/api/access/logout', '/api/access/heartbeat',
    '/style.css', '/extra.css', '/favicon.ico', '/robots.txt', '/sitemap.xml',
  ]);
  if (publicPaths.has(pathname)) {
    if (pathname === '/access') {
      const token = request.cookies.get(COOKIE_NAME)?.value;
      const claims = getSessionClaims(token, process.env.ENOTES_SESSION_SECRET);
      if (claims) {
        try {
          const db = await getDatabase();
          const active = await db.collection('settings').findOne({ _id: 'active-device-session', sessionId: claims.sessionId }, { projection: { _id: 1 } });
          if (active) return withSecurityHeaders(NextResponse.redirect(new URL('/', request.url)));
        } catch {}
      }
    }
    return withSecurityHeaders(NextResponse.next());
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const claims = getSessionClaims(token, process.env.ENOTES_SESSION_SECRET);
  if (!claims) return withSecurityHeaders(NextResponse.redirect(new URL('/access', request.url)));
  try {
    const db = await getDatabase();
    const active = await db.collection('settings').findOne({ _id: 'active-device-session', sessionId: claims.sessionId }, { projection: { _id: 1 } });
    if (active) return withSecurityHeaders(NextResponse.next());
    return withSecurityHeaders(NextResponse.redirect(new URL('/access?reason=session-replaced', request.url)));
  } catch {
    return withSecurityHeaders(NextResponse.json({ error: 'Unable to verify the active device session. Check the database connection.' }, { status: 503 }));
  }
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
