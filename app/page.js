import SiteNavbar from './components/site-navbar';

export default function HomePage() {
  return (
    <main className="shell hub-shell">
      <SiteNavbar />

      <section className="hub-hero">
        <p className="eyebrow">YOUR PERSONAL KNOWLEDGE SPACE</p>
        <h1>Everything you learn,<br /><span>in one place.</span></h1>
        <p className="hub-lead">A calmer home for your notes, saved links, revision history, and learning resources. Choose where you want to go.</p>
        <a className="add-button hub-primary" href="/notes"><span aria-hidden="true">↗</span> Open notes</a>
      </section>

      <section className="hub-grid" aria-label="ENotes destinations">
        <a className="hub-card hub-card-featured" href="/notes">
          <span className="hub-card-icon" aria-hidden="true">▤</span>
          <span className="hub-card-kicker">01 · LEARN</span>
          <h2>Notes library <span aria-hidden="true">↗</span></h2>
          <p>Browse subjects, search your notes, write new entries, and revise with flashcards.</p>
          <span className="hub-card-link">Open library <span aria-hidden="true">→</span></span>
        </a>
        <a className="hub-card" href="/saved-links">
          <span className="hub-card-icon" aria-hidden="true">↗</span>
          <span className="hub-card-kicker">02 · COLLECT</span>
          <h2>Saved links <span aria-hidden="true">↗</span></h2>
          <p>Save useful websites, documentation, tools, and references. Search, copy, reorder, or open them in one tap.</p>
          <span className="hub-card-link">Open saved links <span aria-hidden="true">→</span></span>
        </a>
        <a className="hub-card" href="/settings">
          <span className="hub-card-icon" aria-hidden="true">⚙</span>
          <span className="hub-card-kicker">03 · ORGANIZE</span>
          <h2>Settings & backup <span aria-hidden="true">↗</span></h2>
          <p>Manage subjects, download a backup, restore missing records, and choose your theme.</p>
          <span className="hub-card-link">Open settings <span aria-hidden="true">→</span></span>
        </a>
        <a className="hub-card" href="/html-library">
          <span className="hub-card-icon" aria-hidden="true">⌘</span>
          <span className="hub-card-kicker">04 · EXPLORE</span>
          <h2>HTML files <span aria-hidden="true">↗</span></h2>
          <p>Keep useful reference files and learning resources close at hand.</p>
          <span className="hub-card-link">View resources <span aria-hidden="true">→</span></span>
        </a>
        <a className="hub-card" href="/revision-history">
          <span className="hub-card-icon" aria-hidden="true">↶</span>
          <span className="hub-card-kicker">05 · HISTORY</span>
          <h2>Revision history <span aria-hidden="true">↗</span></h2>
          <p>Browse previous saved versions of your notes by subject and restore content when needed.</p>
          <span className="hub-card-link">Browse revisions <span aria-hidden="true">→</span></span>
        </a>
        <a className="hub-card" href="/import-guide">
          <span className="hub-card-icon" aria-hidden="true">⇧</span>
          <span className="hub-card-kicker">06 · MIGRATE</span>
          <h2>Import guide <span aria-hidden="true">↗</span></h2>
          <p>Review how to bring your existing Markdown notes into ENotes.</p>
          <span className="hub-card-link">Read guide <span aria-hidden="true">→</span></span>
        </a>
      </section>

      <footer><span>Built for learning, one note at a time.</span><span>ENOTES · YOUR PRIVATE WORKSPACE</span></footer>
    </main>
  );
}
