import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as getNotes, POST as createNote, PUT as updateNote, PATCH as patchNote, DELETE as deleteNote } from '../app/api/notes/route.js';
import { POST as createSubject, DELETE as deleteSubject } from '../app/api/subjects/route.js';
import { POST as restoreBackup } from '../app/api/backup/route.js';

async function responseBody(response) {
  return response.json();
}

function jsonRequest(url, method, value) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
}

test('notes API rejects malformed JSON and oversized create payloads before database access', async () => {
  const malformed = await createNote(new Request('https://example.test/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{broken',
  }));
  assert.equal(malformed.status, 400);
  assert.match((await responseBody(malformed)).error, /valid JSON/);

  const oversized = await createNote(new Request('https://example.test/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: ' '.repeat(32 * 1024 + 1),
  }));
  assert.equal(oversized.status, 413);
});

test('notes API rejects invalid create and update fields before database access', async () => {
  const invalidCreate = await createNote(jsonRequest('https://example.test/api/notes', 'POST', {
    subject: 'linux',
    heading: '  ',
    answer: 'content',
  }));
  assert.equal(invalidCreate.status, 400);
  assert.match((await responseBody(invalidCreate)).error, /heading and answer/);

  const invalidUpdate = await updateNote(jsonRequest('https://example.test/api/notes', 'PUT', {
    subject: 'linux',
    number: 0,
    heading: 'Heading',
    answer: 'Answer',
  }));
  assert.equal(invalidUpdate.status, 400);
  assert.match((await responseBody(invalidUpdate)).error, /valid note/);

  const invalidDelete = await deleteNote(new Request('https://example.test/api/notes?subject=linux&number=0', {
    method: 'DELETE',
  }));
  assert.equal(invalidDelete.status, 400);
  assert.match((await responseBody(invalidDelete)).error, /valid note/);
});

test('subjects API rejects malformed, oversized, and invalid create requests before database access', async () => {
  const malformed = await createSubject(new Request('https://example.test/api/subjects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{broken',
  }));
  assert.equal(malformed.status, 400);

  const oversized = await createSubject(new Request('https://example.test/api/subjects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: ' '.repeat(4 * 1024 + 1),
  }));
  assert.equal(oversized.status, 413);

  const invalid = await createSubject(jsonRequest('https://example.test/api/subjects', 'POST', { name: '   ' }));
  assert.equal(invalid.status, 400);
  assert.match((await responseBody(invalid)).error, /Subject name/);

  const missingSlug = await deleteSubject(new Request('https://example.test/api/subjects', { method: 'DELETE' }));
  assert.equal(missingSlug.status, 400);
  assert.match((await responseBody(missingSlug)).error, /subject to delete/);
});

test('backup restore rejects malformed JSON and unsupported backup formats before database access', async () => {
  const malformed = await restoreBackup(new Request('https://example.test/api/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{broken',
  }));
  assert.equal(malformed.status, 400);
  assert.match((await responseBody(malformed)).error, /valid JSON/);

  const unsupported = await restoreBackup(jsonRequest('https://example.test/api/backup', 'POST', {
    format: 'not-enotes',
    version: 1,
    subjects: [],
    notes: [],
  }));
  assert.equal(unsupported.status, 400);
  assert.match((await responseBody(unsupported)).error, /supported/);
});


test('notes API validates tag limits before database access', async () => {
  const response = await createNote(jsonRequest('https://example.test/api/notes', 'POST', {
    subject: 'linux', heading: 'Tags test', answer: 'Content', tags: Array.from({ length: 11 }, (_, index) => `tag${index}`),
  }));
  assert.equal(response.status, 400);
  assert.match((await responseBody(response)).error, /10 tags/);
});

test('metadata endpoint rejects invalid note numbers before database access', async () => {
  const response = await patchNote(jsonRequest('https://example.test/api/notes', 'PATCH', { subject: 'linux', number: 0, favorite: true }));
  assert.equal(response.status, 400);
  assert.match((await responseBody(response)).error, /valid note/);
});


test('global note search requires at least two query characters before database access', async () => {
  const response = await getNotes(new Request('https://example.test/api/notes?scope=all&q=a'));
  assert.equal(response.status, 400);
  assert.match((await responseBody(response)).error, /at least 2 characters/);
});
