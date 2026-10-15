'use client';

import { useState } from 'react';

export default function AccessPage() {
  const [accessKey, setAccessKey] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/access/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not verify the access string.');
      window.location.replace('/');
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card} aria-labelledby="access-title">
        <div style={styles.mark} aria-hidden="true">N</div>
        <p style={styles.eyebrow}>PRIVATE STUDY SPACE</p>
        <h1 id="access-title" style={styles.title}>Welcome to <span style={styles.accent}>ENotes.</span></h1>
        <p style={styles.description}>Enter your access string to open your notes.</p>

        <form onSubmit={submit} style={styles.form}>
          <label htmlFor="access-key" style={styles.label}>Access string</label>
          <input
            id="access-key"
            name="accessKey"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            maxLength={256}
            value={accessKey}
            onChange={(event) => setAccessKey(event.target.value)}
            placeholder="Enter your secret string"
            style={styles.input}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'access-error' : undefined}
          />
          {error && <p id="access-error" role="alert" style={styles.error}>{error}</p>}
          <button type="submit" disabled={submitting || !accessKey} style={{ ...styles.button, opacity: submitting || !accessKey ? 0.7 : 1 }}>
            {submitting ? 'Checking…' : 'Unlock ENotes'}
            <span aria-hidden="true">→</span>
          </button>
        </form>
        <p style={styles.footer}><span style={styles.lock} aria-hidden="true">◆</span> Shared-key access · No account required</p>
      </section>
    </main>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: 'var(--paper, #fcfdfb)' },
  card: { width: '100%', maxWidth: '430px', padding: '38px', background: 'var(--paper, #fff)', border: '1px solid var(--line, #e8ece9)', borderRadius: '16px', boxShadow: '0 24px 80px rgba(30, 55, 40, 0.09)' },
  mark: { display: 'grid', placeItems: 'center', width: '42px', height: '42px', borderRadius: '12px', background: 'var(--green, #40795e)', color: '#fff', fontFamily: 'var(--display, sans-serif)', fontWeight: 800, fontSize: '20px', marginBottom: '30px' },
  eyebrow: { fontFamily: 'var(--mono, monospace)', fontSize: '10px', letterSpacing: '1.5px', color: 'var(--green, #40795e)', margin: '0 0 12px' },
  title: { fontFamily: 'var(--display, sans-serif)', fontSize: '30px', lineHeight: 1.2, letterSpacing: '-1.2px', margin: 0, color: 'var(--ink, #1e2925)' },
  accent: { color: 'var(--green, #40795e)' },
  description: { fontSize: '14px', lineHeight: 1.6, color: 'var(--muted, #84908a)', margin: '12px 0 28px' },
  form: { display: 'grid', gap: '10px' },
  label: { fontSize: '12px', fontWeight: 600, color: 'var(--ink, #1e2925)' },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid var(--line, #dfe6e1)', borderRadius: '8px', padding: '13px 14px', font: '14px var(--sans, sans-serif)', color: 'var(--ink, #1e2925)', background: 'transparent', outlineColor: 'var(--green, #40795e)' },
  error: { margin: '0', color: '#b42318', fontSize: '12px', lineHeight: 1.5 },
  button: { marginTop: '5px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '13px 15px', border: 0, borderRadius: '8px', background: 'var(--green, #40795e)', color: '#fff', font: '600 13px var(--sans, sans-serif)', cursor: 'pointer' },
  footer: { margin: '25px 0 0', textAlign: 'center', fontSize: '11px', color: 'var(--muted, #84908a)' },
  lock: { fontSize: '8px', marginRight: '7px', color: 'var(--green, #40795e)' },
};
