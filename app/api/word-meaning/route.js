const WORD_PATTERN = /^[a-z]+(?:['-][a-z]+)*$/i;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const word = (searchParams.get('word') || '').trim().toLowerCase();

  if (!word || word.length > 80 || !WORD_PATTERN.test(word)) {
    return Response.json({ error: 'Enter one valid English word.' }, { status: 400 });
  }

  try {
    const upstream = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      {
        headers: { Accept: 'application/json', 'User-Agent': 'OgeNotes Word Explorer/1.0' },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      }
    );

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok || !Array.isArray(data) || !data.length) {
      return Response.json(
        { error: upstream.status === 404 ? 'No definition found. Check the spelling or try another word.' : 'The dictionary service is temporarily unavailable. Please try again.' },
        { status: upstream.status === 404 ? 404 : 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return Response.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json(
      { error: error?.name === 'TimeoutError' ? 'The dictionary took too long to respond. Please try again.' : 'Could not reach the dictionary service. Please try again.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export const dynamic = 'force-dynamic';
