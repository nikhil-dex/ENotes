export const MAX_MEDIA_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_MEDIA_FILES = 10000;
export const MAX_MEDIA_TOTAL_BYTES = 9 * 1024 * 1024 * 1024;
export const MAX_MEDIA_FOLDERS = 2000;

const ALLOWED_TYPES = new Map([
  ['application/pdf', ['.pdf']],
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/png', ['.png']],
  ['image/webp', ['.webp']],
]);

export function normalizeFolderName(value) {
  if (typeof value !== 'string') return { error: 'Folder name must be text.' };
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80) return { error: 'Folder name must be 1–80 characters.' };
  if (/[\\/\u0000-\u001f\u007f]/.test(name) || name === '.' || name === '..') {
    return { error: 'Folder names cannot contain slashes or control characters.' };
  }
  return { value: name };
}

export function normalizeMediaFile(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'Enter valid file details.' };
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const type = typeof data.type === 'string' ? data.type.toLowerCase().trim() : '';
  const size = data.size;
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
  if (!name || name.length > 180 || /[\\/\u0000-\u001f\u007f]/.test(name) || name === '.' || name === '..') {
    return { error: 'File name must be 1–180 characters and cannot contain path separators.' };
  }
  if (!ALLOWED_TYPES.has(type) || !ALLOWED_TYPES.get(type).includes(extension)) {
    return { error: 'Only matching PDF, JPG/JPEG, PNG, and WebP files are supported.' };
  }
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_MEDIA_FILE_BYTES) {
    return { error: 'Files must be between 1 byte and 20 MB.' };
  }
  return { value: { name, type, size, extension } };
}

export function hasValidMediaSignature(prefix, type) {
  const bytes = Buffer.isBuffer(prefix) ? prefix : Buffer.from(prefix || []);
  if (type === 'application/pdf') return bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === 'image/webp') return bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

export function isValidMediaId(value) {
  return typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value);
}

export function isValidFolderId(value) {
  return value === null || value === undefined || value === '' || isValidMediaId(value);
}
