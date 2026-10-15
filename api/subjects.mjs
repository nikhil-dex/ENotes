import { deleteMarkdown, errorMessage, json, readSubjects, toSlug, writeMarkdown, writeSubjects } from './_storage.mjs';

export async function GET() {
  try {
    return json(await readSubjects());
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const name = String(data.name || '').trim().replace(/\s+/g, ' ');
    if (!name || name.length > 40) return json({ error: 'Subject name must be 1–40 characters.' }, 400);

    const subjects = await readSubjects();
    const slug = toSlug(name);
    if (!slug || subjects.some((subject) => subject.slug === slug)) {
      return json({ error: 'That subject already exists or has an invalid name.' }, 400);
    }

    const subject = { name, slug, file: `notes/${slug}.md`, nextNumber: 1 };
    await writeMarkdown(slug, `# ${name} Notes\n\nNotes for ${name}.\n`);
    await writeSubjects([...subjects, subject]);
    return json(subject, 201);
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}

export async function DELETE(request) {
  try {
    const slug = new URL(request.url).searchParams.get('slug');
    const subjects = await readSubjects();
    const subject = subjects.find((item) => item.slug === slug);
    if (!subject) return json({ error: 'Subject not found.' }, 404);
    if (subjects.length === 1) {
      return json({ error: 'Keep at least one subject. Add another subject before deleting this one.' }, 400);
    }

    await deleteMarkdown(slug);
    await writeSubjects(subjects.filter((item) => item.slug !== slug));
    return json({ deleted: slug });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
