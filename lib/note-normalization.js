export function normalizeNoteHeading(value) {
  return String(value ?? '').trim().replace(/[\r\n]+/g, ' ');
}
