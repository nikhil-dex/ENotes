import { del, get, issueSignedToken, presignUrl } from '@vercel/blob';

const OBJECT_KEY_PATTERN = /^media\/[a-f0-9-]{36}$/i;

function storeId() {
  const value = process.env.OGE_STORE_ID?.trim();
  if (!value) {
    throw new Error('Private Vercel Blob storage is not configured. Set OGE_STORE_ID on the server and connect the private Blob store to this Vercel project.');
  }
  return value;
}

export function isValidObjectKey(key) {
  return typeof key === 'string' && OBJECT_KEY_PATTERN.test(key);
}

function validateKey(key) {
  if (!isValidObjectKey(key)) throw new Error('Invalid storage object key.');
}

function totalSize(headers, fallback = 0) {
  const contentRange = headers.get('content-range');
  const match = contentRange?.match(/\/(\d+)$/);
  if (match) return Number(match[1]);
  const length = Number(headers.get('content-length'));
  return Number.isFinite(length) && length >= 0 ? length : fallback;
}

async function getRange(key, range = 'bytes=0-15') {
  validateKey(key);
  const object = await get(key, {
    access: 'private',
    storeId: storeId(),
    useCache: false,
    headers: { Range: range },
  });
  if (!object) return null;
  return object;
}

export async function createPresignedUrl(method, key, expiresSeconds = 300, upload = {}) {
  validateKey(key);
  if (!['GET', 'PUT'].includes(method)) throw new Error('Unsupported presigned URL method.');
  if (!Number.isInteger(expiresSeconds) || expiresSeconds < 1 || expiresSeconds > 900) {
    throw new Error('Signed URL expiry must be 1–900 seconds.');
  }
  if (method === 'PUT' && (
    typeof upload.contentType !== 'string' ||
    !Number.isSafeInteger(upload.size) ||
    upload.size < 1
  )) {
    throw new Error('Upload content type and size are required.');
  }

  const id = storeId();
  const operation = method === 'PUT' ? 'put' : 'get';
  const validUntil = Date.now() + expiresSeconds * 1000;
  const constraints = method === 'PUT'
    ? { allowedContentTypes: [upload.contentType], maximumSizeInBytes: upload.size }
    : {};

  const token = await issueSignedToken({
    pathname: key,
    operations: [operation],
    validUntil,
    storeId: id,
    ...constraints,
  });
  const { presignedUrl } = await presignUrl(token, {
    operation,
    pathname: key,
    access: 'private',
    validUntil,
    ...(method === 'PUT'
      ? { ...constraints, addRandomSuffix: false, allowOverwrite: false }
      : { useCache: false }),
  });
  return presignedUrl;
}

export async function headObject(key) {
  const object = await getRange(key, 'bytes=0-0');
  if (!object) return { exists: false };
  const size = totalSize(object.headers, object.blob.size);
  await object.stream.cancel().catch(() => {});
  return { exists: true, size, type: object.blob.contentType || '' };
}

export async function readObjectPrefix(key) {
  const object = await getRange(key, 'bytes=0-15');
  if (!object) return { exists: false };
  const reader = object.stream.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (length < 16) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value).subarray(0, 16 - length);
      chunks.push(chunk);
      length += chunk.length;
      if (chunk.length < value.length) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return {
    exists: true,
    size: totalSize(object.headers, object.blob.size),
    type: object.blob.contentType || '',
    prefix: Buffer.concat(chunks, length),
  };
}

export async function getObject(key, range) {
  validateKey(key);
  return get(key, {
    access: 'private',
    storeId: storeId(),
    useCache: false,
    ...(range ? { headers: { Range: range } } : {}),
  });
}

export async function deleteObject(key) {
  validateKey(key);
  await del(key, { storeId: storeId() });
  return true;
}
