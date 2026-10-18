export const MAX_QUICK_NOTE_LENGTH = 20000;

export function normalizeQuickNoteContent(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n');
}

export function quickNoteTitle(value) {
  const firstLine = normalizeQuickNoteContent(value).split('\n', 1)[0].trim();
  return firstLine.slice(0, 120) || 'New note';
}
