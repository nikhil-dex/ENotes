'use client';
import { useState } from 'react';

export default function GeminiNoteCleanup({ heading, answer, disabled = false, onApply }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const suggestionIsStale = Boolean(suggestion && (heading !== suggestion.originalHeading || answer !== suggestion.originalAnswer));

  async function cleanUp() {
    if (!heading.trim() || !answer.trim()) {
      setError('Add a heading and some note content before asking Gemini to improve it.');
      return;
    }
    setLoading(true);
    setError('');
    setSuggestion(null);
    try {
      const response = await fetch('/api/ai/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ heading, answer }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Gemini could not improve this note. Please try again.');
      if (typeof data.heading !== 'string' || typeof data.answer !== 'string') throw new Error('Gemini returned an unexpected response. Please try again.');
      setSuggestion({ originalHeading: heading, originalAnswer: answer, heading: data.heading, answer: data.answer });
    } catch (caught) {
      setError(caught.message || 'Could not reach Gemini. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function applySuggestion() {
    if (!suggestion) return;
    if (heading !== suggestion.originalHeading || answer !== suggestion.originalAnswer) {
      setSuggestion(null);
      setError('Your note changed after this suggestion was generated. Run cleanup again to avoid overwriting your newer edits.');
      return;
    }
    onApply?.({ heading: suggestion.heading, answer: suggestion.answer });
    setSuggestion(null);
    setError('');
  }

  return (
    <section className="gemini-cleanup" aria-label="Gemini note cleanup">
      <style>{'.gemini-cleanup{margin:14px 0 4px;padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink)}.gemini-cleanup-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.gemini-cleanup-title{margin:0;font:700 13px var(--sans)}.gemini-cleanup-description{margin:5px 0 0;color:var(--muted);font:12px/1.55 var(--sans)}.gemini-cleanup-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:10px 14px;border:1px solid var(--green);border-radius:8px;background:var(--green);color:#fff;font:700 12px var(--sans);cursor:pointer;touch-action:manipulation}.gemini-cleanup-button:disabled{opacity:.55;cursor:wait}.gemini-cleanup-error{margin:10px 0 0;color:#b42318;font:12px/1.5 var(--sans)}.gemini-review{margin-top:14px}.gemini-review-heading{margin:0 0 8px;font:700 12px var(--sans)}.gemini-review-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.gemini-review-panel{min-width:0;padding:11px;border:1px solid var(--line);border-radius:8px;background:var(--paper)}.gemini-review-panel h5{margin:0 0 7px;color:var(--muted);font:700 10px var(--sans);letter-spacing:.08em;text-transform:uppercase}.gemini-review-panel strong{display:block;margin-bottom:8px;font:700 13px/1.45 var(--sans);overflow-wrap:anywhere}.gemini-review-content{max-height:240px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.65 var(--mono)}.gemini-review-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:10px}.gemini-review-actions button{min-height:40px;padding:9px 13px;border:1px solid var(--line);border-radius:7px;background:var(--paper);color:var(--ink);font:600 12px var(--sans);cursor:pointer}.gemini-review-actions .apply{border-color:var(--green);background:var(--green);color:#fff}.gemini-cleanup-note{margin:9px 0 0;color:var(--muted);font:11px/1.5 var(--sans)}@media(max-width:650px){.gemini-cleanup{padding:11px}.gemini-cleanup-top{align-items:stretch}.gemini-cleanup-button{width:100%}.gemini-review-grid{grid-template-columns:minmax(0,1fr)}.gemini-review-content{max-height:180px}.gemini-review-actions{display:grid;grid-template-columns:1fr 1fr}.gemini-review-actions button{width:100%}}'}</style>
      <div className="gemini-cleanup-top">
        <div>
          <p className="gemini-cleanup-title">✦ Improve with Gemini</p>
          <p className="gemini-cleanup-description">Fix spelling and structure Markdown while keeping your technical meaning intact.</p>
        </div>
        <button className="gemini-cleanup-button" type="button" onClick={cleanUp} disabled={disabled || loading}>
          {loading ? 'Improving note…' : '✦ Clean up my notes'}
        </button>
      </div>
      <p className="gemini-cleanup-note">Your draft is sent to the app’s server-side Gemini integration. Nothing changes or saves until you review and apply the suggestion.</p>
      {error && <p className="gemini-cleanup-error" role="alert">{error}</p>}
      {suggestion && <div className="gemini-review">
        <p className="gemini-review-heading">Review suggestion before applying</p>
        <div className="gemini-review-grid">
          <div className="gemini-review-panel"><h5>Original draft</h5><strong>{suggestion.originalHeading}</strong><div className="gemini-review-content">{suggestion.originalAnswer}</div></div>
          <div className="gemini-review-panel"><h5>Gemini suggestion</h5><strong>{suggestion.heading}</strong><div className="gemini-review-content">{suggestion.answer}</div></div>
        </div>
        <p className="gemini-cleanup-note">Review code, commands, formulas, and technical facts before applying.</p>
        {suggestionIsStale && <p className="gemini-cleanup-error" role="alert">Your note has changed since this suggestion was generated. Run cleanup again before applying.</p>}
        <div className="gemini-review-actions">
          <button type="button" onClick={() => setSuggestion(null)}>Cancel</button>
          <button type="button" className="apply" onClick={applySuggestion} disabled={suggestionIsStale}>Apply to draft</button>
        </div>
      </div>}
    </section>
  );
}
