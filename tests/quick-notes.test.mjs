import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_QUICK_NOTE_LENGTH, normalizeQuickNoteContent, quickNoteTitle } from '../lib/quick-notes.js';

test('normalizes line endings and derives the title from the first line', () => {
  const content = normalizeQuickNoteContent('  Meeting notes  \r\nDiscuss roadmap\rNext steps');
  assert.equal(content, '  Meeting notes  \nDiscuss roadmap\nNext steps');
  assert.equal(quickNoteTitle(content), 'Meeting notes');
});

test('uses a friendly title for empty notes and limits the title length', () => {
  assert.equal(quickNoteTitle(''), 'New note');
  assert.equal(quickNoteTitle('  \nBody text'), 'New note');
  assert.equal(quickNoteTitle('x'.repeat(140)).length, 120);
});

test('validates quick notes in backups and remains compatible with older backups', async () => {
  const { validateBackup } = await import('../lib/backup-validation.js');
  const base = {
    format: 'enotes-backup',
    version: 1,
    subjects: [{ slug: 'linux', name: 'Linux' }],
    notes: [],
  };
  assert.equal(validateBackup(base), null);
  assert.equal(validateBackup({ ...base, quickNotes: [{
    _id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    title: 'Meeting notes',
    content: 'Meeting notes\nDiscuss roadmap',
  }] }), null);
  assert.match(validateBackup({ ...base, quickNotes: [{
    _id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    content: 'x'.repeat(20001),
  }] }), /invalid content/i);
});

test('exports the quick note content limit', () => {
  assert.equal(MAX_QUICK_NOTE_LENGTH, 20000);
});
