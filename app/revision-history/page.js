'use client';

import { useEffect, useMemo, useState } from 'react';
import { markdownHtml } from '../../lib/markdown.js';

async function responseJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

export default function RevisionHistoryPage() {
  const [subjects, setSubjects] = useState([]);
  const [subjectSlug, setSubjectSlug] = useState('');
  const [notes, setNotes] = useState([]);
  const [noteNumber, setNoteNumber] = useState('');
  const [revisions, setRevisions] = useState([]);
  const [selectedRevision, setSelectedRevision] = useState(0);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [error, setError] = useState('');

  const activeSubject = subjects.find((subject) => subject.slug === subjectSlug);
  const activeNote = notes.find((note) => String(note.number) === String(noteNumber));
  const chosenRevision = revisions[selectedRevision];
  const revisionCount = useMemo(() => revisions.length, [revisions]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/subjects', { cache: 'no-store' })
      .then(responseJson)
      .then((items) => {
        if (cancelled) return;
        setSubjects(items);
        if (items.length) setSubjectSlug(items[0].slug);
      })
      .catch((loadError) => { if (!cancelled) setError(loadError.message || 'Could not load subjects.'); })
      .finally(() => { if (!cancelled) setLoadingSubjects(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!subjectSlug) { setNotes([]); setNoteNumber(''); setRevisions([]); return; }
    let cancelled = false;
    setLoadingNotes(true);
    setError('');
    setNotes([]);
    setNoteNumber('');
    setRevisions([]);
    fetch(`/api/notes?subject=${encodeURIComponent(subjectSlug)}`, { cache: 'no-store' })
      .then(responseJson)
      .then((items) => {
        if (cancelled) return;
        setNotes(items);
        if (items.length) setNoteNumber(String(items[0].number));
      })
      .catch((loadError) => { if (!cancelled) setError(loadError.message || 'Could not load notes.'); })
      .finally(() => { if (!cancelled) setLoadingNotes(false); });
    return () => { cancelled = true; };
  }, [subjectSlug]);

  useEffect(() => {
    if (!subjectSlug || !noteNumber) { setRevisions([]); return; }
    let cancelled = false;
    setLoadingRevisions(true);
    setError('');
    setRevisions([]);
    setSelectedRevision(0);
    fetch(`/api/notes?subject=${encodeURIComponent(subjectSlug)}&number=${encodeURIComponent(noteNumber)}&history=1`, { cache: 'no-store' })
      .then(responseJson)
      .then((data) => { if (!cancelled) setRevisions(Array.isArray(data.revisions) ? data.revisions : []); })
      .catch((loadError) => { if (!cancelled) setError(loadError.message || 'Could not load revision history.'); })
      .finally(() => { if (!cancelled) setLoadingRevisions(false); });
    return () => { cancelled = true; };
  }, [subjectSlug, noteNumber]);

  return (
    <main className="shell revision-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="ENotes home"><span className="brand-mark">N</span><span>Study<span className="brand-light">Notes</span></span></a>
        <div className="topbar-right"><a className="import-guide-link" href="/">Home</a><a className="import-guide-link" href="/notes">Notes</a><a className="import-guide-link" href="/settings">Settings</a><a className="import-guide-link" href="/html-library">HTML files</a></div>
      </header>

      <section className="revision-hero">
        <p className="eyebrow">YOUR NOTE ARCHIVE</p>
        <h1>Revision history<span className="period">.</span></h1>
        <p className="hub-lead">Browse previously saved versions of a note without leaving your notes editor open.</p>
      </section>

      {error && <p className="page-error" role="alert">{error}</p>}

      <section className="revision-layout" aria-label="Browse revision history">
        <div className="revision-panel">
          <div className="revision-panel-head"><h2>Choose a note</h2><p>Select a subject, then choose the note whose saved versions you want to inspect.</p></div>
          <div style={{ padding: '14px 14px 0' }}>
            <label htmlFor="revision-subject" className="eyebrow">SUBJECT</label>
            <select id="revision-subject" value={subjectSlug} onChange={(event) => setSubjectSlug(event.target.value)} disabled={loadingSubjects || !subjects.length} style={{ width: '100%', minHeight: 40, border: '1px solid var(--line)', borderRadius: 6, padding: '0 10px', background: 'var(--paper)', color: 'var(--ink)' }}>
              {!subjects.length && <option value="">{loadingSubjects ? 'Loading subjects…' : 'No subjects available'}</option>}
              {subjects.map((subject) => <option value={subject.slug} key={subject.slug}>{subject.name}</option>)}
            </select>
          </div>
          <div className="revision-list">
            {loadingNotes && <p className="revision-empty" role="status">Loading notes…</p>}
            {!loadingNotes && notes.map((note) => (
              <button type="button" key={note.number} className={String(note.number) === String(noteNumber) ? 'revision-select selected' : 'revision-select'} onClick={() => setNoteNumber(String(note.number))}>
                <strong>{note.heading || `Note ${note.number}`}</strong>
                <span>NOTE {String(note.number).padStart(2, '0')} · {note.saved || 'Saved date unavailable'}</span>
              </button>
            ))}
            {!loadingNotes && !notes.length && <p className="revision-empty">No notes were found in this subject.</p>}
          </div>
        </div>

        <div className="revision-panel">
          <div className="revision-panel-head">
            <h2>{activeNote?.heading || 'Saved versions'}</h2>
            <p>{activeSubject?.name || 'Choose a subject'} · {loadingRevisions ? 'Loading history…' : `${revisionCount} previous ${revisionCount === 1 ? 'version' : 'versions'}`}</p>
          </div>
          {loadingRevisions && <p className="revision-empty" role="status">Loading saved versions…</p>}
          {!loadingRevisions && !error && !revisions.length && activeNote && <p className="revision-empty">No previous versions yet. ENotes stores a previous version when you edit and save a note.</p>}
          {!loadingRevisions && revisions.length > 0 && (
            <div className="revision-versions">
              {revisions.map((revision, index) => (
                <article className={index === selectedRevision ? 'revision-version selected' : 'revision-version'} key={`${revision.revisedAt || revision.saved || 'version'}-${index}`}>
                  <button type="button" className="revision-select" onClick={() => setSelectedRevision(index)} aria-pressed={index === selectedRevision}>
                    <span className="revision-version-head"><strong>Previous version {revisions.length - index}</strong><span>{revision.saved || revision.revisedAt || 'Date unavailable'}</span></span>
                    <strong>{revision.heading || 'Untitled note'}</strong>
                    <span>{String(revision.answer || '').slice(0, 180)}{String(revision.answer || '').length > 180 ? '…' : ''}</span>
                  </button>
                </article>
              ))}
              {chosenRevision && (
                <article className="revision-version">
                  <div className="revision-version-head"><strong>Version details</strong><span>{chosenRevision.saved || chosenRevision.revisedAt || 'Previous save'}</span></div>
                  <h3>{chosenRevision.heading || 'Untitled note'}</h3>
                  <div className="revision-version-content" dangerouslySetInnerHTML={{ __html: markdownHtml(chosenRevision.answer || '') }} />
                  <div className="revision-actions"><a className="revision-primary" href={`/notes?subject=${encodeURIComponent(subjectSlug)}`}>Open notes library ↗</a></div>
                </article>
              )}
            </div>
          )}
          {!activeNote && !loadingNotes && <p className="revision-empty">Choose a note to view its previous versions.</p>}
        </div>
      </section>
      <footer><span>Built for learning, one note at a time.</span><span>REVISION HISTORY · ENOTES</span></footer>
    </main>
  );
}
