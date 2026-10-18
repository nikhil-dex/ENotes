'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteNavbar from '../components/site-navbar';

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

const emptyForm = { title: '', url: '', description: '', category: '', tags: '' };

function hostName(value) {
  try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return value; }
}

export default function SavedLinksPage() {
  const [links, setLinks] = useState([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await readResponse(await fetch('/api/saved-links', { cache: 'no-store' }));
      setLinks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Could not load saved links.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  const visibleLinks = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return links;
    return links.filter((link) => [link.title, link.url, link.description, link.category, ...(link.tags || [])]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [links, query]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
    setError('');
    setMessage('');
  }

  function startEdit(link) {
    setEditingId(link.id);
    setForm({ title: link.title || '', url: link.url || '', description: link.description || '',
      category: link.category || '', tags: (link.tags || []).join(', ') });
    setFormOpen(true);
    setError('');
    setMessage('');
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function submitForm(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    const payload = { ...form, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) };
    try {
      const response = await fetch('/api/saved-links', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { ...payload, id: editingId } : payload),
      });
      const result = await readResponse(response);
      if (editingId) setLinks((current) => current.map((link) => link.id === editingId ? result : link));
      else setLinks((current) => [...current, result].sort((a, b) => (a.order || 0) - (b.order || 0)));
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setMessage(editingId ? 'Link updated.' : 'Link saved.');
    } catch (err) {
      setError(err.message || 'Could not save this link.');
    } finally {
      setSaving(false);
    }
  }

  async function copyLink(link) {
    setBusyId(link.id);
    setMessage('');
    setError('');
    try {
      await navigator.clipboard.writeText(link.url);
      setMessage('URL copied to clipboard.');
    } catch {
      setError('Clipboard access was blocked. You can copy the URL from the link details.');
    } finally {
      setBusyId('');
    }
  }

  async function deleteLink(link) {
    if (!window.confirm('Delete “' + link.title + '”? This cannot be undone.')) return;
    setBusyId(link.id);
    setError('');
    setMessage('');
    try {
      await readResponse(await fetch('/api/saved-links?id=' + encodeURIComponent(link.id), { method: 'DELETE' }));
      setLinks((current) => current.filter((item) => item.id !== link.id).map((item, order) => ({ ...item, order })));
      setMessage('Link deleted.');
    } catch (err) {
      setError(err.message || 'Could not delete this link.');
    } finally {
      setBusyId('');
    }
  }

  async function moveLink(link, direction) {
    const index = links.findIndex((item) => item.id === link.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= links.length || busyId) return;
    const reordered = [...links];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setLinks(reordered.map((item, order) => ({ ...item, order })));
    setBusyId('reordering');
    setError('');
    setMessage('');
    try {
      await readResponse(await fetch('/api/saved-links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: reordered.map((item) => item.id) }),
      }));
      setMessage('Order updated.');
    } catch (err) {
      setError(err.message || 'Could not reorder links.');
      await loadLinks();
    } finally {
      setBusyId('');
    }
  }

  return (
    <main className="shell saved-links-shell">
      <SiteNavbar />
      <section className="saved-links-hero">
        <div>
          <p className="eyebrow">YOUR PERSONAL LINK LIBRARY</p>
          <h1>Saved <span>links.</span></h1>
          <p className="saved-links-lead">Keep useful websites, docs, tools, and references one tap away.</p>
        </div>
        <button className="add-button saved-links-add" type="button" onClick={startCreate}>
          <span aria-hidden="true">＋</span> Save a link
        </button>
      </section>

      <section className="saved-links-toolbar" aria-label="Saved links tools">
        <label className="saved-links-search">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, URL, category, or tag…" aria-label="Search saved links" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}
        </label>
        <span className="saved-links-count">{visibleLinks.length} {visibleLinks.length === 1 ? 'LINK' : 'LINKS'}{query ? ' FOUND' : ' SAVED'}</span>
      </section>

      {(error || message) && !formOpen && <p className={'saved-links-feedback' + (error ? ' is-error' : '')} role="status">{error || message}</p>}

      {formOpen && (
        <section className="saved-link-form-panel" aria-labelledby="saved-link-form-title">
          <div className="saved-link-form-heading">
            <div>
              <p className="eyebrow">{editingId ? 'UPDATE RESOURCE' : 'ADD TO YOUR LIBRARY'}</p>
              <h2 id="saved-link-form-title">{editingId ? 'Edit saved link' : 'Save a new link'}</h2>
            </div>
            <button className="saved-link-close" type="button" onClick={closeForm} disabled={saving} aria-label="Close form">×</button>
          </div>
          <form onSubmit={submitForm} className="saved-link-form">
            <label>Title <input required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. React documentation" /></label>
            <label>URL <input required type="url" maxLength={2048} value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://example.com" /></label>
            <label className="saved-link-wide">Description <textarea maxLength={500} rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What do you use this link for?" /></label>
            <label>Category <input maxLength={40} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Development, Learning…" /></label>
            <label>Tags <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="docs, frontend, reference" /><span className="saved-link-hint">Separate tags with commas (up to 10).</span></label>
            {error && <p className="saved-links-feedback is-error saved-link-wide" role="alert">{error}</p>}
            <div className="saved-link-form-actions saved-link-wide">
              <button className="saved-links-secondary" type="button" onClick={closeForm} disabled={saving}>Cancel</button>
              <button className="add-button" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Save link'}</button>
            </div>
          </form>
        </section>
      )}

      {loading ? (
        <div className="saved-links-empty"><span className="saved-links-empty-icon">◌</span><h2>Loading your links</h2><p>Fetching your saved resources…</p></div>
      ) : visibleLinks.length ? (
        <section className="saved-links-grid" aria-label="Saved links">
          {visibleLinks.map((link) => {
            const orderIndex = links.findIndex((item) => item.id === link.id);
            return (
              <article className="saved-link-card" key={link.id}>
                <div className="saved-link-card-top">
                  <span className="saved-link-favicon" aria-hidden="true">{hostName(link.url).slice(0, 1).toUpperCase()}</span>
                  <span className="saved-link-domain">{hostName(link.url)}</span>
                  {link.category && <span className="saved-link-category">{link.category}</span>}
                </div>
                <h2>{link.title}</h2>
                {link.description && <p className="saved-link-description">{link.description}</p>}
                <a className="saved-link-url" href={link.url} target="_blank" rel="noopener noreferrer" title={link.url}>{link.url}</a>
                {link.tags && link.tags.length > 0 && <div className="saved-link-tags">{link.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
                <div className="saved-link-card-actions">
                  <a className="saved-link-open" href={link.url} target="_blank" rel="noopener noreferrer">Open <span aria-hidden="true">↗</span></a>
                  <button type="button" onClick={() => copyLink(link)} disabled={Boolean(busyId)} title="Copy URL">{busyId === link.id ? '…' : 'Copy'}</button>
                  <button type="button" onClick={() => startEdit(link)} disabled={Boolean(busyId)} title="Edit link">Edit</button>
                  <button type="button" onClick={() => moveLink(link, -1)} disabled={Boolean(busyId) || orderIndex === 0} title="Move up" aria-label={'Move ' + link.title + ' up'}>↑</button>
                  <button type="button" onClick={() => moveLink(link, 1)} disabled={Boolean(busyId) || orderIndex === links.length - 1} title="Move down" aria-label={'Move ' + link.title + ' down'}>↓</button>
                  <button className="saved-link-delete" type="button" onClick={() => deleteLink(link)} disabled={Boolean(busyId)} title="Delete link" aria-label={'Delete ' + link.title}>×</button>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="saved-links-empty">
          <span className="saved-links-empty-icon" aria-hidden="true">↗</span>
          <h2>{query ? 'No matching links' : 'Your link library starts here'}</h2>
          <p>{query ? 'Try another search term.' : 'Save docs, tools, tutorials, and useful websites so you can find them whenever you need them.'}</p>
          {!query && <button className="add-button" type="button" onClick={startCreate}>＋ Save your first link</button>}
        </div>
      )}

      <footer><span>Useful things, never far away.</span><span>ENOTES · SAVED LINKS</span></footer>
    </main>
  );
}
