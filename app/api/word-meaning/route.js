const WORD_PATTERN = /^[a-z]+(?:['-][a-z]+)*$/i;

function normalizeWiktionary(word, payload) {
  if (!payload || typeof payload !== 'object') return null;
  const groups = Array.isArray(payload) ? payload : Object.values(payload).flatMap((value) => Array.isArray(value) ? value : []);
  const meanings = groups.map((group) => {
    const definitions = (group.definitions || []).map((item) => ({
      definition: typeof item.definition === 'string' ? item.definition.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&') : '',
      example: (item.parsedExamples?.[0]?.example || item.examples?.[0]?.example || (typeof item.examples?.[0] === 'string' ? item.examples[0] : '') || '')
        .replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'),
      synonyms: Array.isArray(item.synonyms) ? item.synonyms.map((synonym) => typeof synonym === 'string' ? synonym : synonym.word).filter(Boolean) : [],
    })).filter((item) => item.definition);
    return {
      partOfSpeech: group.partOfSpeech || 'Meaning',
      definitions: definitions.slice(0, 4),
      synonyms: [...new Set(definitions.flatMap((item) => item.synonyms))].slice(0, 8),
    };
  }).filter((meaning) => meaning.definitions.length);

  return meanings.length ? [{ word, phonetic: '', meanings }] : null;
}

async function fetchWithTimeout(url) {
  return fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'OgeNotes Word Explorer/1.0 (English vocabulary helper)' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const word = (searchParams.get('word') || '').trim().toLowerCase();

  if (!word || word.length > 80 || !WORD_PATTERN.test(word)) {
    return Response.json({ error: 'Enter one valid English word.' }, { status: 400 });
  }

  // Try the primary dictionary first.
  try {
    const upstream = await fetchWithTimeout(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    const data = await upstream.json().catch(() => null);
    if (upstream.ok && Array.isArray(data) && data.length) {
      return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (upstream.status === 404) {
      // A second source may contain the word even when the primary dictionary does not.
      const fallback = await fetchWithTimeout(
        `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`
      );
      const fallbackData = await fallback.json().catch(() => null);
      const normalized = fallback.ok ? normalizeWiktionary(word, fallbackData?.en || fallbackData) : null;
      if (normalized) return Response.json(normalized, { headers: { 'Cache-Control': 'no-store' } });
      return Response.json(
        { error: 'No definition found. Check the spelling or try another word.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  } catch {
    // Continue to the fallback dictionary if the primary provider is unreachable.
  }

  // Fallback dictionary for provider errors, rate limits, or network failures.
  try {
    const fallback = await fetchWithTimeout(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`
    );
    const fallbackData = await fallback.json().catch(() => null);
    const normalized = fallback.ok ? normalizeWiktionary(word, fallbackData?.en || fallbackData) : null;
    if (normalized) return Response.json(normalized, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Both providers failed; return a helpful response below.
  }

  return Response.json(
    { error: 'Both dictionary sources are temporarily unreachable. Please try again in a moment.' },
    { status: 502, headers: { 'Cache-Control': 'no-store' } }
  );
}

export const dynamic = 'force-dynamic';
