import { getDatabase } from '../../../lib/mongodb.js';
import { MAX_BACKUP_BYTES, validateBackup } from '../../../lib/backup-validation.js';
import { readLimitedBody } from '../../../lib/read-limited-body.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
}


export async function GET() {
  try {
    const db = await getDatabase();
    const [subjects, notes] = await Promise.all([
      db.collection('subjects').find({}).sort({ order: 1, name: 1 }).toArray(),
      db.collection('notes').find({}).sort({ subject: 1, number: 1 }).toArray(),
    ]);

    const backup = {
      format: 'enotes-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      subjects,
      notes,
    };
    const filename = `enotes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    return new Response(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('GET /api/backup failed:', error);
    return json({ error: 'Could not export the backup. Check the database connection.' }, 500);
  }
}

export async function POST(request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_BACKUP_BYTES) return json({ error: 'Backup files must be 10 MB or smaller.' }, 413);

    let raw;
    try {
      raw = await readLimitedBody(request, MAX_BACKUP_BYTES);
    } catch (error) {
      return json({ error: 'Backup files must be 10 MB or smaller.' }, error?.status || 400);
    }

    let backup;
    try {
      backup = JSON.parse(raw);
    } catch {
      return json({ error: 'The selected file is not valid JSON.' }, 400);
    }

    const validationError = validateBackup(backup);
    if (validationError) return json({ error: validationError }, 400);

    const db = await getDatabase();
    const subjectsCollection = db.collection('subjects');
    const notesCollection = db.collection('notes');
    const existingSubjects = await subjectsCollection.find({}).toArray();
    const existingSlugs = new Set(existingSubjects.map((subject) => subject.slug || subject._id));
    const existingSubjectBySlug = new Map(existingSubjects.map((subject) => [subject.slug || subject._id, subject]));
    const incomingSlugs = new Set(backup.subjects.map((subject) => subject.slug || subject._id));

    // Do not replace existing subject metadata or note contents during restore.
    // New records are added; records with matching identifiers are left untouched.
    const subjectsToInsert = backup.subjects
      .filter((subject) => !existingSlugs.has(subject.slug || subject._id))
      .map((subject, index) => {
        const slug = subject.slug || subject._id;
        return {
          _id: slug,
          slug,
          name: subject.name.trim(),
          file: typeof subject.file === 'string' ? subject.file : `notes/${slug}.md`,
          nextNumber: Number.isInteger(subject.nextNumber) && subject.nextNumber > 0 ? subject.nextNumber : 1,
          order: Number.isInteger(subject.order) && subject.order >= 0 ? subject.order : existingSubjects.length + index,
          createdAt: subject.createdAt ? new Date(subject.createdAt) : new Date(),
        };
      });

    if (subjectsToInsert.length) await subjectsCollection.insertMany(subjectsToInsert, { ordered: true });

    const restoredSlugs = new Set([...existingSlugs, ...incomingSlugs]);
    const existingNoteIds = new Set(
      (await notesCollection.find({}, { projection: { _id: 1 } }).toArray()).map((note) => String(note._id)),
    );
    let notesAdded = 0;
    let notesSkipped = 0;
    const maxNumberBySubject = new Map();

    for (const note of backup.notes) {
      const id = `${note.subject}:${note.number}`;
      maxNumberBySubject.set(note.subject, Math.max(maxNumberBySubject.get(note.subject) || 0, note.number));
      if (existingNoteIds.has(id)) {
        notesSkipped += 1;
        continue;
      }
      if (!restoredSlugs.has(note.subject)) continue;

      const document = {
        _id: id,
        subject: note.subject,
        number: note.number,
        heading: note.heading.trim().replace(/[\\r\\n]+/g, ' '),
        answer: note.answer.replace(/\\r\\n/g, '\\n'),
        saved: typeof note.saved === 'string' ? note.saved : new Date().toISOString(),
        createdAt: note.createdAt ? new Date(note.createdAt) : new Date(),
      };
      try {
        await notesCollection.insertOne(document);
        existingNoteIds.add(id);
        notesAdded += 1;
      } catch (error) {
        if (error?.code === 11000) notesSkipped += 1;
        else throw error;
      }
    }

    for (const slug of incomingSlugs) {
      const current = existingSubjectBySlug.get(slug);
      const backupSubject = backup.subjects.find((subject) => (subject.slug || subject._id) === slug);
      const nextNumber = Math.max(
        current?.nextNumber || 1,
        backupSubject?.nextNumber || 1,
        (maxNumberBySubject.get(slug) || 0) + 1,
      );
      await subjectsCollection.updateOne({ _id: slug }, { $max: { nextNumber } });
    }

    return json({
      ok: true,
      subjectsAdded: subjectsToInsert.length,
      notesAdded,
      notesSkipped,
      mode: 'merge',
      message: 'Restore complete. Existing subjects and notes were not overwritten.',
    });
  } catch (error) {
    console.error('POST /api/backup failed:', error);
    return json({ error: 'Restore could not be completed. Some new records may have been added; export a fresh backup before retrying.' }, 500);
  }
}
