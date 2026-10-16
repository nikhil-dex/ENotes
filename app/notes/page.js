'use client';
import SiteNavbar from '../components/site-navbar';

import { useEffect, useMemo, useRef, useState } from 'react';
import { markdownHtml } from '../../lib/markdown.js';
import { calculateNextReview } from '../../lib/spaced-repetition.js';
import { getDailyRevisionState, recordDailyReview, setDailyRevisionGoal } from '../../lib/daily-revision.js';
import { enqueueOfflineMutation, getPendingOfflineMutations, removePendingOfflineMutation } from '../../lib/offline-mutation-queue.js';

function draftStorageKey(subject, number) {
  return `enotes:draft:${subject}:${number ?? 'new'}`;
}

async function responseJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

function referencesNote(answer, heading) {
  if (!answer || !heading) return false;
  return String(answer).split(/\r?\n/).some((line) => {
    const matches = line.matchAll(/\[\[([^\]]+)\]\]/g);
    for (const match of matches) {
      if (match[1].trim().toLocaleLowerCase() === heading.trim().toLocaleLowerCase()) return true;
    }
    return false;
  });
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
  const [sortOrder, setSortOrder] = useState('latest');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;
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
  const [studyDeck, setStudyDeck] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [studyRevealed, setStudyRevealed] = useState(false);
  const [learnedNotes, setLearnedNotes] = useState(new Set());
  const [reviewSchedule, setReviewSchedule] = useState({});
  const [dailyRevision, setDailyRevision] = useState({ date: '', completed: 0, goal: 10 });
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState('online');
  const [syncVersion, setSyncVersion] = useState(0);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const answerRef = useRef(null);
  const dialogRef = useRef(null);
  const headingInputRef = useRef(null);
  const initialDraftRef = useRef({ heading: '', answer: '' });
  const draftDirty = noteDialog && (heading !== initialDraftRef.current.heading || answer !== initialDraftRef.current.answer);
  const subjectNavRef = useRef(null);

  const active = subjects.find((subject) => subject.slug === activeSubject);
  const availableTags = useMemo(() => [...new Set(notes.flatMap((note) => Array.isArray(note.tags) ? note.tags : []))].sort(), [notes]);
  const filteredNotes = useMemo(() => notes
    .filter((note) => `${note.heading} ${note.answer} ${(note.tags || []).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((note) => !favoritesOnly || note.favorite === true)
    .filter((note) => !pinnedOnly || note.pinned === true)
    .filter((note) => !selectedTag || (note.tags || []).includes(selectedTag))
    .sort((a, b) => {
      if (sortOrder === 'oldest') return a.number - b.number;
      if (sortOrder === 'title-asc') return a.heading.localeCompare(b.heading);
      if (sortOrder === 'title-desc') return b.heading.localeCompare(a.heading);
      return Number(b.pinned === true) - Number(a.pinned === true) || Number(b.favorite === true) - Number(a.favorite === true) || b.number - a.number;
    }), [notes, query, favoritesOnly, pinnedOnly, selectedTag, sortOrder]);
  const totalPages = Math.max(1, Math.ceil(filteredNotes.length / pageSize));
  const shownNotes = useMemo(() => filteredNotes.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredNotes, currentPage]);


  useEffect(() => {
    try {
      const storedDailyRevision = JSON.parse(localStorage.getItem('dailyRevision:v1') || 'null');
      const today = getDailyRevisionState(storedDailyRevision);
      setDailyRevision(today);
      if (JSON.stringify(storedDailyRevision) !== JSON.stringify(today)) localStorage.setItem('dailyRevision:v1', JSON.stringify(today));
    } catch {
      const today = getDailyRevisionState(null);
      setDailyRevision(today);
      localStorage.setItem('dailyRevision:v1', JSON.stringify(today));
    }
    setIsOnline(navigator.onLine);
    setSyncStatus(navigator.onLine ? 'online' : 'offline');
    try { setPendingSyncCount(getPendingOfflineMutations(localStorage).length); } catch {}
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' || storedTheme === 'light') setTheme(storedTheme);
    const storedSubject = localStorage.getItem('activeSubject');
    const requestedSubject = new URLSearchParams(window.location.search).get('subject');
    fetch('/api/subjects')
      .then(responseJson)
      .then((items) => {
        setSubjects(items);
        try { localStorage.setItem('enotes:offline:subjects:v1', JSON.stringify(items)); } catch {}
        const preferred = items.find((item) => item.slug === requestedSubject) || items.find((item) => item.slug === storedSubject) || items[0];
        if (preferred) setActiveSubject(preferred.slug);
      })
      .catch((error) => {
        let cached = [];
        try {
          const parsed = JSON.parse(localStorage.getItem('enotes:offline:subjects:v1') || '[]');
          if (Array.isArray(parsed)) cached = parsed;
        } catch {}
        if (cached.length) {
          setSubjects(cached);
          setSyncStatus('offline');
          const preferred = cached.find((item) => item.slug === requestedSubject) || cached.find((item) => item.slug === storedSubject) || cached[0];
          if (preferred) setActiveSubject(preferred.slug);
        } else setFormError(error.message);
      });
  }, []);

  useEffect(() => {
    const syncDailyRevision = () => {
      try {
        const stored = JSON.parse(localStorage.getItem('dailyRevision:v1') || 'null');
        const today = getDailyRevisionState(stored);
        if (JSON.stringify(stored) !== JSON.stringify(today)) localStorage.setItem('dailyRevision:v1', JSON.stringify(today));
        setDailyRevision((current) => JSON.stringify(current) === JSON.stringify(today) ? current : today);
      } catch {
        const today = getDailyRevisionState(null);
        try { localStorage.setItem('dailyRevision:v1', JSON.stringify(today)); } catch {}
        setDailyRevision((current) => JSON.stringify(current) === JSON.stringify(today) ? current : today);
      }
    };
    const interval = window.setInterval(syncDailyRevision, 60_000);
    window.addEventListener('focus', syncDailyRevision);
    document.addEventListener('visibilitychange', syncDailyRevision);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', syncDailyRevision);
      document.removeEventListener('visibilitychange', syncDailyRevision);
    };
  }, []);

  useEffect(() => {
    const heartbeat = async () => {
      try {
        const response = await fetch('/api/access/heartbeat', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
        if (response.status === 401) window.location.replace('/access?reason=session-replaced');
      } catch {}
    };
    const timer = window.setInterval(heartbeat, 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onOnline = () => { setIsOnline(true); setSyncStatus('syncing'); setSyncVersion((version) => version + 1); };
    const onOffline = () => { setIsOnline(false); setSyncStatus('offline'); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  useEffect(() => {
    if (!isOnline || !pendingSyncCount) return;
    let cancelled = false;
    const flushOfflineMutations = async () => {
      setSyncStatus('syncing');
      while (!cancelled && navigator.onLine) {
        const queue = getPendingOfflineMutations(localStorage);
        if (!queue.length) {
          setPendingSyncCount(0); setSyncStatus('synced'); setSyncVersion((version) => version + 1); return;
        }
        const mutation = queue[0];
        try {
          const response = await fetch('/api/notes', {
            method: mutation.kind === 'update' ? 'PUT' : 'PATCH',
            headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store',
            body: JSON.stringify({
              subject: mutation.subject, number: mutation.number,
              ...(mutation.kind === 'update' ? {
                heading: mutation.heading, answer: mutation.answer, tags: mutation.tags,
                favorite: mutation.favorite, pinned: mutation.pinned,
              } : mutation.changes),
            }),
          });
          if (!response.ok) { setSyncStatus(response.status === 409 ? 'conflict' : 'error'); return; }
          const updated = await response.json();
          removePendingOfflineMutation(localStorage, mutation.id);
          setPendingSyncCount(getPendingOfflineMutations(localStorage).length);
          setNotes((current) => current.map((item) => item.number === updated.number && (item.subject || activeSubject) === (updated.subject || activeSubject) ? { ...item, ...updated, pendingSync: false } : item));
          setReaderNote((current) => current?.number === updated.number && (current.subject || activeSubject) === (updated.subject || activeSubject) ? { ...current, ...updated, pendingSync: false } : current);
        } catch { setSyncStatus('offline'); return; }
      }
    };
    flushOfflineMutations();
    return () => { cancelled = true; };
  }, [isOnline, pendingSyncCount, syncVersion, activeSubject]);

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
    setCurrentPage(1);
  }, [query, favoritesOnly, pinnedOnly, selectedTag, sortOrder, globalSearch]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, Math.max(1, Math.ceil(filteredNotes.length / pageSize))));
  }, [filteredNotes.length]);

  useEffect(() => {
    if (!activeSubject || globalSearch) return;
    const controller = new AbortController();
    localStorage.setItem('activeSubject', activeSubject);
    setNotesLoading(true);
    setFormError('');
    setNotes([]);
    if (navigator.onLine) setSyncStatus('syncing');
    fetch(`/api/notes?subject=${encodeURIComponent(activeSubject)}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(responseJson)
      .then((items) => {
        if (!controller.signal.aborted) {
          setNotes(items);
          try { localStorage.setItem(`enotes:offline:notes:v1:${activeSubject}`, JSON.stringify(items)); } catch {}
          setSyncStatus('synced');
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        let cached = null;
        try {
          const parsed = JSON.parse(localStorage.getItem(`enotes:offline:notes:v1:${activeSubject}`) || 'null');
          if (Array.isArray(parsed)) cached = parsed;
        } catch {}
        if (cached) {
          setNotes(cached);
          setSyncStatus('offline');
        } else {
          setFormError(error.message);
          setSyncStatus(navigator.onLine ? 'error' : 'offline');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setNotesLoading(false);
      });
    try {
      const saved = JSON.parse(localStorage.getItem(`learnedNotes:${activeSubject}`) || '[]');
      setLearnedNotes(new Set(saved));
    } catch { setLearnedNotes(new Set()); }
    try {
      setReviewSchedule(JSON.parse(localStorage.getItem('reviewSchedule:v1') || '{}'));
    } catch { setReviewSchedule({}); }
    setQuery('');
    return () => controller.abort();
  }, [activeSubject, globalSearch, syncVersion]);

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
    const pending = getPendingOfflineMutations(localStorage);
    if (pending.length && !window.confirm(`There are ${pending.length} offline change(s) waiting to sync. OK will discard them only after this device successfully releases its session. Cancel to stay here and sync first.`)) return;
    try {
      const response = await fetch('/api/access/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Could not release this device session. Check your connection and try again.');
      if (pending.length) {
        try { localStorage.setItem('enotes:offline:mutations:v1', '[]'); } catch {}
        setPendingSyncCount(0);
      }
      window.location.replace('/access');
    } catch (error) {
      setFormError(error.message || 'Could not lock ENotes. Please try again. Your queued changes have been kept.');
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
    const payload = {
      heading: heading.trim(), answer: answer.trim(), subject: editingNote?.subject || activeSubject,
      tags: tagInput.split(',').map((tag) => tag.trim()).filter(Boolean), favorite: favoriteDraft, pinned: pinnedDraft,
      ...(editingNote ? { number: editingNote.number } : {}),
    };
    try {
      let note;
      if (!navigator.onLine && editingNote) {
        const mutation = enqueueOfflineMutation(localStorage, {
          kind: 'update', subject: payload.subject, number: editingNote.number,
          heading: payload.heading, answer: payload.answer, tags: payload.tags, favorite: payload.favorite, pinned: payload.pinned,
        });
        if (!mutation) throw new Error('Could not queue this edit on this device. Check browser storage and try again.');
        note = { ...editingNote, ...payload, saved: 'Saved on this device · waiting to sync', pendingSync: true };
        setPendingSyncCount(getPendingOfflineMutations(localStorage).length); setSyncStatus('offline');
      } else if (!navigator.onLine && !editingNote) {
        throw new Error('New notes cannot be created offline yet. Your draft remains saved on this device.');
      } else {
        note = await responseJson(await fetch('/api/notes', {
          method: editingNote ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin', body: JSON.stringify(payload),
        }));
      }
      if (editingNote) {
        setNotes((current) => current.map((item) => item.number === note.number && (item.subject || activeSubject) === (note.subject || activeSubject) ? { ...item, ...note } : item));
        setReaderNote((current) => current?.number === note.number && (current.subject || activeSubject) === (note.subject || activeSubject) ? { ...current, ...note } : current);
        try {
          const key = `enotes:offline:notes:v1:${note.subject || activeSubject}`;
          const cached = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(cached)) localStorage.setItem(key, JSON.stringify(cached.map((item) => item.number === note.number ? { ...item, ...note } : item)));
        } catch {}
      } else setNotes((current) => [...current, { ...note, subjectName: active?.name || activeSubject }]);
      try { localStorage.removeItem(draftStorageKey(activeSubject, editingNote?.number)); } catch {}
      setHeading(''); setAnswer(''); setTagInput(''); setFavoriteDraft(false); setPinnedDraft(false); initialDraftRef.current = { heading: '', answer: '' }; setDraftStatus(''); setPreview(false); setNoteDialog(false); setEditingNote(null);
    } catch (error) { setFormError(error.message); }
    finally { setSaving(false); }
  }

  async function updateNoteMetadata(note, changes) {
    try {
      if (!navigator.onLine) {
        const mutation = enqueueOfflineMutation(localStorage, { kind: 'patch', subject: note.subject || activeSubject, number: note.number, changes });
        if (!mutation) throw new Error('Could not queue this change on this device.');
        const updated = { ...note, ...changes, pendingSync: true };
        setNotes((current) => current.map((item) => item.number === note.number && (item.subject || activeSubject) === (note.subject || activeSubject) ? { ...item, ...updated } : item));
        setReaderNote((current) => current?.number === note.number && (current.subject || activeSubject) === (note.subject || activeSubject) ? { ...current, ...updated } : current);
        try {
          const key = `enotes:offline:notes:v1:${note.subject || activeSubject}`;
          const cached = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(cached)) localStorage.setItem(key, JSON.stringify(cached.map((item) => item.number === note.number ? { ...item, ...updated } : item)));
        } catch {}
        setPendingSyncCount(getPendingOfflineMutations(localStorage).length); setSyncStatus('offline'); return;
      }
      const updated = await responseJson(await fetch('/api/notes', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: note.subject || activeSubject, number: note.number, ...changes }),
      }));
      setNotes((current) => current.map((item) => item.number === note.number && (item.subject || activeSubject) === (note.subject || activeSubject) ? { ...item, ...updated } : item));
      setReaderNote((current) => current?.number === note.number && (current.subject || activeSubject) === (note.subject || activeSubject) ? { ...current, ...updated } : current);
    } catch (error) { setFormError(error.message || 'Could not update note properties.'); }
  }

  function editNote(note) {
    initialDraftRef.current = { heading: note.heading, answer: note.answer };
    setEditingNote({ ...note, subject: note.subject || activeSubject }); setHeading(note.heading); setAnswer(note.answer);
    setTagInput((note.tags || []).join(', ')); setFavoriteDraft(note.favorite === true); setPinnedDraft(note.pinned === true);
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


  function noteReviewKey(note) { return `${note.subject || activeSubject}:${note.number}`; }

  function isReviewDue(note) {
    const dueAt = reviewSchedule[noteReviewKey(note)]?.dueAt;
    return !dueAt || new Date(dueAt).getTime() <= Date.now();
  }

  const dueReviewCount = notes.filter(isReviewDue).length;

  function startStudy(dueOnly = false) {
    if (!notes.length) return;
    const dueNotes = notes.filter(isReviewDue);
    const deck = dueOnly ? dueNotes : notes;
    if (!deck.length) return;
    setStudyDeck([...deck].sort((a, b) => Number(isReviewDue(b)) - Number(isReviewDue(a)) || b.number - a.number));
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

  function rateReview(rating) {
    const note = studyDeck[studyIndex];
    if (!note) return;
    const key = noteReviewKey(note);
    const now = new Date();
    const nextDailyRevision = recordDailyReview(dailyRevision, now);
    setDailyRevision(nextDailyRevision);
    localStorage.setItem('dailyRevision:v1', JSON.stringify(nextDailyRevision));
    const nextReview = calculateNextReview(reviewSchedule[key], rating, now);
    const nextSchedule = {
      ...reviewSchedule,
      [key]: nextReview,
    };
    setReviewSchedule(nextSchedule);
    localStorage.setItem('reviewSchedule:v1', JSON.stringify(nextSchedule));
    if (rating === 'good' || rating === 'easy') {
      const nextLearned = new Set(learnedNotes);
      nextLearned.add(note.number);
      saveLearned(nextLearned);
    }
    moveStudy(studyIndex + 1);
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
      <SiteNavbar actions={(
          <>
            <button className="theme-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-pressed={theme === 'dark'}>{theme === 'dark' ? '☼' : '◐'} <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button>
            <span className={`sync-status ${!isOnline ? 'offline' : ['error', 'conflict'].includes(syncStatus) ? 'error' : ''}`} role="status" aria-live="polite"><span className="sync-status-dot" aria-hidden="true"/>{!isOnline ? `Offline · ${pendingSyncCount} pending` : syncStatus === 'syncing' ? `Syncing · ${pendingSyncCount} pending` : syncStatus === 'synced' ? 'Synced' : syncStatus === 'conflict' ? 'Sync paused · conflict' : syncStatus === 'error' ? 'Sync issue · queued' : 'Online'}</span>
            <span className="navbar-storage-label">{active?.file || 'MongoDB'}</span>
            <button className="theme-button" type="button" onClick={lockSession} aria-label="Lock ENotes and end this session">Lock</button>
          </>
        )} />

      <nav className="subject-nav" aria-label="Main navigation" ref={subjectNavRef}>
        <button className="mobile-nav-toggle" type="button" aria-controls="subject-menu" aria-expanded={mobileNavOpen} aria-label={mobileNavOpen ? 'Close subject menu' : 'Open subject menu'} onClick={() => setMobileNavOpen((open) => !open)}><span className="mobile-nav-icon" aria-hidden="true"><i/><i/><i/></span><span>Subjects</span></button>
        <div className={`subject-dropdown ${mobileNavOpen ? 'open' : ''}`} id="subject-menu">
          {subjects.map((subject) => <span className="subject-item" key={subject.slug}><button className={`subject-tab ${subject.slug === activeSubject ? 'active' : ''}`} onClick={() => { setActiveSubject(subject.slug); setMobileNavOpen(false); }}>{subject.name}</button></span>)}
        </div>
      </nav>

      <section className="intro">
        <div><p className="eyebrow">YOUR PERSONAL KNOWLEDGE BASE</p><h1>{active?.name || 'Your'} notes<span className="period">.</span></h1><p className="subtitle">A clear place for the commands, concepts, and things you learn.</p></div>
        <div className="intro-actions"><button className="study-button" onClick={() => startStudy(true)} disabled={!dueReviewCount}><span aria-hidden="true">◉</span> Review due ({dueReviewCount})</button><button className="study-button secondary-study-button" onClick={() => startStudy(false)} disabled={!notes.length}>Study all notes</button><button className="add-button" onClick={() => { initialDraftRef.current = { heading: '', answer: '' }; setEditingNote(null); setHeading(''); setAnswer(''); setTagInput(''); setFavoriteDraft(false); setPinnedDraft(false); setRevisions([]); setRevisionsOpen(false); setRevisionsError(''); setFormError(''); setNoteDialog(true); }}><span aria-hidden="true">+</span> Add a note</button></div>
      </section>

      <section className="stats" aria-label="Note statistics"><div className="stat"><span className="stat-number">{String(notes.length).padStart(2, '0')}</span><span className="stat-label">TOTAL NOTES</span></div><div className="stat-divider"/><div className="stat"><span className="stat-number">{String(subjects.length).padStart(2, '0')}</span><span className="stat-label">SUBJECTS</span></div><div className="stat-spacer"/><div className="search-wrap"><span aria-hidden="true">⌕</span><input type="search" placeholder={globalSearch ? "Search all subjects…" : "Search this subject…"} aria-label="Search notes" value={query} onChange={(event) => setQuery(event.target.value)}/></div><button type="button" className={globalSearch ? "global-search-toggle active" : "global-search-toggle"} aria-pressed={globalSearch} onClick={() => { setGlobalSearch((value) => !value); setQuery(""); setFormError(""); }}>⌕ {globalSearch ? "All subjects" : "Search all subjects"}</button></section>

      <section className="daily-revision" aria-labelledby="dailyRevisionTitle">
        <div className="daily-revision-copy">
          <p className="eyebrow">DAILY PRACTICE</p>
          <h2 id="dailyRevisionTitle">Today's revision<span className="period">.</span></h2>
          <p>{dueReviewCount > 0 ? `${dueReviewCount} card${dueReviewCount === 1 ? '' : 's'} due for review.` : 'No cards are due for review right now.'}</p>
          <div className="daily-progress-track" role="progressbar" aria-label="Daily revision goal progress" aria-valuemin={0} aria-valuemax={dailyRevision.goal} aria-valuenow={Math.min(dailyRevision.completed, dailyRevision.goal)}>
            <span style={{ width: `${Math.min(100, Math.round((dailyRevision.completed / dailyRevision.goal) * 100))}%` }} />
          </div>
          <span className="daily-progress-caption">{dailyRevision.completed} of {dailyRevision.goal} reviews completed today</span>
        </div>
        <div className="daily-revision-actions">
          <label htmlFor="dailyRevisionGoal">Daily goal<select id="dailyRevisionGoal" value={dailyRevision.goal} onChange={(event) => {
            const next = setDailyRevisionGoal(dailyRevision, Number(event.target.value));
            setDailyRevision(next);
            localStorage.setItem('dailyRevision:v1', JSON.stringify(next));
          }}><option value={5}>5 cards</option><option value={10}>10 cards</option><option value={15}>15 cards</option><option value={20}>20 cards</option></select></label>
          <button className="add-button daily-revision-start" type="button" onClick={() => startStudy(true)} disabled={!dueReviewCount}>Start daily review <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <section className="notes-section"><div className="section-heading"><div><p className="eyebrow">THE LIBRARY</p><h2>{globalSearch ? "Search results" : "All notes"} <span className="count-pill">{filteredNotes.length}</span></h2></div><label className="sort-control">Sort <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sort notes"><option value="latest">Pinned &amp; latest</option><option value="oldest">Oldest first</option><option value="title-asc">Title A–Z</option><option value="title-desc">Title Z–A</option></select></label></div>
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
        {notesLoading ? <div className="empty-state" role="status"><span className="empty-icon">◌</span><h3>Loading notes…</h3><p>Getting notes for this subject.</p></div> : filteredNotes.length ? <div className="notes-grid">{shownNotes.map((note) => <article className="note-card" key={`${note.subject || activeSubject}:${note.number}`}><button className="card-open" onClick={() => setReaderNote(note)} aria-label={`Open note: ${note.heading}`}><span className="card-top"><span className="note-index">NO. {String(note.number).padStart(2, '0')}</span>{globalSearch && <span className="note-subject-label">{note.subjectName || note.subject}</span>}<span className="note-badges">{note.pinned && <span title="Pinned">📌</span>}{note.favorite && <span title="Favorite">★</span>}</span></span><span className="note-title">{note.heading}</span><span className="note-preview">{note.answer}</span><span className="card-tags">{(note.tags || []).map((tag) => <span key={tag} className="tag-chip">{tag}</span>)}</span><span className="card-bottom">◷ <span>{note.saved}</span></span></button><button className={note.favorite ? "metadata-action selected" : "metadata-action"} onClick={() => updateNoteMetadata(note, { favorite: note.favorite !== true })} aria-pressed={note.favorite === true} aria-label={note.favorite ? `Remove favorite: ${note.heading}` : `Add favorite: ${note.heading}`} title={note.favorite ? "Remove favorite" : "Add favorite"}>★</button><button className={note.pinned ? "metadata-action selected" : "metadata-action"} onClick={() => updateNoteMetadata(note, { pinned: note.pinned !== true })} aria-pressed={note.pinned === true} aria-label={note.pinned ? `Unpin note: ${note.heading}` : `Pin note: ${note.heading}`} title={note.pinned ? "Unpin note" : "Pin note"}>⌖</button><button className="edit-note" onClick={() => editNote(note)} aria-label={`Edit note: ${note.heading}`} title="Edit note">✎</button><button className="delete-note" onClick={() => deleteNote(note)} disabled={deletingNotes.has(note.number)} aria-label={`Delete note: ${note.heading}`} title={deletingNotes.has(note.number) ? 'Deleting note…' : 'Delete note'}>{deletingNotes.has(note.number) ? '…' : '×'}</button></article>)}</div> : <div className="empty-state"><span className="empty-icon">⌕</span><h3>{globalSearch && query.trim().length < 2 ? 'Search across your library' : query ? 'No notes found' : 'Start your collection'}</h3><p>{globalSearch && query.trim().length < 2 ? 'Enter at least 2 characters to search every subject.' : query ? 'Try another search, or add a new note.' : 'Add a note to this subject, then come back to study it.'}</p></div>}{globalSearchTruncated && <p className="search-limit-note" role="status">Showing the first 100 matching notes. Refine your search to narrow the results.</p> }
        {filteredNotes.length > pageSize && <nav className="pagination" aria-label="Notes pages">
          <span className="pagination-summary">Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredNotes.length)} of {filteredNotes.length}</span>
          <div className="pagination-actions">
            <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} aria-label="Previous page">← Previous</button>
            <span aria-live="polite">Page {currentPage} of {totalPages}</span>
            <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} aria-label="Next page">Next →</button>
          </div>
        </nav>}
      </section>
      <footer><span>Built for learning, one note at a time.</span><span>MONGODB · SUBJECT BASED</span></footer>

      {formError && !noteDialog && <p className="page-error" role="alert">{formError}</p>}

      {noteDialog && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) requestCloseNoteDialog(); }}><section ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="formTitle" aria-describedby="formDescription"><button className="close-button" onClick={requestCloseNoteDialog} aria-label="Close form">×</button><p className="eyebrow">{editingNote ? `EDIT NOTE ${String(editingNote.number).padStart(2, '0')}` : 'GROW YOUR LIBRARY'}</p><h2 id="formTitle">{editingNote ? 'Edit note' : 'Add a note'}<span className="period">.</span></h2><p id="formDescription" className="form-subtitle">{editingNote ? 'Update the heading or answer. Its serial number will stay the same.' : 'Give it a clear heading and capture what you learned.'}</p>
        <form onSubmit={saveNote}><label htmlFor="heading">HEADING</label><input ref={headingInputRef} id="heading" maxLength={160} placeholder="e.g. What does chmod do?" value={heading} onChange={(event) => setHeading(event.target.value)} required/><label htmlFor="noteTags">TAGS <span className="field-hint">comma-separated · up to 10</span></label><input id="noteTags" maxLength={260} placeholder="e.g. arrays, exam, important" value={tagInput} onChange={(event) => setTagInput(event.target.value)} /><div className="note-metadata-fields"><label><input type="checkbox" checked={favoriteDraft} onChange={(event) => setFavoriteDraft(event.target.checked)} /> Mark as favorite</label><label><input type="checkbox" checked={pinnedDraft} onChange={(event) => setPinnedDraft(event.target.checked)} /> Pin to top</label></div><div className="label-row"><label htmlFor="answer">ANSWER</label><span>Markdown · link notes with [[Exact note heading]]</span></div><div className="editor-toolbar" aria-label="Answer formatting"><button type="button" onClick={() => insertFormatting('bold')} title="Bold">B</button><button type="button" onClick={() => insertFormatting('code')} title="Inline code">&lt;/&gt;</button><button type="button" onClick={() => insertFormatting('list')} title="Bullet list">• List</button><button type="button" onClick={() => insertFormatting('codeblock')} title="Code block">{'{ }'}</button><span>Formatting shortcuts</span><span className="draft-status" role="status" aria-live="polite">{draftStatus}</span></div>
          <div className="editor-tabs"><button type="button" className={!preview ? 'active' : ''} onClick={() => setPreview(false)}>Write</button><button type="button" className={preview ? 'active' : ''} onClick={() => setPreview(true)}>Preview</button></div>
          {!preview ? <textarea ref={answerRef} id="answer" rows={6} maxLength={10000} placeholder="Write your explanation here…" value={answer} onChange={(event) => setAnswer(event.target.value)} required/> : <div className="answer-preview">{answer ? <div dangerouslySetInnerHTML={{ __html: markdownHtml(answer) }}/> : <p className="preview-placeholder">Nothing to preview yet.</p>}</div>}
          {formError && <p className="form-error" role="alert">{formError}</p>}<button className="submit-button" type="submit" disabled={saving}><span>{saving ? 'Saving…' : editingNote ? 'Save changes' : 'Save note'}</span><span aria-hidden="true">→</span></button></form>
      </section></div>}

      {readerNote && <div className="reader-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setReaderNote(null); }}><article className="reader-panel" role="dialog" aria-modal="true" aria-labelledby="readerTitle"><div className="reader-toolbar"><span className="reader-kicker">NOTE {String(readerNote.number).padStart(2, '0')}</span><button className="close-button reader-close" onClick={() => setReaderNote(null)} aria-label="Close note">×</button></div><div className="reader-content"><p className="eyebrow">{readerNote.subjectName || subjects.find((subject) => subject.slug === (readerNote.subject || activeSubject))?.name || active?.name}</p><h2 id="readerTitle">{readerNote.heading}</h2><div className="reader-meta">Saved {readerNote.saved}</div><div className="reader-answer" dangerouslySetInnerHTML={{ __html: markdownHtml(readerNote.answer) }}/>
          <section className="note-links-section" aria-label="Linked notes">
            <h3>Linked notes</h3>
            {notes.filter((note) => (note.subject || activeSubject) === (readerNote.subject || activeSubject) && note.number !== readerNote.number && referencesNote(readerNote.answer, note.heading)).length
              ? <ul>{notes.filter((note) => (note.subject || activeSubject) === (readerNote.subject || activeSubject) && note.number !== readerNote.number && referencesNote(readerNote.answer, note.heading)).map((note) => <li key={note.number}><button type="button" onClick={() => setReaderNote(note)}>{note.heading} <span>→</span></button></li>)}</ul>
              : <p>No linked notes yet. Add <code>[[Exact note heading]]</code> to an answer to link another note.</p>}
          </section>
          <section className="note-links-section backlinks-section" aria-label="Backlinks">
            <h3>Backlinks</h3>
            {notes.filter((note) => (note.subject || activeSubject) === (readerNote.subject || activeSubject) && note.number !== readerNote.number && referencesNote(note.answer, readerNote.heading)).length
              ? <ul>{notes.filter((note) => (note.subject || activeSubject) === (readerNote.subject || activeSubject) && note.number !== readerNote.number && referencesNote(note.answer, readerNote.heading)).map((note) => <li key={note.number}><button type="button" onClick={() => setReaderNote(note)}>{note.heading} <span>↗</span></button></li>)}</ul>
              : <p>No notes link to this one yet.</p>}
          </section>
        </div></article></div>}

      {studyOpen && currentStudyNote && <div className="reader-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setStudyOpen(false); }}><section className="study-panel" role="dialog" aria-modal="true" aria-labelledby="studyQuestion"><div className="reader-toolbar"><span className="reader-kicker">STUDY SESSION</span><button className="close-button reader-close" onClick={() => setStudyOpen(false)} aria-label="Close study session">×</button></div><div className="study-content"><div className="study-progress-row"><span>CARD {studyIndex + 1} OF {studyDeck.length}</span><span>{dueReviewCount} due · {learnedNotes.size} learned</span></div><div className="study-progress"><span style={{ width: `${((studyIndex + 1) / studyDeck.length) * 100}%` }}/></div><p className="eyebrow">{active?.name}</p><p className="study-prompt">Try to recall the answer</p><h2 id="studyQuestion">{currentStudyNote.heading}</h2>{studyRevealed && <div className="study-answer" dangerouslySetInnerHTML={{ __html: markdownHtml(currentStudyNote.answer) }} />}{!studyRevealed && <button className="reveal-button" onClick={() => setStudyRevealed(true)}>Reveal answer</button>}{studyRevealed && <div className="study-actions review-ratings"><button type="button" className="rating-again" onClick={() => rateReview('again')}>Again <small>10 min</small></button><button type="button" className="rating-hard" onClick={() => rateReview('hard')}>Hard <small>1+ day</small></button><button type="button" className="rating-good" onClick={() => rateReview('good')}>Good <small>Next interval</small></button><button type="button" className="rating-easy" onClick={() => rateReview('easy')}>Easy <small>Longer interval</small></button></div>}<div className="study-navigation"><button onClick={() => moveStudy(studyIndex - 1)} disabled={studyIndex === 0}>← Previous</button><button onClick={shuffleStudy}>Shuffle cards</button><button onClick={() => moveStudy(studyIndex + 1)}>{studyIndex === studyDeck.length - 1 ? 'Finish' : 'Next →'}</button></div></div></section></div>}
    </main>
  );
}
