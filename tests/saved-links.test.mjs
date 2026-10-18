import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSavedLink } from '../lib/saved-links.js';

test('normalizes a valid saved link', () => {
  const result = normalizeSavedLink({
    title: '  Next.js Docs ',
    url: 'https://nextjs.org/docs',
    description: ' Official documentation ',
    category: 'Development',
    tags: [' Next.js ', 'docs', 'docs'],
  });

  assert.equal(result.error, undefined);
  assert.equal(result.value.title, 'Next.js Docs');
  assert.equal(result.value.url, 'https://nextjs.org/docs');
  assert.equal(result.value.description, 'Official documentation');
  assert.equal(result.value.category, 'Development');
  assert.deepEqual(result.value.tags, ['next.js', 'docs']);
});

test('rejects invalid URLs and unsafe protocols', () => {
  assert.match(normalizeSavedLink({ title: 'Example', url: 'not-a-url' }).error, /valid URL/i);
  assert.match(normalizeSavedLink({ title: 'Example', url: 'javascript:alert(1)' }).error, /HTTP and HTTPS/i);
});

test('validates title, description, category, and tag limits', () => {
  assert.match(normalizeSavedLink({ title: '', url: 'https://example.com' }).error, /Title is required/i);
  assert.match(normalizeSavedLink({ title: 'Example', url: 'https://example.com', description: 'x'.repeat(501) }).error, /Description/i);
  assert.match(normalizeSavedLink({ title: 'Example', url: 'https://example.com', tags: Array.from({ length: 11 }, (_, i) => String(i)) }).error, /up to 10 tags/i);
});
