import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../../lib/mongodb.js';
import { readLimitedBody } from '../../../lib/read-limited-body.js';
import { normalizeSavedLink } from '../../../lib/saved-links.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function readJson(request, limit = 24 * 1024) {
  try {
    return { data: JSON.parse(await readLimitedBody(request, limit)) };
  } catch (error) {
    return { error: json({ error: error?.status === 413 ? 'Request body is too large.' : 'Enter valid JSON.' }, error?.status || 400) };
  }
}

export async function GET() {
  try {
    const db = await getDatabase();
    const links = await db.collection('savedLinks')
      .find({}, { projection: { _id: 1, title: 1, url: 1, description: 1, category: 1, tags: 1, order: 1, createdAt: 1, updatedAt: 1 } })
      .sort({ order: 1, createdAt: -1 })
      .limit(1000)
      .toArray();
    return json(links.map((link) => ({ ...link, id: link._id.toString(), _id: undefined })));
  } catch (error) {
    console.error('GET /api/saved-links failed:', error);
    return json({ error: 'Could not load saved links. Check the MongoDB connection settings.' }, 500);
  }
}

export async function POST(request) {
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  const normalized = normalizeSavedLink(parsed.data);
  if (normalized.error) return json({ error: normalized.error }, 400);

  try {
    const db = await getDatabase();
    const collection = db.collection('savedLinks');
    const count = await collection.countDocuments();
    const now = new Date();
    const link = {
      _id: randomUUID(),
      ...normalized.value,
      order: count,
      createdAt: now,
      updatedAt: now,
    };
    await collection.insertOne(link);
    return json({ ...link, id: link._id, _id: undefined }, 201);
  } catch (error) {
    console.error('POST /api/saved-links failed:', error);
    return json({ error: 'Could not save this link. Please try again.' }, 500);
  }
}

export async function PUT(request) {
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  const id = String(parsed.data?.id || '');
  if (!/^[a-f0-9-]{36}$/i.test(id)) return json({ error: 'Choose a valid saved link.' }, 400);
  const normalized = normalizeSavedLink(parsed.data);
  if (normalized.error) return json({ error: normalized.error }, 400);

  try {
    const db = await getDatabase();
    const result = await db.collection('savedLinks').findOneAndUpdate(
      { _id: id },
      { $set: { ...normalized.value, updatedAt: new Date() } },
      { returnDocument: 'after', includeResultMetadata: false },
    );
    if (!result) return json({ error: 'Saved link not found.' }, 404);
    return json({ ...result, id: result._id, _id: undefined });
  } catch (error) {
    console.error('PUT /api/saved-links failed:', error);
    return json({ error: 'Could not update this link. Please try again.' }, 500);
  }
}

export async function PATCH(request) {
  const parsed = await readJson(request, 32 * 1024);
  if (parsed.error) return parsed.error;
  const ids = parsed.data?.orderedIds;
  if (!Array.isArray(ids) || ids.length > 1000 || ids.some((id) => typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) || new Set(ids).size !== ids.length) {
    return json({ error: 'Choose a valid order for the saved links.' }, 400);
  }

  try {
    const db = await getDatabase();
    const collection = db.collection('savedLinks');
    const existingCount = await collection.countDocuments({ _id: { $in: ids } });
    if (existingCount !== ids.length) return json({ error: 'One or more saved links could not be found. Refresh and try again.' }, 409);
    if (ids.length) {
      await collection.bulkWrite(ids.map((id, order) => ({
        updateOne: { filter: { _id: id }, update: { $set: { order, updatedAt: new Date() } } },
      })));
    }
    return json({ reordered: ids.length });
  } catch (error) {
    console.error('PATCH /api/saved-links failed:', error);
    return json({ error: 'Could not reorder saved links. Please try again.' }, 500);
  }
}

export async function DELETE(request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[a-f0-9-]{36}$/i.test(id)) return json({ error: 'Choose a valid saved link.' }, 400);

  try {
    const db = await getDatabase();
    const collection = db.collection('savedLinks');
    const result = await collection.deleteOne({ _id: id });
    if (!result.deletedCount) return json({ error: 'Saved link not found.' }, 404);
    const remaining = await collection.find({}, { projection: { _id: 1, order: 1 } }).sort({ order: 1, createdAt: -1 }).toArray();
    if (remaining.length) {
      await collection.bulkWrite(remaining.map((link, order) => ({
        updateOne: { filter: { _id: link._id }, update: { $set: { order } } },
      })));
    }
    return json({ deleted: id });
  } catch (error) {
    console.error('DELETE /api/saved-links failed:', error);
    return json({ error: 'Could not delete this link. Please try again.' }, 500);
  }
}
