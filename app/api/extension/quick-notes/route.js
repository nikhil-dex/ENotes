import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../../../lib/mongodb.js';
import { readLimitedBody } from '../../../../lib/read-limited-body.js';
import { MAX_QUICK_NOTE_LENGTH, normalizeQuickNoteContent, quickNoteTitle } from '../../../../lib/quick-notes.js';
import { extensionCorsHeaders, findValidExtensionToken, isAllowedExtensionOrigin } from '../../../../lib/extension-auth.js';

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
  let data;
  try { data = JSON.parse(await readLimitedBody(request, 96 * 1024)); }
  catch (error) { return json({ error: error?.status === 413 ? 'Request body is too large.' : 'Enter valid JSON.' }, error?.status || 400, cors); }
  if (typeof data?.content !== 'string') return json({ error: 'Quick note content must be text.' }, 400, cors);
  const content = normalizeQuickNoteContent(data.content);
  if (!content.trim()) return json({ error: 'Write something before saving.' }, 400, cors);
  if (content.length > MAX_QUICK_NOTE_LENGTH) return json({ error: 'Quick notes must be 20,000 characters or fewer.' }, 400, cors);
  try {
    const db = await getDatabase();
    const token = await findValidExtensionToken(request, db);
    if (!token || !token.scopes?.includes('quick-notes:create')) return json({ error: 'Extension access expired or was revoked. Reconnect it from ENotes.' }, 401, cors);
    const now = new Date();
    const note = { _id: randomUUID(), title: quickNoteTitle(content), content, createdAt: now, updatedAt: now };
    await db.collection('quickNotes').insertOne(note);
    return json({ id: note._id, title: note.title, createdAt: now, updatedAt: now }, 201, cors);
  } catch (error) {
    console.error('POST /api/extension/quick-notes failed:', error);
    return json({ error: 'Could not save the quick note. Please try again.' }, 500, cors);
  }
}
