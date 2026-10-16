'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { markdownHtml } from '../../lib/markdown.js';

function draftStorageKey(subject, number) {
  return `enotes:draft:${subject}:${number ?? 'new'}`;
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
  const [notesLoading, setNotesLoading] = useState(false);
  const [deletingNotes, setDeletingNotes] = useState(new Set());
  const [query, setQuery] = useState('');
  const [globalSearch, setGlobalSearch] = useState(false);
  const [globalSearchTruncated, setGlobalSearchTruncated] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [favoriteDraft, setFavoriteDraft] = useState(false);
  const [pinnedDraft, setPinnedDraft] = useState(false);
  const [theme, setTheme] = useState('light');
  const [noteDialog, setNoteDialog] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [readerNote, setReaderNote] = useState(null);
  const [studyOpen, setStudyOpen] = useState(false);
  const [heading, setHeading] = useState('');
  const [answer, setAnswer] = useState('');
  const [formError, setFormError] = useState('');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const [revisions, setRevisions] = useState([]);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState('');
  const [studyDeck, setStudyDeck] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [studyRevealed, setStudyRevealed] = useState(false);
  const [learnedNotes, setLearnedNotes] = useState(new Set());
  const answerRef = useRef(null);
  const dialogRef = useRef(null);
  const headingInputRef = useRef(null);
  const initialDraftRef = useRef({ heading: '', answer: '' });
  const draftDirty = noteDialog && (heading !== initialDraftRef.current.heading || answer !== initialDraftRef.current.answer);
  const subjectNavRef = useRef(null);

  const active = subjects.find((subject) => subject.slug === activeSubject);
  const availableTags = useMemo(() => [...new Set(notes.flatMap((note) => Array.isArray(note.tags) ? note.tags : []))].sort(), [notes]);
  const shownNotes = useMemo(() => notes
    .filter((note) => `${note.heading} ${note.answer} ${(note.tags || []).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((note) => !favoritesOnly || note.favorite === true)
    .filter((note) => !pinnedOnly || note.pinned === true)
    .filter((note) => !selectedTag || (note.tags || []).includes(selectedTag))
    .sort((a, b) => Number(b.pinned === true) - Number(a.pinned === true) || Number(b.favorite === true) - Number(a.favorite === true) || b.number - a.number), [notes, query, favoritesOnly, pinnedOnly, selectedTag]);

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' || storedTheme === 'light') setTheme(storedTheme);
    const storedSubject = localStorage.getItem('activeSubject');
    const requestedSubject = new URLSearchParams(window.location.search).get('subject');
    fetch('/api/subjects')
      .then(responseJson)
      .then((items) => {
        setSubjects(items);
        const preferred = items.find((item) => item.slug === requestedSubject) || items.find((item) => item.slug === storedSubject) || items[0];
        if (preferred) setActiveSubject(preferred.slug);
      })
      .catch((error) => setFormError(error.message));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const hasOverlay = noteDialog || readerNote || studyOpen;
    document.body.style.overflow = hasOverlay ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [noteDialog, readerNote, studyOpen]);

  useEffect(() => {
    if (!activeSubject || globalSearch) return;
    const controller = new AbortController();
    localStorage.setItem('activeSubject', activeSubject);
    setNotesLoading(true);
    setFormError('');
    setNotes([]);
    fetch(`/api/notes?subject=${encodeURIComponent(activeSubject)}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(responseJson)
      .then((items) => {
        if (!controller.signal.aborted) setNotes(items);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setFormError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setNotesLoading(false);
      });
    try {
      const saved = JSON.parse(localStorage.getItem(`learnedNotes:${activeSubject}`) || '[]');
      setLearnedNotes(new Set(saved));
    } catch { setLearnedNotes(new Set()); }
    setQuery('');
    return () => controller.abort();
  }, [activeSubject, globalSearch]);

  useEffect(() => {
    if (!globalSearch) {
      setGlobalSearchTruncated(false);
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setNotes([]);
      setNotesLoading(false);
      setGlobalSearchTruncated(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setNotesLoading(true);
      setFormError('');
      try {
        const data = await responseJson(await fetch(`/api/notes?scope=all&q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
          cache: 'no-store',
        }));
        if (!controller.signal.aborted) {
          setNotes(data.notes || []);
          setGlobalSearchTruncated(data.truncated === true);
        }
      } catch (error) {
        if (!controller.signal.aborted) setFormError(error.message || 'Global search failed.');
      } finally {
        if (!controller.signal.aborted) setNotesLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [globalSearch, query]);

  function requestCloseNoteDialog() {
    if (draftDirty && !window.confirm('Discard your unsaved note changes? The local draft will be removed.')) return;
    try { localStorage.removeItem(draftStorageKey(editingNote?.subject || activeSubject, editingNote?.number)); } catch {}
    setDraftStatus('');
    setNoteDialog(false);
    setEditingNote(null);
    setFormError('');
  }

  useEffect(() => {
    if (!noteDialog) return;
    headingInputRef.current?.focus();
  }, [noteDialog]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== 'Escape') return;
      if (noteDialog) requestCloseNoteDialog();
      setReaderNote(null); setStudyOpen(false); setMobileNavOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [noteDialog, heading, answer]);

  useEffect(() => {
    if (!noteDialog || !activeSubject) return;
    const key = draftStorageKey(activeSubject, editingNote?.number);
    let saved;
    try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch { saved = null; }
    if (!saved || typeof saved.heading !== 'string' || typeof saved.answer !== 'string') return;
    const original = editingNote
      ? { heading: editingNote.heading, answer: editingNote.answer }
      : { heading: '', answer: '' };
    if (saved.heading === original.heading && saved.answer === original.answer) return;
    if (window.confirm('An autosaved draft exists on this device. Restore it?')) {
      initialDraftRef.current = original;
      setHeading(saved.heading);
      setAnswer(saved.answer);
      setDraftStatus('Draft restored');
    } else {
      try { localStorage.removeItem(key); } catch {}
      setDraftStatus('');
    }
  }, [noteDialog, activeSubject, editingNote]);

  useEffect(() => {
    if (!noteDialog || !activeSubject) return;
    const key = draftStorageKey(activeSubject, editingNote?.number);
    if (!heading.trim() && !answer.trim()) {
      let existingDraft = null;
      try { existingDraft = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
      if (!existingDraft || (!existingDraft.heading && !existingDraft.answer)) {
        try { localStorage.removeItem(key); } catch {}
      }
      setDraftStatus('');
      return;
    }
    setDraftStatus('Saving draft…');
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ heading, answer, updatedAt: new Date().toISOString() }));
        setDraftStatus('Draft saved on this device');
      } catch {
        setDraftStatus('Draft could not be saved');
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [noteDialog, activeSubject, editingNote, heading, answer]);

  useEffect(() => {
    if (!draftDirty) return;
    function warnBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [draftDirty]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    function closeOnOutsideClick(event) {
      if (!subjectNavRef.current?.contains(event.target)) setMobileNavOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [mobileNavOpen]);

  function saveLearned(next) {
    setLearnedNotes(next);
    localStorage.setItem(`learnedNotes:${activeSubject}`, JSON.stringify([...next]));
  }

  async function lockSession() {
    try {
      await fetch('/api/access/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
    } finally {
      window.location.replace('/access');
    }
  }

  async function reloadNotes(slug = activeSubject) {
    const data = await responseJson(await fetch(`/api/notes?subject=${encodeURIComponent(slug)}`));
    setNotes(data);
  }

  async function saveNote(event) {
    event.preventDefault();
    if (saving) return;
    setFormError('');
    setSaving(true);
    try {
      const note = await responseJson(await fetch('/api/notes', {
        method: editingNote ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heading, answer, subject: editingNote?.subject || activeSubject, tags: tagInput.split(',').map((tag) => tag.trim()).filter(Boolean), favorite: favoriteDraft, pinned: pinnedDraft, ...(editingNote ? { number: editingNote.number } : {}) }),
      }));
      if (editingNote) {
        setNotes((current) => current.map((item) => item.number === note.number && (item.subject || activeSubject) === (note.subject || activeSubject) ? { ...item, ...note } : item));
        setReaderNote((current) => current?.number === note.number && (current.subject || activeSubject) === (note.subject || activeSubject) ? { ...current, ...note } : current);
      } else {
        setNotes((current) => [...current, { ...note, subjectName: active?.name || activeSubject }]);
      }
      try { localStorage.removeItem(draftStorageKey(activeSubject, editingNote?.number)); } catch {}
      setHeading(''); setAnswer(''); setTagInput(''); setFavoriteDraft(false); setPinnedDraft(false); initialDraftRef.current = { heading: '', answer: '' }; setDraftStatus(''); setPreview(false); setNoteDialog(false); setEditingNote(null);
    } catch (error) { setFormError(error.message); }
    finally { setSaving(false); }
  }

  async function updateNoteMetadata(note, changes) {
    try {
      const updated = await responseJson(await fetch('/api/notes', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: note.subject || activeSubject, number: note.number, ...changes }),
      }));
      setNotes((current) => current.map((item) => item.number === note.number && (item.subject || activeSubject) === (note.subject || activeSubject) ? { ...item, ...updated } : item));
      setReaderNote((current) => current?.number === note.number && (current.subject || activeSubject) === (note.subject || activeSubject) ? { ...current, ...updated } : current);
    } catch (error) {
      setFormError(error.message || 'Could not update note properties.');
    }
  }

  async function loadRevisionHistory() {
    if (!editingNote) return;
    setRevisionsOpen(true);
    setRevisionsLoading(true);
    setRevisionsError('');
    try {
      const data = await responseJson(await fetch(
        `/api/notes?subject=${encodeURIComponent(editingNote.subject || activeSubject)}&number=${editingNote.number}&history=1`,
        { cache: 'no-store' },
      ));
      setRevisions(Array.isArray(data.revisions) ? data.revisions : []);
    } catch (error) {
      setRevisionsError(error.message || 'Could not load revision history.');
    } finally {
      setRevisionsLoading(false);
    }
  }

  function editNote(note) {
    initialDraftRef.current = { heading: note.heading, answer: note.answer };
    setEditingNote({ ...note, subject: note.subject || activeSubject }); setHeading(note.heading); setAnswer(note.answer);
    setTagInput((note.tags || []).join(', ')); setFavoriteDraft(note.favorite === true); setPinnedDraft(note.pinned === true);
    setRevisions([]); setRevisionsOpen(false); setRevisionsError('');
    setPreview(false); setFormError(''); setNoteDialog(true);
  }

  async function deleteNote(note) {
    if (deletingNotes.has(note.number)) return;
    if (!window.confirm(`Delete “${note.heading}” from ${note.subjectName || active?.name || activeSubject}? This cannot be undone.`)) return;
    setDeletingNotes((current) => new Set(current).add(note.number));
    setFormError('');
    try {
      await responseJson(await fetch(`/api/notes?subject=${encodeURIComponent(note.subject || activeSubject)}&number=${note.number}`, { method: 'DELETE' }));
      setNotes((current) => current.filter((item) => !(item.number === note.number && (item.subject || activeSubject) === (note.subject || activeSubject))));
      setReaderNote((current) => current?.number === note.number ? null : current);
    } catch (error) {
      setFormError(error.message || 'Could not delete this note. Please try again.');
    } finally {
      setDeletingNotes((current) => {
        const next = new Set(current);
        next.delete(note.number);
        return next;
      });
    }
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
      <header className="topbar">
        <a className="brand" href="/" aria-label="Notes dashboard home"><span className="brand-mark">N</span><span>Study<span className="brand-light">Notes</span></span></a>
        <div className="topbar-right"><a className="import-guide-link" href="/">Home</a><a className="import-guide-link" href="/settings">Settings</a><a className="import-guide-link" href="/html-library">HTML files</a><a className="import-guide-link" href="/import-guide">Import guide</a><button className="theme-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-pressed={theme === 'dark'}>{theme === 'dark' ? '☼' : '◐'} <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button><span className="status-dot"/><span>{active?.file || 'MongoDB'}</span><button className="theme-button" type="button" onClick={lockSession} aria-label="Lock ENotes and end this session">Lock</button></div>
      </header>

      <nav className="subject-nav" aria-label="Main navigation" ref={subjectNavRef}>
        <button className="mobile-nav-toggle" type="button" aria-controls="subject-menu" aria-expanded={mobileNavOpen} aria-label={mobileNavOpen ? 'Close subject menu' : 'Open subject menu'} onClick={() => setMobileNavOpen((open) => !open)}><span className="mobile-nav-icon" aria-hidden="true"><i/><i/><i/></span><span>Subjects</span></button>
        <div className={`subject-dropdown ${mobileNavOpen ? 'open' : ''}`} id="subject-menu">
          {subjects.map((subject) => <span className="subject-item" key={subject.slug}><button className={`subject-tab ${subject.slug === activeSubject ? 'active' : ''}`} onClick={() => { setActiveSubject(subject.slug); setMobileNavOpen(false); }}>{subject.name}</button></span>)}
        </div>
      </nav>

      <section className="intro">
        <div><p className="eyebrow">YOUR PERSONAL KNOWLEDGE BASE</p><h1>{active?.name || 'Your'} notes<span className="period">.</span></h1><p className="subtitle">A clear place for the commands, concepts, and things you learn.</p></div>
        <div className="intro-actions"><button className="study-button" onClick={startStudy} disabled={!notes.length}><span aria-hidden="true">◉</span> Study notes</button><button className="add-button" onClick={() => { initialDraftRef.current = { heading: '', answer: '' }; setEditingNote(null); setHeading(''); setAnswer(''); setTagInput(''); setFavoriteDraft(false); setPinnedDraft(false); setRevisions([]); setRevisionsOpen(false); setRevisionsError(''); setFormError(''); setNoteDialog(true); }}><span aria-hidden="true">+</span> Add a note</button></div>
      </section>

      <section className="stats" aria-label="Note statistics"><div className="stat"><span className="stat-number">{String(notes.length).padStart(2, '0')}</span><span className="stat-label">TOTAL NOTES</span></div><div className="stat-divider"/><div className="stat"><span className="stat-number">{String(subjects.length).padStart(2, '0')}</span><span className="stat-label">SUBJECTS</span></div><div className="stat-spacer"/><div className="search-wrap"><span aria-hidden="true">⌕</span><input type="search" placeholder={globalSearch ? "Search all subjects…" : "Search this subject…"} aria-label="Search notes" value={query} onChange={(event) => setQuery(event.target.value)}/></div><button type="button" className={globalSearch ? "global-search-toggle active" : "global-search-toggle"} aria-pressed={globalSearch} onClick={() => { setGlobalSearch((value) => !value); setQuery(""); setFormError(""); }}>⌕ {globalSearch ? "All subjects" : "Search all subjects"}</button></section>

      <section className="notes-section"><div className="section-heading"><div><p className="eyebrow">THE LIBRARY</p><h2>All notes <span className="count-pill">{shownNotes.length}</span></h2></div><span className="sort-label">LATEST FIRST <span aria-hidden="true">↕</span></span></div>
        <div className="note-filters" aria-label="Note filters">
          <button type="button" className={favoritesOnly ? 'filter-chip active' : 'filter-chip'} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)}>★ Favorites</button>
          <button type="button" className={pinnedOnly ? 'filter-chip active' : 'filter-chip'} aria-pressed={pinnedOnly} onClick={() => setPinnedOnly((value) => !value)}>📌 Pinned</button>
          {availableTags.length > 0 && <label className="tag-filter">Tag
            <select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)} aria-label="Filter notes by tag">
              <option value="">All tags</option>{availableTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </label>}
          {(favoritesOnly || pinnedOnly || selectedTag) && <button type="button" className="clear-filters" onClick={() => { setFavoritesOnly(false); setPinnedOnly(false); setSelectedTag(''); }}>Clear filters</button>}
        </div>
        {notesLoading ? <div className="empty-state" role="status"><span className="empty-icon">◌</span><h3>Loading notes…</h3><p>Getting notes for this subject.</p></div> : shownNotes.length ? <div className="notes-grid">{shownNotes.map((note) => <article className="note-card" key={`${note.subject || activeSubject}:${note.number}`}><button className="card-open" onClick={() => setReaderNote(note)} aria-label={`Open note: ${note.heading}`}><span className="card-top"><span className="note-index">NO. {String(note.number).padStart(2, '0')}</span>{globalSearch && <span className="note-subject-label">{note.subjectName || note.subject}</span>}<span className="note-badges">{note.pinned && <span title="Pinned">📌</span>}{note.favorite && <span title="Favorite">★</span>}</span></span><span className="note-title">{note.heading}</span><span className="note-preview">{note.answer}</span><span className="card-tags">{(note.tags || []).map((tag) => <span key={tag} className="tag-chip">{tag}</span>)}</span><span className="card-bottom">◷ <span>{note.saved}</span></span></button><button className={note.favorite ? "metadata-action selected" : "metadata-action"} onClick={() => updateNoteMetadata(note, { favorite: note.favorite !== true })} aria-pressed={note.favorite === true} aria-label={note.favorite ? `Remove favorite: ${note.heading}` : `Add favorite: ${note.heading}`} title={note.favorite ? "Remove favorite" : "Add favorite"}>★</button><button className={note.pinned ? "metadata-action selected" : "metadata-action"} onClick={() => updateNoteMetadata(note, { pinned: note.pinned !== true })} aria-pressed={note.pinned === true} aria-label={note.pinned ? `Unpin note: ${note.heading}` : `Pin note: ${note.heading}`} title={note.pinned ? "Unpin note" : "Pin note"}>⌖</button><button className="edit-note" onClick={() => editNote(note)} aria-label={`Edit note: ${note.heading}`} title="Edit note">✎</button><button className="delete-note" onClick={() => deleteNote(note)} disabled={deletingNotes.has(note.number)} aria-label={`Delete note: ${note.heading}`} title={deletingNotes.has(note.number) ? 'Deleting note…' : 'Delete note'}>{deletingNotes.has(note.number) ? '…' : '×'}</button></article>)}</div> : <div className="empty-state"><span className="empty-icon">⌕</span><h3>{globalSearch && query.trim().length < 2 ? 'Search across your library' : query ? 'No notes found' : 'Start your collection'}</h3><p>{globalSearch && query.trim().length < 2 ? 'Enter at least 2 characters to search every subject.' : query ? 'Try another search, or add a new note.' : 'Add a note to this subject, then come back to study it.'}</p></div>}{globalSearchTruncated && <p className="search-limit-note" role="status">Showing the first 100 matching notes. Refine your search to narrow the results.</p> }
      </section>
      <footer><span>Built for learning, one note at a time.</span><span>MONGODB · SUBJECT BASED</span></footer>

      {formError && !noteDialog && <p className="page-error" role="alert">{formError}</p>}

      {noteDialog && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) requestCloseNoteDialog(); }}><section ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="formTitle" aria-describedby="formDescription"><button className="close-button" onClick={requestCloseNoteDialog} aria-label="Close form">×</button><p className="eyebrow">{editingNote ? `EDIT NOTE ${String(editingNote.number).padStart(2, '0')}` : 'GROW YOUR LIBRARY'}</p><h2 id="formTitle">{editingNote ? 'Edit note' : 'Add a note'}<span className="period">.</span></h2><p id="formDescription" className="form-subtitle">{editingNote ? 'Update the heading or answer. Its serial number will stay the same.' : 'Give it a clear heading and capture what you learned.'}</p>
        <form onSubmit={saveNote}><label htmlFor="heading">HEADING</label><input ref={headingInputRef} id="heading" maxLength={160} placeholder="e.g. What does chmod do?" value={heading} onChange={(event) => setHeading(event.target.value)} required/><label htmlFor="noteTags">TAGS <span className="field-hint">comma-separated · up to 10</span></label><input id="noteTags" maxLength={260} placeholder="e.g. arrays, exam, important" value={tagInput} onChange={(event) => setTagInput(event.target.value)} /><div className="note-metadata-fields"><label><input type="checkbox" checked={favoriteDraft} onChange={(event) => setFavoriteDraft(event.target.checked)} /> Mark as favorite</label><label><input type="checkbox" checked={pinnedDraft} onChange={(event) => setPinnedDraft(event.target.checked)} /> Pin to top</label></div><div className="label-row"><label htmlFor="answer">ANSWER</label><span>Markdown is okay</span>{editingNote && <button type="button" className="history-button" onClick={loadRevisionHistory}>Revision history</button>}</div><div className="editor-toolbar" aria-label="Answer formatting"><button type="button" onClick={() => insertFormatting('bold')} title="Bold">B</button><button type="button" onClick={() => insertFormatting('code')} title="Inline code">&lt;/&gt;</button><button type="button" onClick={() => insertFormatting('list')} title="Bullet list">• List</button><button type="button" onClick={() => insertFormatting('codeblock')} title="Code block">{'{ }'}</button><span>Formatting shortcuts</span><span className="draft-status" role="status" aria-live="polite">{draftStatus}</span></div>
          {revisionsOpen && <section className="revision-history" aria-label="Note revision history">
            <div className="revision-history-heading"><strong>Previous versions</strong><button type="button" onClick={() => setRevisionsOpen(false)}>Close</button></div>
            {revisionsLoading && <p role="status">Loading versions…</p>}
            {revisionsError && <p className="form-error" role="alert">{revisionsError}</p>}
            {!revisionsLoading && !revisionsError && revisions.length === 0 && <p>No previous versions yet. Versions are saved after you edit this note.</p>}
            <ol>{revisions.map((revision, index) => <li key={`${revision.revisedAt || revision.saved || 'version'}-${index}`}>
              <div><strong>{revision.saved || 'Previous version'}</strong><p>{revision.heading}</p><span>{String(revision.answer || '').slice(0, 110)}{String(revision.answer || '').length > 110 ? '…' : ''}</span></div>
              <button type="button" onClick={() => { setHeading(revision.heading || ''); setAnswer(revision.answer || ''); setPreview(false); setFormError(''); setDraftStatus('Previous version restored to editor'); }}>Restore</button>
            </li>)}</ol>
          </section>}
          <div className="editor-tabs"><button type="button" className={!preview ? 'active' : ''} onClick={() => setPreview(false)}>Write</button><button type="button" className={preview ? 'active' : ''} onClick={() => setPreview(true)}>Preview</button></div>
          {!preview ? <textarea ref={answerRef} id="answer" rows={6} maxLength={10000} placeholder="Write your explanation here…" value={answer} onChange={(event) => setAnswer(event.target.value)} required/> : <div className="answer-preview">{answer ? <div dangerouslySetInnerHTML={{ __html: markdownHtml(answer) }}/> : <p className="preview-placeholder">Nothing to preview yet.</p>}</div>}
          {formError && <p className="form-error" role="alert">{formError}</p>}<button className="submit-button" type="submit" disabled={saving}><span>{saving ? 'Saving…' : editingNote ? 'Save changes' : 'Save note'}</span><span aria-hidden="true">→</span></button></form>
      </section></div>}

      {readerNote && <div className="reader-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setReaderNote(null); }}><article className="reader-panel" role="dialog" aria-modal="true" aria-labelledby="readerTitle"><div className="reader-toolbar"><span className="reader-kicker">NOTE {String(readerNote.number).padStart(2, '0')}</span><button className="close-button reader-close" onClick={() => setReaderNote(null)} aria-label="Close note">×</button></div><div className="reader-content"><p className="eyebrow">{active?.name}</p><h2 id="readerTitle">{readerNote.heading}</h2><div className="reader-meta">Saved {readerNote.saved}</div><div className="reader-answer" dangerouslySetInnerHTML={{ __html: markdownHtml(readerNote.answer) }}/></div></article></div>}

      {studyOpen && currentStudyNote && <div className="reader-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setStudyOpen(false); }}><section className="study-panel" role="dialog" aria-modal="true" aria-labelledby="studyQuestion"><div className="reader-toolbar"><span className="reader-kicker">STUDY SESSION</span><button className="close-button reader-close" onClick={() => setStudyOpen(false)} aria-label="Close study session">×</button></div><div className="study-content"><div className="study-progress-row"><span>CARD {studyIndex + 1} OF {studyDeck.length}</span><span>{learnedNotes.size} learned</span></div><div className="study-progress"><span style={{ width: `${((studyIndex + 1) / studyDeck.length) * 100}%` }}/></div><p className="eyebrow">{active?.name}</p><p className="study-prompt">Try to recall the answer</p><h2 id="studyQuestion">{currentStudyNote.heading}</h2>{studyRevealed && <div className="study-answer" dangerouslySetInnerHTML={{ __html: markdownHtml(currentStudyNote.answer) }} />}{!studyRevealed && <button className="reveal-button" onClick={() => setStudyRevealed(true)}>Reveal answer</button>}{studyRevealed && <div className="study-actions">{currentIsLearned && <button className="review-button" onClick={() => { const next = new Set(learnedNotes); next.delete(currentStudyNote.number); saveLearned(next); }}>Review again</button>}<button className="submit-button" onClick={markLearned} disabled={currentIsLearned}><span>{currentIsLearned ? 'Learned ✓' : 'Got it'}</span><span aria-hidden="true">→</span></button></div>}<div className="study-navigation"><button onClick={() => moveStudy(studyIndex - 1)} disabled={studyIndex === 0}>← Previous</button><button onClick={shuffleStudy}>Shuffle cards</button><button onClick={() => moveStudy(studyIndex + 1)}>{studyIndex === studyDeck.length - 1 ? 'Finish' : 'Next →'}</button></div></div></section></div>}
    </main>
  );
}
