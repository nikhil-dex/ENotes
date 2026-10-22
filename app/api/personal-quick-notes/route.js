import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../../lib/mongodb.js';
import { readLimitedBody } from '../../../lib/read-limited-body.js';
import { MAX_QUICK_NOTE_LENGTH, normalizeQuickNoteContent, quickNoteTitle } from '../../../lib/quick-notes.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function readJson(request) {
  try {
    return { data: JSON.parse(await readLimitedBody(request, 96 * 1024)) };
  } catch (error) {
    return { error: json({ error: error?.status === 413 ? 'Request body is too large.' : 'Enter valid JSON.' }, error?.status || 400) };
  }
}

function validId(value) {
  return typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value);
}

export async function GET() {
  try {
    const db = await getDatabase();
    const notes = await db.collection('personalQuickNotes')
      .find({}, { projection: { _id: 1, title: 1, content: 1, createdAt: 1, updatedAt: 1 } })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(1000)
      .toArray();
    return json(notes.map((note) => ({ ...note, id: String(note._id), _id: undefined })));
  } catch (error) {
    console.error('GET /api/personal-quick-notes failed:', error);
    return json({ error: 'Could not load personal quick notes. Check the database connection settings.' }, 500);
  }
}

export async function POST(request) {
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  const content = normalizeQuickNoteContent(parsed.data?.content);
  if (content.length > MAX_QUICK_NOTE_LENGTH) return json({ error: 'Personal personal quick notes must be 20,000 characters or fewer.' }, 400);

  try {
    const db = await getDatabase();
    const now = new Date();
    const note = { _id: randomUUID(), title: quickNoteTitle(content), content, createdAt: now, updatedAt: now };
    await db.collection('personalQuickNotes').insertOne(note);
    return json({ ...note, id: note._id, _id: undefined }, 201);
  } catch (error) {
    console.error('POST /api/personal-quick-notes failed:', error);
    return json({ error: 'Could not create a personal quick note. Please try again.' }, 500);
  }
}

export async function PUT(request) {
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  const id = parsed.data?.id;
  if (!validId(id)) return json({ error: 'Choose a valid personal quick note.' }, 400);
  if (typeof parsed.data?.content !== 'string') return json({ error: 'Quick note content must be text.' }, 400);
  const content = normalizeQuickNoteContent(parsed.data.content);
  if (content.length > MAX_QUICK_NOTE_LENGTH) return json({ error: 'Personal personal quick notes must be 20,000 characters or fewer.' }, 400);

  try {
    const db = await getDatabase();
    const result = await db.collection('personalQuickNotes').findOneAndUpdate(
      { _id: id },
      { $set: { content, title: quickNoteTitle(content), updatedAt: new Date() } },
      { returnDocument: 'after', includeResultMetadata: false },
    );
    if (!result) return json({ error: 'Quick note not found. Refresh and try again.' }, 404);
    return json({ ...result, id: String(result._id), _id: undefined });
  } catch (error) {
    console.error('PUT /api/personal-quick-notes failed:', error);
    return json({ error: 'Could not save this personal quick note. Please try again.' }, 500);
  }
}

export async function DELETE(request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!validId(id)) return json({ error: 'Choose a valid personal quick note.' }, 400);
  try {
    const db = await getDatabase();
    const result = await db.collection('personalQuickNotes').deleteOne({ _id: id });
    if (!result.deletedCount) return json({ error: 'Quick note not found.' }, 404);
    return json({ deleted: id });
  } catch (error) {
    console.error('DELETE /api/personal-quick-notes failed:', error);
    return json({ error: 'Could not delete this personal quick note. Please try again.' }, 500);
  }
}
