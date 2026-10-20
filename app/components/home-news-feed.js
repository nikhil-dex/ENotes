'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const REFRESH_MS = 5 * 60 * 1000;

function timeAgo(value) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return 'Recently';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function HomeNewsFeed() {
  const [stories, setStories] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError('');
    try {
      const response = await fetch('/api/news', { cache: 'no-store' });
      if (!response.ok) throw new Error('News is temporarily unavailable.');
      const data = await response.json();
      if (!Array.isArray(data.stories)) throw new Error('The news feed returned an unexpected response.');
      setStories(data.stories);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load news right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const visibleStories = useMemo(
    () => stories.filter((story) => filter === 'all' || story.category === filter),
    [stories, filter]
  );

  return (
    <section className="home-news" aria-labelledby="home-news-title">
      <div className="home-news-header">
        <div className="home-news-heading-copy">
          <p className="eyebrow">YOUR WORLD, AT A GLANCE</p>
          <h1 id="home-news-title">India &amp; tech, <span>in the know.</span></h1>
          <p className="home-news-lead">Indian headlines, politics, and technology stories from around the world.</p>
        </div>
        <button className="home-news-refresh" type="button" onClick={() => refresh(true)} disabled={refreshing || loading} aria-label="Refresh news now">
          <span aria-hidden="true" className={refreshing ? 'home-news-refresh-icon is-spinning' : 'home-news-refresh-icon'}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="home-news-toolbar">
        <div className="home-news-filters" role="group" aria-label="Filter news">
          <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>Top stories</button>
          <button type="button" className={filter === 'india' ? 'is-active' : ''} onClick={() => setFilter('india')}>India &amp; politics</button>
          <button type="button" className={filter === 'tech' ? 'is-active' : ''} onClick={() => setFilter('tech')}>World tech</button>
        </div>
        <span className="home-news-auto"><span className="home-news-live-dot" /> Auto-refreshes every 5 min</span>
      </div>

      {error && <p className="home-news-error" role="status">{error} <button type="button" onClick={() => refresh(true)}>Try again</button></p>}
      {loading && !stories.length ? (
        <div className="home-news-loading" role="status"><span className="home-news-spinner" /> Loading latest headlines…</div>
      ) : visibleStories.length ? (
        <div className="home-news-grid">
          {visibleStories.map((story) => (
            <article className="home-news-card" key={story.id}>
              <div className="home-news-card-meta">
                <span className={story.category === 'india' ? 'home-news-category india' : 'home-news-category tech'}>{story.category === 'india' ? 'INDIA' : 'WORLD TECH'}</span>
                <span>{timeAgo(story.publishedAt)}</span>
              </div>
              <h2><a href={story.url} target="_blank" rel="noopener noreferrer">{story.title}</a></h2>
              <div className="home-news-card-footer">
                <span className="home-news-source">{story.source || 'News source'}</span>
                <a href={story.url} target="_blank" rel="noopener noreferrer" aria-label={`Read ${story.title}`}>Read story ↗</a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="home-news-empty">No stories in this category right now. Try refreshing or choosing another category.</div>
      )}

      <div className="home-news-footer">
        <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Headlines may change as publishers update their feeds.'}</span>
        <span>Stories open on their original publisher · Headlines via Google News RSS</span>
      </div>
    </section>
  );
}
