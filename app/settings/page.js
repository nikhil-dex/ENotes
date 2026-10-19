'use client';
import SiteNavbar from '../components/site-navbar';

import { useEffect, useRef, useState } from 'react';

async function responseJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

export default function SettingsPage() {
  const [subjects, setSubjects] = useState([]);
  const [subjectName, setSubjectName] = useState('');
  const [subjectBusy, setSubjectBusy] = useState(false);
  const [deletingSubjects, setDeletingSubjects] = useState(new Set());
  const [subjectError, setSubjectError] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [theme, setTheme] = useState('dark');
  const fileRef = useRef(null);

  async function refreshSubjects() {
    const items = await responseJson(await fetch('/api/subjects', { cache: 'no-store' }));
    setSubjects(items);
  }

  useEffect(() => {
    refreshSubjects().catch((error) => setSubjectError(error.message));
    const storedTheme = localStorage.getItem('theme');
    const initialTheme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'dark';
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
    localStorage.setItem('theme', initialTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  async function createSubject(event) {
    event.preventDefault();
    if (subjectBusy) return;
    setSubjectBusy(true);
    setSubjectError('');
    try {
      const subject = await responseJson(await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: subjectName }),
      }));
      setSubjects((current) => [...current, subject]);
      setSubjectName('');
    } catch (error) {
      setSubjectError(error.message);
    } finally {
      setSubjectBusy(false);
    }
  }

  async function deleteSubject(subject) {
    if (deletingSubjects.has(subject.slug)) return;
    if (subjects.length <= 1) {
      setSubjectError('Keep at least one subject. Add another before deleting this one.');
      return;
    }
    if (!window.confirm(`Delete “${subject.name}” and all its notes? This cannot be undone.`)) return;
    setDeletingSubjects((current) => new Set(current).add(subject.slug));
    setSubjectError('');
    try {
      await responseJson(await fetch(`/api/subjects?slug=${encodeURIComponent(subject.slug)}`, { method: 'DELETE' }));
      setSubjects((current) => current.filter((item) => item.slug !== subject.slug));
    } catch (error) {
      setSubjectError(error.message || `Could not delete ${subject.name}. Please try again.`);
    } finally {
      setDeletingSubjects((current) => {
        const next = new Set(current);
        next.delete(subject.slug);
        return next;
      });
    }
  }

  async function downloadBackup() {
    if (backupBusy) return;
    setBackupBusy(true);
    setBackupMessage('');
    try {
      const response = await fetch('/api/backup', { cache: 'no-store' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Could not download the backup.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `enotes-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setBackupMessage('Backup downloaded. Store it somewhere private.');
    } catch (error) {
      setBackupMessage(error.message || 'Backup download failed.');
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || backupBusy) return;
    setBackupMessage('');
    if (file.size > 10 * 1024 * 1024) {
      setBackupMessage('Choose a backup file no larger than 10 MB.');
      return;
    }
    if (!window.confirm('Restore this backup by adding missing subjects and notes? Existing notes will not be overwritten.')) return;
    setBackupBusy(true);
    try {
      const raw = await file.text();
      try { JSON.parse(raw); } catch { throw new Error('That file is not valid JSON.'); }
      const result = await responseJson(await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: raw,
      }));
      await refreshSubjects();
      setBackupMessage(`Restore complete: ${result.subjectsAdded} subjects added, ${result.notesAdded} notes added, ${result.notesSkipped} existing notes skipped.`);
    } catch (error) {
      setBackupMessage(error.message || 'Restore failed.');
    } finally {
      setBackupBusy(false);
    }
  }

  async function lockSession() {
    try {
      await fetch('/api/access/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
    } finally {
      window.location.replace('/access');
    }
  }

  return (
    <main className="shell hub-shell">
      <SiteNavbar actions={(
          <>
            <button className="theme-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-pressed={theme === 'dark'}>{theme === 'dark' ? '☼' : '◐'} <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button>
            <button className="theme-button" type="button" onClick={lockSession}>Lock</button>
          </>
        )} />

      <section className="settings-heading">
        <div><p className="eyebrow">WORKSPACE CONTROL</p><h1>Settings<span className="period">.</span></h1><p className="hub-lead">Manage your subjects and keep your notes safe. Everyday note-taking stays in the Notes library.</p></div>
      </section>

      <section className="settings-section" aria-labelledby="subjects-heading">
        <div className="settings-section-title"><div><p className="eyebrow">01 · ORGANIZATION</p><h2 id="subjects-heading">Subjects</h2></div><span className="settings-count">{subjects.length} total</span></div>
        <form className="settings-add-form" onSubmit={createSubject}>
          <label className="sr-only" htmlFor="new-subject-name">New subject name</label>
          <input id="new-subject-name" value={subjectName} maxLength={40} onChange={(event) => setSubjectName(event.target.value)} placeholder="Add a subject, e.g. Computer Networks" required />
          <button className="add-button" type="submit" disabled={subjectBusy}>{subjectBusy ? 'Adding…' : '+ Add subject'}</button>
        </form>
        {subjectError && <p className="settings-message settings-error" role="alert">{subjectError}</p>}
        <div className="settings-subject-list">
          {subjects.map((subject) => <article className="settings-subject-row" key={subject.slug}>
            <span className="settings-subject-mark" aria-hidden="true">▤</span>
            <div className="settings-subject-info"><strong>{subject.name}</strong><span>{subject.file || 'MongoDB'} · next note #{subject.nextNumber || 1}</span></div>
            <a className="settings-open-link" href={`/notes?subject=${encodeURIComponent(subject.slug)}`}>Open notes ↗</a>
            <button className="settings-delete-button" type="button" onClick={() => deleteSubject(subject)} disabled={deletingSubjects.has(subject.slug)} aria-label={`Delete ${subject.name} and its notes`}>{deletingSubjects.has(subject.slug) ? 'Deleting…' : 'Delete'}</button>
          </article>)}
          {!subjects.length && <p className="settings-muted">No subjects yet. Add one above to start your library.</p>}
        </div>
      </section>

      <section className="settings-section" aria-labelledby="backup-heading">
        <div className="settings-section-title"><div><p className="eyebrow">02 · RECOVERY</p><h2 id="backup-heading">Backup & restore</h2></div></div>
        <p className="settings-copy">Download a private JSON copy of your subjects and notes. Restoring merges missing records only and never replaces existing notes.</p>
        <div className="settings-backup-actions">
          <button type="button" className="add-button" onClick={downloadBackup} disabled={backupBusy}>{backupBusy ? 'Working…' : '↓ Download backup'}</button>
          <button type="button" className="settings-secondary-button" onClick={() => fileRef.current?.click()} disabled={backupBusy}>Restore from JSON</button>
          <input ref={fileRef} className="backup-file-input" type="file" accept="application/json,.json" onChange={restoreBackup} aria-label="Choose an ENotes JSON backup" />
        </div>
        <p className="settings-muted">Maximum file size: 10 MB. Existing subject metadata and notes are not overwritten.</p>
        {backupMessage && <p className="settings-message" role="status" aria-live="polite">{backupMessage}</p>}
      </section>

      <section className="settings-section settings-appearance" aria-labelledby="appearance-heading">
        <div><p className="eyebrow">03 · COMFORT</p><h2 id="appearance-heading">Appearance</h2><p className="settings-copy">Choose the theme for your workspace.</p></div>
        <div className="settings-theme-switch"><button type="button" className={theme === 'light' ? 'selected' : ''} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>☼ Light</button><button type="button" className={theme === 'dark' ? 'selected' : ''} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>◐ Dark</button></div>
      </section>

      <footer><span>Built for learning, one note at a time.</span><span>SETTINGS · ENotes</span></footer>
    </main>
  );
}
