import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MEDIA_FILE_BYTES,
  MAX_MEDIA_FILES,
  MAX_MEDIA_TOTAL_BYTES,
  hasValidMediaSignature,
  isValidFolderId,
  isValidMediaId,
  normalizeFolderName,
  normalizeMediaFile,
} from '../lib/media-validation.js';
import { createPresignedUrl, isValidObjectKey } from '../lib/blob-storage.js';

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
  assert.equal(MAX_MEDIA_TOTAL_BYTES, 8 * 1000 * 1000 * 1000);
});

test('validates private Blob object keys and signed URL constraints before network access', async () => {
  const validKey = 'media/f47ac10b-58cc-4372-a567-0e02b2c3d479';
  assert.equal(isValidObjectKey(validKey), true);
  assert.equal(isValidObjectKey('private/other'), false);
  assert.equal(isValidObjectKey('../media/file'), false);
  await assert.rejects(createPresignedUrl('GET', 'private/other'), /Invalid storage object key/);
  await assert.rejects(createPresignedUrl('GET', validKey, 3600), /1–900/);
  await assert.rejects(createPresignedUrl('PUT', validKey, 300), /Upload content type and size are required/);
});

test('requires the configured private Vercel Blob store ID', async () => {
  const previous = process.env.OGE_STORE_ID;
  delete process.env.OGE_STORE_ID;
  try {
    await assert.rejects(
      createPresignedUrl('GET', 'media/f47ac10b-58cc-4372-a567-0e02b2c3d479'),
      /OGE_STORE_ID/,
    );
  } finally {
    if (previous === undefined) delete process.env.OGE_STORE_ID;
    else process.env.OGE_STORE_ID = previous;
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
  assert.match(validateBackup({ ...base, mediaFolders: [folder], mediaFiles: Array.from({ length: 401 }, (_, index) => ({ ...file, _id: `f47ac10b-58cc-4372-a567-0e02b2c3${String(index).padStart(4, '0')}`, name: `lecture-${index}.pdf`, objectKey: `media/f47ac10b-58cc-4372-a567-0e02b2c3${String(index).padStart(4, '0')}`, size: 20 * 1024 * 1024, folderId: null })) }), /storage safety limit/);
});
