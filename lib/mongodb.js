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
      db.collection('subjects').createIndex({ order: 1, name: 1 }),
      db.collection('notes').createIndex({ subject: 1, number: -1 }),
      db.collection('notes').createIndex({ subject: 1, number: 1 }, { unique: true }),
      db.collection('savedLinks').createIndex({ order: 1, createdAt: -1 }),
      db.collection('quickNotes').createIndex({ updatedAt: -1, createdAt: -1 }),
      db.collection('mediaFolders').createIndex({ name: 1 }),
      db.collection('mediaFiles').createIndex({ folderId: 1, status: 1, updatedAt: -1 }),
      db.collection('mediaFiles').createIndex({ objectKey: 1 }, { unique: true }),
      db.collection('extensionPairings').createIndex({ codeHash: 1 }, { unique: true }),
      db.collection('extensionPairings').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection('extensionTokens').createIndex({ tokenHash: 1 }, { unique: true }),
      db.collection('extensionTokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).catch((error) => {
      // Allow a later request to retry index setup after a transient database failure.
      indexesPromise = undefined;
      throw error;
    });
  }
  await indexesPromise;
  return db;
}
