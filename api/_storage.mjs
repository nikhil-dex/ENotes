import { del, get, put } from '@vercel/blob';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const subjectsPath = 'notes/subjects.json';

export function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function errorMessage(error) {
  console.error('Notes API error:', error);
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL) {
    return 'Connect a Vercel Blob store or set BLOB_READ_WRITE_TOKEN before using the Vercel API locally.';
  }
  return 'Notes storage is unavailable. Check that a private Vercel Blob store is connected to this project.';
}

async function readSeed(relativePath) {
  try {
    return await readFile(path.join(projectRoot, relativePath), 'utf8');
  } catch {
    return '';
  }
}

export async function readMarkdown(slug) {
  const key = `notes/${slug}.md`;
  const blob = await get(key, { access: 'private' });
  if (blob?.statusCode === 200) return new Response(blob.stream).text();
  return readSeed(key);
}

export async function writeMarkdown(slug, markdown) {
  await put(`notes/${slug}.md`, markdown, {
    access: 'private',
    allowOverwrite: true,
    contentType: 'text/markdown; charset=utf-8',
    cacheControlMaxAge: 0,
  });
}

export async function deleteMarkdown(slug) {
  const key = `notes/${slug}.md`;
  const blob = await get(key, { access: 'private' });
  if (blob) await del(key);
}

export async function readSubjects() {
  const blob = await get(subjectsPath, { access: 'private' });
  const source = blob?.statusCode === 200
    ? await new Response(blob.stream).text()
    : await readSeed('subjects.json');
  const subjects = JSON.parse(source || '[]');
  let changed = false;

  for (const subject of subjects) {
    subject.file = `notes/${subject.slug}.md`;
    if (!Number.isInteger(subject.nextNumber) || subject.nextNumber < 1) {
      const markdown = await readMarkdown(subject.slug);
      const numbers = [...markdown.matchAll(/^## (\d+)\./gm)].map((match) => Number(match[1]));
      subject.nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
      changed = true;
    }
  }

  if (!blob || changed) await writeSubjects(subjects);
  return subjects;
}

export async function writeSubjects(subjects) {
  await put(subjectsPath, JSON.stringify(subjects, null, 2) + '\n', {
    access: 'private',
    allowOverwrite: true,
    contentType: 'application/json; charset=utf-8',
    cacheControlMaxAge: 0,
  });
}

export function parseNotes(markdown) {
  const sections = [...markdown.matchAll(/^## (\d+)\. (.+)\n\*\*Saved:\*\* (.+)\n\n([\s\S]*?)(?=\n## |$)/gm)];
  return sections.map((match) => ({
    number: Number(match[1]),
    heading: match[2],
    saved: match[3],
    answer: match[4].trim(),
  }));
}

export function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
