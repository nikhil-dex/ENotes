import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBackup, MAX_SUBJECTS, MAX_NOTES } from '../lib/backup-validation.js';

function backup(overrides = {}) {
  return {
    format: 'enotes-backup',
    version: 1,
    subjects: [{ slug: 'linux', name: 'Linux', nextNumber: 2 }],
    notes: [{ subject: 'linux', number: 1, heading: 'Permissions', answer: 'chmod' }],
    ...overrides,
  };
}

test('backup validator rejects non-object roots and missing record arrays', () => {
  assert.match(validateBackup(null), /supported/);
  assert.match(validateBackup([]), /supported/);
  assert.match(validateBackup({ format: 'enotes-backup', version: 1, subjects: [] }), /arrays/);
});

test('backup validator rejects malformed and duplicate subjects', () => {
  assert.match(validateBackup(backup({ subjects: [null] })), /subject record is invalid/);
  assert.match(validateBackup(backup({ subjects: [{ slug: 'Linux!', name: 'Linux' }] })), /invalid slug/);
  assert.match(validateBackup(backup({
    subjects: [{ slug: 'linux', name: 'Linux' }, { slug: 'linux', name: 'Linux duplicate' }],
  })), /duplicate subject/);
  assert.match(validateBackup(backup({ subjects: [{ slug: 'linux', name: '   ' }] })), /invalid name/);
});

test('backup validator rejects invalid subject metadata', () => {
  assert.match(validateBackup(backup({ subjects: [{ slug: 'linux', name: 'Linux', nextNumber: 0 }] })), /next note number/);
  assert.match(validateBackup(backup({ subjects: [{ slug: 'linux', name: 'Linux', order: -1 }] })), /order value/);
  assert.match(validateBackup(backup({ subjects: [{ slug: 'linux', name: 'Linux', file: 42 }] })), /file reference/);
  assert.match(validateBackup(backup({ subjects: [{ slug: 'linux', name: 'Linux', createdAt: 'not-a-date' }] })), /creation date/);
});

test('backup validator rejects malformed notes and invalid note metadata', () => {
  assert.match(validateBackup(backup({ notes: [null] })), /note record is invalid/);
  assert.match(validateBackup(backup({ notes: [{ subject: 'linux', number: 0, heading: 'H', answer: 'A' }] })), /invalid note number/);
  assert.match(validateBackup(backup({ notes: [{ subject: 'linux', number: 1, heading: ' ', answer: 'A' }] })), /invalid heading/);
  assert.match(validateBackup(backup({ notes: [{ subject: 'linux', number: 1, heading: 'H', answer: ' ' }] })), /invalid content/);
  assert.match(validateBackup(backup({ notes: [{ subject: 'linux', number: 1, heading: 'H', answer: 'A', createdAt: 'bad-date' }] })), /invalid creation date/);
  assert.match(validateBackup(backup({ notes: [{ subject: 'linux', number: 1, heading: 'H', answer: 'A', saved: 123 }] })), /invalid saved timestamp/);
});

test('backup validator enforces documented record count limits', () => {
  const tooManySubjects = Array.from({ length: MAX_SUBJECTS + 1 }, (_, index) => ({
    slug: `subject-${index}`,
    name: `Subject ${index}`,
  }));
  assert.match(validateBackup(backup({ subjects: tooManySubjects, notes: [] })), /too many records/);

  const tooManyNotes = Array.from({ length: MAX_NOTES + 1 }, (_, index) => ({
    subject: 'linux',
    number: index + 1,
    heading: 'Heading',
    answer: 'Answer',
  }));
  assert.match(validateBackup(backup({ notes: tooManyNotes })), /too many records/);
});

test('backup validator accepts a valid backup with optional metadata omitted', () => {
  assert.equal(validateBackup(backup({
    subjects: [{ slug: 'linux', name: 'Linux' }],
    notes: [{ subject: 'linux', number: 1, heading: 'Permissions', answer: 'chmod' }],
  })), null);
});
