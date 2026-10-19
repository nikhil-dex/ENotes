import SiteNavbar from '../components/site-navbar';

export const metadata = {
  title: 'MongoDB Import Guide',
  description: 'MongoDB document schema and instructions for importing notes.',
};

const noteExample = `{
  "_id": "linux:1",
  "subject": "linux",
  "number": 1,
  "heading": "What is GRUB?",
  "answer": "GRUB is a bootloader used to select and start an operating system.",
  "saved": "Oct 15, 2026, 3:57 PM (IST)",
  "createdAt": { "$date": "2026-10-15T10:27:00.000Z" }
}`;

const subjectExample = `{
  "_id": "linux",
  "slug": "linux",
  "name": "Linux",
  "file": "notes/linux.md",
  "nextNumber": 2,
  "order": 0
}`;

export default function ImportGuidePage() {
  return (
    <main className="shell import-guide-shell">
      <SiteNavbar />

      <article className="import-guide">
        <p className="eyebrow">MONGODB REFERENCE</p>
        <h1>Import notes<span className="period">.</span></h1>
        <p className="import-guide-lead">Use this schema when importing note documents directly into MongoDB. The dashboard reads notes from the <code>notes</code> collection.</p>

        <section className="guide-section">
          <h2>Note document</h2>
          <p>Import a JSON array of objects. Keep the <code>_id</code> unique and make <code>subject</code> match a subject slug in the <code>subjects</code> collection.</p>
          <pre className="schema-code"><code>{noteExample}</code></pre>
          <dl className="field-list">
            <div><dt><code>_id</code></dt><dd>Unique string in the format <code>subject:number</code>, for example <code>linux:1</code>.</dd></div>
            <div><dt><code>subject</code></dt><dd>Subject slug, in lowercase, such as <code>linux</code>, <code>devops</code>, or <code>ml</code>.</dd></div>
            <div><dt><code>number</code></dt><dd>Positive integer used as the note’s serial number.</dd></div>
            <div><dt><code>heading</code></dt><dd>Short note title as a string.</dd></div>
            <div><dt><code>answer</code></dt><dd>Note content as a string. Markdown formatting is supported.</dd></div>
            <div><dt><code>saved</code></dt><dd>Display text for when the note was saved, such as <code>Oct 15, 2026, 3:57 PM (IST)</code>.</dd></div>
            <div><dt><code>createdAt</code></dt><dd>Optional MongoDB date. In JSON imports, use Extended JSON as shown.</dd></div>
          </dl>
        </section>

        <section className="guide-section">
          <h2>Subject document</h2>
          <p>Each note subject also needs a document in the <code>subjects</code> collection. Set <code>nextNumber</code> to one greater than the largest imported note number for that subject.</p>
          <pre className="schema-code"><code>{subjectExample}</code></pre>
        </section>

        <section className="guide-section">
          <h2>Import with MongoDB Compass</h2>
          <ol>
            <li>Choose your database and open the <code>subjects</code> collection.</li>
            <li>Import the subject document if it does not already exist.</li>
            <li>Open the <code>notes</code> collection and import a JSON file containing an array of note objects.</li>
            <li>Confirm each note’s <code>subject</code> uses the matching subject slug.</li>
          </ol>
          <p className="guide-tip">The project includes <code>linux-notes.mongodb.json</code> as a ready-to-import example. If you have already imported the same notes, don’t import them again because their <code>_id</code> values will conflict.</p>
        </section>
      </article>
    </main>
  );
}
