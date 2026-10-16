import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReleaseEnvironment } from '../scripts/check-release-env.mjs';

const valid = {
  MONGODB_URI: 'mongodb+srv://db-user:db-password@cluster.example.mongodb.net/?retryWrites=true&w=majority',
  MONGODB_DB: 'linux_notes',
  ENOTES_SESSION_SECRET: 'a-secure-test-session-secret-with-more-than-32-chars',
};

test('release environment accepts valid MongoDB URI and session secret', () => {
  assert.deepEqual(validateReleaseEnvironment(valid), []);
});

test('release environment requires a MongoDB URI', () => {
  const issues = validateReleaseEnvironment({ ...valid, MONGODB_URI: '' });
  assert.ok(issues.some((issue) => issue.includes('MONGODB_URI is required')));
});

test('release environment rejects placeholder database credentials', () => {
  const issues = validateReleaseEnvironment({
    ...valid,
    MONGODB_URI: 'mongodb+srv://<username>:<password>@<cluster-host>/?retryWrites=true',
  });
  assert.ok(issues.some((issue) => issue.includes('placeholder')));
});

test('release environment rejects unsupported URI schemes and malformed database names', () => {
  const issues = validateReleaseEnvironment({
    ...valid,
    MONGODB_URI: 'https://database.example.com',
    MONGODB_DB: 'linux notes',
  });
  assert.ok(issues.some((issue) => issue.includes('must start with mongodb')));
  assert.ok(issues.some((issue) => issue.includes('MONGODB_DB')));
});

test('release environment rejects missing, short, or example session secrets', () => {
  assert.ok(validateReleaseEnvironment({ ...valid, ENOTES_SESSION_SECRET: '' }).some((issue) => issue.includes('at least 32')));
  assert.ok(validateReleaseEnvironment({ ...valid, ENOTES_SESSION_SECRET: 'short-secret' }).some((issue) => issue.includes('at least 32')));
  assert.ok(validateReleaseEnvironment({ ...valid, ENOTES_SESSION_SECRET: 'replace-with-a-long-example-secret-value' }).some((issue) => issue.includes('example value')));
});
