import { createHmac, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getDatabase } from '../../../../lib/mongodb.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = 'enotes_access';
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  try {
    const sessionSecret = process.env.ENOTES_SESSION_SECRET;
    if (!sessionSecret || sessionSecret.length < 32) {
      return json({ error: 'Access is not configured correctly. Set ENOTES_SESSION_SECRET on the server.' }, 500);
    }

    const body = await request.json();
    const accessKey = body?.accessKey;
    if (typeof accessKey !== 'string' || accessKey.length === 0 || accessKey.length > 256) {
      return json({ error: 'Enter the access string.' }, 400);
    }

    const db = await getDatabase();
    const config = await db.collection('settings').findOne({ _id: 'shared-access-key' });
    if (!config?.salt || !config?.keyHash) {
      return json({ error: 'The access key has not been configured yet.' }, 503);
    }

    const actual = await scrypt(accessKey, Buffer.from(config.salt, 'base64'), 64);
    const expected = Buffer.from(config.keyHash, 'base64');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return json({ error: 'That access string is incorrect.' }, 401);
    }

    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    const signature = createHmac('sha256', sessionSecret)
      .update(`enotes-access:${expiresAt}`)
      .digest('hex');
    const token = `${expiresAt}.${signature}`;

    const response = json({ ok: true });
    response.headers.append(
      'Set-Cookie',
      `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
    );
    return response;
  } catch (error) {
    console.error('POST /api/access/verify failed:', error);
    return json({ error: 'Could not verify the access string. Check the database connection.' }, 500);
  }
}
