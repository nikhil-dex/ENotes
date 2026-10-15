import { getDatabase } from '../../../lib/mongodb.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
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
    const slug = new URL(request.url).searchParams.get('subject') || 'linux';
    const db = await getDatabase();
    const subject = await db.collection('subjects').findOne({ _id: slug });
    if (!subject) return json({ error: 'Subject not found.' }, 404);
    const notes = await db.collection('notes').find({ subject: slug }).sort({ number: -1 }).toArray();
    return json(notes.map(({ _id, subject: noteSubject, number, heading, answer, saved }) => ({
      number, heading, answer, saved, subject: noteSubject,
    })));
  } catch (error) {
    console.error('GET /api/notes failed:', error);
    return json({ error: 'Could not load notes. Check the MongoDB connection settings.' }, 500);
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const slug = String(data.subject || 'linux');
    const heading = String(data.heading || '').trim();
    const answer = String(data.answer || '').trim();
    if (!heading || !answer || heading.length > 160 || answer.length > 10000) {
      return json({ error: 'Add a heading and answer within the allowed length.' }, 400);
    }

    const db = await getDatabase();
    // Atomically reserve the next note number. The pipeline also repairs older
    // subjects whose nextNumber field is missing or invalid, without reusing IDs.
    const subject = await db.collection('subjects').findOneAndUpdate(
      { _id: slug },
      [{
        $set: {
          nextNumber: {
            $add: [
              { $max: [{ $ifNull: ['$nextNumber', 1] }, 1] },
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
      createdAt: new Date(),
    };
    await db.collection('notes').insertOne(note);
    return json(note, 201);
  } catch (error) {
    console.error('POST /api/notes failed:', { name: error?.name, message: error?.message, code: error?.code });
    if (error?.code === 11000) {
      return json({ error: 'A note-number conflict occurred. Refresh the page and try saving again.' }, 409);
    }
    return json({ error: 'Could not save this note. Please refresh and try again; if it persists, check the deployment logs.' }, 500);
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const slug = String(data.subject || 'linux');
    const number = Number(data.number);
    const heading = String(data.heading || '').trim();
    const answer = String(data.answer || '').trim();
    if (!Number.isInteger(number) || number < 1) return json({ error: 'Choose a valid note.' }, 400);
    if (!heading || !answer || heading.length > 160 || answer.length > 10000) {
      return json({ error: 'Add a heading and answer within the allowed length.' }, 400);
    }

    const db = await getDatabase();
    const result = await db.collection('notes').findOneAndUpdate(
      { _id: `${slug}:${number}`, subject: slug },
      { $set: {
        heading: heading.replace(/[\r\n]+/g, ' '),
        answer: answer.replace(/\r\n/g, '\n'),
        saved: savedTime(),
        updatedAt: new Date(),
      } },
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
