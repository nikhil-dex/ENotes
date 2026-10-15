import { getDatabase } from '../../../lib/mongodb.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function GET() {
  try {
    const db = await getDatabase();
    const subjects = await db.collection('subjects').find({}).sort({ order: 1, name: 1 }).toArray();
    return json(subjects.map(({ _id, name, slug, file, nextNumber }) => ({
      slug: slug || _id,
      name,
      file: file || `notes/${slug || _id}.md`,
      nextNumber: nextNumber || 1,
    })));
  } catch (error) {
    console.error('GET /api/subjects failed:', error);
    return json({ error: 'Could not load subjects. Check the MongoDB connection settings.' }, 500);
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const name = String(data.name || '').trim().replace(/\s+/g, ' ');
    if (!name || name.length > 40) return json({ error: 'Subject name must be 1–40 characters.' }, 400);

    const slug = slugify(name);
    if (!slug) return json({ error: 'Enter a subject name using letters or numbers.' }, 400);

    const db = await getDatabase();
    const subject = { _id: slug, slug, name, file: `notes/${slug}.md`, nextNumber: 1, order: await db.collection('subjects').countDocuments(), createdAt: new Date() };
    try {
      await db.collection('subjects').insertOne(subject);
    } catch (error) {
      if (error?.code === 11000) return json({ error: 'That subject already exists.' }, 409);
      throw error;
    }
    return json({ slug, name, file: subject.file, nextNumber: 1 }, 201);
  } catch (error) {
    console.error('POST /api/subjects failed:', error);
    return json({ error: 'Could not create the subject.' }, 500);
  }
}

export async function DELETE(request) {
  try {
    const slug = new URL(request.url).searchParams.get('slug');
    if (!slug) return json({ error: 'Choose a subject to delete.' }, 400);

    const db = await getDatabase();
    const subjects = db.collection('subjects');
    const subject = await subjects.findOne({ _id: slug });
    if (!subject) return json({ error: 'Subject not found.' }, 404);
    if (await subjects.countDocuments() <= 1) {
      return json({ error: 'Keep at least one subject. Add another subject before deleting this one.' }, 400);
    }

    await db.collection('notes').deleteMany({ subject: slug });
    await subjects.deleteOne({ _id: slug });
    return json({ deleted: slug });
  } catch (error) {
    console.error('DELETE /api/subjects failed:', error);
    return json({ error: 'Could not delete the subject.' }, 500);
  }
}
