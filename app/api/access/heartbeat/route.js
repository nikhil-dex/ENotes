import { COOKIE_NAME, createSessionToken, getSessionClaims, SESSION_SECONDS } from '../../../../lib/access-session.js';
import { getDatabase } from '../../../../lib/mongodb.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    const claims = getSessionClaims(request.cookies.get(COOKIE_NAME)?.value, process.env.ENOTES_SESSION_SECRET, { allowExpired: true });
    if (!claims) return Response.json({ error: 'Session expired.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    const db = await getDatabase();
    const active = await db.collection('settings').findOneAndUpdate(
      { _id: 'active-device-session', sessionId: claims.sessionId },
      { $set: { lastSeenAt: new Date() } },
      { returnDocument: 'after', includeResultMetadata: false },
    );
    if (!active) return Response.json({ error: 'This device no longer owns the active session.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    const token = createSessionToken(process.env.ENOTES_SESSION_SECRET, expiresAt, claims.sessionId);
    const response = Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    response.headers.append('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    return response;
  } catch (error) {
    console.error('POST /api/access/heartbeat failed:', error);
    return Response.json({ error: 'Could not renew the active session.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
