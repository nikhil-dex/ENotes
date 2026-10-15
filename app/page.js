'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function markdownHtml(value) {
  const lines = escapeHtml(value).split('\n');
  let html = '';
  let inList = false;
  let inCode = false;
  let codeLines = [];
  const inline = (line) => line.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (!inCode) {
        if (inList) { html += '</ul>'; inList = false; }
        inCode = true;
        codeLines = [];
      } else {
        html += `<pre><code>${codeLines.join('\n')}</code></pre>`;
        inCode = false;
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (/^#{1,3}\s/.test(line)) html += `<h3>${inline(line.replace(/^#{1,3}\s+/, ''))}</h3>`;
      else if (line.trim()) html += `<p>${inline(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  if (inCode) html += `<pre><code>${codeLines.join('\n')}</code></pre>`;
  return html;
}

async function responseJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

export default function HomePage() {
  const [subjects, setSubjects] = useState([]);
  const [activeSubject, setActiveSubject] = useState('');
  const [notes, setNotes] = useState([]);
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState('light');
  const [noteDialog, setNoteDialog] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [subjectDialog, setSubjectDialog] = useState(false);
  const [readerNote, setReaderNote] = useState(null);
  const [studyOpen, setStudyOpen] = useState(false);
  const [heading, setHeading] = useState('');
  const [answer, setAnswer] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [formError, setFormError] = useState('');
  const [subjectError, setSubjectError] = useState('');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studyDeck, setStudyDeck] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [studyRevealed, setStudyRevealed] = useState(false);
  const [learnedNotes, setLearnedNotes] = useState(new Set());
  const answerRef = useRef(null);

  const active = subjects.find((subject) => subject.slug === activeSubject);
  const shownNotes = useMemo(() => notes
    .filter((note) => `${note.heading} ${note.answer}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.number - a.number), [notes, query]);

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' || storedTheme === 'light') setTheme(storedTheme);
    const storedSubject = localStorage.getItem('activeSubject');
    fetch('/api/subjects')
      .then(responseJson)
      .then((items) => {
        setSubjects(items);
        const preferred = items.find((item) => item.slug === storedSubject) || items[0];
        if (preferred) setActiveSubject(preferred.slug);
      })
      .catch((error) => setFormError(error.message));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const hasOverlay = noteDialog || subjectDialog || readerNote || studyOpen;
    document.body.style.overflow = hasOverlay ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [noteDialog, subjectDialog, readerNote, studyOpen]);

  useEffect(() => {
    if (!activeSubject) return;
    localStorage.setItem('activeSubject', activeSubject);
    fetch(`/api/notes?subject=${encodeURIComponent(activeSubject)}`)
      .then(responseJson)
      .then(setNotes)
      .catch((error) => setFormError(error.message));
    try {
      const saved = JSON.parse(localStorage.getItem(`learnedNotes:${activeSubject}`) || '[]');
      setLearnedNotes(new Set(saved));
    } catch { setLearnedNotes(new Set()); }
    setQuery('');
  }, [activeSubject]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== 'Escape') return;
      setNoteDialog(false); setSubjectDialog(false); setReaderNote(null); setStudyOpen(false); setMobileNavOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function saveLearned(next) {
    setLearnedNotes(next);
    localStorage.setItem(`learnedNotes:${activeSubject}`, JSON.stringify([...next]));
  }

  async function reloadNotes(slug = activeSubject) {
    const data = await responseJson(await fetch(`/api/notes?subject=${encodeURIComponent(slug)}`));
    setNotes(data);
  }

  async function saveNote(event) {
    event.preventDefault(); setFormError(''); setSaving(true);
    try {
      const note = await responseJson(await fetch('/api/notes', {
        method: editingNote ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heading, answer, subject: activeSubject, ...(editingNote ? { number: editingNote.number } : {}) }),
      }));
      if (editingNote) {
        setNotes((current) => current.map((item) => item.number === note.number ? note : item));
        setReaderNote((current) => current?.number === note.number ? note : current);
      } else {
        setNotes((current) => [...current, note]);
      }
      setHeading(''); setAnswer(''); setPreview(false); setNoteDialog(false); setEditingNote(null);
    } catch (error) { setFormError(error.message); }
    finally { setSaving(false); }
  }

  function editNote(note) {
    setEditingNote(note); setHeading(note.heading); setAnswer(note.answer);
    setPreview(false); setFormError(''); setNoteDialog(true);
  }

  async function createSubject(event) {
    event.preventDefault(); setSubjectError(''); setSaving(true);
    try {
      const subject = await responseJson(await fetch('/api/subjects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: subjectName }),
      }));
      setSubjects((current) => [...current, subject]);
      setSubjectName(''); setSubjectDialog(false); setActiveSubject(subject.slug);
    } catch (error) { setSubjectError(error.message); }
    finally { setSaving(false); }
  }

  async function deleteNote(note) {
    if (!window.confirm(`Delete “${note.heading}” from ${active?.name || activeSubject}? This cannot be undone.`)) return;
    try {
      await responseJson(await fetch(`/api/notes?subject=${encodeURIComponent(activeSubject)}&number=${note.number}`, { method: 'DELETE' }));
      setNotes((current) => current.filter((item) => item.number !== note.number));
      setReaderNote((current) => current?.number === note.number ? null : current);
    } catch (error) { window.alert(error.message); }
  }

  async function deleteSubject(subject) {
    if (!window.confirm(`Delete ${subject.name} and all its notes? This cannot be undone.`)) return;
    try {
      await responseJson(await fetch(`/api/subjects?slug=${encodeURIComponent(subject.slug)}`, { method: 'DELETE' }));
      const remaining = subjects.filter((item) => item.slug !== subject.slug);
      setSubjects(remaining);
      if (activeSubject === subject.slug) setActiveSubject(remaining[0]?.slug || '');
    } catch (error) { window.alert(error.message); }
  }

  function startStudy() {
    if (!notes.length) return;
    setStudyDeck([...notes].sort((a, b) => b.number - a.number));
    setStudyIndex(0); setStudyRevealed(false);
    const stillPresent = new Set([...learnedNotes].filter((number) => notes.some((note) => note.number === number)));
    saveLearned(stillPresent);
    setStudyOpen(true);
  }

  function moveStudy(index) {
    if (index >= studyDeck.length) { setStudyOpen(false); return; }
    if (index < 0) return;
    setStudyIndex(index); setStudyRevealed(false);
  }

  function markLearned() {
    const note = studyDeck[studyIndex];
    if (!note) return;
    const next = new Set(learnedNotes); next.add(note.number); saveLearned(next);
    if (studyIndex < studyDeck.length - 1) moveStudy(studyIndex + 1);
  }

  function shuffleStudy() {
    const shuffled = [...studyDeck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setStudyDeck(shuffled); setStudyIndex(0); setStudyRevealed(false);
  }

  function insertFormatting(format) {
    const field = answerRef.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selected = answer.slice(start, end);
    let before = '';
    let value = selected || 'text';
    let after = '';
    if (format === 'bold') { before = '**'; after = '**'; }
    if (format === 'code') { before = '`'; after = '`'; }
    if (format === 'codeblock') { before = '```bash\n'; after = '\n```'; value = selected || 'command'; }
    if (format === 'list') {
      const lineStart = answer.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = answer.indexOf('\n', end);
      const actualEnd = lineEnd < 0 ? answer.length : lineEnd;
      const list = answer.slice(lineStart, actualEnd).split('\n').map((line) => `- ${line}`).join('\n');
      setAnswer(`${answer.slice(0, lineStart)}${list}${answer.slice(actualEnd)}`);
      return;
    }
    setAnswer(`${answer.slice(0, start)}${before}${value}${after}${answer.slice(end)}`);
  }

  const currentStudyNote = studyDeck[studyIndex];
  const currentIsLearned = currentStudyNote && learnedNotes.has(currentStudyNote.number);

  return (
    <main className="shell">
      <header className={`topbar dashboard-topbar ${mobileNavOpen ? 'nav-open' : ''}`}>
        <a className="brand" href="/" aria-label="Notes dashboard home"><span className="brand-mark">N</span><span>Study<span className="brand-light">Notes</span></span></a>
        <button className="mobile-nav-toggle" type="button" aria-controls="dashboard-navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}><span className="mobile-nav-icon" aria-hidden="true"><i/><i/><i/></span><span>{mobileNavOpen ? 'Close' : 'Menu'}</span></button>
        <div className={`dashboard-nav-panel ${mobileNavOpen ? 'open' : ''}`} id="dashboard-navigation">
          <div className="topbar-right"><a className="import-guide-link" href="/html-library">HTML files</a><a className="import-guide-link" href="/import-guide">Import guide</a><button className="theme-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? '☼' : '◐'} <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button><span className="status-dot"/><span>{active?.file || 'MongoDB'}</span></div>
          <nav className="subject-nav" aria-label="Note subjects">
            {subjects.map((subject) => <span className="subject-item" key={subject.slug}><button className={`subject-tab ${subject.slug === activeSubject ? 'active' : ''}`} onClick={() => { setActiveSubject(subject.slug); setMobileNavOpen(false); }}>{subject.name}</button><button className="delete-subject" onClick={() => deleteSubject(subject)} aria-label={`Delete ${subject.name} subject`} title="Delete subject">×</button></span>)}
            <button className="subject-add" onClick={() => { setSubjectError(''); setSubjectDialog(true); setMobileNavOpen(false); }}><span>+</span> Add more</button>
          </nav>
        </div>
      </header>

      <section className="intro">
        <div><p className="eyebrow">YOUR PERSONAL KNOWLEDGE BASE</p><h1>{active?.name || 'Your'} notes<span className="period">.</span></h1><p className="subtitle">A clear place for the commands, concepts, and things you learn.</p></div>
        <div className="intro-actions"><button className="study-button" onClick={startStudy} disabled={!notes.length}><span aria-hidden="true">◉</span> Study notes</button><button className="add-button" onClick={() => { setEditingNote(null); setHeading(''); setAnswer(''); setFormError(''); setNoteDialog(true); }}><span aria-hidden="true">+</span> Add a note</button></div>
      </section>

      <section className="stats" aria-label="Note statistics"><div className="stat"><span className="stat-number">{String(notes.length).padStart(2, '0')}</span><span className="stat-label">TOTAL NOTES</span></div><div className="stat-divider"/><div className="stat"><span className="stat-number">{String(subjects.length).padStart(2, '0')}</span><span className="stat-label">SUBJECTS</span></div><div className="stat-spacer"/><div className="search-wrap"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search your notes…" aria-label="Search notes" value={query} onChange={(event) => setQuery(event.target.value)}/></div></section>

      <section className="notes-section"><div className="section-heading"><div><p className="eyebrow">THE LIBRARY</p><h2>All notes <span className="count-pill">{shownNotes.length}</span></h2></div><span className="sort-label">LATEST FIRST <span aria-hidden="true">↕</span></span></div>
        {shownNotes.length ? <div className="notes-grid">{shownNotes.map((note) => <article className="note-card" key={note.number}><button className="card-open" onClick={() => setReaderNote(note)} aria-label={`Open note: ${note.heading}`}><span className="card-top"><span className="note-index">NO. {String(note.number).padStart(2, '0')}</span></span><span className="note-title">{note.heading}</span><span className="note-preview">{note.answer}</span><span className="card-bottom">◷ <span>{note.saved}</span></span></button><button className="edit-note" onClick={() => editNote(note)} aria-label={`Edit note: ${note.heading}`} title="Edit note">✎</button><button className="delete-note" onClick={() => deleteNote(note)} aria-label={`Delete note: ${note.heading}`} title="Delete note">×</button></article>)}</div> : <div className="empty-state"><span className="empty-icon">⌕</span><h3>{query ? 'No notes found' : 'Start your collection'}</h3><p>{query ? 'Try another search, or add a new note.' : 'Add a note to this subject, then come back to study it.'}</p></div>}
      </section>
      <footer><span>Built for learning, one note at a time.</span><span>MONGODB · SUBJECT BASED</span></footer>

      {formError && !noteDialog && !subjectDialog && <p className="page-error" role="alert">{formError}</p>}

      {noteDialog && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setNoteDialog(false); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="formTitle"><button className="close-button" onClick={() => setNoteDialog(false)} aria-label="Close form">×</button><p className="eyebrow">{editingNote ? `EDIT NOTE ${String(editingNote.number).padStart(2, '0')}` : 'GROW YOUR LIBRARY'}</p><h2 id="formTitle">{editingNote ? 'Edit note' : 'Add a note'}<span className="period">.</span></h2><p className="form-subtitle">{editingNote ? 'Update the heading or answer. Its serial number will stay the same.' : 'Give it a clear heading and capture what you learned.'}</p>
        <form onSubmit={saveNote}><label htmlFor="heading">HEADING</label><input id="heading" maxLength={160} placeholder="e.g. What does chmod do?" value={heading} onChange={(event) => setHeading(event.target.value)} required/><div className="label-row"><label htmlFor="answer">ANSWER</label><span>Markdown is okay</span></div><div className="editor-toolbar" aria-label="Answer formatting"><button type="button" onClick={() => insertFormatting('bold')} title="Bold">B</button><button type="button" onClick={() => insertFormatting('code')} title="Inline code">&lt;/&gt;</button><button type="button" onClick={() => insertFormatting('list')} title="Bullet list">• List</button><button type="button" onClick={() => insertFormatting('codeblock')} title="Code block">{'{ }'}</button><span>Formatting shortcuts</span></div><div className="editor-tabs"><button type="button" className={!preview ? 'active' : ''} onClick={() => setPreview(false)}>Write</button><button type="button" className={preview ? 'active' : ''} onClick={() => setPreview(true)}>Preview</button></div>
          {!preview ? <textarea ref={answerRef} id="answer" rows={6} maxLength={10000} placeholder="Write your explanation here…" value={answer} onChange={(event) => setAnswer(event.target.value)} required/> : <div className="answer-preview">{answer ? <div dangerouslySetInnerHTML={{ __html: markdownHtml(answer) }}/> : <p className="preview-placeholder">Nothing to preview yet.</p>}</div>}
          {formError && <p className="form-error" role="alert">{formError}</p>}<button className="submit-button" type="submit" disabled={saving}><span>{saving ? 'Saving…' : editingNote ? 'Save changes' : 'Save note'}</span><span aria-hidden="true">→</span></button></form>
      </section></div>}

      {subjectDialog && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSubjectDialog(false); }}><section className="dialog subject-dialog" role="dialog" aria-modal="true" aria-labelledby="subjectFormTitle"><button className="close-button" onClick={() => setSubjectDialog(false)} aria-label="Close form">×</button><p className="eyebrow">MAKE ROOM TO LEARN</p><h2 id="subjectFormTitle">Add a subject<span className="period">.</span></h2><p className="form-subtitle">Create a separate notes collection for another topic.</p><form onSubmit={createSubject}><label htmlFor="subjectName">SUBJECT NAME</label><input id="subjectName" maxLength={40} placeholder="e.g. Networking" value={subjectName} onChange={(event) => setSubjectName(event.target.value)} required/>{subjectError && <p className="form-error" role="alert">{subjectError}</p>}<button className="submit-button" type="submit" disabled={saving}><span>{saving ? 'Creating…' : 'Create subject'}</span><span aria-hidden="true">→</span></button></form></section></div>}

      {readerNote && <div className="reader-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setReaderNote(null); }}><article className="reader-panel" role="dialog" aria-modal="true" aria-labelledby="readerTitle"><div className="reader-toolbar"><span className="reader-kicker">NOTE {String(readerNote.number).padStart(2, '0')}</span><button className="close-button reader-close" onClick={() => setReaderNote(null)} aria-label="Close note">×</button></div><div className="reader-content"><p className="eyebrow">{active?.name}</p><h2 id="readerTitle">{readerNote.heading}</h2><div className="reader-meta">Saved {readerNote.saved}</div><div className="reader-answer" dangerouslySetInnerHTML={{ __html: markdownHtml(readerNote.answer) }}/></div></article></div>}

      {studyOpen && currentStudyNote && <div className="reader-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setStudyOpen(false); }}><section className="study-panel" role="dialog" aria-modal="true" aria-labelledby="studyQuestion"><div className="reader-toolbar"><span className="reader-kicker">STUDY SESSION</span><button className="close-button reader-close" onClick={() => setStudyOpen(false)} aria-label="Close study session">×</button></div><div className="study-content"><div className="study-progress-row"><span>CARD {studyIndex + 1} OF {studyDeck.length}</span><span>{learnedNotes.size} learned</span></div><div className="study-progress"><span style={{ width: `${((studyIndex + 1) / studyDeck.length) * 100}%` }}/></div><p className="eyebrow">{active?.name}</p><p className="study-prompt">Try to recall the answer</p><h2 id="studyQuestion">{currentStudyNote.heading}</h2>{studyRevealed && <div className="study-answer" dangerouslySetInnerHTML={{ __html: markdownHtml(currentStudyNote.answer) }} />}{!studyRevealed && <button className="reveal-button" onClick={() => setStudyRevealed(true)}>Reveal answer</button>}{studyRevealed && <div className="study-actions">{currentIsLearned && <button className="review-button" onClick={() => { const next = new Set(learnedNotes); next.delete(currentStudyNote.number); saveLearned(next); }}>Review again</button>}<button className="submit-button" onClick={markLearned} disabled={currentIsLearned}><span>{currentIsLearned ? 'Learned ✓' : 'Got it'}</span><span aria-hidden="true">→</span></button></div>}<div className="study-navigation"><button onClick={() => moveStudy(studyIndex - 1)} disabled={studyIndex === 0}>← Previous</button><button onClick={shuffleStudy}>Shuffle cards</button><button onClick={() => moveStudy(studyIndex + 1)}>{studyIndex === studyDeck.length - 1 ? 'Finish' : 'Next →'}</button></div></div></section></div>}
    </main>
  );
}
