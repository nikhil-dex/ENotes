'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import SiteNavbar from './site-navbar';

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

function titleOf(content) {
  return String(content || '').split('\n', 1)[0].trim() || 'Untitled note';
}

function formatDate(value) {
  if (!value) return 'Just created';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently edited';
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const QuickNoteCard = memo(function QuickNoteCard({ note, content, index, title, onContentChange, onDelete, saveError, saving }) {
  const [characterCount, setCharacterCount] = useState((content || '').length);
  const [copied, setCopied] = useState(false);

  async function copyNote() {
    try {
      await navigator.clipboard.writeText(content || '');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return (
    <article className="quick-note-section">
      <div className="quick-note-topline">
        <span className="quick-note-index">{String(index + 1).padStart(2, '0')}</span>
        <span className="quick-note-date">{saving ? 'Saving…' : saveError ? 'Not saved' : formatDate(note.updatedAt || note.createdAt)}</span>
        <button className="quick-note-copy" type="button" onClick={copyNote} aria-label={'Copy ' + title} title={copied ? 'Copied to clipboard' : 'Copy note'}>{copied ? 'Copied!' : 'Copy'}</button>
        <button className="quick-note-delete" type="button" onClick={() => onDelete(note)} aria-label={'Delete ' + title} title="Delete note">×</button>
      </div>
      <div
        className="quick-note-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={'Quick note ' + (index + 1)}
        aria-multiline="true"
        data-placeholder="Start writing…"
        onInput={(event) => { const content = event.currentTarget.innerText; setCharacterCount(content.length); onContentChange(note.id, content); }}
      >{content || ''}</div>
      {saveError && <p className="quick-note-save-error" role="alert">{saveError}</p>}
      <div className="quick-note-bottomline">
        <span>{characterCount} characters</span>
        <span>{saveError ? 'Save failed' : saving ? 'Auto-saving' : 'Saved'}</span>
      </div>
    </article>
  );
});

export default function QuickNotesPanel({ fullPage = false }) {
  const [notes, setNotes] = useState([]);
  const [dirty, setDirty] = useState({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saveErrors, setSaveErrors] = useState({});
  const [savingIds, setSavingIds] = useState({});

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await readResponse(await fetch('/api/quick-notes', { cache: 'no-store' }));
      setNotes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Could not load quick notes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  useEffect(() => {
    const entries = Object.entries(dirty);
    if (!entries.length) return undefined;
    const timer = setTimeout(async () => {
      await Promise.all(entries.map(async ([id, content]) => {
        setSavingIds((current) => ({ ...current, [id]: true }));
        try {
          const result = await readResponse(await fetch('/api/quick-notes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, content }),
          }));
          setNotes((current) => current.map((note) => note.id === id
            ? { ...note, title: result.title, updatedAt: result.updatedAt }
            : note));
          setSaveErrors((current) => ({ ...current, [id]: '' }));
          setDirty((current) => current[id] === content ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)) : current);
        } catch (err) {
          setSaveErrors((current) => ({ ...current, [id]: err.message || 'Could not save this note.' }));
        } finally {
          setSavingIds((current) => ({ ...current, [id]: false }));
        }
      }));
    }, 700);
    return () => clearTimeout(timer);
  }, [dirty]);

  async function addNote() {
    if (creating) return;
    setCreating(true);
    setError('');
    setMessage('');
    try {
      const note = await readResponse(await fetch('/api/quick-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      }));
      setNotes((current) => [note, ...current]);
      setMessage('New note added. The first line becomes its heading.');
    } catch (err) {
      setError(err.message || 'Could not create a quick note.');
    } finally {
      setCreating(false);
    }
  }

  const updateContent = useCallback((id, content) => {
    setDirty((current) => ({ ...current, [id]: content }));
    setSaveErrors((current) => ({ ...current, [id]: '' }));
    setMessage('');
  }, []);

  const deleteNote = useCallback(async (note) => {
    if (!window.confirm('Delete "' + titleOf(note.content) + '"? This cannot be undone.')) return;
    setError('');
    setMessage('');
    try {
      await readResponse(await fetch('/api/quick-notes?id=' + encodeURIComponent(note.id), { method: 'DELETE' }));
      setNotes((current) => current.filter((item) => item.id !== note.id));
      setDirty((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== note.id)));
      setSaveErrors((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== note.id)));
      setMessage('Quick note deleted.');
    } catch (err) {
      setError(err.message || 'Could not delete this quick note.');
    }
  }, []);

  const visibleNotes = fullPage ? notes : notes.slice(0, 3);

  return (
    <section className={'quick-notes-section' + (fullPage ? ' quick-notes-full-page' : '')} aria-labelledby="quick-notes-heading">
      {fullPage && <SiteNavbar />}
      <div className="quick-notes-heading-row">
        <div>
          <p className="eyebrow">{fullPage ? 'CAPTURE IT BEFORE YOU FORGET' : 'THOUGHTS, REMINDERS & IDEAS'}</p>
          <h2 id="quick-notes-heading">{fullPage ? <>Quick <span>Notes.</span></> : <>Quick notes <span className="quick-notes-count">{notes.length}</span></>}</h2>
          <p className="quick-notes-lead">{fullPage ? 'No separate title field — your first line automatically becomes the heading, just like iPhone Notes.' : 'Write instantly, no separate title needed. Your first line becomes the heading.'}</p>
        </div>
        <button className="quick-note-add-button" type="button" onClick={addNote} disabled={creating} aria-label="Add a quick note" title="Add a quick note">
          <span aria-hidden="true">＋</span>{fullPage ? (creating ? 'Adding…' : 'Add note') : ''}
        </button>
      </div>

      {(error || message) && <p className={'quick-notes-feedback' + (error ? ' is-error' : '')} role="status">{error || message}</p>}

      {loading ? <p className="quick-notes-loading">Loading quick notes…</p> : notes.length ? (
        <div className="quick-notes-grid">
          {visibleNotes.map((note, index) => (
            <QuickNoteCard
              key={note.id}
              note={note}
              content={dirty[note.id] !== undefined ? dirty[note.id] : note.content}
              title={titleOf(dirty[note.id] !== undefined ? dirty[note.id] : note.content)}
              index={index}
              onContentChange={updateContent}
              onDelete={deleteNote}
              saveError={saveErrors[note.id]}
              saving={Boolean(savingIds[note.id] || dirty[note.id] !== undefined)}
            />
          ))}
          <button className="quick-note-add-tile" type="button" onClick={addNote} disabled={creating} aria-label="Add another quick note">
            <span aria-hidden="true">＋</span><strong>Add another note</strong><small>Create a new note section</small>
          </button>
        </div>
      ) : (
        <div className="quick-notes-empty">
          <span className="quick-notes-empty-icon" aria-hidden="true">✎</span>
          <h3>Your thoughts, in one place.</h3>
          <p>Create a quick note and start typing. The first line automatically becomes its heading.</p>
          <button className="add-button" type="button" onClick={addNote} disabled={creating}><span aria-hidden="true">＋</span> Create your first note</button>
        </div>
      )}
      {!fullPage && <a className="quick-notes-view-all" href="/quick-notes">Open Quick Notes <span aria-hidden="true">→</span></a>}
      {fullPage && <footer><span>Your ideas, saved as you write.</span><span>OGENOTES · QUICK NOTES</span></footer>}
    </section>
  );
}
