import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const read = (path) => readFile(new URL('./' + path, import.meta.url), 'utf8');

test('browser extension manifest is valid and keeps a stable ID key', async () => {
  const manifest = JSON.parse(await read('manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, 'service-worker.js');
  assert.ok(manifest.content_scripts.some((script) => script.js.includes('content.js')));
  const digest = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest().subarray(0, 16);
  const extensionId = [...digest].map((byte) => String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15))).join('');
  assert.equal(extensionId, 'odbkddlkdjcmookpoaechkjplnofedpi');
});

test('extension JavaScript files parse without syntax errors', async () => {
  for (const path of ['content.js', 'popup.js', 'service-worker.js']) {
    const source = await read(path);
    try { new vm.Script(source, { filename: path }); } catch (error) { assert.fail(path + ' failed to parse: ' + error.stack); }
  }
});
