import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/ai/cleanup/route.js';

function jsonRequest(value) {
  return new Request('https://example.test/api/ai/cleanup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
}

test('Gemini cleanup rejects missing or invalid note fields before calling the provider', async () => {
  const missing = await POST(jsonRequest({ heading: 'A title', answer: '' }));
  assert.equal(missing.status, 400);
  assert.match((await missing.json()).error, /heading and note content/);
  const tooLong = await POST(jsonRequest({ heading: 'A title', answer: 'x'.repeat(10001) }));
  assert.equal(tooLong.status, 400);
});

test('Gemini cleanup rejects malformed JSON without calling the provider', async () => {
  const response = await POST(new Request('https://example.test/api/ai/cleanup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{broken',
  }));
  assert.equal(response.status, 400);
});
