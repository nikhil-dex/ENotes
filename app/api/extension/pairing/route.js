import { randomBytes } from 'node:crypto';
import { getDatabase } from '../../../../lib/mongodb.js';
import { hashExtensionSecret } from '../../../../lib/extension-auth.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST() {
  try {
    if (!process.env.ENOTES_EXTENSION_ID) return json({ error: 'Browser extension pairing is not configured on the server yet.' }, 503);
    const db = await getDatabase();
    const now = new Date();
    await db.collection('extensionPairings').deleteMany({ expiresAt: { $lte: now } });
    const code = randomBytes(24).toString('base64url');
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
    await db.collection('extensionPairings').insertOne({ codeHash: hashExtensionSecret(code), createdAt: now, expiresAt });
    return json({ code, expiresAt });
  } catch (error) {
    console.error('POST /api/extension/pairing failed:', error);
    return json({ error: 'Could not create a pairing code. Please try again.' }, 500);
  }
}

export async function DELETE() {
  try {
    const db = await getDatabase();
    const [pairings, tokens] = await Promise.all([db.collection('extensionPairings').deleteMany({}), db.collection('extensionTokens').deleteMany({})]);
    return json({ revokedTokens: tokens.deletedCount || 0, clearedPairings: pairings.deletedCount || 0 });
  } catch (error) {
    console.error('DELETE /api/extension/pairing failed:', error);
    return json({ error: 'Could not revoke browser extension access. Please try again.' }, 500);
  }
}
