import test from 'node:test';
import assert from 'node:assert/strict';
import { extensionOrigin, extensionCorsHeaders, hashExtensionSecret, isAllowedExtensionOrigin, findValidExtensionToken } from './extension-auth.js';

test('extension origin is derived only from a valid Chrome extension ID', () => {
  process.env.ENOTES_EXTENSION_ID = 'a'.repeat(32);
  assert.equal(extensionOrigin(), 'chrome-extension://' + 'a'.repeat(32));
  process.env.ENOTES_EXTENSION_ID = 'not-a-valid-id';
  assert.equal(extensionOrigin(), null);
  delete process.env.ENOTES_EXTENSION_ID;
});

test('extension CORS is restricted to the configured extension origin', () => {
  process.env.ENOTES_EXTENSION_ID = 'a'.repeat(32);
  const allowed = new Request('https://enotes.example/api/extension/token', { headers: { Origin: 'chrome-extension://' + 'a'.repeat(32) } });
  const denied = new Request('https://enotes.example/api/extension/token', { headers: { Origin: 'https://evil.example' } });
  assert.equal(isAllowedExtensionOrigin(allowed), true);
  assert.equal(extensionCorsHeaders(allowed)['Access-Control-Allow-Origin'], 'chrome-extension://' + 'a'.repeat(32));
  assert.equal(isAllowedExtensionOrigin(denied), false);
  assert.deepEqual(extensionCorsHeaders(denied), {});
  delete process.env.ENOTES_EXTENSION_ID;
});

test('extension bearer tokens are stored and looked up by hash, with expiry and revocation checks', async () => {
  const token = 'x'.repeat(43);
  const expected = { _id: 'token-id', scopes: ['quick-notes:create'], expiresAt: new Date(Date.now() + 60000) };
  let query;
  const db = { collection(name) { assert.equal(name, 'extensionTokens'); return { findOne(filter, options) { query = { filter, options }; return Promise.resolve(expected); } }; } };
  const request = new Request('https://enotes.example/api/extension/quick-notes', { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(await findValidExtensionToken(request, db), expected);
  assert.equal(query.filter.tokenHash, hashExtensionSecret(token));
  assert.ok(query.filter.expiresAt.$gt instanceof Date);
  assert.deepEqual(query.filter.revokedAt, { $exists: false });
  assert.equal(query.options.projection._id, 1);
  assert.equal(await findValidExtensionToken(new Request('https://enotes.example/api/extension/quick-notes'), db), null);
});
