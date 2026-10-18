'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SiteNavbar from '../components/site-navbar';

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

function formatDate(value) {
  if (!value) return 'Just created';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently edited';
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function QuickNotesPage() {
  const [notes, setNotes] = useState([]);
  const [dirty, setDirty] = useState({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saveErrors, setSaveErrors] = useState({});
  const editorRefs = useRef({});

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
      setMessage('New note added. Start typing — the first line becomes its title.');
      requestAnimationFrame(() => editorRefs.current[note.id]?.focus());
    } catch (err) {
      setError(err.message || 'Could not create a quick note.');
    } finally {
      setCreating(false);
    }
  }

  function updateContent(id, content) {
    setNotes((current) => current.map((note) => note.id === id ? { ...note, content } : note));
    setDirty((current) => ({ ...current, [id]: content }));
    setSaveErrors((current) => ({ ...current, [id]: '' }));
    setMessage('');
  }

  async function deleteNote(note) {
    const title = (note.content || '').split('\n', 1)[0].trim();
    if (!window.confirm('Delete "' + (title || 'Untitled quick note') + '"? This cannot be undone.')) return;
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
  }

  return (
    <main className="shell quick-notes-shell">
      <SiteNavbar />
      <section className="quick-notes-hero">
        <div>
          <p className="eyebrow">CAPTURE IT BEFORE YOU FORGET</p>
          <h1>Quick <span>Notes.</span></h1>
          <p className="quick-notes-lead">A quiet space for thoughts, reminders, and ideas. No separate title field — your first line becomes the heading.</p>
        </div>
        <button className="add-button quick-notes-add" type="button" onClick={addNote} disabled={creating}>
          <span aria-hidden="true">＋</span> {creating ? 'Adding…' : 'Add note'}
        </button>
      </section>

      {(error || message) && <p className={'quick-notes-feedback' + (error ? ' is-error' : '')} role="status">{error || message}</p>}

      {loading ? (
        <div className="quick-notes-empty"><p>Loading your notes…</p></div>
      ) : notes.length ? (
        <section className="quick-notes-grid" aria-label="Quick notes">
          {notes.map((note, index) => (
            <article className="quick-note-section" key={note.id}>
              <div className="quick-note-topline">
                <span className="quick-note-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="quick-note-date">{dirty[note.id] !== undefined ? 'Editing…' : saveErrors[note.id] ? 'Not saved' : formatDate(note.updatedAt || note.createdAt)}</span>
                <button className="quick-note-delete" type="button" onClick={() => deleteNote(note)} aria-label="Delete quick note" title="Delete note">×</button>
              </div>
              <div
                ref={(element) => { editorRefs.current[note.id] = element; }}
                className="quick-note-editor"
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-label={'Quick note ' + (index + 1)}
                aria-multiline="true"
                data-placeholder="Start writing…"
                onInput={(event) => updateContent(note.id, event.currentTarget.innerText)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
                    event.preventDefault();
                    const content = event.currentTarget.innerText;
                    updateContent(note.id, content);
                  }
                }}
              >{note.content || ''}</div>
              {saveErrors[note.id] && <p className="quick-note-save-error" role="alert">{saveErrors[note.id]}</p>}
              <div className="quick-note-bottomline">
                <span>{(note.content || '').length} characters</span>
                <span>{saveErrors[note.id] ? 'Save failed' : dirty[note.id] !== undefined ? 'Auto-saving' : 'Saved'}</span>
              </div>
            </article>
          ))}
          <button className="quick-note-add-tile" type="button" onClick={addNote} disabled={creating} aria-label="Add another quick note">
            <span aria-hidden="true">＋</span><strong>Add another note</strong><small>New note section</small>
          </button>
        </section>
      ) : (
        <section className="quick-notes-empty">
          <span className="quick-notes-empty-icon" aria-hidden="true">✎</span>
          <h2>Your thoughts, in one place.</h2>
          <p>Create a quick note and start typing. The first line automatically becomes its heading.</p>
          <button className="add-button" type="button" onClick={addNote} disabled={creating}><span aria-hidden="true">＋</span> Create your first note</button>
        </section>
      )}
      <footer><span>Your ideas, saved as you write.</span><span>ENOTES · QUICK NOTES</span></footer>
    </main>
  );
}
