import { readdir } from 'node:fs/promises';
import SiteNavbar from '../components/site-navbar';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata = {
  title: 'HTML Files',
  description: 'Browse the HTML study pages saved in the HTML library folder.',
};

function displayName(filename) {
  return filename
    .replace(/\.html$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function HtmlLibraryPage() {
  const directory = path.join(process.cwd(), 'public', 'html-library');
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  return (
    <main className="shell import-guide-shell">
      <SiteNavbar />

      <section className="html-library">
        <p className="eyebrow">YOUR STUDY PAGES</p>
        <h1>HTML library<span className="period">.</span></h1>
        <p className="import-guide-lead">Open a saved study page. Add more <code>.html</code> files to <code>public/html-library</code> and this list will pick them up automatically.</p>
        {files.length ? (
          <div className="html-file-grid">
            {files.map((filename) => (
              <a className="html-file-card" href={`/html-library/${encodeURIComponent(filename)}`} key={filename} target="_blank" rel="noreferrer">
                <span className="html-file-icon" aria-hidden="true">&lt;/&gt;</span>
                <span className="html-file-title">{displayName(filename)}</span>
                <span className="html-file-name">{filename}</span>
                <span className="html-file-open">Open page ↗</span>
              </a>
            ))}
          </div>
        ) : (
          <div className="empty-state"><span className="empty-icon">&lt;/&gt;</span><h3>No HTML pages yet</h3><p>Place an HTML file inside <code>public/html-library</code> to list it here.</p></div>
        )}
      </section>
    </main>
  );
}
