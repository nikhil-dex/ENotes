const TAG_PATTERN = /^[\p{L}\p{N} ._+-]+$/u;

export function normalizeSavedLink(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { error: 'Enter valid link details.' };
  }

  const title = String(data.title || '').trim();
  const rawUrl = String(data.url || '').trim();
  const description = String(data.description || '').trim();
  const category = String(data.category || '').trim();
  const rawTags = data.tags === undefined ? [] : data.tags;

  if (!title || title.length > 120) {
    return { error: 'Title is required and must be 120 characters or fewer.' };
  }
  if (!rawUrl || rawUrl.length > 2048) {
    return { error: 'Enter a URL no longer than 2048 characters.' };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return { error: 'Enter a valid URL, including https:// or http://.' };
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
    return { error: 'Only HTTP and HTTPS links are allowed.' };
  }
  if (description.length > 500) return { error: 'Description must be 500 characters or fewer.' };
  if (category.length > 40) return { error: 'Category must be 40 characters or fewer.' };
  if (!Array.isArray(rawTags)) return { error: 'Tags must be a list.' };

  const tags = [...new Set(rawTags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
  if (tags.length > 10 || tags.some((tag) => tag.length > 24 || !TAG_PATTERN.test(tag))) {
    return { error: 'Use up to 10 tags, each no longer than 24 characters.' };
  }

  return {
    value: {
      title,
      url: parsedUrl.toString(),
      description,
      category,
      tags,
    },
  };
}
