import { getDatabase } from '../../../../lib/mongodb.js';
import { extensionCorsHeaders, findValidExtensionToken, isAllowedExtensionOrigin } from '../../../../lib/extension-auth.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data, status = 200, headers = {}) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

export async function OPTIONS(request) {
  if (!isAllowedExtensionOrigin(request)) return json({ error: 'Extension origin is not allowed.' }, 403);
  return new Response(null, { status: 204, headers: extensionCorsHeaders(request) });
}

export async function POST(request) {
  const cors = extensionCorsHeaders(request);
  if (!isAllowedExtensionOrigin(request)) return json({ error: 'Extension origin is not allowed.' }, 403, cors);
  try {
    const db = await getDatabase();
    const token = await findValidExtensionToken(request, db);
    if (!token) return json({ error: 'Extension connection is already expired or disconnected.' }, 401, cors);
    await db.collection('extensionTokens').updateOne(
      { _id: token._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
    return json({ ok: true }, 200, cors);
  } catch (error) {
    console.error('POST /api/extension/disconnect failed:', error);
    return json({ error: 'Could not disconnect the extension. Please try again.' }, 500, cors);
  }
}
