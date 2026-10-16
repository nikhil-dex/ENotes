import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownHtml } from '../lib/markdown.js';

test('renders common Markdown blocks and inline formatting', () => {
  const html = markdownHtml('# Heading\n\n**bold** and *italic* with `code`.\n\n- one\n- two\n\n1. first\n2. second\n\n> quoted');
  assert.match(html, /<h1>Heading<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(html, /<ol><li>first<\/li><li>second<\/li><\/ol>/);
  assert.match(html, /<blockquote>quoted<\/blockquote>/);
});

test('escapes raw HTML in paragraphs, links, and fenced code', () => {
  const html = markdownHtml('<script>alert(1)</script>\n\n```html\n<img src=x onerror=alert(1)>\n```');
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('only creates links for explicit HTTP(S) URLs', () => {
  const html = markdownHtml('[safe](https://example.com) [bad](javascript:alert(1))');
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.doesNotMatch(html, /href="javascript:/);
});
