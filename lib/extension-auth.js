import { createHash } from 'node:crypto';

export const EXTENSION_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export function hashExtensionSecret(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function extensionOrigin() {
  const id = process.env.ENOTES_EXTENSION_ID;
  return id && /^[a-p]{32}$/.test(id) ? `chrome-extension://${id}` : null;
}

export function extensionCorsHeaders(request) {
  const origin = request.headers.get('origin');
  const allowedOrigin = extensionOrigin();
  if (!origin || !allowedOrigin || origin !== allowedOrigin) return {};
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  };
}

export function isAllowedExtensionOrigin(request) {
  const origin = request.headers.get('origin');
  const allowedOrigin = extensionOrigin();
  return Boolean(origin && allowedOrigin && origin === allowedOrigin);
}

export async function findValidExtensionToken(request, db) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer ([A-Za-z0-9_-]{40,100})$/);
  if (!match) return null;
  const tokenHash = hashExtensionSecret(match[1]);
  const now = new Date();
  return db.collection('extensionTokens').findOne({
    tokenHash,
    expiresAt: { $gt: now },
    revokedAt: { $exists: false },
  }, { projection: { _id: 1, scopes: 1, expiresAt: 1 } });
}
