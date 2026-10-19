import { randomBytes, randomUUID } from 'node:crypto';
import { getDatabase } from '../../../../lib/mongodb.js';
import { EXTENSION_TOKEN_TTL_MS, extensionCorsHeaders, extensionOrigin, hashExtensionSecret, isAllowedExtensionOrigin } from '../../../../lib/extension-auth.js';
import { readLimitedBody } from '../../../../lib/read-limited-body.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

export async function OPTIONS(request) {
  if (!isAllowedExtensionOrigin(request)) return json({ error: 'Extension origin is not allowed.' }, 403);
  return new Response(null, { status: 204, headers: extensionCorsHeaders(request) });
}

export async function POST(request) {
  const cors = extensionCorsHeaders(request);
  if (!isAllowedExtensionOrigin(request)) return json({ error: 'Extension origin is not allowed.' }, 403, cors);
  if (!process.env.ENOTES_EXTENSION_ID || !extensionOrigin()) return json({ error: 'Browser extension pairing is not configured.' }, 503, cors);
  let body;
  try { body = JSON.parse(await readLimitedBody(request, 4096)); }
  catch (error) { return json({ error: error?.status === 413 ? 'Request body is too large.' : 'Enter a valid pairing code.' }, error?.status || 400, cors); }
  const code = body?.code;
  if (typeof code !== 'string' || code.length < 20 || code.length > 100) return json({ error: 'Enter a valid pairing code.' }, 400, cors);
  try {
    const db = await getDatabase();
    const pairing = await db.collection('extensionPairings').findOneAndDelete({ codeHash: hashExtensionSecret(code), expiresAt: { $gt: new Date() } }, { includeResultMetadata: false });
    if (!pairing) return json({ error: 'Pairing code is invalid or expired. Generate a new one in ENotes.' }, 401, cors);
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + EXTENSION_TOKEN_TTL_MS);
    await db.collection('extensionTokens').insertOne({ _id: randomUUID(), tokenHash: hashExtensionSecret(token), scopes: ['quick-notes:create'], createdAt: now, expiresAt });
    return json({ token, expiresAt }, 200, cors);
  } catch (error) {
    console.error('POST /api/extension/token failed:', error);
    return json({ error: 'Could not connect the extension. Please try again.' }, 500, cors);
  }
}
