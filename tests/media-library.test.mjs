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
