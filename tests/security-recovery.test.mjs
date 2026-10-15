import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, isValidSession, SESSION_SECONDS } from '../lib/access-session.js';
import { validateBackup, MAX_BACKUP_BYTES } from '../lib/backup-validation.js';
import { readLimitedBody } from '../lib/read-limited-body.js';

const secret = 'test-secret-for-enotes-session-tests-0123456789';
const now = 1_800_000_000;

test('signed session is valid before expiry and invalid at expiry', () => {
  const token = createSessionToken(secret, now + SESSION_SECONDS);
  assert.equal(isValidSession(token, secret, now), true);
  assert.equal(isValidSession(token, secret, now + SESSION_SECONDS), false);
});

test('session validation rejects tampering, malformed tokens, and weak secrets', () => {
  const token = createSessionToken(secret, now + SESSION_SECONDS);
  assert.equal(isValidSession(token.replace(/[a-f0-9]$/, '0'), secret, now), false);
  assert.equal(isValidSession('not-a-token', secret, now), false);
  assert.equal(isValidSession(token, 'short', now), false);
});

test('backup validator accepts a minimal valid backup', () => {
  assert.equal(validateBackup({
    format: 'enotes-backup',
    version: 1,
    subjects: [{ slug: 'linux', name: 'Linux' }],
    notes: [{ subject: 'linux', number: 1, heading: 'Permissions', answer: 'chmod' }],
  }), null);
});

test('backup validator rejects unsupported formats, orphan notes, and duplicate IDs', () => {
  assert.match(validateBackup({ format: 'other', version: 1, subjects: [], notes: [] }), /supported/);
  assert.match(validateBackup({
    format: 'enotes-backup', version: 1,
    subjects: [{ slug: 'linux', name: 'Linux' }],
    notes: [{ subject: 'missing', number: 1, heading: 'H', answer: 'A' }],
  }), /refer to a subject/);
  assert.match(validateBackup({
    format: 'enotes-backup', version: 1,
    subjects: [{ slug: 'linux', name: 'Linux' }],
    notes: [
      { subject: 'linux', number: 1, heading: 'H', answer: 'A' },
      { subject: 'linux', number: 1, heading: 'H2', answer: 'A2' },
    ],
  }), /duplicate note/);
});

test('limited body reader accepts within-limit payloads and rejects oversized ones', async () => {
  const request = new Request('https://example.test/api', { method: 'POST', body: '{"ok":true}' });
  assert.equal(await readLimitedBody(request, 64), '{"ok":true}');
  const tooLarge = new Request('https://example.test/api', { method: 'POST', body: 'x'.repeat(32) });
  await assert.rejects(readLimitedBody(tooLarge, 8), (error) => error.status === 413);
  assert.equal(MAX_BACKUP_BYTES, 10 * 1024 * 1024);
});
