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
  const [accent, setAccent] = useState('green');
  const [secondary, setSecondary] = useState('blue');
  const [pixelEnabled, setPixelEnabled] = useState(true);
  const [pixelColor, setPixelColor] = useState('accent');
  const [pixelMode, setPixelMode] = useState('random');
  const [pixelSpeed, setPixelSpeed] = useState('normal');
  const [pixelDensity, setPixelDensity] = useState('normal');
  const fileRef = useRef(null);

  async function refreshSubjects() {
    const items = await responseJson(await fetch('/api/subjects', { cache: 'no-store' }));
    setSubjects(items);
  }

  useEffect(() => {
    refreshSubjects().catch((error) => setSubjectError(error.message));
    try {
      const pixel = JSON.parse(localStorage.getItem('ogenotes-pixel-strip-settings') || '{}');
      setPixelEnabled(pixel.enabled !== false);
      setPixelColor(pixel.color === 'white' ? 'white' : 'accent');
      setPixelMode(['random', 'wave', 'sparkle', 'rain', 'pulse', 'heartbeat', 'geometry', 'glitch', 'orbit'].includes(pixel.mode) ? pixel.mode : 'random');
      setPixelSpeed(['slow', 'normal', 'fast'].includes(pixel.speed) ? pixel.speed : 'normal');
      setPixelDensity(['fine', 'normal', 'bold'].includes(pixel.density) ? pixel.density : 'normal');
    } catch { /* Use defaults when saved settings are invalid. */ }
    const storedTheme = localStorage.getItem('theme');
    const initialTheme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'dark';
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
    localStorage.setItem('theme', initialTheme);
    const storedAccent = localStorage.getItem('accent');
    const initialAccent = ['green', 'blue', 'purple', 'rose'].includes(storedAccent) ? storedAccent : 'green';
    setAccent(initialAccent);
    document.documentElement.dataset.primary = initialAccent;
    if (initialAccent === 'green') delete document.documentElement.dataset.accent;
    else document.documentElement.dataset.accent = initialAccent;
    const storedSecondary = localStorage.getItem('secondary');
    const initialSecondary = ['green', 'blue', 'purple', 'rose'].includes(storedSecondary) ? storedSecondary : 'blue';
    setSecondary(initialSecondary);
    document.documentElement.dataset.secondary = initialSecondary;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (accent === 'green') delete document.documentElement.dataset.accent;
    else document.documentElement.dataset.accent = accent;
    localStorage.setItem('accent', accent);
    document.documentElement.dataset.primary = accent;
  }, [accent]);

  useEffect(() => {
    document.documentElement.dataset.secondary = secondary;
    localStorage.setItem('secondary', secondary);
  }, [secondary]);

  function savePixelSettings(next) {
    const settings = { enabled: pixelEnabled, color: pixelColor, mode: pixelMode, speed: pixelSpeed, density: pixelDensity, ...next };
    setPixelEnabled(settings.enabled);
    setPixelColor(settings.color);
    setPixelMode(settings.mode);
    setPixelSpeed(settings.speed);
    setPixelDensity(settings.density);
    localStorage.setItem('ogenotes-pixel-strip-settings', JSON.stringify(settings));
    window.dispatchEvent(new Event('ogenotes-pixel-settings'));
    window.dispatchEvent(new Event('storage'));
  }

  function previewPixelAnimation() {
    window.dispatchEvent(new Event('ogenotes-pixel-preview'));
  }

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
      link.download = `ogogenotes-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
          <input ref={fileRef} className="backup-file-input" type="file" accept="application/json,.json" onChange={restoreBackup} aria-label="Choose an OgeNotes JSON backup" />
        </div>
        <p className="settings-muted">Maximum file size: 10 MB. Existing subject metadata and notes are not overwritten.</p>
        {backupMessage && <p className="settings-message" role="status" aria-live="polite">{backupMessage}</p>}
      </section>

      <section className="settings-section settings-appearance" aria-labelledby="appearance-heading">
        <div><p className="eyebrow">03 · COMFORT</p><h2 id="appearance-heading">Appearance</h2><p className="settings-copy">Choose a workspace mode and accent palette. Changes apply across the app.</p></div>
        <div className="settings-appearance-controls">
          <div className="settings-theme-switch"><button type="button" className={theme === 'light' ? 'selected' : ''} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>☼ Light</button><button type="button" className={theme === 'dark' ? 'selected' : ''} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>◐ Dark</button></div>
          <p className="settings-palette-label">Primary color</p><div className="settings-accent-picker" role="group" aria-label="Primary color">
            {[{ id: 'green', label: 'Forest green', color: '#40795e' }, { id: 'blue', label: 'Ocean blue', color: '#376fc0' }, { id: 'purple', label: 'Violet', color: '#7955b5' }, { id: 'rose', label: 'Rose', color: '#b94f70' }].map((option) => <button key={option.id} type="button" className={'settings-accent-option' + (accent === option.id ? ' selected' : '')} onClick={() => setAccent(option.id)} aria-label={option.label} aria-pressed={accent === option.id} title={option.label}><span style={{ background: option.color }} />{option.label}</button>)}
          </div>
          <div className="settings-palette-group">
            <p className="settings-palette-label">Secondary color</p>
            <div className="settings-accent-picker" role="group" aria-label="Secondary color">
              {[{ id: 'green', label: 'Forest green', color: '#40795e' }, { id: 'blue', label: 'Ocean blue', color: '#376fc0' }, { id: 'purple', label: 'Violet', color: '#7955b5' }, { id: 'rose', label: 'Rose', color: '#b94f70' }].map((option) => <button key={option.id} type="button" className={'settings-accent-option' + (secondary === option.id ? ' selected' : '')} onClick={() => setSecondary(option.id)} aria-label={option.label + ' secondary color'} aria-pressed={secondary === option.id} title={option.label}><span style={{ background: option.color }} />{option.label}</button>)}
            </div>
          </div>
        </div>
      </section>


      <section className="settings-section pixel-settings-section" aria-labelledby="pixel-strip-heading">
        <div className="settings-section-title"><div><p className="eyebrow">04 · PERSONALIZATION</p><h2 id="pixel-strip-heading">Pixel Strip</h2></div><span className="settings-count">8 effects</span></div>
        <p className="settings-copy">Customize the animated pixel display shown below the navigation bar throughout OgeNotes.</p>
        <div className="pixel-settings-preview" aria-hidden="true"><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /><span className="pixel-preview-dot" /></div>
        <div className="pixel-settings-grid">
          <label className="pixel-setting-toggle"><span><strong>Enable Pixel Strip</strong><small>Show or hide the strip on all pages.</small></span><input type="checkbox" checked={pixelEnabled} onChange={(event) => savePixelSettings({ enabled: event.target.checked })} /></label>
          <label className="pixel-setting-control"><span><strong>Pixel color</strong><small>Follow the primary theme accent or use white.</small></span><select value={pixelColor} onChange={(event) => savePixelSettings({ color: event.target.value })}><option value="accent">Theme accent</option><option value="white">Monochrome white</option></select></label>
          <label className="pixel-setting-control"><span><strong>Animation mode</strong><small>Random rotation or a preferred effect.</small></span><select value={pixelMode} onChange={(event) => savePixelSettings({ mode: event.target.value })}><option value="random">Random rotation</option><option value="wave">Pixel waves</option><option value="sparkle">Random sparkles</option><option value="rain">Digital rain</option><option value="pulse">Pulse grid</option><option value="heartbeat">Pixel heartbeat</option><option value="geometry">Geometric shapes</option><option value="glitch">Glitch</option><option value="orbit">Orbit rings</option></select></label>
          <label className="pixel-setting-control"><span><strong>Animation speed</strong><small>Adjust how quickly the pixels move.</small></span><select value={pixelSpeed} onChange={(event) => savePixelSettings({ speed: event.target.value })}><option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option></select></label>
          <label className="pixel-setting-control"><span><strong>Pixel density</strong><small>Choose finer or bolder pixels.</small></span><select value={pixelDensity} onChange={(event) => savePixelSettings({ density: event.target.value })}><option value="fine">Fine</option><option value="normal">Balanced</option><option value="bold">Bold</option></select></label>
        </div>
        <div className="pixel-settings-actions"><button type="button" className="add-button" onClick={previewPixelAnimation} disabled={!pixelEnabled}>↻ Preview another animation</button><span className="settings-muted">Preferences save automatically on this device.</span></div>
      </section>

      <footer><span>Built for learning, one note at a time.</span><span>SETTINGS · ENotes</span></footer>
    </main>
  );
}
