import { normalizeMediaFile } from './media-validation.js';

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export const MAX_SUBJECTS = 1000;
export const MAX_NOTES = 50000;
export const MAX_SAVED_LINKS = 10000;
export const MAX_QUICK_NOTES = 10000;
export const MAX_MEDIA_FILES = 10000;
export const MAX_MEDIA_FOLDERS = 2000;

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
  if (backup.savedLinks !== undefined && !Array.isArray(backup.savedLinks)) {
    return 'The backup savedLinks field must be an array.';
  }
  if (backup.quickNotes !== undefined && !Array.isArray(backup.quickNotes)) {
    return 'The backup quickNotes field must be an array.';
  }
  if (backup.mediaFolders !== undefined && !Array.isArray(backup.mediaFolders)) return 'The backup mediaFolders field must be an array.';
  if (backup.mediaFiles !== undefined && !Array.isArray(backup.mediaFiles)) return 'The backup mediaFiles field must be an array.';
  if (backup.subjects.length > MAX_SUBJECTS || backup.notes.length > MAX_NOTES || (backup.savedLinks?.length || 0) > MAX_SAVED_LINKS || (backup.quickNotes?.length || 0) > MAX_QUICK_NOTES || (backup.mediaFiles?.length || 0) > MAX_MEDIA_FILES || (backup.mediaFolders?.length || 0) > MAX_MEDIA_FOLDERS) {
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

  const savedLinkIds = new Set();
  for (const link of backup.savedLinks || []) {
    if (!isPlainObject(link)) return 'A saved link record is invalid.';
    const id = typeof link.id === 'string' ? link.id : link._id;
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) return 'A saved link has an invalid ID.';
    if (savedLinkIds.has(id)) return 'The backup contains duplicate saved links.';
    savedLinkIds.add(id);
    if (typeof link.title !== 'string' || !link.title.trim() || link.title.length > 120) return 'A saved link has an invalid title.';
    if (typeof link.url !== 'string' || link.url.length > 2048) return 'A saved link has an invalid URL.';
    let parsedUrl;
    try { parsedUrl = new URL(link.url); } catch { return 'A saved link has an invalid URL.'; }
    if (!['http:', 'https:'].includes(parsedUrl.protocol) || !parsedUrl.hostname) return 'A saved link has an invalid URL.';
    if (link.description !== undefined && (typeof link.description !== 'string' || link.description.length > 500)) return 'A saved link has an invalid description.';
    if (link.category !== undefined && (typeof link.category !== 'string' || link.category.length > 40)) return 'A saved link has an invalid category.';
    if (link.tags !== undefined && (!Array.isArray(link.tags) || link.tags.length > 10 || link.tags.some((tag) => typeof tag !== 'string' || tag.length > 24))) return 'A saved link has invalid tags.';
    if (link.order !== undefined && (!Number.isInteger(link.order) || link.order < 0)) return 'A saved link has an invalid order.';
    if (link.createdAt !== undefined && !hasValidOptionalDate(link.createdAt)) return 'A saved link has an invalid creation date.';
    if (link.updatedAt !== undefined && !hasValidOptionalDate(link.updatedAt)) return 'A saved link has an invalid update date.';
  }

  const quickNoteIds = new Set();
  for (const note of backup.quickNotes || []) {
    if (!isPlainObject(note)) return 'A quick note record is invalid.';
    const id = typeof note.id === 'string' ? note.id : note._id;
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) return 'A quick note has an invalid ID.';
    if (quickNoteIds.has(id)) return 'The backup contains duplicate quick notes.';
    quickNoteIds.add(id);
    if (typeof note.content !== 'string' || note.content.length > 20000) return 'A quick note has invalid content.';
    if (note.title !== undefined && (typeof note.title !== 'string' || note.title.length > 120)) return 'A quick note has an invalid title.';
    if (note.createdAt !== undefined && !hasValidOptionalDate(note.createdAt)) return 'A quick note has an invalid creation date.';
    if (note.updatedAt !== undefined && !hasValidOptionalDate(note.updatedAt)) return 'A quick note has an invalid update date.';
  }

  const mediaFolderIds = new Set();
  for (const folder of backup.mediaFolders || []) {
    if (!isPlainObject(folder) || typeof folder._id !== 'string' || !/^[a-f0-9-]{36}$/i.test(folder._id)) return 'A media folder has an invalid ID.';
    if (mediaFolderIds.has(folder._id)) return 'The backup contains duplicate media folders.';
    mediaFolderIds.add(folder._id);
    if (typeof folder.name !== 'string' || !folder.name.trim() || folder.name.length > 80 || /[\\/\u0000-\u001f\u007f]/.test(folder.name) || folder.name === '.' || folder.name === '..') return 'A media folder has an invalid name.';
    if (folder.createdAt !== undefined && !hasValidOptionalDate(folder.createdAt)) return 'A media folder has an invalid creation date.';
    if (folder.updatedAt !== undefined && !hasValidOptionalDate(folder.updatedAt)) return 'A media folder has an invalid update date.';
  }

  const mediaFileIds = new Set();
  for (const file of backup.mediaFiles || []) {
    if (!isPlainObject(file) || typeof file._id !== 'string' || !/^[a-f0-9-]{36}$/i.test(file._id)) return 'A media file has an invalid ID.';
    if (mediaFileIds.has(file._id)) return 'The backup contains duplicate media files.';
    mediaFileIds.add(file._id);
    if (typeof file.name !== 'string' || !file.name.trim() || file.name.length > 180 || /[\\/\u0000-\u001f\u007f]/.test(file.name)) return 'A media file has an invalid name.';
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'A media file has an unsupported type.';
    if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > 20 * 1024 * 1024) return 'A media file has an invalid size.';
    if (normalizeMediaFile({ name: file.name, type: file.type, size: file.size }).error) return 'A media file has invalid metadata.';
    if (file.objectKey !== `media/${file._id}`) return 'A media file has an invalid storage key.';
    if (file.folderId !== null && file.folderId !== undefined && !mediaFolderIds.has(file.folderId)) return 'A media file refers to a folder missing from the backup.';
    if (file.status !== undefined && file.status !== 'ready') return 'Only completed media files can be included in a backup.';
    if (file.createdAt !== undefined && !hasValidOptionalDate(file.createdAt)) return 'A media file has an invalid creation date.';
    if (file.updatedAt !== undefined && !hasValidOptionalDate(file.updatedAt)) return 'A media file has an invalid update date.';
  }

  return null;
}
