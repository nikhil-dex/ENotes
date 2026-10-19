'use client';

import { useEffect, useState } from 'react';

async function readJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not load dashboard data.');
  return data;
}

function relativeDate(value) {
  if (!value) return 'Saved recently';
  const parsed = new Date(String(value).replace(/ \(IST\)$/, ''));
  if (Number.isNaN(parsed.getTime())) return String(value).replace(/ \(IST\)$/, '');
  const days = Math.floor((Date.now() - parsed.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return days + ' days ago';
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function HomeDashboard() {
  const [data, setData] = useState({ loading: true, notes: [], noteCount: 0, subjectCount: 0, linkCount: 0, fileCount: 0, error: '' });

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const subjects = await readJson('/api/subjects');
        const [linksResult, mediaResult, notesBySubject] = await Promise.all([
          readJson('/api/saved-links').catch(() => []),
          readJson('/api/media').catch(() => ({ folders: [], files: [] })),
          Promise.all((Array.isArray(subjects) ? subjects : []).map(async (subject) => {
            const notes = await readJson('/api/notes?subject=' + encodeURIComponent(subject.slug)).catch(() => []);
            return (Array.isArray(notes) ? notes : []).map((note) => ({ ...note, subjectName: subject.name, subjectSlug: subject.slug }));
          })),
        ]);

        const allNotes = notesBySubject.flat();
        const sortDate = (note) => {
          const parsed = Date.parse(String(note.saved || '').replace(/ \(IST\)$/, ''));
          return Number.isNaN(parsed) ? Number(note.number || 0) : parsed;
        };
        allNotes.sort((a, b) => sortDate(b) - sortDate(a));
        const folders = Array.isArray(mediaResult.folders) ? mediaResult.folders : [];
        const rootFiles = Array.isArray(mediaResult.files) ? mediaResult.files : [];
        const folderFiles = await Promise.all(folders.map(async (folder) => {
          const folderData = await readJson('/api/media?folderId=' + encodeURIComponent(folder.id)).catch(() => ({ files: [] }));
          return Array.isArray(folderData.files) ? folderData.files.length : 0;
        }));
        if (cancelled) return;
        setData({
          loading: false,
          notes: allNotes.slice(0, 5),
          noteCount: allNotes.length,
          subjectCount: Array.isArray(subjects) ? subjects.length : 0,
          linkCount: Array.isArray(linksResult) ? linksResult.length : 0,
          fileCount: rootFiles.length + folderFiles.reduce((total, count) => total + count, 0),
          error: '',
        });
      } catch (error) {
        if (!cancelled) setData((current) => ({ ...current, loading: false, error: error.message || 'Could not load dashboard data.' }));
      }
    }

    loadDashboard();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="home-dashboard" aria-labelledby="home-dashboard-title">
      <div className="home-dashboard-heading">
        <div>
          <p className="eyebrow">YOUR WORKSPACE AT A GLANCE</p>
          <h2 id="home-dashboard-title">Pick up where you left off.</h2>
          <p className="home-dashboard-lead">Your latest notes and your most-used destinations, all in one place.</p>
        </div>
        <a className="home-dashboard-view-all" href="/notes">Open notes <span aria-hidden="true">→</span></a>
      </div>

      <div className="home-dashboard-stats" aria-label="Workspace statistics">
        <a className="home-dashboard-stat" href="/notes">
          <span className="home-dashboard-stat-icon" aria-hidden="true">▤</span>
          <span className="home-dashboard-stat-label">Notes</span>
          <strong>{data.loading ? '—' : data.noteCount}</strong>
        </a>
        <a className="home-dashboard-stat" href="/saved-links">
          <span className="home-dashboard-stat-icon" aria-hidden="true">↗</span>
          <span className="home-dashboard-stat-label">Saved links</span>
          <strong>{data.loading ? '—' : data.linkCount}</strong>
        </a>
        <a className="home-dashboard-stat" href="/files">
          <span className="home-dashboard-stat-icon" aria-hidden="true">▧</span>
          <span className="home-dashboard-stat-label">Files</span>
          <strong>{data.loading ? '—' : data.fileCount}</strong>
        </a>
        <a className="home-dashboard-stat" href="/settings">
          <span className="home-dashboard-stat-icon" aria-hidden="true">◫</span>
          <span className="home-dashboard-stat-label">Subjects</span>
          <strong>{data.loading ? '—' : data.subjectCount}</strong>
        </a>
      </div>

      <div className="home-dashboard-content">
        <section className="home-dashboard-recent" aria-labelledby="home-recent-title">
          <div className="home-dashboard-section-heading">
            <div>
              <p className="eyebrow">RECENTLY SAVED</p>
              <h3 id="home-recent-title">Recent notes</h3>
            </div>
            <a href="/notes">View all <span aria-hidden="true">→</span></a>
          </div>
          {data.loading ? (
            <p className="home-dashboard-empty">Loading your notes…</p>
          ) : data.notes.length ? (
            <div className="home-dashboard-note-list">
              {data.notes.map((note) => (
                <a className="home-dashboard-note" href={'/notes?subject=' + encodeURIComponent(note.subjectSlug)} key={note.subjectSlug + ':' + note.number}>
                  <span className="home-dashboard-note-mark" aria-hidden="true">✎</span>
                  <span className="home-dashboard-note-copy">
                    <strong>{note.heading || 'Untitled note'}</strong>
                    <span>{note.subjectName} · Note {note.number}</span>
                  </span>
                  <span className="home-dashboard-note-date">{relativeDate(note.saved)}</span>
                  <span className="home-dashboard-note-arrow" aria-hidden="true">→</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="home-dashboard-empty">
              <span aria-hidden="true">✎</span>
              <strong>Your next idea starts here.</strong>
              <p>Create your first note and it will show up here.</p>
              <a className="home-dashboard-action-link" href="/notes">Create a note <span aria-hidden="true">→</span></a>
            </div>
          )}
          {data.error && <p className="home-dashboard-error" role="status">{data.error} Some dashboard counts may be unavailable.</p>}
        </section>

        <section className="home-dashboard-actions" aria-labelledby="home-actions-title">
          <p className="eyebrow">SHORTCUTS</p>
          <h3 id="home-actions-title">Quick actions</h3>
          <a href="/notes"><span className="home-dashboard-action-icon" aria-hidden="true">＋</span><span><strong>Write a note</strong><small>Capture what you're learning</small></span><span aria-hidden="true">→</span></a>
          <a href="/saved-links"><span className="home-dashboard-action-icon" aria-hidden="true">↗</span><span><strong>Save a link</strong><small>Keep a useful resource close</small></span><span aria-hidden="true">→</span></a>
          <a href="/files"><span className="home-dashboard-action-icon" aria-hidden="true">▧</span><span><strong>Open file library</strong><small>Find images and PDFs</small></span><span aria-hidden="true">→</span></a>
          <a href="/extension-setup"><span className="home-dashboard-action-icon" aria-hidden="true">⌁</span><span><strong>Browser extension</strong><small>Capture ideas from websites</small></span><span aria-hidden="true">→</span></a>
        </section>
      </div>
    </section>
  );
}
