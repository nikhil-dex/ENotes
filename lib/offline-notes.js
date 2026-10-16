const SUBJECTS_KEY = 'enotes:offline:subjects:v1';
const NOTES_PREFIX = 'enotes:offline:notes:v1:';

function readArray(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null');
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function writeArray(storage, key, value) {
  if (!Array.isArray(value)) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getCachedSubjects(storage) {
  return readArray(storage, SUBJECTS_KEY) || [];
}

export function cacheSubjects(storage, subjects) {
  return writeArray(storage, SUBJECTS_KEY, subjects);
}

export function getCachedNotes(storage, subject) {
  if (typeof subject !== 'string' || !subject) return [];
  return readArray(storage, NOTES_PREFIX + subject) || [];
}

export function cacheNotes(storage, subject, notes) {
  if (typeof subject !== 'string' || !subject) return false;
  return writeArray(storage, NOTES_PREFIX + subject, notes);
}
