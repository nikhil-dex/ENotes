import { getDatabase } from '../../../lib/mongodb.js';
import { readLimitedBody } from '../../../lib/read-limited-body.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function normalizeTags(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const tags = [...new Set(value.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
  if (tags.length > 10 || tags.some((tag) => tag.length > 24 || !/^[\\p{L}\\p{N} _-]+$/u.test(tag))) return null;
  return tags;
}

function savedTime() {
  return new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }) + ' (IST)';
}

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const slug = params.get('subject') || 'linux';
    const history = params.get('history') === '1';
    const historyNumber = Number(params.get('number'));
    if (history && (!Number.isInteger(historyNumber) || historyNumber < 1)) {
      return json({ error: 'Choose a valid note.' }, 400);
    }
    const db = await getDatabase();
    const subject = await db.collection('subjects').findOne({ _id: slug });
    if (!subject) return json({ error: 'Subject not found.' }, 404);
    if (history) {
      const note = await db.collection('notes').findOne(
        { _id: `${slug}:${historyNumber}`, subject: slug },
        { projection: { _id: 0, revisions: 1 } },
      );
      if (!note) return json({ error: 'Note not found.' }, 404);
      return json({ revisions: Array.isArray(note.revisions) ? note.revisions.slice().reverse() : [] });
    }
    const notes = await db.collection('notes')
      .find({ subject: slug }, { projection: { _id: 0, subject: 1, number: 1, heading: 1, answer: 1, saved: 1, tags: 1, favorite: 1, pinned: 1 } })
      .sort({ number: -1 })
      .toArray();
    return json(notes);
  } catch (error) {
    console.error('GET /api/notes failed:', error);
    return json({ error: 'Could not load notes. Check the MongoDB connection settings.' }, 500);
  }
}

export async function POST(request) {
  try {
    let data;
    try {
      data = JSON.parse(await readLimitedBody(request, 32 * 1024));
    } catch (error) {
      return json({ error: error?.status === 413 ? 'Request body is too large.' : 'Enter valid JSON.' }, error?.status || 400);
    }
    const slug = String(data.subject || 'linux');
    const heading = String(data.heading || '').trim();
    const answer = String(data.answer || '').trim();
    const tags = normalizeTags(data.tags);
    if (tags === null) return json({ error: 'Use up to 10 tags, each no longer than 24 characters.' }, 400);
    const favorite = data.favorite === true;
    const pinned = data.pinned === true;
    if (!heading || !answer || heading.length > 160 || answer.length > 10000) {
      return json({ error: 'Add a heading and answer within the allowed length.' }, 400);
    }

    const db = await getDatabase();
    // Reconcile stale counters and retry duplicate-key conflicts. Reservation is
    // atomic so concurrent saves normally receive distinct numbers; retries recover
    // from counters that predate the current numbering rules.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const latestNote = await db.collection('notes')
        .find({ subject: slug }, { projection: { number: 1 } })
        .sort({ number: -1 })
        .limit(1)
        .next();
      const nextAfterExisting = Number.isInteger(latestNote?.number)
        ? latestNote.number + 1
        : 1;

      const subject = await db.collection('subjects').findOneAndUpdate(
        { _id: slug },
        [{
          $set: {
            nextNumber: {
              $add: [
                { $max: [{ $ifNull: ['$nextNumber', 1] }, nextAfterExisting, 1] },
                1,
              ],
            },
          },
        }],
        { returnDocument: 'after', includeResultMetadata: false },
      );
      if (!subject) return json({ error: 'Choose a valid subject.' }, 404);

      const number = subject.nextNumber - 1;
      const note = {
        _id: `${slug}:${number}`,
        subject: slug,
        number,
        heading: heading.replace(/[\r\n]+/g, ' '),
        answer: answer.replace(/\r\n/g, '\n'),
        saved: savedTime(),
        tags,
        favorite,
        pinned,
        createdAt: new Date(),
      };
      try {
        await db.collection('notes').insertOne(note);
        return json(note, 201);
      } catch (error) {
        if (error?.code !== 11000) throw error;
        if (attempt === 4) {
          console.error('POST /api/notes exhausted note-number retries:', {
            keyPattern: error?.keyPattern,
            keyValue: error?.keyValue,
          });
          return json({ error: 'Could not reserve a unique note number. Please try again; if it continues, contact the app owner.' }, 409);
        }
      }
    }
    return json({ error: 'Could not reserve a unique note number. Please try again.' }, 409);
  } catch (error) {
    console.error('POST /api/notes failed:', { name: error?.name, message: error?.message, code: error?.code });
    return json({ error: 'Could not save this note. Please refresh and try again; if it persists, check the deployment logs.' }, 500);
  }
}

export async function PUT(request) {
  try {
    let data;
    try {
      data = JSON.parse(await readLimitedBody(request, 32 * 1024));
    } catch (error) {
      return json({ error: error?.status === 413 ? 'Request body is too large.' : 'Enter valid JSON.' }, error?.status || 400);
    }
    const slug = String(data.subject || 'linux');
    const number = Number(data.number);
    const heading = String(data.heading || '').trim();
    const answer = String(data.answer || '').trim();
    const tags = normalizeTags(data.tags);
    if (tags === null) return json({ error: 'Use up to 10 tags, each no longer than 24 characters.' }, 400);
    const favorite = data.favorite === true;
    const pinned = data.pinned === true;
    if (!Number.isInteger(number) || number < 1) return json({ error: 'Choose a valid note.' }, 400);
    if (!heading || !answer || heading.length > 160 || answer.length > 10000) {
      return json({ error: 'Add a heading and answer within the allowed length.' }, 400);
    }

    const db = await getDatabase();
    const collection = db.collection('notes');
    const previous = await collection.findOne(
      { _id: `${slug}:${number}`, subject: slug },
      { projection: { heading: 1, answer: 1, saved: 1, revisions: 1 } },
    );
    if (!previous) return json({ error: 'Note not found.' }, 404);
    const result = await collection.findOneAndUpdate(
      { _id: `${slug}:${number}`, subject: slug },
      {
        $set: {
          heading: heading.replace(/[\\r\\n]+/g, ' '),
          answer: answer.replace(/\\r\\n/g, '\\n'),
          saved: savedTime(),
          tags,
          favorite,
          pinned,
          updatedAt: new Date(),
        },
        $push: {
          revisions: {
            $each: [{
              heading: previous.heading || '',
              answer: previous.answer || '',
              saved: previous.saved || '',
              revisedAt: new Date(),
            }],
            $slice: -20,
          },
        },
      },
      { returnDocument: 'after', includeResultMetadata: false },
    );
    if (!result) return json({ error: 'Note not found.' }, 404);
    return json(result);
  } catch (error) {
    console.error('PUT /api/notes failed:', error);
    return json({ error: 'Could not update this note.' }, 500);
  }
}

export async function DELETE(request) {
  try {
    const url = new URL(request.url);
    const subject = url.searchParams.get('subject') || 'linux';
    const number = Number(url.searchParams.get('number'));
    if (!Number.isInteger(number) || number < 1) return json({ error: 'Choose a valid note.' }, 400);

    const db = await getDatabase();
    const result = await db.collection('notes').deleteOne({ _id: `${subject}:${number}`, subject });
    if (!result.deletedCount) return json({ error: 'Note not found.' }, 404);
    return json({ deleted: number, subject });
  } catch (error) {
    console.error('DELETE /api/notes failed:', error);
    return json({ error: 'Could not delete this note.' }, 500);
  }
}
