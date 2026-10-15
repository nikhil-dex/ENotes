const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const notesDir = path.join(root, 'notes');
const subjectsPath = path.join(root, 'subjects.json');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

fs.mkdirSync(notesDir, { recursive: true });

function readSubjects() {
  if (!fs.existsSync(subjectsPath)) fs.writeFileSync(subjectsPath, JSON.stringify([
    { name: 'Linux', slug: 'linux', file: 'notes/linux.md' },
    { name: 'DevOps', slug: 'devops', file: 'notes/devops.md' },
    { name: 'ML', slug: 'ml', file: 'notes/ml.md' }
  ], null, 2) + '\n');
  const subjects = JSON.parse(fs.readFileSync(subjectsPath, 'utf8'));
  let changed = false;
  for (const subject of subjects) {
    const expectedFile = `notes/${subject.slug}.md`;
    const target = path.join(notesDir, `${subject.slug}.md`);
    const oldFile = path.resolve(root, subject.file || expectedFile);
    if (oldFile.startsWith(root + path.sep) && oldFile !== target && fs.existsSync(oldFile) && !fs.existsSync(target)) {
      fs.renameSync(oldFile, target);
    }
    if (!fs.existsSync(target)) fs.writeFileSync(target, `# ${subject.name} Notes\n\nNotes for ${subject.name}.\n`);
    if (!Number.isInteger(subject.nextNumber) || subject.nextNumber < 1) {
      const markdown = fs.readFileSync(target, 'utf8');
      const numbers = [...markdown.matchAll(/^## (\d+)\./gm)].map((match) => Number(match[1]));
      subject.nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
      changed = true;
    }
    if (subject.file !== expectedFile) {
      subject.file = expectedFile;
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(subjectsPath, JSON.stringify(subjects, null, 2) + '\n');
  return subjects;
}

function getSubject(slug) {
  return readSubjects().find((subject) => subject.slug === slug);
}

function readNotes(subject) {
  const file = path.join(notesDir, `${subject.slug}.md`);
  const md = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const sections = [...md.matchAll(/^## (\d+)\. (.+)\n\*\*Saved:\*\* (.+)\n\n([\s\S]*?)(?=\n## |$)/gm)];
  return sections.map((m) => ({ number: Number(m[1]), heading: m[2], saved: m[3], answer: m[4].trim() }));
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/subjects') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(readSubjects()));
  }
  if (req.method === 'POST' && req.url === '/api/subjects') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const name = String(data.name || '').trim().replace(/\s+/g, ' ');
        if (!name || name.length > 40) throw new Error('Subject name must be 1–40 characters.');
        const subjects = readSubjects();
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (!slug || subjects.some((subject) => subject.slug === slug)) throw new Error('That subject already exists or has an invalid name.');
        const file = `notes/${slug}.md`;
        fs.writeFileSync(path.join(notesDir, `${slug}.md`), `# ${name} Notes\n\nNotes for ${name}.\n`);
        const subject = { name, slug, file, nextNumber: 1 };
        subjects.push(subject);
        fs.writeFileSync(subjectsPath, JSON.stringify(subjects, null, 2) + '\n');
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(subject));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: err.message || 'Could not add subject.' }));
      }
    });
    return;
  }
  if (req.method === 'DELETE' && req.url.startsWith('/api/subjects')) {
    const url = new URL(req.url, 'http://localhost');
    const slug = url.searchParams.get('slug');
    const subjects = readSubjects();
    const subject = subjects.find((item) => item.slug === slug);
    if (!subject) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Subject not found.' })); }
    if (subjects.length === 1) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Keep at least one subject. Add another subject before deleting this one.' })); }
    const file = path.join(notesDir, `${subject.slug}.md`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    const remaining = subjects.filter((item) => item.slug !== slug);
    fs.writeFileSync(subjectsPath, JSON.stringify(remaining, null, 2) + '\n');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ deleted: slug }));
  }
  if (req.method === 'GET' && req.url.startsWith('/api/notes')) {
    const slug = new URL(req.url, 'http://localhost').searchParams.get('subject') || 'linux';
    const subject = getSubject(slug);
    if (!subject) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Subject not found.' })); }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(readNotes(subject)));
  }
  if (req.method === 'POST' && req.url.startsWith('/api/notes')) {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 100000) req.destroy(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const subjects = readSubjects();
        const subject = subjects.find((item) => item.slug === String(data.subject || 'linux'));
        if (!subject) throw new Error('Choose a valid subject.');
        const heading = String(data.heading || '').trim();
        const answer = String(data.answer || '').trim();
        if (!heading || !answer || heading.length > 160 || answer.length > 10000) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Add a heading and answer within the allowed length.' }));
        }
        const notes = readNotes(subject);
        const number = Number.isInteger(subject.nextNumber) ? subject.nextNumber : (notes.length ? Math.max(...notes.map((n) => n.number)) + 1 : 1);
        const saved = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) + ' (IST)';
        fs.appendFileSync(path.join(notesDir, `${subject.slug}.md`), `\n\n## ${number}. ${heading.replace(/[\r\n]+/g, ' ')}\n**Saved:** ${saved}\n\n${answer.replace(/\r\n/g, '\n')}\n`);
        subject.nextNumber = number + 1;
        fs.writeFileSync(subjectsPath, JSON.stringify(subjects, null, 2) + '\n');
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ number, heading, saved, answer, subject: subject.slug }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Could not save this section.' }));
      }
    });
    return;
  }
  if (req.method === 'DELETE' && req.url.startsWith('/api/notes')) {
    const url = new URL(req.url, 'http://localhost');
    const subject = getSubject(url.searchParams.get('subject') || 'linux');
    const number = Number(url.searchParams.get('number'));
    if (!subject || !Number.isInteger(number) || number < 1) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Choose a valid subject and note.' })); }
    const file = path.join(notesDir, `${subject.slug}.md`);
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Note not found.' })); }
    const markdown = fs.readFileSync(file, 'utf8');
    const matches = [...markdown.matchAll(/^## (\d+)\. .+$/gm)];
    const index = matches.findIndex((match) => Number(match[1]) === number);
    if (index < 0) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Note not found.' })); }
    const start = matches[index].index;
    const end = matches[index + 1]?.index ?? markdown.length;
    const before = markdown.slice(0, start).replace(/\n+$/, '\n\n');
    const after = markdown.slice(end).replace(/^\n+/, '');
    fs.writeFileSync(file, `${before}${after}`.trimEnd() + '\n');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ deleted: number, subject: subject.slug }));
  }
  const requested = req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(root, 'public', requested.replace(/^\/+/, ''));
  if (!file.startsWith(path.join(root, 'public') + path.sep)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(file, (err, contents) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(contents);
  });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, '127.0.0.1', () => console.log(`Linux notes dashboard: http://localhost:${port}`));
