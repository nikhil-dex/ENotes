import { getDatabase } from '../../../lib/mongodb.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const MAX_SUBJECTS = 1000;
const MAX_NOTES = 50000;

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateBackup(backup) {
  if (!isPlainObject(backup) || backup.format !== 'enotes-backup' || backup.version !== 1) {
    return 'This is not a supported ENotes backup file.';
  }
  if (!Array.isArray(backup.subjects) || !Array.isArray(backup.notes)) {
    return 'The backup must contain subjects and notes arrays.';
  }
  if (backup.subjects.length > MAX_SUBJECTS || backup.notes.length > MAX_NOTES) {
    return 'The backup contains too many records.';
  }

  const subjectSlugs = new Set();
  for (const subject of backup.subjects) {
    if (!isPlainObject(subject)) return 'A subject record is invalid.';
    const slug = typeof subject.slug === 'string' ? subject.slug : subject._id;
    if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return 'A subject has an invalid slug.';
    }
    if (typeof subject.name !== 'string' || !subject.name.trim() || subject.name.length > 40) {
      return 'A subject has an invalid name.';
    }
    if (subjectSlugs.has(slug)) return `The backup contains duplicate subject “${slug}”.`;
    subjectSlugs.add(slug);
    if (subject.nextNumber !== undefined && (!Number.isInteger(subject.nextNumber) || subject.nextNumber < 1)) {
      return `Subject “${slug}” has an invalid next note number.`;
    }
  }

  const noteIds = new Set();
  for (const note of backup.notes) {
    if (!isPlainObject(note)) return 'A note record is invalid.';
    if (typeof note.subject !== 'string' || !subjectSlugs.has(note.subject)) {
      return 'Every note must refer to a subject included in the backup.';
    }
    if (!Number.isInteger(note.number) || note.number < 1) return 'A note has an invalid note number.';
    if (typeof note.heading !== 'string' || !note.heading.trim() || note.heading.length > 160) {
      return 'A note has an invalid heading.';
    }
    if (typeof note.answer !== 'string' || !note.answer.trim() || note.answer.length > 10000) {
      return 'A note has invalid content.';
    }
    const id = `${note.subject}:${note.number}`;
    if (noteIds.has(id)) return `The backup contains duplicate note ${id}.`;
    noteIds.add(id);
    if (note.saved !== undefined && typeof note.saved !== 'string') return `Note ${id} has an invalid saved timestamp.`;
  }

  return null;
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

    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_BACKUP_BYTES) {
      return json({ error: 'Backup files must be 10 MB or smaller.' }, 413);
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
