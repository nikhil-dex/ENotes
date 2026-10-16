import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const COOKIE_NAME = 'enotes_access';
export const SESSION_SECONDS = 60 * 60;

export function createSessionToken(secret, expiresAt, sessionId = randomUUID()) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Session secret must contain at least 32 characters.');
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) throw new Error('Session expiry must be a positive integer timestamp.');
  if (typeof sessionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(sessionId)) throw new Error('Session ID must be a UUID.');
  const expiresAtText = String(expiresAt);
  const signature = createHmac('sha256', secret).update(`enotes-access:${expiresAtText}:${sessionId}`).digest('hex');
  return `${expiresAtText}.${sessionId}.${signature}`;
}

export function getSessionClaims(token, secret, { allowExpired = false, nowSeconds = Math.floor(Date.now() / 1000) } = {}) {
  if (typeof token !== 'string' || typeof secret !== 'string' || secret.length < 32) return null;
  const [expiresAtText, sessionId, signature, ...extra] = token.split('.');
  if (extra.length || !/^\\d+$/.test(expiresAtText || '') || !/^[a-f0-9-]{36}$/i.test(sessionId || '') || !/^[a-f0-9]{64}$/.test(signature || '')) return null;
  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAt) || (!allowExpired && expiresAt <= nowSeconds)) return null;
  const expected = createHmac('sha256', secret).update(`enotes-access:${expiresAtText}:${sessionId}`).digest();
  const received = Buffer.from(signature, 'hex');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  return { expiresAt, sessionId };
}

export function isValidSession(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  return Boolean(getSessionClaims(token, secret, { nowSeconds }));
}
