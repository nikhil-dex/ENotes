import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { loadEnvConfig } from '@next/env';
import { MongoClient } from 'mongodb';

loadEnvConfig(process.cwd());

const scrypt = promisify(scryptCallback);
const uri = process.env.MONGODB_URI;
const accessKey = process.env.ENOTES_ACCESS_KEY;

if (!uri) {
  console.error('Missing MONGODB_URI. Set it in .env.local before configuring the access key.');
  process.exit(1);
}
if (!accessKey || accessKey.length < 12) {
  console.error('Set ENOTES_ACCESS_KEY in .env.local to a string of at least 12 characters.');
  process.exit(1);
}

const salt = randomBytes(16);
const keyHash = await scrypt(accessKey, salt, 64);
const client = new MongoClient(uri, { maxPoolSize: 2, appName: 'enotes-access-key-setup' });

try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'linux_notes');
  await db.collection('settings').updateOne(
    { _id: 'shared-access-key' },
    {
      $set: {
        salt: salt.toString('base64'),
        keyHash: keyHash.toString('base64'),
        updatedAt: new Date(),
        scheme: 'scrypt',
      },
    },
    { upsert: true },
  );
  console.log('ENotes shared access key saved as a salted hash in MongoDB.');
  console.log('Remove ENOTES_ACCESS_KEY from .env.local after setup if you do not need to rotate the key again.');
} catch (error) {
  console.error('Could not save the access key:', error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
