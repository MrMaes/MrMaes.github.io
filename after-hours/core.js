export const BASE = new URL('./', import.meta.url).pathname;

export function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

export function paragraphs(value = '') {
  return String(value).split(/\n\s*\n/).filter(part => part.trim())
    .map(part => `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`).join('');
}

export function dateLabel(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return '';
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.valueOf())) return '';
  return date.toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  });
}

export function entryUrl(id) {
  return `${BASE}entry/?id=${encodeURIComponent(String(id))}`;
}

export function photoUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const candidate = value.trim();
  if (/^data:image\/(?:jpeg|png|webp|gif);base64,[a-z0-9+/=]+$/i.test(candidate)) return candidate;
  if (candidate.startsWith('blob:')) return candidate;
  try {
    const url = new URL(candidate, new URL('./', import.meta.url));
    const ownOrigin = new URL(import.meta.url).origin;
    if (url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === ownOrigin)) return url.href;
  } catch { /* Invalid image addresses are omitted. */ }
  return '';
}

export async function loadPublicData() {
  const response = await fetch(`${BASE}content.json`, {cache: 'no-store'});
  if (!response.ok) throw new Error('The notebook could not be loaded. Please try again in a moment.');
  const data = await response.json();
  if (!data || data.format !== 'after-hours-journal' || !data.settings || !Array.isArray(data.entries)) {
    throw new Error('The notebook file needs a small repair. Its saved content has not been changed.');
  }
  if (typeof data.settings.title !== 'string' || !Array.isArray(data.settings.garageSections) || !Array.isArray(data.settings.nowItems)) {
    throw new Error('The journal details could not be read. Please check content.json.');
  }
  const entries = data.entries.filter(entry => entry && entry.status === 'published');
  const ids = new Set();
  for (const entry of entries) {
    if (typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) ||
      typeof entry.title !== 'string' || typeof entry.body !== 'string' ||
      !['Life', 'Garage', 'Pursuits'].includes(entry.category) || !dateLabel(entry.date) || !Array.isArray(entry.photos)) {
      throw new Error('One of the journal entries could not be read. Please check content.json.');
    }
    ids.add(entry.id);
  }
  return {...data, entries};
}

export function renderArticle(entry) {
  const title = String(entry.title || 'A small moment');
  const photos = Array.isArray(entry.photos) ? entry.photos : [];
  const gallery = photos.map((photo, index) => {
    const src = photoUrl(photo.url);
    if (!src) return '';
    return `<figure><button type="button" data-photo-index="${index}" aria-label="Enlarge photograph ${index + 1}"><img src="${escapeHtml(src)}" alt="${escapeHtml(photo.alt || `Photograph ${index + 1} from ${title}`)}" loading="${index ? 'lazy' : 'eager'}"></button>${photo.alt ? `<figcaption>${escapeHtml(photo.alt)}</figcaption>` : ''}</figure>`;
  }).join('');
  return `<div class="ah-article-meta"><span>${escapeHtml(entry.category)}</span><time datetime="${escapeHtml(entry.date)}">${escapeHtml(dateLabel(entry.date))}</time></div>
    <h1 class="ah-article-title">${escapeHtml(title)}</h1>
    ${gallery ? `<div class="ah-photo-gallery">${gallery}</div>` : ''}
    <div class="ah-article-body">${paragraphs(entry.body || '')}</div>`;
}
