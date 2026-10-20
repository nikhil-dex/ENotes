const FEEDS = [
  {
    category: 'india',
    url: 'https://news.google.com/rss/search?q=India+politics+OR+Indian+government+OR+Parliament+when%3A7d&hl=en-IN&gl=IN&ceid=IN%3Aen',
  },
  {
    category: 'india',
    url: 'https://news.google.com/rss/search?q=India+national+news+elections+policy+when%3A7d&hl=en-IN&gl=IN&ceid=IN%3Aen',
  },
  {
    category: 'tech',
    url: 'https://news.google.com/rss/search?q=global+technology+OR+artificial+intelligence+OR+semiconductors+OR+cybersecurity+when%3A7d&hl=en-US&gl=US&ceid=US%3Aen',
  },
  {
    category: 'tech',
    url: 'https://news.google.com/rss/search?q=technology+companies+AI+research+product+launch+when%3A7d&hl=en-US&gl=US&ceid=US%3Aen',
  },
];

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .trim();
}

function tagValue(xml, tag) {
  const match = xml.match(new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}\\s*>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function parseFeed(xml, category) {
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => {
    const item = match[1];
    const title = tagValue(item, 'title');
    const url = tagValue(item, 'link');
    const publishedAt = tagValue(item, 'pubDate');
    const source = tagValue(item, 'source');
    if (!title || !url || !/^https?:\/\//i.test(url)) return null;
    return {
      id: `${category}-${url}`,
      title,
      url,
      publishedAt,
      source: source || (() => {
        try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
      })(),
      category,
    };
  }).filter(Boolean);
}

export async function GET() {
  const results = await Promise.allSettled(FEEDS.map(async (feed) => {
    const response = await fetch(feed.url, {
      headers: { 'User-Agent': 'OgeNotes News Reader/1.0' },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`News feed returned ${response.status}`);
    return parseFeed(await response.text(), feed.category);
  }));

  const stories = results
    .flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));

  const unique = [];
  const seen = new Set();
  for (const story of stories) {
    const key = story.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(story);
  }

  if (!unique.length) {
    return Response.json({ stories: [], error: 'News feeds are temporarily unavailable.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return Response.json({ stories: unique.slice(0, 36), fetchedAt: new Date().toISOString() }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export const dynamic = 'force-dynamic';
