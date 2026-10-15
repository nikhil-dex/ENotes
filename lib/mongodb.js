import { MongoClient } from 'mongodb';

const options = { maxPoolSize: 10, appName: 'linux-notes-dashboard' };
let indexesPromise;

export async function getDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Missing MONGODB_URI. Add it to .env.local and the Vercel environment variables.');

  if (!globalThis._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    globalThis._mongoClientPromise = client.connect();
  }
  const client = await globalThis._mongoClientPromise;
  const db = client.db(process.env.MONGODB_DB || 'linux_notes');
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      db.collection('subjects').createIndex({ slug: 1 }, { unique: true }),
      db.collection('notes').createIndex({ subject: 1, number: -1 }),
      db.collection('notes').createIndex({ subject: 1, number: 1 }, { unique: true }),
    ]);
  }
  await indexesPromise;
  return db;
}
