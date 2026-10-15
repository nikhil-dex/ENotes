import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'linux_notes';

if (!uri) {
  console.error('Set MONGODB_URI in .env.local or your shell before importing notes.');
  process.exit(1);
}

function parseNotes(markdown, slug) {
  const sections = [...markdown.matchAll(/^## (\d+)\. (.+)\n\*\*Saved:\*\* (.+)\n\n([\s\S]*?)(?=\n## |$)/gm)];
  return sections.map((match) => ({
    _id: `${slug}:${Number(match[1])}`,
    subject: slug,
    number: Number(match[1]),
    heading: match[2],
    saved: match[3],
    answer: match[4].trim(),
    createdAt: new Date(),
  }));
}

const subjects = JSON.parse(await readFile(path.join(root, 'subjects.json'), 'utf8'));
const client = new MongoClient(uri, { maxPoolSize: 5, appName: 'linux-notes-import' });

try {
  await client.connect();
  const db = client.db(dbName);
  const subjectCollection = db.collection('subjects');
  const noteCollection = db.collection('notes');
  await noteCollection.createIndex({ subject: 1, number: 1 }, { unique: true });
  await noteCollection.createIndex({ subject: 1, number: -1 });

  let imported = 0;
  for (const [order, subject] of subjects.entries()) {
    const markdown = await readFile(path.join(root, 'notes', `${subject.slug}.md`), 'utf8').catch(() => '');
    const notes = parseNotes(markdown, subject.slug);
    const highest = notes.reduce((max, note) => Math.max(max, note.number), 0);
    const nextNumber = Math.max(Number(subject.nextNumber) || 1, highest + 1);

    await subjectCollection.updateOne(
      { _id: subject.slug },
      { $setOnInsert: {
        _id: subject.slug,
        slug: subject.slug,
        name: subject.name,
        file: `notes/${subject.slug}.md`,
        nextNumber,
        order,
        createdAt: new Date(),
      } },
      { upsert: true },
    );
    await subjectCollection.updateOne({ _id: subject.slug }, { $max: { nextNumber } });

    for (const note of notes) {
      await noteCollection.updateOne({ _id: note._id }, { $setOnInsert: note }, { upsert: true });
      imported++;
    }
    console.log(`Imported ${notes.length} notes for ${subject.name}.`);
  }
  console.log(`Finished. ${imported} note records were checked; existing records were preserved.`);
} finally {
  await client.close();
}
