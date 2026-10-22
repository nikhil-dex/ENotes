'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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

function AirNoteLibraryCard({ note, index, onOpen, onEdit, onDelete }) {
  const title = titleOf(note.content);
  return (
    <article className="note-card airnote-library-card">
      <button className="card-open" type="button" onClick={() => onOpen(note)} aria-label={'Open AirNote: ' + title}>
        <span className="card-top"><span className="note-index">NOTE {String(index + 1).padStart(2, '0')}</span><span className="note-mark" aria-hidden="true">✎</span></span>
        <span className="note-title">{title}</span>
        <span className="note-preview">{note.content || 'Empty note — open to read or edit.'}</span>
        <span className="card-bottom">◷ <span>{formatDate(note.updatedAt || note.createdAt)}</span></span>
      </button>
      <div className="note-card-actions" aria-label={'Actions for ' + title}>
        <button type="button" className="edit-note" onClick={() => onEdit(note)} aria-label={'Edit AirNote: ' + title} title="Edit AirNote">✎</button>
        <button type="button" className="delete-note" onClick={() => onDelete(note)} aria-label={'Delete AirNote: ' + title} title="Delete AirNote">×</button>
      </div>
    </article>
  );
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
        dir="ltr"
        style={{ direction: 'ltr', unicodeBidi: 'plaintext', textAlign: 'left' }}
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

export default function PersonalQuickNotesPanel({ fullPage = false }) {
  const [notes, setNotes] = useState([]);
  const [dirty, setDirty] = useState({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saveErrors, setSaveErrors] = useState({});
  const [savingIds, setSavingIds] = useState({});
  const [openedNote, setOpenedNote] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await readResponse(await fetch('/api/personal-quick-notes', { cache: 'no-store' }));
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
          const result = await readResponse(await fetch('/api/personal-quick-notes', {
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
      const note = await readResponse(await fetch('/api/personal-quick-notes', {
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
      await readResponse(await fetch('/api/personal-quick-notes?id=' + encodeURIComponent(note.id), { method: 'DELETE' }));
      setNotes((current) => current.filter((item) => item.id !== note.id));
      setDirty((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== note.id)));
      setSaveErrors((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== note.id)));
      setMessage('Quick note deleted.');
    } catch (err) {
      setError(err.message || 'Could not delete this quick note.');
    }
  }, []);

  function openEditor(note) {
    setEditingNote(note);
    setEditContent(note.content || '');
    setOpenedNote(null);
    setError('');
    setMessage('');
  }

  async function saveEditedNote() {
    if (!editingNote || editSaving) return;
    setEditSaving(true);
    setError('');
    try {
      const result = await readResponse(await fetch('/api/personal-quick-notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingNote.id, content: editContent }),
      }));
      setNotes((current) => current.map((note) => note.id === editingNote.id ? { ...note, ...result } : note));
      setDirty((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== editingNote.id)));
      setEditingNote(null);
      setMessage('AirNote saved.');
    } catch (err) {
      setError(err.message || 'Could not save this AirNote.');
    } finally {
      setEditSaving(false);
    }
  }

  const visibleNotes = fullPage ? notes : notes.slice(0, 3);

  return (
    <section className={'quick-notes-section' + (fullPage ? ' quick-notes-full-page' : '')} aria-labelledby="quick-notes-heading">
      {fullPage && <SiteNavbar />}
      <div className="quick-notes-heading-row">
        <div>
          <p className="eyebrow">{fullPage ? 'CAPTURE IT BEFORE YOU FORGET' : 'THOUGHTS, REMINDERS & IDEAS'}</p>
          <h2 id="quick-notes-heading">{fullPage ? <>Air<span>Notes.</span></> : <>AirNotes <span className="quick-notes-count">{notes.length}</span></>}</h2>
          <p className="quick-notes-lead">{fullPage ? 'No separate title field — your first line automatically becomes the heading, just like iPhone Notes.' : 'Capture ideas independently from Quick Notes. Your first line becomes the heading.'}</p>
        </div>
        <button className="quick-note-add-button" type="button" onClick={addNote} disabled={creating} aria-label="Add a quick note" title="Add a quick note">
          <span aria-hidden="true">＋</span>{fullPage ? (creating ? 'Adding…' : 'Add note') : ''}
        </button>
      </div>

      {(error || message) && <p className={'quick-notes-feedback' + (error ? ' is-error' : '')} role="status">{error || message}</p>}

      {loading ? <p className="quick-notes-loading">Loading AirNotes…</p> : notes.length ? (
        <div className="quick-notes-grid">
          {visibleNotes.map((note, index) => fullPage ? (
            <AirNoteLibraryCard key={note.id} note={note} index={index} onOpen={setOpenedNote} onEdit={openEditor} onDelete={deleteNote} />
          ) : (
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
      {fullPage && typeof document !== 'undefined' && createPortal(
        <>
        {fullPage && openedNote && (
          <div className="reader-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenedNote(null); }}>
            <article className="reader-panel airnote-reader-panel" role="dialog" aria-modal="true" aria-labelledby="airnote-reader-title">
              <div className="reader-toolbar">
                <div className="reader-pagination"><span className="reader-kicker">AIRNOTE</span></div>
                <div className="reader-toolbar-actions">
                  <button type="button" className="edit-note" onClick={() => openEditor(openedNote)} aria-label="Edit AirNote" title="Edit AirNote">✎ Edit</button>
                  <button className="close-button reader-close" onClick={() => setOpenedNote(null)} aria-label="Close AirNote">×</button>
                </div>
              </div>
              <div className="reader-content">
                <h2 id="airnote-reader-title">{titleOf(openedNote.content)}</h2>
                <div className="reader-meta">Updated {formatDate(openedNote.updatedAt || openedNote.createdAt)}</div>
                <div className="reader-answer airnote-reader-answer">{openedNote.content || 'This AirNote is empty. Select Edit to start writing.'}</div>
              </div>
            </article>
          </div>
        )}
        {fullPage && editingNote && (
          <div className="modal-backdrop editor-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !editSaving) setEditingNote(null); }}>
            <section className="dialog editor-dialog airnote-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="airnote-edit-title">
              <button className="close-button" onClick={() => !editSaving && setEditingNote(null)} aria-label="Close editor">×</button>
              <p className="eyebrow">AIRNOTES</p>
              <h2 id="airnote-edit-title">Edit AirNote<span className="period">.</span></h2>
              <p className="form-subtitle">Make your changes, then save them to AirNotes.</p>
              <textarea autoFocus value={editContent} onChange={(event) => setEditContent(event.target.value)} aria-label="AirNote content" rows={12} />
              <div className="editor-dialog-actions">
                <button type="button" className="study-button" onClick={() => setEditingNote(null)} disabled={editSaving}>Cancel</button>
                <button type="button" className="add-button" onClick={saveEditedNote} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save changes'}</button>
              </div>
            </section>
          </div>
        )}
        </>,
        document.body,
      )}
      {!fullPage && <a className="quick-notes-view-all" href="/airnotes">Open AirNotes <span aria-hidden="true">→</span></a>}
      {fullPage && <footer><span>Your ideas, saved as you write.</span><span>OGENOTES · QUICK NOTES</span></footer>}
    </section>
  );
}
