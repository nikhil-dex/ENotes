import { COOKIE_NAME, getSessionClaims } from '../../../../lib/access-session.js';
import { getDatabase } from '../../../../lib/mongodb.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const claims = getSessionClaims(token, process.env.ENOTES_SESSION_SECRET, { allowExpired: true });
    if (claims) {
      const db = await getDatabase();
      await db.collection('settings').deleteOne({ _id: 'active-device-session', sessionId: claims.sessionId });
    }
    const response = Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    response.headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    return response;
  } catch (error) {
    console.error('POST /api/access/logout failed:', error);
    return Response.json({ error: 'Could not release the active device session. Check the connection and try again.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
