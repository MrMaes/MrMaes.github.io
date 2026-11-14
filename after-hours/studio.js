import { BASE, escapeHtml, dateLabel, entryUrl, photoUrl, loadPublicData, renderArticle } from './core.js';

const STORAGE_KEY = 'after-hours-github-writing-desk-v2';
const EDIT_URL = 'https://github.com/MrMaes/MrMaes.github.io/edit/main/after-hours/content.json';
const UPLOAD_URL = 'https://github.com/MrMaes/MrMaes.github.io/upload/main/after-hours';
const PHOTOS_URL = 'https://github.com/MrMaes/MrMaes.github.io/upload/main/after-hours/photos';
const categories = ['Life', 'Garage', 'Pursuits'];
const copy = value => JSON.parse(JSON.stringify(value));
const escape = value => escapeHtml(String(value ?? ''));
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const same = (a, b) => stable(a ?? null) === stable(b ?? null);
const meaningfulEntry = entry => entry ? { id: entry.id, title: entry.title, body: entry.body, category: entry.category, date: entry.date, status: entry.status, photos: entry.photos || [] } : null;
const sameEntry = (a, b) => same(meaningfulEntry(a), meaningfulEntry(b));
const publicEntry = entry => ({ id: entry.id, title: entry.title.trim() || 'A small moment', body: entry.body, category: entry.category, date: entry.date, status: 'published', photos: (entry.photos || []).map(photo => ({ id: photo.id, url: photo.url, alt: photo.alt || '' })), createdAt: entry.createdAt, updatedAt: entry.updatedAt });

function localDate() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function newDraft() {
  return { id: '', title: '', body: '', category: 'Life', date: localDate(), status: 'draft', photos: [], createdAt: '', updatedAt: '' };
}

function emptyWorkspace() {
  return { version: 2, drafts: {}, changes: {}, deletions: {}, settings: null, activeDraft: null };
}

function noteId(note) {
  const slug = (note.title || 'a-small-moment').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'a-small-moment';
  return `${note.date}-${slug}-${crypto.randomUUID().slice(0, 6)}`;
}

function validateNote(note) {
  if (!note.body.trim() && !note.photos.length) throw new Error('Add a few words or a photograph first.');
  const date = new Date(`${note.date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(note.date) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== note.date) throw new Error('Choose a valid date for this note.');
  if (!categories.includes(note.category)) throw new Error('Choose Life, Garage, or Pursuits.');
  if (note.title.length > 160 || note.body.length > 50000) throw new Error('This note is too long. Keep the title under 160 characters and the text under 50,000.');
  if (note.photos.length > 10) throw new Error('Each note can hold up to ten photographs.');
  note.photos.forEach(photo => {
    if (!photo.url || !photoUrl(photo.url) || /^(blob:|data:)/i.test(photo.url)) throw new Error('Use an uploaded photo path or an HTTPS image address before preparing the update.');
  });
}

/** Three-way merge: preserve newer live changes and never include local drafts. */
export function mergePublication(live, workspace) {
  const entries = new Map((live.entries || []).filter(entry => entry.status === 'published').map(entry => [entry.id, publicEntry(entry)]));
  const conflicts = [];
  for (const [id, change] of Object.entries(workspace.changes || {})) {
    const current = entries.get(id) || null;
    const desired = publicEntry(change.entry);
    if (!sameEntry(current, change.base) && !sameEntry(current, desired)) {
      conflicts.push(`“${change.entry.title}” changed online after you started editing it.`);
      continue;
    }
    entries.set(id, desired);
  }
  for (const [id, deletion] of Object.entries(workspace.deletions || {})) {
    const current = entries.get(id) || null;
    if (current && !sameEntry(current, deletion.base)) conflicts.push(`“${current.title}” changed online before its removal could be prepared.`);
    else entries.delete(id);
  }
  let settings = copy(live.settings);
  if (workspace.settings) {
    if (!same(live.settings, workspace.settings.base) && !same(live.settings, workspace.settings.value)) conflicts.push('The journal details changed online after you started editing them.');
    else settings = copy(workspace.settings.value);
  }
  if (conflicts.length) throw new Error(`${conflicts.join(' ')} Your work is still saved on this browser. Download a backup, open the latest live version, and compare the changes before trying again.`);
  return { format: 'after-hours-journal', version: 2, settings, entries: [...entries.values()].sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))) };
}

function downloadFile(name, content, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function field(label, control, help = '') {
  return `<label class="ah-field"><span>${label}</span>${control}${help ? `<small>${help}</small>` : ''}</label>`;
}

export function mountStudio(root, initialData) {
  let live = copy(initialData);
  let workspace = emptyWorkspace();
  let storageProblem = '';
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && saved.version === 2 && saved.drafts && saved.changes && saved.deletions) workspace = { ...emptyWorkspace(), ...saved };
  } catch {
    storageProblem = 'This browser could not open its saved drafts. You can still write and download a backup before leaving.';
  }
  let tab = 'write';
  let draft = newDraft();
  let draftBase = null;
  if (workspace.activeDraft && workspace.drafts[workspace.activeDraft]) {
    draft = copy(workspace.drafts[workspace.activeDraft].entry);
    draftBase = copy(workspace.drafts[workspace.activeDraft].base);
  }
  let settings = copy(workspace.settings?.value || live.settings);
  let settingsBase = copy(workspace.settings?.base || live.settings);
  let dirty = false;
  let settingsDirty = false;
  let busy = false;
  let message = '';
  let error = storageProblem;
  let prepared = null;
  let copied = false;

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      return true;
    } catch {
      setError('This browser could not save your draft. Download a private backup before leaving; your work is still open here.');
      return false;
    }
  }

  function notices() {
    const status = root.querySelector('[data-status]');
    const alert = root.querySelector('[data-error]');
    if (status) status.textContent = message;
    if (alert) alert.textContent = error;
    const dirtyNote = root.querySelector('[data-draft-status]');
    if (dirtyNote) dirtyNote.textContent = dirty ? 'This note has unsaved changes.' : draft.id && workspace.drafts[draft.id] ? 'Draft saved on this browser.' : 'Your next note starts here.';
    const settingsNote = root.querySelector('[data-settings-status]');
    if (settingsNote) settingsNote.textContent = settingsDirty ? 'These details have unsaved changes.' : '';
  }

  function setMessage(value) { message = value; error = ''; notices(); }
  function setError(value) { error = value; message = ''; notices(); }
  function invalidate() { prepared = null; copied = false; }

  function saveDraft(showMessage = true) {
    try {
      validateNote(draft);
      const now = new Date().toISOString();
      if (!draft.id) draft.id = noteId(draft);
      draft.createdAt ||= now;
      draft.updatedAt = now;
      draft.status = 'draft';
      workspace.drafts[draft.id] = { entry: copy(draft), base: copy(draftBase), savedAt: now };
      workspace.activeDraft = draft.id;
      if (!persist()) return false;
      dirty = false;
      if (showMessage) setMessage('Draft saved on this browser. It is not in the public journal.');
      notices();
      return true;
    } catch (problem) { setError(problem.message); return false; }
  }

  function editNote(entry, base = undefined) {
    if (dirty && !confirm('Leave this unsaved note? Choose Cancel to save a local draft first.')) return;
    draft = entry ? { ...copy(entry), status: 'draft' } : newDraft();
    draftBase = base !== undefined ? copy(base) : entry ? copy(live.entries.find(item => item.id === entry.id) || null) : null;
    dirty = false;
    workspace.activeDraft = entry?.id && workspace.drafts[entry.id] ? entry.id : null;
    persist();
    tab = 'write';
    message = '';
    error = '';
    render();
    root.querySelector('[name="title"]')?.focus();
  }

  function publicChangesCount() { return Object.keys(workspace.changes).length + Object.keys(workspace.deletions).length + Number(Boolean(workspace.settings)); }

  function renderWrite() {
    return `<div class="ah-editor-grid"><div class="ah-editor-main">
      <div class="ah-section-line"><h2 class="ah-section-label">${draftBase ? 'Revisit this entry' : 'A fresh page'}</h2><button type="button" class="ah-button-quiet" data-action="new">New note +</button></div>
      <form data-note-form>
        ${field('A title, if you want one', `<input name="title" maxlength="160" value="${escape(draft.title)}" placeholder="The long way home">`)}
        <div class="ah-field-row">${field('Date', `<input name="date" type="date" required value="${escape(draft.date)}">`)}${field('Filed under', `<select name="category">${categories.map(category => `<option${category === draft.category ? ' selected' : ''}>${category}</option>`).join('')}</select>`)}</div>
        ${field('What do you want to remember?', `<textarea name="body" rows="12" maxlength="50000" placeholder="Something you tried, noticed, or enjoyed…">${escape(draft.body)}</textarea>`)}
      </form>
      <div class="ah-upload-area"><span>Add photographs</span><p class="ah-help">Upload your images to the journal’s photo folder on GitHub, then add their names here. An image named ride.jpg uses the path photos/ride.jpg.</p><div class="ah-editor-actions"><a class="ah-button-quiet" href="${PHOTOS_URL}" target="_blank" rel="noopener">Open photo upload ↗</a><button type="button" class="ah-button-secondary" data-action="add-photo" ${draft.photos.length >= 10 ? 'disabled' : ''}>Add a photo link +</button></div><p class="ah-help">Up to ten photographs per note. Uploads become public when committed on GitHub.</p></div>
      <div class="ah-photo-edit-list">${draft.photos.map((photo, index) => `<div class="ah-studio-photo-row"><div>${field(`Photograph ${index + 1}: path or HTTPS address`, `<input data-photo-index="${index}" data-photo-field="url" value="${escape(photo.url)}" placeholder="photos/ride.jpg">`)}${field('Caption &amp; image description', `<input data-photo-index="${index}" data-photo-field="alt" maxlength="1000" value="${escape(photo.alt)}" placeholder="A few words about this photograph">`)}</div><div class="ah-editor-actions"><button type="button" class="ah-button-quiet" data-action="photo-up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>Move earlier</button><button type="button" class="ah-button-quiet" data-action="photo-remove" data-index="${index}">Remove</button></div></div>`).join('')}</div>
      <div class="ah-editor-actions"><button type="button" class="ah-button" data-action="prepare-note">Prepare update</button><button type="button" class="ah-button-secondary" data-action="save-draft">Save local draft</button><button type="button" class="ah-button-quiet" data-action="preview">Preview</button></div>
      ${draftBase ? `<a class="ah-readlink" href="${escape(entryUrl(draftBase.id))}" target="_blank" rel="noopener">Read the live entry ↗</a>` : ''}
    </div><aside class="ah-editor-side"><span class="ah-section-label">A small reminder</span><h2>It doesn’t have<br>to be much.</h2><p>A photograph can hold a whole afternoon. A few lines can hold an idea.</p><p>Local drafts stay in this browser. They are not synced or published.</p><p>Prepare an update when you’re ready, then commit it on GitHub.</p><p class="ah-help" data-draft-status></p></aside></div>`;
  }

  function renderEntries() {
    const drafts = Object.values(workspace.drafts).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    return `<div class="ah-section-line"><h2 class="ah-section-label">Every page, in one place</h2><button type="button" class="ah-button-quiet" data-action="backup">Download private backup</button></div>
      ${drafts.length ? `<h3 class="ah-studio-subheading">Drafts on this browser</h3><div class="ah-studio-list">${drafts.map(item => `<div class="ah-studio-row"><div><p class="ah-date">Local draft · ${escape(dateLabel(item.entry.date))} · ${escape(item.entry.category)}${workspace.changes[item.entry.id] ? ' · Ready for GitHub' : ''}</p><h2>${escape(item.entry.title || 'A small moment')}</h2></div><div><button type="button" class="ah-button-secondary" data-action="edit-draft" data-id="${escape(item.entry.id)}">Edit</button><button type="button" class="ah-button-quiet" data-action="remove-draft" data-id="${escape(item.entry.id)}">Remove local draft</button></div></div>`).join('')}</div>` : '<p class="ah-help">No saved drafts on this browser yet.</p>'}
      <h3 class="ah-studio-subheading">The public journal</h3><div class="ah-studio-list">${live.entries.filter(entry => entry.status === 'published').map(entry => `<div class="ah-studio-row"><div><p class="ah-date">Live · ${escape(dateLabel(entry.date))} · ${escape(entry.category)}${workspace.changes[entry.id] ? ' · Update ready' : ''}${workspace.deletions[entry.id] ? ' · Removal ready' : ''}</p><h2>${escape(entry.title)}</h2></div><div><button type="button" class="ah-button-secondary" data-action="edit-live" data-id="${escape(entry.id)}">Edit</button><a class="ah-button-quiet" href="${escape(entryUrl(entry.id))}" target="_blank" rel="noopener">Read ↗</a><button type="button" class="ah-button-quiet" data-action="stage-remove" data-id="${escape(entry.id)}">Prepare removal</button></div></div>`).join('')}</div>`;
  }

  function renderSettings() {
    return `<form class="ah-settings-form" data-settings-form><fieldset><legend>The journal</legend>
      ${field('Name', `<input name="settings.title" required maxlength="80" value="${escape(settings.title)}">`)}
      ${field('A short introduction', `<textarea name="settings.tagline" rows="2" maxlength="180">${escape(settings.tagline)}</textarea>`)}
      ${field('The note in the margin', `<textarea name="settings.about" rows="4" maxlength="10000">${escape(settings.about)}</textarea>`)}</fieldset>
      <fieldset><legend>The garage</legend>${field('Bike name', `<input name="settings.bikeName" maxlength="100" value="${escape(settings.bikeName)}">`)}${field('Introduction', `<textarea name="settings.garageIntro" rows="3" maxlength="6000">${escape(settings.garageIntro)}</textarea>`)}
      ${settings.garageSections.map((section, index) => `<div class="ah-setting-group">${field('Section name', `<input data-section="${index}" data-setting-field="title" maxlength="100" value="${escape(section.title)}">`)}${field('Parts and notes, one per line', `<textarea data-section="${index}" data-setting-field="items" rows="4">${escape(section.items.join('\n'))}</textarea>`)}<button type="button" class="ah-button-quiet" data-action="remove-section" data-index="${index}">Remove section</button></div>`).join('')}
      <button type="button" class="ah-button-secondary" data-action="add-section" ${settings.garageSections.length >= 12 ? 'disabled' : ''}>Add a section +</button></fieldset>
      <fieldset><legend>Now</legend>${field('Introduction', `<textarea name="settings.nowIntro" rows="3" maxlength="6000">${escape(settings.nowIntro)}</textarea>`)}
      ${settings.nowItems.map((item, index) => `<div class="ah-setting-group">${field('What has your attention?', `<input data-interest="${index}" data-setting-field="label" maxlength="80" value="${escape(item.label)}">`)}${field('A few words', `<textarea data-interest="${index}" data-setting-field="text" maxlength="3000" rows="3">${escape(item.text)}</textarea>`)}<button type="button" class="ah-button-quiet" data-action="remove-interest" data-index="${index}">Remove item</button></div>`).join('')}
      <button type="button" class="ah-button-secondary" data-action="add-interest" ${settings.nowItems.length >= 12 ? 'disabled' : ''}>Add an interest +</button></fieldset>
      <div class="ah-editor-actions"><button type="submit" class="ah-button">Save details for next update</button><span class="ah-help" data-settings-status></span></div><p class="ah-help">This saves the changes on this browser. Use Publish to prepare the GitHub update.</p></form>`;
  }

  function renderPublish() {
    const count = publicChangesCount();
    return `<section class="ah-publication"><p class="ah-section-label">One last step</p><h2 class="ah-studio-publish-title">From the desk<br>to the journal.</h2>
      <p class="ah-lead">GitHub publishes the journal after you commit its updated content file. Only the repository owner or an authorized collaborator can commit.</p>
      <div class="ah-notice"><p>${count ? `${count} change${count === 1 ? '' : 's'} ready to prepare.` : 'No changes are queued yet. Write a note or save your journal details first.'}</p><p class="ah-help">Local drafts stay out of the public file unless you choose Prepare update for that note.</p></div>
      ${count ? `<ul class="ah-publication-changes">${Object.values(workspace.changes).map(change => `<li><span>${change.base ? 'Update' : 'Add'}: ${escape(change.entry.title)}</span><button type="button" class="ah-button-quiet" data-action="unstage" data-id="${escape(change.entry.id)}">Keep as draft</button></li>`).join('')}${Object.entries(workspace.deletions).map(([id, change]) => `<li><span>Remove: ${escape(change.base.title)}</span><button type="button" class="ah-button-quiet" data-action="undo-removal" data-id="${escape(id)}">Keep entry</button></li>`).join('')}${workspace.settings ? '<li><span>Update journal details</span><button type="button" class="ah-button-quiet" data-action="unstage-settings">Keep live details</button></li>' : ''}</ul>` : ''}
      <div class="ah-editor-actions"><button type="button" class="ah-button" data-action="refresh-package" ${count ? '' : 'disabled'}>${busy ? 'Checking the live journal…' : 'Prepare publication file'}</button><button type="button" class="ah-button-quiet" data-action="check-live">Check for published changes</button><button type="button" class="ah-button-quiet" data-action="backup">Download private backup</button></div>
      ${prepared ? `<div class="ah-publication-steps"><h3>Your file is ready</h3><ol><li>Copy the public content below.</li><li>Open the GitHub editor, replace all of its content with your copy, and choose <strong>Commit changes</strong>.</li><li>Return here after GitHub finishes publishing and check for your changes.</li></ol><p class="ah-help">If GitHub asks you to sign in, use the account that owns this repository.</p><div class="ah-editor-actions"><button type="button" class="ah-button" data-action="copy-publication">${copied ? 'Copied ✓' : 'Copy public content'}</button><a class="ah-button-secondary" href="${EDIT_URL}" target="_blank" rel="noopener">Open GitHub editor ↗</a><button type="button" class="ah-button-quiet" data-action="download-publication">Download content.json</button></div><details><summary>Review the public content file</summary><label class="ah-field"><span>Public content only</span><textarea readonly rows="10" data-publication-text aria-label="Public content file">${escape(JSON.stringify(prepared, null, 2))}</textarea></label></details><p class="ah-help">You can also download content.json and <a href="${UPLOAD_URL}" target="_blank" rel="noopener">upload it to this journal’s folder on GitHub ↗</a>, replacing the existing file. This file contains published notes and your prepared changes, not your other local drafts.</p></div>` : ''}
      <p class="ah-help">A private backup includes local drafts. Keep that file on your own device; do not upload it to the public repository.</p>
    </section>`;
  }

  function render() {
    root.innerHTML = `<section class="ah-studio-header"><div><p class="ah-section-label">For the keeper of this notebook</p><h1>The writing desk.</h1><p>A photograph, a few words. That counts.</p></div><a class="ah-backlink" href="${escape(BASE)}">Back to the journal</a></section>
      <p class="ah-studio-local-note">Drafts save on this browser. Publishing finishes on GitHub.</p>
      <div class="ah-studio-tabs" role="group" aria-label="Writing desk sections">${[['write', 'Write a note'], ['entries', 'Your entries'], ['settings', 'Journal details'], ['publish', `Publish${publicChangesCount() ? ` (${publicChangesCount()})` : ''}`]].map(([value, label]) => `<button type="button" data-tab="${value}" aria-pressed="${tab === value}">${label}</button>`).join('')}</div>
      <p class="ah-status" data-status role="status"></p><p class="ah-error" data-error role="alert"></p>
      <div data-studio-panel>${tab === 'write' ? renderWrite() : tab === 'entries' ? renderEntries() : tab === 'settings' ? renderSettings() : renderPublish()}</div>
      <dialog class="ah-preview-dialog" data-preview><div class="ah-preview-toolbar"><span>Preview · Your changes are not published</span><button type="button" class="ah-button-quiet" data-action="close-preview">Keep editing ×</button></div><article class="ah-article" data-preview-article></article></dialog>`;
    if (busy) root.querySelectorAll('button').forEach(button => { button.disabled = true; });
    notices();
  }

  async function preparePackage() {
    if (!publicChangesCount()) { setError('Prepare a note or save journal details first.'); return; }
    busy = true;
    render();
    try {
      const fresh = await loadPublicData();
      const merged = mergePublication(fresh, workspace);
      live = fresh;
      prepared = merged;
      copied = false;
      message = 'The publication file is ready. Nothing has been published yet; finish the commit on GitHub.';
      error = '';
    } catch (problem) { prepared = null; message = ''; error = problem.message || 'The live journal could not be checked. Try again when you are online.'; }
    finally { busy = false; render(); }
  }

  async function checkLive() {
    busy = true;
    render();
    try {
      const fresh = await loadPublicData();
      let found = 0;
      for (const [id, change] of Object.entries(workspace.changes)) {
        if (sameEntry(fresh.entries.find(entry => entry.id === id), publicEntry(change.entry))) {
          delete workspace.changes[id];
          const saved = workspace.drafts[id];
          if (saved && sameEntry(publicEntry(saved.entry), publicEntry(change.entry))) delete workspace.drafts[id];
          else if (saved) saved.base = copy(fresh.entries.find(entry => entry.id === id));
          if (draft.id === id) { draftBase = copy(fresh.entries.find(entry => entry.id === id)); }
          found++;
        }
      }
      for (const id of Object.keys(workspace.deletions)) {
        if (!fresh.entries.some(entry => entry.id === id)) { delete workspace.deletions[id]; found++; }
      }
      if (workspace.settings && same(fresh.settings, workspace.settings.value)) { workspace.settings = null; settingsBase = copy(fresh.settings); if (!settingsDirty) settings = copy(fresh.settings); found++; }
      live = fresh;
      invalidate();
      persist();
      message = found ? `${found} prepared change${found === 1 ? ' is' : 's are'} now visible in the public journal.` : 'The live journal has been checked. No additional prepared changes are visible yet. GitHub may still be publishing.';
      error = '';
    } catch (problem) { message = ''; error = problem.message || 'The live journal could not be checked. Your local work is still here.'; }
    finally { busy = false; render(); }
  }

  root.addEventListener('input', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) return;
    if (input.closest('[data-note-form]')) { draft[input.name] = input.value; dirty = true; }
    else if (input.dataset.photoIndex !== undefined) { const photo = draft.photos[Number(input.dataset.photoIndex)]; if (photo && ['url', 'alt'].includes(input.dataset.photoField)) { photo[input.dataset.photoField] = input.value; dirty = true; } }
    else if (input.closest('[data-settings-form]')) {
      if (input.name.startsWith('settings.')) settings[input.name.slice(9)] = input.value;
      else if (input.dataset.section !== undefined) { const section = settings.garageSections[Number(input.dataset.section)]; if (section) section[input.dataset.settingField] = input.dataset.settingField === 'items' ? input.value.split('\n') : input.value; }
      else if (input.dataset.interest !== undefined) { const item = settings.nowItems[Number(input.dataset.interest)]; if (item) item[input.dataset.settingField] = input.value; }
      settingsDirty = true;
    } else return;
    message = '';
    notices();
  });

  root.addEventListener('submit', event => {
    event.preventDefault();
    if (!event.target.matches('[data-settings-form]') || busy) return;
    if (!settings.title.trim()) { setError('Give the journal a name before saving its details.'); return; }
    const cleaned = copy(settings);
    cleaned.title = cleaned.title.trim();
    cleaned.garageSections = cleaned.garageSections.map(section => ({ title: section.title.trim(), items: section.items.map(item => item.trim()).filter(Boolean) }));
    workspace.settings = { value: cleaned, base: copy(settingsBase) };
    invalidate();
    if (persist()) { settings = cleaned; settingsDirty = false; setMessage('Journal details saved on this browser and queued for your next GitHub update.'); render(); }
  });

  root.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button || !root.contains(button) || busy || button.disabled) return;
    if (button.dataset.tab) { tab = button.dataset.tab; message = ''; error = ''; render(); return; }
    const action = button.dataset.action;
    const id = button.dataset.id;
    const index = Number(button.dataset.index);
    try {
      if (action === 'new') editNote();
      else if (action === 'save-draft') saveDraft();
      else if (action === 'add-photo') { if (draft.photos.length < 10) { draft.photos.push({ id: crypto.randomUUID(), url: '', alt: '' }); dirty = true; render(); root.querySelector(`[data-photo-index="${draft.photos.length - 1}"][data-photo-field="url"]`)?.focus(); } }
      else if (action === 'photo-remove') { draft.photos.splice(index, 1); dirty = true; render(); }
      else if (action === 'photo-up' && index > 0) { [draft.photos[index - 1], draft.photos[index]] = [draft.photos[index], draft.photos[index - 1]]; dirty = true; render(); }
      else if (action === 'preview') {
        const preview = root.querySelector('[data-preview]');
        root.querySelector('[data-preview-article]').innerHTML = renderArticle({ ...draft, title: draft.title.trim() || 'A small moment', photos: draft.photos.filter(photo => photo.url && photoUrl(photo.url)) });
        root.querySelectorAll('[data-preview-article] button[data-photo-index]').forEach(photoButton => { photoButton.setAttribute('tabindex', '-1'); photoButton.style.cursor = 'default'; });
        preview.showModal();
      }
      else if (action === 'close-preview') root.querySelector('[data-preview]').close();
      else if (action === 'edit-draft') { const saved = workspace.drafts[id]; if (saved) editNote(saved.entry, saved.base); }
      else if (action === 'edit-live') {
        const saved = workspace.drafts[id];
        if (saved) editNote(saved.entry, saved.base);
        else editNote(live.entries.find(entry => entry.id === id));
      }
      else if (action === 'remove-draft') {
        if (!confirm('Remove this local draft and any prepared update for it? The live entry will stay as it is.')) return;
        delete workspace.drafts[id]; delete workspace.changes[id];
        if (workspace.activeDraft === id) workspace.activeDraft = null;
        if (draft.id === id) { draft = newDraft(); draftBase = null; dirty = false; }
        invalidate(); persist(); message = 'Local draft removed. The public journal has not changed.'; render();
      }
      else if (action === 'stage-remove') {
        const entry = live.entries.find(item => item.id === id);
        if (!entry || !confirm(`Prepare removal of “${entry.title}” from the public journal? It will remain live until you commit the update on GitHub.`)) return;
        workspace.deletions[id] = { base: copy(entry) }; delete workspace.changes[id]; invalidate(); persist(); tab = 'publish'; message = 'Removal queued. Commit the publication file on GitHub to apply it.'; render();
      }
      else if (action === 'prepare-note') {
        if (!saveDraft(false)) return;
        const entry = publicEntry({ ...draft, title: draft.title.trim() || 'A small moment', updatedAt: new Date().toISOString() });
        workspace.changes[entry.id] = { entry, base: copy(workspace.changes[entry.id]?.base ?? draftBase) };
        delete workspace.deletions[entry.id]; invalidate();
        if (!persist()) return;
        tab = 'publish'; await preparePackage();
      }
      else if (action === 'refresh-package') await preparePackage();
      else if (action === 'check-live') await checkLive();
      else if (action === 'unstage') { delete workspace.changes[id]; invalidate(); persist(); render(); }
      else if (action === 'undo-removal') { delete workspace.deletions[id]; invalidate(); persist(); render(); }
      else if (action === 'unstage-settings') { workspace.settings = null; settings = copy(live.settings); settingsBase = copy(live.settings); settingsDirty = false; invalidate(); persist(); render(); }
      else if (action === 'add-section') { settings.garageSections.push({ title: '', items: [] }); settingsDirty = true; render(); }
      else if (action === 'remove-section') { settings.garageSections.splice(index, 1); settingsDirty = true; render(); }
      else if (action === 'add-interest') { settings.nowItems.push({ label: '', text: '' }); settingsDirty = true; render(); }
      else if (action === 'remove-interest') { settings.nowItems.splice(index, 1); settingsDirty = true; render(); }
      else if (action === 'copy-publication' && prepared) {
        try { await navigator.clipboard.writeText(JSON.stringify(prepared, null, 2) + '\n'); copied = true; message = 'Public content copied. Replace the GitHub editor’s content with this copy, then commit the change.'; error = ''; render(); }
        catch { const details = root.querySelector('.ah-publication-steps details'); if (details) details.open = true; const text = root.querySelector('[data-publication-text]'); text?.focus(); text?.select(); setMessage('The content is selected. Copy it with your keyboard, or download content.json instead.'); }
      }
      else if (action === 'download-publication' && prepared) { downloadFile('content.json', JSON.stringify(prepared, null, 2) + '\n'); setMessage('content.json downloaded. Upload it to the journal folder on GitHub and commit the replacement.'); }
      else if (action === 'backup') {
        const backup = { format: 'after-hours-private-backup', version: 2, savedAt: new Date().toISOString(), workspace: copy(workspace), openNote: { entry: copy(draft), base: copy(draftBase) }, openSettings: copy(settings) };
        downloadFile(`after-hours-private-backup-${localDate()}.json`, JSON.stringify(backup, null, 2) + '\n'); setMessage('Private backup downloaded. It includes local drafts; keep it on your device, outside the public repository.');
      }
    } catch (problem) { setError(problem.message || 'That step could not be completed. Your work is still here.'); }
  });

  const beforeUnload = event => { if (dirty || settingsDirty || busy) { event.preventDefault(); event.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);
  render();
}
