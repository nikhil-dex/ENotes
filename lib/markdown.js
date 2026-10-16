function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function renderInline(value) {
  let text = escapeHtml(value);
  const code = [];
  text = text.replace(/`([^`]+)`/g, (_, content) => {
    const token = `@@CODE${code.length}@@`;
    code.push(`<code>${content}</code>`);
    return token;
  });
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  return text.replace(/@@CODE(\d+)@@/g, (_, index) => code[Number(index)] || '');
}

/**
 * Render the supported Markdown subset to escaped HTML.
 * Raw HTML is always escaped; links are limited to explicit HTTP(S) URLs.
 */
export function markdownHtml(value) {
  const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let list = [];
  let listType = '';
  let quote = [];
  let code = [];
  let inCode = false;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push(`<${listType}>${list.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${listType}>`);
      list = [];
      listType = '';
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      blocks.push(`<blockquote>${quote.map(renderInline).join('<br>')}</blockquote>`);
      quote = [];
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      flushParagraph(); flushList(); flushQuote();
      if (inCode) {
        blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = [];
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) { code.push(line); continue; }
    if (!line.trim()) { flushParagraph(); flushList(); flushQuote(); continue; }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList(); flushQuote();
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (bullet || ordered) {
      flushParagraph(); flushQuote();
      const nextType = bullet ? 'ul' : 'ol';
      if (list.length && listType !== nextType) flushList();
      listType = nextType;
      list.push((bullet || ordered)[1]);
      continue;
    }
    const quoted = line.match(/^\s*>\s?(.*)$/);
    if (quoted) {
      flushParagraph(); flushList();
      quote.push(quoted[1]);
      continue;
    }
    flushList(); flushQuote();
    paragraph.push(line);
  }

  if (inCode) blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  flushParagraph(); flushList(); flushQuote();
  return blocks.join('');
}
