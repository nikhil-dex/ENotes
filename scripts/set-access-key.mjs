import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const scrypt = promisify(scryptCallback);
const accessKey = process.env.ENOTES_ACCESS_KEY;

if (!accessKey || accessKey.length !== 9) {
  console.error('Set ENOTES_ACCESS_KEY in .env.local to exactly 9 characters.');
  process.exit(1);
}

const salt = randomBytes(16);
const keyHash = await scrypt(accessKey, salt, 64);
const document = {
  _id: 'shared-access-key',
  salt: salt.toString('base64'),
  keyHash: keyHash.toString('base64'),
  updatedAt: { $date: new Date().toISOString() },
  scheme: 'scrypt',
};

console.log('\nCopy the following MongoDB Extended JSON document into your database:');
console.log('Database: value of MONGODB_DB (defaults to linux_notes)');
console.log('Collection: settings');
console.log('\n--- DOCUMENT START ---');
console.log(JSON.stringify(document, null, 2));
console.log('--- DOCUMENT END ---\n');
console.log('In MongoDB Compass, open the settings collection and insert this document.');
console.log('If a document with _id "shared-access-key" already exists, replace/update that document instead of inserting a duplicate.');
console.log('This script only generates the document locally. It does not connect to MongoDB.');
