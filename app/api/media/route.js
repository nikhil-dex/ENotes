import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../../lib/mongodb.js';
import { readLimitedBody } from '../../../lib/read-limited-body.js';
import { hasValidMediaSignature, isValidFolderId, isValidMediaId, MAX_MEDIA_FILES, MAX_MEDIA_FOLDERS, MAX_MEDIA_TOTAL_BYTES, normalizeFolderName, normalizeMediaFile } from '../../../lib/media-validation.js';
import { createPresignedUrl, deleteObject, headObject, readObjectPrefix } from '../../../lib/r2-storage.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
}

async function readJson(request) {
  try {
    return { data: JSON.parse(await readLimitedBody(request, 16 * 1024)) };
  } catch (error) {
    return { error: json({ error: error?.status === 413 ? 'Request body is too large.' : 'Enter valid JSON.' }, error?.status || 400) };
  }
}

function serialize(record) {
  const { _id, ...rest } = record;
  return { ...rest, id: String(_id) };
}

export async function GET(request) {
  try {
    const db = await getDatabase();
    const params = new URL(request.url).searchParams;
    if (params.get('action') === 'download') {
      const id = params.get('id') || '';
      if (!isValidMediaId(id)) return json({ error: 'Choose a valid file.' }, 400);
      const file = await db.collection('mediaFiles').findOne({ _id: id, status: 'ready' });
      if (!file) return json({ error: 'File not found.' }, 404);
      const disposition = params.get('disposition') === 'attachment' ? `attachment; filename="${file.name.replace(/["\\\\\r\n]/g, '_')}"` : '';
      const url = createPresignedUrl('GET', file.objectKey, 300, new Date(), disposition);
      return json({ url, expiresIn: 300, file: serialize(file) });
    }
    const folderId = params.get('folderId') || null;
    if (!isValidFolderId(folderId)) return json({ error: 'Choose a valid folder.' }, 400);
    if (folderId && !await db.collection('mediaFolders').findOne({ _id: folderId })) {
      return json({ error: 'Folder not found. Refresh and try again.' }, 404);
    }
    const [folders, files] = await Promise.all([
      db.collection('mediaFolders').find({}, { projection: { _id: 1, name: 1, createdAt: 1, updatedAt: 1 } }).sort({ name: 1 }).limit(MAX_MEDIA_FOLDERS).toArray(),
      db.collection('mediaFiles').find({ folderId, status: 'ready' }, { projection: { _id: 1, name: 1, type: 1, size: 1, folderId: 1, createdAt: 1, updatedAt: 1 } }).sort({ updatedAt: -1, createdAt: -1 }).limit(MAX_MEDIA_FILES).toArray(),
    ]);
    return json({ folders: folders.map(serialize), files: files.map(serialize), currentFolderId: folderId });
  } catch (error) {
    console.error('GET /api/media failed:', error);
    return json({ error: error.message?.includes('R2 environment') || error.message?.includes('storage is not configured') ? error.message : 'Could not load the file library. Check the database and private storage configuration.' }, 500);
  }
}

export async function POST(request) {
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  const data = parsed.data;
  try {
    const db = await getDatabase();
    if (data?.action === 'create-folder') {
      const normalized = normalizeFolderName(data.name);
      if (normalized.error) return json({ error: normalized.error }, 400);
      if (await db.collection('mediaFolders').countDocuments() >= MAX_MEDIA_FOLDERS) return json({ error: 'The library has reached its folder limit.' }, 400);
      const now = new Date();
      const folder = { _id: randomUUID(), name: normalized.value, createdAt: now, updatedAt: now };
      await db.collection('mediaFolders').insertOne(folder);
      return json(serialize(folder), 201);
    }

    if (data?.action === 'start-upload') {
      const normalized = normalizeMediaFile(data);
      if (normalized.error) return json({ error: normalized.error }, 400);
      const folderId = data.folderId || null;
      if (!isValidFolderId(folderId)) return json({ error: 'Choose a valid folder.' }, 400);
      if (folderId && !await db.collection('mediaFolders').findOne({ _id: folderId })) return json({ error: 'Folder not found.' }, 404);
      if (await db.collection('mediaFiles').countDocuments({ status: { $ne: 'deleted' } }) >= MAX_MEDIA_FILES) return json({ error: 'The library has reached its file limit.' }, 400);
      const usage = await db.collection('mediaFiles').aggregate([
        { $match: { status: { $in: ['ready', 'pending'] } } },
        { $group: { _id: null, bytes: { $sum: '$size' } } },
      ]).toArray();
      if ((usage[0]?.bytes || 0) + normalized.value.size > MAX_MEDIA_TOTAL_BYTES) {
        return json({ error: 'The library has reached its 8 GB tracked-storage safety limit. Delete unneeded files before uploading more.' }, 400);
      }
      const id = randomUUID();
      const now = new Date();
      const file = {
        _id: id,
        name: normalized.value.name,
        type: normalized.value.type,
        size: normalized.value.size,
        extension: normalized.value.extension,
        folderId,
        objectKey: `media/${id}`,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      await db.collection('mediaFiles').insertOne(file);
      try {
        return json({ id, uploadUrl: createPresignedUrl('PUT', file.objectKey, 300), expiresIn: 300 }, 201);
      } catch (error) {
        await db.collection('mediaFiles').deleteOne({ _id: id, status: 'pending' });
        throw error;
      }
    }

    if (data?.action === 'abort-upload') {
      if (!isValidMediaId(data.id)) return json({ error: 'Choose a valid upload.' }, 400);
      const pending = await db.collection('mediaFiles').findOne({ _id: data.id, status: 'pending' });
      if (!pending) return json({ aborted: false });
      const object = await headObject(pending.objectKey);
      if (object.exists) await deleteObject(pending.objectKey);
      await db.collection('mediaFiles').deleteOne({ _id: data.id, status: 'pending' });
      return json({ aborted: true });
    }

    if (data?.action === 'complete-upload') {
      const id = data.id;
      if (!isValidMediaId(id)) return json({ error: 'Choose a valid upload.' }, 400);
      const file = await db.collection('mediaFiles').findOne({ _id: id, status: 'pending' });
      if (!file) return json({ error: 'Pending upload not found. Start the upload again.' }, 404);
      const object = await headObject(file.objectKey);
      if (!object.exists) return json({ error: 'The upload could not be verified in private storage.' }, 409);
      if (object.size && object.size !== file.size) {
        await deleteObject(file.objectKey);
        await db.collection('mediaFiles').deleteOne({ _id: id, status: 'pending' });
        return json({ error: 'The uploaded file size did not match. Please upload it again.' }, 400);
      }
      const inspected = await readObjectPrefix(file.objectKey);
      if (!inspected.exists || !hasValidMediaSignature(inspected.prefix, file.type)) {
        await deleteObject(file.objectKey);
        await db.collection('mediaFiles').deleteOne({ _id: id, status: 'pending' });
        return json({ error: 'The file contents do not match the selected PDF or image type.' }, 400);
      }
      const result = await db.collection('mediaFiles').findOneAndUpdate(
        { _id: id, status: 'pending' },
        { $set: { status: 'ready', updatedAt: new Date() } },
        { returnDocument: 'after', includeResultMetadata: false },
      );
      if (!result) return json({ error: 'Upload state changed. Refresh the library.' }, 409);
      return json(serialize(result), 201);
    }
    return json({ error: 'Unsupported file-library action.' }, 400);
  } catch (error) {
    console.error('POST /api/media failed:', error);
    return json({ error: error.message?.includes('storage is not configured') || error.message?.includes('R2_') ? error.message : 'Could not complete the file-library request. Check private storage configuration.' }, 500);
  }
}

export async function PATCH(request) {
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  const data = parsed.data;
  try {
    const db = await getDatabase();
    if (data?.action === 'rename-folder') {
      if (!isValidMediaId(data.id)) return json({ error: 'Choose a valid folder.' }, 400);
      const normalized = normalizeFolderName(data.name);
      if (normalized.error) return json({ error: normalized.error }, 400);
      const result = await db.collection('mediaFolders').findOneAndUpdate(
        { _id: data.id },
        { $set: { name: normalized.value, updatedAt: new Date() } },
        { returnDocument: 'after', includeResultMetadata: false },
      );
      if (!result) return json({ error: 'Folder not found.' }, 404);
      return json(serialize(result));
    }
    if (data?.action === 'move-file') {
      if (!isValidMediaId(data.id) || !isValidFolderId(data.folderId)) return json({ error: 'Choose a valid file and folder.' }, 400);
      if (data.folderId && !await db.collection('mediaFolders').findOne({ _id: data.folderId })) return json({ error: 'Folder not found.' }, 404);
      const result = await db.collection('mediaFiles').findOneAndUpdate(
        { _id: data.id, status: 'ready' },
        { $set: { folderId: data.folderId || null, updatedAt: new Date() } },
        { returnDocument: 'after', includeResultMetadata: false },
      );
      if (!result) return json({ error: 'File not found.' }, 404);
      return json(serialize(result));
    }
    return json({ error: 'Unsupported file-library action.' }, 400);
  } catch (error) {
    console.error('PATCH /api/media failed:', error);
    return json({ error: 'Could not update the file library.' }, 500);
  }
}

export async function DELETE(request) {
  const params = new URL(request.url).searchParams;
  const id = params.get('id') || '';
  const type = params.get('type') || 'file';
  if (!isValidMediaId(id)) return json({ error: 'Choose a valid file or folder.' }, 400);
  try {
    const db = await getDatabase();
    if (type === 'folder') {
      const folder = await db.collection('mediaFolders').findOne({ _id: id });
      if (!folder) return json({ error: 'Folder not found.' }, 404);
      const hasFiles = await db.collection('mediaFiles').findOne({ folderId: id, status: { $ne: 'deleted' } }, { projection: { _id: 1 } });
      if (hasFiles) return json({ error: 'Move or delete the folder’s files before deleting this folder.' }, 409);
      await db.collection('mediaFolders').deleteOne({ _id: id });
      return json({ deleted: id, type: 'folder' });
    }
    const file = await db.collection('mediaFiles').findOne({ _id: id, status: { $in: ['ready', 'pending'] } });
    if (!file) return json({ error: 'File not found.' }, 404);
    if (file.status === 'ready') await deleteObject(file.objectKey);
    await db.collection('mediaFiles').deleteOne({ _id: id });
    return json({ deleted: id, type: 'file' });
  } catch (error) {
    console.error('DELETE /api/media failed:', error);
    return json({ error: 'Could not delete the file. The record was kept if storage deletion failed.' }, 500);
  }
}
