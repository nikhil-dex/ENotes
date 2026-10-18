import { createHash, createHmac } from 'node:crypto';

function config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Private file storage is not configured. Set the R2 environment variables on the server.');
  }
  if (!/^[a-z0-9-]{3,63}$/.test(bucket)) throw new Error('R2_BUCKET_NAME is invalid.');
  if (!/^[a-f0-9]{32}$/i.test(accountId)) throw new Error('R2_ACCOUNT_ID is invalid.');
  return { accountId, bucket, accessKeyId, secretAccessKey, host: `${accountId}.r2.cloudflarestorage.com` };
}

function awsEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalPath(bucket, key) {
  return `/${awsEncode(bucket)}/${key.split('/').map(awsEncode).join('/')}`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
  return createHmac('sha256', key).update(value).digest(encoding);
}

function signingKey(secret, date) {
  const dateKey = hmac(`AWS4${secret}`, date);
  const regionKey = hmac(dateKey, 'auto');
  const serviceKey = hmac(regionKey, 's3');
  return hmac(serviceKey, 'aws4_request');
}

function canonicalQuery(values) {
  return Object.entries(values)
    .map(([key, value]) => [awsEncode(key), awsEncode(String(value))])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

export function createPresignedUrl(method, key, expiresSeconds = 300, now = new Date(), responseDisposition = '') {
  if (!['GET', 'PUT'].includes(method)) throw new Error('Unsupported presigned URL method.');
  if (typeof key !== 'string' || !/^media\/[a-f0-9-]{36}$/.test(key)) throw new Error('Invalid storage object key.');
  if (!Number.isInteger(expiresSeconds) || expiresSeconds < 1 || expiresSeconds > 900) throw new Error('Signed URL expiry must be 1–900 seconds.');
  const cfg = config();
  const date = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const shortDate = date.slice(0, 8);
  const scope = `${shortDate}/auto/s3/aws4_request`;
  const uri = canonicalPath(cfg.bucket, key);
  const query = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${cfg.accessKeyId}/${scope}`,
    'X-Amz-Date': date,
    'X-Amz-Expires': expiresSeconds,
    'X-Amz-SignedHeaders': 'host',
  };
  if (method === 'GET' && responseDisposition) query['response-content-disposition'] = responseDisposition;
  const queryText = canonicalQuery(query);
  const canonicalRequest = [method, uri, queryText, `host:${cfg.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', date, scope, sha256(canonicalRequest)].join('\n');
  const signature = hmac(signingKey(cfg.secretAccessKey, shortDate), stringToSign, 'hex');
  return `https://${cfg.host}${uri}?${queryText}&X-Amz-Signature=${signature}`;
}

async function signedRequest(method, key, range = '') {
  const cfg = config();
  if (typeof key !== 'string' || !/^media\/[a-f0-9-]{36}$/.test(key)) throw new Error('Invalid storage object key.');
  const now = new Date();
  const date = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const shortDate = date.slice(0, 8);
  const uri = canonicalPath(cfg.bucket, key);
  const payloadHash = sha256('');
  const headers = {
    host: cfg.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': date,
  };
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders = `host:${cfg.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${date}\n`;
  const canonicalRequest = [method, uri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${shortDate}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', date, scope, sha256(canonicalRequest)].join('\n');
  const signature = hmac(signingKey(cfg.secretAccessKey, shortDate), stringToSign, 'hex');
  if (range) headers.range = range;
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(`https://${cfg.host}${uri}`, { method, headers, cache: 'no-store' });
  if (response.status === 404) return { exists: false };
  if (!response.ok) throw new Error(`Private file storage request failed (HTTP ${response.status}).`);
  if (range) {
    return {
      exists: true,
      size: Number(response.headers.get('content-length') || 0),
      type: response.headers.get('content-type') || '',
      prefix: Buffer.from(await response.arrayBuffer()),
    };
  }
  return {
    exists: true,
    size: Number(response.headers.get('content-length') || 0),
    type: response.headers.get('content-type') || '',
  };
}

export async function headObject(key) {
  return signedRequest('HEAD', key);
}

export async function readObjectPrefix(key) {
  return signedRequest('GET', key, 'bytes=0-15');
}

export async function deleteObject(key) {
  const result = await signedRequest('DELETE', key);
  return result.exists;
}
