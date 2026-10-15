export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export const MAX_SUBJECTS = 1000;
export const MAX_NOTES = 50000;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasValidOptionalDate(value) {
  return value === undefined || value === null || (
    typeof value === 'string' && value.length <= 64 && !Number.isNaN(Date.parse(value))
  );
}

export function validateBackup(backup) {
  if (!isPlainObject(backup) || backup.format !== 'enotes-backup' || backup.version !== 1) {
    return 'This is not a supported ENotes backup file.';
  }
  if (!Array.isArray(backup.subjects) || !Array.isArray(backup.notes)) {
    return 'The backup must contain subjects and notes arrays.';
  }
  if (backup.subjects.length > MAX_SUBJECTS || backup.notes.length > MAX_NOTES) {
    return 'The backup contains too many records.';
  }

  const subjectSlugs = new Set();
  for (const subject of backup.subjects) {
    if (!isPlainObject(subject)) return 'A subject record is invalid.';
    const slug = typeof subject.slug === 'string' ? subject.slug : subject._id;
    if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return 'A subject has an invalid slug.';
    }
    if (typeof subject.name !== 'string' || !subject.name.trim() || subject.name.length > 40) {
      return 'A subject has an invalid name.';
    }
    if (subjectSlugs.has(slug)) return `The backup contains duplicate subject “${slug}”.`;
    subjectSlugs.add(slug);
    if (subject.createdAt !== undefined && !hasValidOptionalDate(subject.createdAt)) {
      return `Subject “${slug}” has an invalid creation date.`;
    }
    if (subject.order !== undefined && (!Number.isInteger(subject.order) || subject.order < 0)) {
      return `Subject “${slug}” has an invalid order value.`;
    }
    if (subject.file !== undefined && (typeof subject.file !== 'string' || subject.file.length > 256)) {
      return `Subject “${slug}” has an invalid file reference.`;
    }
    if (subject.nextNumber !== undefined && (!Number.isInteger(subject.nextNumber) || subject.nextNumber < 1)) {
      return `Subject “${slug}” has an invalid next note number.`;
    }
  }

  const noteIds = new Set();
  for (const note of backup.notes) {
    if (!isPlainObject(note)) return 'A note record is invalid.';
    if (typeof note.subject !== 'string' || !subjectSlugs.has(note.subject)) {
      return 'Every note must refer to a subject included in the backup.';
    }
    if (!Number.isInteger(note.number) || note.number < 1) return 'A note has an invalid note number.';
    if (typeof note.heading !== 'string' || !note.heading.trim() || note.heading.length > 160) {
      return 'A note has an invalid heading.';
    }
    if (typeof note.answer !== 'string' || !note.answer.trim() || note.answer.length > 10000) {
      return 'A note has invalid content.';
    }
    const id = `${note.subject}:${note.number}`;
    if (noteIds.has(id)) return `The backup contains duplicate note ${id}.`;
    noteIds.add(id);
    if (note.saved !== undefined && (typeof note.saved !== 'string' || note.saved.length > 100)) {
      return `Note ${id} has an invalid saved timestamp.`;
    }
    if (note.createdAt !== undefined && !hasValidOptionalDate(note.createdAt)) {
      return `Note ${id} has an invalid creation date.`;
    }
  }

  return null;
}
