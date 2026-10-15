import { errorMessage, json, parseNotes, readMarkdown, readSubjects, writeMarkdown, writeSubjects } from './_storage.mjs';

export async function GET(request) {
  try {
    const slug = new URL(request.url).searchParams.get('subject') || 'linux';
    const subjects = await readSubjects();
    if (!subjects.some((subject) => subject.slug === slug)) return json({ error: 'Subject not found.' }, 404);
    return json(parseNotes(await readMarkdown(slug)));
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const subjects = await readSubjects();
    const subject = subjects.find((item) => item.slug === String(data.subject || 'linux'));
    if (!subject) return json({ error: 'Choose a valid subject.' }, 400);

    const heading = String(data.heading || '').trim();
    const answer = String(data.answer || '').trim();
    if (!heading || !answer || heading.length > 160 || answer.length > 10000) {
      return json({ error: 'Add a heading and answer within the allowed length.' }, 400);
    }

    const number = subject.nextNumber;
    const saved = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }) + ' (IST)';
    const markdown = await readMarkdown(subject.slug);
    const section = `## ${number}. ${heading.replace(/[\r\n]+/g, ' ')}\n**Saved:** ${saved}\n\n${answer.replace(/\r\n/g, '\n')}`;
    await writeMarkdown(subject.slug, `${markdown.trimEnd()}\n\n${section}\n`);
    subject.nextNumber = number + 1;
    await writeSubjects(subjects);
    return json({ number, heading, saved, answer, subject: subject.slug }, 201);
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}

export async function DELETE(request) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get('subject') || 'linux';
    const number = Number(url.searchParams.get('number'));
    const subjects = await readSubjects();
    if (!subjects.some((subject) => subject.slug === slug) || !Number.isInteger(number) || number < 1) {
      return json({ error: 'Choose a valid subject and note.' }, 400);
    }

    const markdown = await readMarkdown(slug);
    const matches = [...markdown.matchAll(/^## (\d+)\. .+$/gm)];
    const index = matches.findIndex((match) => Number(match[1]) === number);
    if (index < 0) return json({ error: 'Note not found.' }, 404);

    const start = matches[index].index;
    const end = matches[index + 1]?.index ?? markdown.length;
    const before = markdown.slice(0, start).replace(/\n+$/, '\n\n');
    const after = markdown.slice(end).replace(/^\n+/, '');
    await writeMarkdown(slug, `${before}${after}`.trimEnd() + '\n');
    return json({ deleted: number, subject: slug });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
