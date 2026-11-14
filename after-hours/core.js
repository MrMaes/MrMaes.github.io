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

export function normalizeJournalData(data) {
  if (!data || data.format !== 'after-hours-journal' || !data.settings || (data.entries != null && !Array.isArray(data.entries))) {
    throw new Error('The notebook file needs a small repair. Its saved content has not been changed.');
  }
  // The CMS omits empty fields when saving. Empty content remains empty; never restore starter text.
  const settings = {
    ...data.settings,
    tagline: data.settings.tagline ?? '',
    about: data.settings.about ?? '',
    bikeName: data.settings.bikeName ?? '',
    garageIntro: data.settings.garageIntro ?? '',
    nowIntro: data.settings.nowIntro ?? '',
    garageSections: data.settings.garageSections ?? [],
    nowItems: data.settings.nowItems ?? [],
  };
  if (typeof settings.title !== 'string' || !Array.isArray(settings.garageSections) || !Array.isArray(settings.nowItems) ||
    settings.garageSections.some(section => !section || typeof section.title !== 'string' || (section.items != null && !Array.isArray(section.items))) ||
    settings.nowItems.some(item => !item || typeof item.label !== 'string' || (item.text != null && typeof item.text !== 'string'))) {
    throw new Error('The journal details could not be read. Please check content.json.');
  }
  settings.garageSections = settings.garageSections.map(section => ({...section, items: section.items ?? []}));
  settings.nowItems = settings.nowItems.map(item => ({...item, text: item.text ?? ''}));
  const entries = (data.entries ?? []).filter(entry => entry && entry.status === 'published').map(entry => ({
    ...entry,
    // Older entries keep their original links. The visual editor creates a stable UUID for new notes.
    id: entry.id || entry.key,
    body: entry.body ?? '',
    photos: entry.photos ?? [],
    createdAt: entry.createdAt || `${entry.date}T12:00:00Z`,
    updatedAt: entry.updatedAt || entry.createdAt || `${entry.date}T12:00:00Z`,
  }));
  const ids = new Set();
  for (const entry of entries) {
    if (typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) ||
      typeof entry.title !== 'string' || typeof entry.body !== 'string' ||
      !['Life', 'Garage', 'Pursuits'].includes(entry.category) || !dateLabel(entry.date) || !Array.isArray(entry.photos) ||
      entry.photos.some(photo => !photo || typeof photo.url !== 'string' || (photo.alt != null && typeof photo.alt !== 'string'))) {
      throw new Error('One of the journal entries could not be read. Please check content.json.');
    }
    ids.add(entry.id);
  }
  return {...data, settings, entries};
}

export async function loadPublicData() {
  const response = await fetch(`${BASE}content.json`, {cache: 'no-store'});
  if (!response.ok) throw new Error('The notebook could not be loaded. Please try again in a moment.');
  return normalizeJournalData(await response.json());
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
