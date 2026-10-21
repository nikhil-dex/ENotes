'use client';

import { useState } from 'react';

function unique(items) {
  return [...new Set((items || []).filter(Boolean))];
}

export default function EnglishWordExplainer() {
  const [expanded, setExpanded] = useState(false);
  const [word, setWord] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function explainWord(event) {
    event.preventDefault();
    const query = word.trim().toLowerCase();
    if (!query) {
      setError('Enter an English word to look up.');
      return;
    }
    if (!/^[a-z]+(?:['-][a-z]+)*$/i.test(query)) {
      setError('Please enter a single English word using letters, apostrophes, or hyphens.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch(`/api/word-meaning?word=${encodeURIComponent(query)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data) || !data.length) {
        throw new Error('No definition found. Check the spelling or try another word.');
      }

      const entries = data.map((entry) => ({
        word: entry.word || query,
        phonetic: entry.phonetic || entry.phonetics?.find((item) => item.text)?.text || '',
        meanings: (entry.meanings || []).map((meaning) => ({
          partOfSpeech: meaning.partOfSpeech || 'Meaning',
          definitions: (meaning.definitions || [])
            .filter((definition) => definition.definition)
            .slice(0, 4)
            .map((definition) => ({
              definition: definition.definition,
              example: definition.example || '',
            })),
          synonyms: unique([
            ...(meaning.synonyms || []),
            ...((meaning.definitions || []).flatMap((definition) => definition.synonyms || [])),
          ]).slice(0, 8),
        })).filter((meaning) => meaning.definitions.length),
      }));
      setResult(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not look up that word right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="word-explainer" aria-labelledby="word-explainer-title">
      <div className="word-explainer-header">
        <div className="word-explainer-heading">
          <p className="eyebrow">BUILD YOUR VOCABULARY</p>
          <h2 id="word-explainer-title">English word explorer</h2>
          <p>Look up an English word and explore its meanings, usage, and related words.</p>
        </div>
        <button
          type="button"
          className="word-explainer-toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls="word-explainer-content"
        >
          <span aria-hidden="true">{expanded ? '−' : '+'}</span> {expanded ? 'Collapse' : 'Open explorer'}
        </button>
      </div>

      {expanded && (
        <div id="word-explainer-content" className="word-explainer-content">
          <form className="word-explainer-form" onSubmit={explainWord}>
            <label htmlFor="english-word-input">English word</label>
            <div className="word-explainer-input-row">
              <input
                id="english-word-input"
                type="text"
                value={word}
                onChange={(event) => setWord(event.target.value)}
                placeholder="e.g. resilient, elaborate, curious"
                autoComplete="off"
                maxLength={80}
              />
              <button type="submit" disabled={loading || !word.trim()}>
                {loading ? 'Looking up…' : 'Explain word →'}
              </button>
            </div>
            <p className="word-explainer-hint">Get clear definitions, parts of speech, example sentences, and synonyms when available.</p>
          </form>

          {error && <p className="word-explainer-error" role="alert">{error}</p>}
          {loading && <div className="word-explainer-loading" role="status">Finding the meanings…</div>}

          {result && (
            <div className="word-explainer-result" aria-live="polite">
              <div className="word-explainer-wordline">
                <div>
                  <h3>{result[0]?.word || word}</h3>
                  {result[0]?.phonetic && <span className="word-explainer-phonetic">{result[0].phonetic}</span>}
                </div>
                <span className="word-explainer-result-label">WORD GUIDE</span>
              </div>
              {result.map((entry, entryIndex) => (
                <div key={`${entry.word}-${entryIndex}`}>
                  {entry.meanings.map((meaning, meaningIndex) => (
                    <section className="word-explainer-meaning" key={`${meaning.partOfSpeech}-${meaningIndex}`}>
                      <h4>{meaning.partOfSpeech}</h4>
                      <ol>
                        {meaning.definitions.map((definition, definitionIndex) => (
                          <li key={definitionIndex}>
                            <p>{definition.definition}</p>
                            {definition.example && <blockquote>“{definition.example}”</blockquote>}
                          </li>
                        ))}
                      </ol>
                      {meaning.synonyms.length > 0 && (
                        <div className="word-explainer-synonyms">
                          <strong>Related words</strong>
                          <div>{meaning.synonyms.map((synonym) => <span key={synonym}>{synonym}</span>)}</div>
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              ))}
              <p className="word-explainer-source">Definitions provided by Free Dictionary API.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
