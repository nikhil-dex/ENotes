import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNoteHeading } from '../lib/note-normalization.js';

test('preserves ordinary letters in note headings', () => {
  assert.equal(normalizeNoteHeading('Encoding'), 'Encoding');
  assert.equal(normalizeNoteHeading('Rendering'), 'Rendering');
  assert.equal(normalizeNoteHeading('Networking'), 'Networking');
});

test('replaces line breaks with spaces without removing letters', () => {
  assert.equal(normalizeNoteHeading('Compiler\nDesign'), 'Compiler Design');
  assert.equal(normalizeNoteHeading('  Encoding  '), 'Encoding');
});
