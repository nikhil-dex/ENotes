const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const subjectsPath = path.join(root, 'subjects.json');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

function readSubjects() {
  if (!fs.existsSync(subjectsPath)) fs.writeFileSync(subjectsPath, JSON.stringify([
    { name: 'Linux', slug: 'linux', file: 'lec_1.md' },
    { name: 'DevOps', slug: 'devops', file: 'devops.md' },
    { name: 'ML', slug: 'ml', file: 'ml.md' }
  ], null, 2) + '\n');
  return JSON.parse(fs.readFileSync(subjectsPath, 'utf8'));
}

function getSubject(slug) {
  return readSubjects().find((subject) => subject.slug === slug);
}

function readNotes(subject) {
  const md = fs.existsSync(subject.file) ? fs.readFileSync(subject.file, 'utf8') : '';
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
        const file = `${slug}.md`;
        fs.writeFileSync(file, `# ${name} Notes\n\nNotes for ${name}.\n`);
        const subject = { name, slug, file };
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
        const subject = getSubject(String(data.subject || 'linux'));
        if (!subject) throw new Error('Choose a valid subject.');
        const heading = String(data.heading || '').trim();
        const answer = String(data.answer || '').trim();
        if (!heading || !answer || heading.length > 160 || answer.length > 10000) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Add a heading and answer within the allowed length.' }));
        }
        const notes = readNotes(subject);
        const number = notes.length ? Math.max(...notes.map((n) => n.number)) + 1 : 1;
        const saved = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) + ' (IST)';
        fs.appendFileSync(subject.file, `\n\n## ${number}. ${heading.replace(/[\r\n]+/g, ' ')}\n**Saved:** ${saved}\n\n${answer.replace(/\r\n/g, '\n')}\n`);
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ number, heading, saved, answer, subject: subject.slug }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Could not save this section.' }));
      }
    });
    return;
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
