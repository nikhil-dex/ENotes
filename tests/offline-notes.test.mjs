import test from 'node:test';
import assert from 'node:assert/strict';
import { cacheNotes, cacheSubjects, getCachedNotes, getCachedSubjects } from '../lib/offline-notes.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

test('offline cache stores and retrieves subjects and notes by subject', () => {
  const storage = memoryStorage();
  const subjects = [{ slug: 'os', name: 'Operating Systems' }];
  const notes = [{ number: 1, heading: 'Processes', answer: 'A running program' }];
  assert.equal(cacheSubjects(storage, subjects), true);
  assert.equal(cacheNotes(storage, 'os', notes), true);
  assert.deepEqual(getCachedSubjects(storage), subjects);
  assert.deepEqual(getCachedNotes(storage, 'os'), notes);
  assert.deepEqual(getCachedNotes(storage, 'cn'), []);
});

test('offline cache treats invalid JSON and non-array values as empty', () => {
  const storage = memoryStorage({
    'enotes:offline:subjects:v1': '{broken',
    'enotes:offline:notes:v1:os': JSON.stringify({ heading: 'not an array' }),
  });
  assert.deepEqual(getCachedSubjects(storage), []);
  assert.deepEqual(getCachedNotes(storage, 'os'), []);
});

test('offline cache handles unavailable storage writes safely', () => {
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  assert.deepEqual(getCachedSubjects(storage), []);
  assert.deepEqual(getCachedNotes(storage, 'os'), []);
  assert.equal(cacheSubjects(storage, [{ slug: 'os' }]), false);
  assert.equal(cacheNotes(storage, 'os', []), false);
});
