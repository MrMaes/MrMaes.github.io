import { BASE, escapeHtml, dateLabel } from './core.js';

const EDITOR_BASE = 'https://app.pagescms.org/MrMaes/MrMaes.github.io/main';
export const EDITOR_URL = `${EDITOR_BASE}/file/journal`;
export const EDITOR_LINKS = {
  entries: EDITOR_URL,
  details: `${EDITOR_BASE}/file/details`,
  photos: `${EDITOR_BASE}/media/default`,
};

const STORAGE_KEY = 'after-hours-github-writing-desk-v2';
const escape = value => escapeHtml(String(value ?? ''));
const text = value => typeof value === 'string' ? value : '';
const object = value => value && typeof value === 'object' && !Array.isArray(value);

/** Read the former writing desk without changing or removing any saved work. */
export function readEarlierDrafts(storage) {
  let raw = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { notes: [], workspace: null, raw: null, error: '' };
    const workspace = JSON.parse(raw);
    if (!object(workspace)) return { notes: [], workspace: null, raw, error: 'The saved draft data could not be opened. You can download an unchanged copy below.' };
    const notes = new Map();
    const add = (key, item) => {
      if (!object(item) || !object(item.entry)) return;
      const entry = item.entry;
      const id = text(entry.id) || key;
      if (notes.has(id)) return;
      notes.set(id, {
        id,
        title: text(entry.title) || 'A small moment',
        body: text(entry.body),
        date: text(entry.date),
        category: text(entry.category),
        photos: Array.isArray(entry.photos) ? entry.photos.filter(object).map(photo => ({url: text(photo.url), alt: text(photo.alt)})) : [],
      });
    };
    if (object(workspace.drafts)) Object.entries(workspace.drafts).forEach(([key, item]) => add(key, item));
    if (object(workspace.changes)) Object.entries(workspace.changes).forEach(([key, item]) => add(key, item));
    return { notes: [...notes.values()], workspace, raw, error: '' };
  } catch {
    return { notes: [], workspace: null, raw, error: raw ? 'The saved draft data could not be opened. You can download an unchanged copy below.' : 'This browser is not allowing access to its saved drafts. No saved data has been changed.' };
  }
}

export function draftText(note) {
  const parts = [note.title];
  if (note.date) parts.push(`Date: ${note.date}`);
  if (note.category) parts.push(`Filed under: ${note.category}`);
  if (note.body) parts.push('', note.body);
  if (note.photos?.length) parts.push('', 'Photographs:', ...note.photos.map(photo => [photo.url, photo.alt].filter(Boolean).join(' — ')));
  return parts.join('\n');
}

function saveDownload(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function earlierDraftsMarkup(saved) {
  const hasChanges = saved.notes.length || saved.workspace?.settings ||
    (object(saved.workspace?.deletions) && Object.keys(saved.workspace.deletions).length);
  if (!hasChanges && !saved.error) return '';
  return `<section class="ah-earlier-drafts" aria-labelledby="earlier-drafts-heading">
    <div class="ah-section-line"><div><p class="ah-section-label">From your earlier writing desk</p><h2 id="earlier-drafts-heading">Your drafts are still here.</h2></div>${saved.raw ? '<button type="button" class="ah-button-quiet" data-action="backup">Download private backup</button>' : ''}</div>
    ${saved.error ? `<p class="ah-error" role="alert">${escape(saved.error)}</p>` : '<p class="ah-help">These notes were saved in this browser. Open a draft to copy its words into the new editor, or keep a backup on your device.</p>'}
    ${saved.notes.map((note, index) => `<details class="ah-saved-draft"><summary><span>${escape(note.title)}</span><small>${escape([dateLabel(note.date), note.category].filter(Boolean).join(' · '))}</small></summary><div class="ah-saved-draft-body"><label class="ah-field"><span>Saved draft text</span><textarea readonly rows="9" data-draft-text="${index}" aria-label="Saved draft: ${escape(note.title)}">${escape(draftText(note))}</textarea></label><button type="button" class="ah-button-secondary" data-action="copy-draft" data-index="${index}">Copy this draft</button></div></details>`).join('')}
    ${saved.workspace?.settings ? '<p class="ah-help">Your saved journal details are also preserved in the private backup.</p>' : ''}
    ${saved.raw ? '<p class="ah-help">Keep this backup on your device. It may contain unpublished writing.</p>' : ''}
    <p class="ah-status" data-draft-status role="status" aria-live="polite"></p>
  </section>`;
}

export function mountStudio(root, data) {
  let saved;
  try { saved = readEarlierDrafts(window.localStorage); }
  catch { saved = {notes: [], workspace: null, raw: null, error: 'This browser is not allowing access to its saved drafts. No saved data has been changed.'}; }
  const title = text(data?.settings?.title) || 'After Hours';
  root.innerHTML = `<section class="ah-studio-header">
    <div><p class="ah-section-label">For the keeper of this notebook</p><h1>The writing desk.</h1><p>A photograph, a few words. That counts.</p></div>
    <a class="ah-backlink" href="${escape(BASE)}">Read the journal</a>
  </section>
  <section class="ah-desk-invitation" aria-labelledby="desk-heading">
    <div class="ah-desk-invitation-copy"><p class="ah-section-label">Make a little room</p><h2 id="desk-heading">Keep the<br>good things.</h2><p>Write a note, add your photographs, and save. Once connected, the editor sends your changes to GitHub and ${escape(title)} updates automatically.</p><a class="ah-button ah-open-editor" href="${escape(EDITOR_URL)}" target="_blank" rel="noopener">Open the editor <span aria-hidden="true">↗</span></a><p class="ah-help ah-editor-byline">Pages CMS · Sign in with GitHub</p></div>
    <aside class="ah-desk-side-note"><p class="ah-section-label">A note at a time</p><ol><li><span>01</span><div><h3>Choose a page.</h3><p>A new memory, a small change, or something on your mind.</p></div></li><li><span>02</span><div><h3>Make it yours.</h3><p>A title, a few words, and photographs straight from your device.</p></div></li><li><span>03</span><div><h3>Save it.</h3><p>The editor handles the GitHub update. Your journal follows shortly.</p></div></li></ol></aside>
  </section>
  <nav class="ah-desk-sections" aria-label="What to edit">
    <a href="${escape(EDITOR_LINKS.entries)}" target="_blank" rel="noopener"><span class="ah-section-label">01 / The notebook</span><h2>Journal entries <span aria-hidden="true">↗</span></h2><p>Add a note or revisit a story. Keep dates, categories, and photographs together.</p></a>
    <a href="${escape(EDITOR_LINKS.details)}" target="_blank" rel="noopener"><span class="ah-section-label">02 / Here, lately</span><h2>Journal details <span aria-hidden="true">↗</span></h2><p>Update the Garage, your current interests, and the introductions around the site.</p></a>
    <a href="${escape(EDITOR_LINKS.photos)}" target="_blank" rel="noopener"><span class="ah-section-label">03 / Collected moments</span><h2>Photographs <span aria-hidden="true">↗</span></h2><p>Upload and choose images in the editor, then give each one a few words.</p></a>
  </nav>
  <details class="ah-desk-connection"><summary>First visit? Connect your editor.</summary><div><ol><li>Sign in to Pages CMS with your <strong>MrMaes</strong> GitHub account.</li><li>When GitHub asks, choose <strong>Only select repositories</strong> and select <strong>MrMaes.github.io</strong>.</li><li>Open that repository in Pages CMS, choose the <strong>main</strong> branch, and open the journal section you want to edit.</li></ol><p class="ah-help">GitHub grants access to the whole selected repository, which also contains your teaching website. The editing forms are configured for After Hours.</p><p class="ah-help">Saving content or uploading photos in the connected editor sends them to your public repository. Keep private writing in your own notes until you are ready to share it.</p></div></details>
  ${earlierDraftsMarkup(saved)}`;

  root.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    if (!button || !root.contains(button)) return;
    const status = root.querySelector('[data-draft-status]');
    if (button.dataset.action === 'backup' && saved.raw) {
      if (saved.workspace) {
        const backup = {format: 'after-hours-private-backup', version: 2, savedAt: new Date().toISOString(), workspace: saved.workspace};
        saveDownload('after-hours-private-backup.json', JSON.stringify(backup, null, 2) + '\n', 'application/json');
      } else saveDownload('after-hours-saved-draft-data.txt', saved.raw, 'text/plain');
      if (status) status.textContent = 'Backup downloaded. Your saved drafts are still in this browser.';
    } else if (button.dataset.action === 'copy-draft') {
      const index = Number(button.dataset.index);
      const note = saved.notes[index];
      if (!note) return;
      try {
        await navigator.clipboard.writeText(draftText(note));
        if (status) status.textContent = 'Draft copied. You can paste it into the new editor.';
      } catch {
        const area = root.querySelector(`[data-draft-text="${index}"]`);
        area?.focus();
        area?.select();
        if (status) status.textContent = 'Your draft text is selected. Copy it with your keyboard.';
      }
    }
  });
}
