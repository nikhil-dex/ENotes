import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MEDIA_FILE_BYTES,
  MAX_MEDIA_FILES,
  isValidFolderId,
  isValidMediaId,
  normalizeFolderName,
  normalizeMediaFile,
} from '../lib/media-validation.js';
import { createPresignedUrl } from '../lib/r2-storage.js';

test('normalizes folder names and rejects unsafe paths', () => {
  assert.deepEqual(normalizeFolderName('  Study   PDFs '), { value: 'Study PDFs' });
  assert.match(normalizeFolderName('../private').error, /slashes/);
  assert.match(normalizeFolderName('  ').error, /1–80/);
  assert.match(normalizeFolderName('x'.repeat(81)).error, /1–80/);
});

test('accepts supported image and PDF types with matching extensions', () => {
  assert.equal(normalizeMediaFile({ name: 'lecture.pdf', type: 'application/pdf', size: 1024 }).error, undefined);
  assert.equal(normalizeMediaFile({ name: 'diagram.PNG', type: 'image/png', size: 1 }).error, undefined);
  assert.equal(normalizeMediaFile({ name: 'photo.jpeg', type: 'image/jpeg', size: 2048 }).error, undefined);
  assert.equal(normalizeMediaFile({ name: 'photo.webp', type: 'image/webp', size: 512 }).error, undefined);
});

test('rejects unsafe names, mismatched extensions, unsupported types, and oversized files', () => {
  assert.match(normalizeMediaFile({ name: '../lecture.pdf', type: 'application/pdf', size: 12 }).error, /path separators/);
  assert.match(normalizeMediaFile({ name: 'lecture.png', type: 'application/pdf', size: 12 }).error, /matching PDF/);
  assert.match(normalizeMediaFile({ name: 'notes.txt', type: 'text/plain', size: 12 }).error, /matching PDF/);
  assert.match(normalizeMediaFile({ name: 'lecture.pdf', type: 'application/pdf', size: MAX_MEDIA_FILE_BYTES + 1 }).error, /20 MB/);
  assert.match(normalizeMediaFile({ name: 'lecture.pdf', type: 'application/pdf', size: 0 }).error, /20 MB/);
});

test('validates media IDs and root/folder selectors', () => {
  assert.equal(isValidMediaId('f47ac10b-58cc-4372-a567-0e02b2c3d479'), true);
  assert.equal(isValidMediaId('../secret'), false);
  assert.equal(isValidFolderId(null), true);
  assert.equal(isValidFolderId(''), true);
  assert.equal(isValidFolderId('f47ac10b-58cc-4372-a567-0e02b2c3d479'), true);
  assert.equal(isValidFolderId('bad'), false);
  assert.equal(MAX_MEDIA_FILES, 10000);
});


test('creates short-lived signed URLs without exposing public bucket access', () => {
  const original = {
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  };
  Object.assign(process.env, {
    R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
    R2_BUCKET_NAME: 'enotes-private',
    R2_ACCESS_KEY_ID: 'test-access-key',
    R2_SECRET_ACCESS_KEY: 'test-secret-key',
  });
  try {
    const url = new URL(createPresignedUrl('PUT', 'media/f47ac10b-58cc-4372-a567-0e02b2c3d479', 300, new Date('2026-10-18T12:00:00.000Z')));
    assert.equal(url.hostname, '0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com');
    assert.equal(url.searchParams.get('X-Amz-Expires'), '300');
    assert.equal(url.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256');
    assert.match(url.searchParams.get('X-Amz-Signature') || '', /^[a-f0-9]{64}$/);
    assert.equal(url.searchParams.has('X-Amz-Signature'), true);
    assert.match(createPresignedUrl('GET', 'media/f47ac10b-58cc-4372-a567-0e02b2c3d479', 300, new Date('2026-10-18T12:00:00.000Z'), 'attachment; filename="lecture.pdf"'), /response-content-disposition=attachment/);
    assert.throws(() => createPresignedUrl('GET', 'private/other', 300), /Invalid storage object key/);
    assert.throws(() => createPresignedUrl('GET', 'media/f47ac10b-58cc-4372-a567-0e02b2c3d479', 3600), /1–900/);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});


test('accepts correct file signatures and rejects mismatched contents', () => {
  assert.equal(hasValidMediaSignature(Buffer.from('%PDF-1.7'), 'application/pdf'), true);
  assert.equal(hasValidMediaSignature(Buffer.from([0xff, 0xd8, 0xff, 0xdb]), 'image/jpeg'), true);
  assert.equal(hasValidMediaSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'), true);
  assert.equal(hasValidMediaSignature(Buffer.from('RIFF1234WEBP'), 'image/webp'), true);
  assert.equal(hasValidMediaSignature(Buffer.from('<html>'), 'application/pdf'), false);
  assert.equal(hasValidMediaSignature(Buffer.from('not a webp'), 'image/webp'), false);
});

test('backup validator accepts media metadata but rejects invalid keys and orphan folders', async () => {
  const { validateBackup } = await import('../lib/backup-validation.js');
  const base = { format: 'enotes-backup', version: 1, subjects: [], notes: [] };
  const folderId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const fileId = 'f47ac10b-58cc-4372-a567-0e02b2c3d480';
  const folder = { _id: folderId, name: 'PDFs' };
  const file = { _id: fileId, name: 'lecture.pdf', type: 'application/pdf', size: 1024, folderId, objectKey: `media/${fileId}`, status: 'ready' };
  assert.equal(validateBackup({ ...base, mediaFolders: [folder], mediaFiles: [file] }), null);
  assert.match(validateBackup({ ...base, mediaFolders: [folder], mediaFiles: [{ ...file, objectKey: 'media/other' }] }), /storage key/);
  assert.match(validateBackup({ ...base, mediaFolders: [], mediaFiles: [file] }), /folder missing/);
  assert.match(validateBackup({ ...base, mediaFolders: [folder], mediaFiles: [{ ...file, name: '../lecture.pdf' }] }), /invalid name/);
});
