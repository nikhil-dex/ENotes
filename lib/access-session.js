import { createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE_NAME = 'enotes_access';
export const SESSION_SECONDS = 60 * 60;

export function createSessionToken(secret, expiresAt) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('Session secret must contain at least 32 characters.');
  }
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    throw new Error('Session expiry must be a positive integer timestamp.');
  }
  const expiresAtText = String(expiresAt);
  const signature = createHmac('sha256', secret)
    .update(`enotes-access:${expiresAtText}`)
    .digest('hex');
  return `${expiresAtText}.${signature}`;
}

export function isValidSession(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string' || typeof secret !== 'string' || secret.length < 32) return false;
  const [expiresAtText, signature, ...extra] = token.split('.');
  if (extra.length || !/^\d+$/.test(expiresAtText || '') || !/^[a-f0-9]{64}$/.test(signature || '')) return false;

  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= nowSeconds) return false;

  const expected = createHmac('sha256', secret)
    .update(`enotes-access:${expiresAtText}`)
    .digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}
