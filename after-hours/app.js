import {
  BASE, escapeHtml, dateLabel, entryUrl, photoUrl, loadPublicData, renderArticle,
} from './core.js';

const e = escapeHtml;
const categories = ['All notes', 'Life', 'Garage', 'Pursuits'];
const allowedViews = ['journal', 'garage', 'now', 'entry', 'studio'];
const view = allowedViews.includes(document.body.dataset.view) ? document.body.dataset.view : 'journal';
const root = document.getElementById('app');
const href = path => `${BASE}${path}`;
const excerpt = (body, length = 180) => body.length > length
  ? `${body.slice(0, length).replace(/\s+\S*$/, '')}…`
  : body;

function entryCard(entry, index = 0) {
  const url = e(entryUrl(entry.id));
  const photo = entry.photos?.[0];
  const imageUrl = photo ? photoUrl(photo.url) : '';
  return `<article class="ah-entry-card" data-category="${e(entry.category)}">
    <span class="ah-entry-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
    <div class="ah-entry-content">
      <p class="ah-date"><span>${e(entry.category)}</span><span aria-hidden="true"> / </span><time datetime="${e(entry.date)}">${e(dateLabel(entry.date))}</time></p>
      <h2 class="ah-entry-title"><a href="${url}">${e(entry.title)}</a></h2>
      ${entry.body ? `<p class="ah-entry-excerpt">${e(excerpt(entry.body))}</p>` : ''}
      <a class="ah-readlink" href="${url}">Open this note <span aria-hidden="true"></span></a>
    </div>
    ${imageUrl ? `<a class="ah-entry-photo" href="${url}" aria-label="Read ${e(entry.title)}"><img src="${e(imageUrl)}" alt="${e(photo.alt || `Photograph from ${entry.title}`)}" loading="lazy"></a>` : ''}
  </article>`;
}

function shell(settings) {
  const words = settings.title.trim().split(/\s+/);
  const end = words.length > 1 ? words.pop() : '';
  const active = name => view === name || (name === 'journal' && view === 'entry') ? ' aria-current="page"' : '';
  return `<div class="ah-shell">
    <a class="ah-skip-link" href="#journal-main">Skip to the journal</a>
    <div class="ah-spine" aria-hidden="true"><span>Collected at an unhurried pace</span><span>AH / MMXXVI</span></div>
    <div class="ah-page">
      <header class="ah-header">
        <div class="ah-topline"><span>A personal field journal</span><span>Est. 2026 <span aria-hidden="true">✳</span></span></div>
        <a href="${href('')}" class="ah-wordmark" aria-label="${e(settings.title)}, home">${e(words.join(' '))}${end ? ` <em>${e(end)}</em>` : ''}</a>
        <nav class="ah-navigation" aria-label="Main navigation"><div>
          <a href="${href('')}"${active('journal')}>Journal</a>
          <a href="${href('garage/')}"${active('garage')}>Garage</a>
          <a href="${href('now/')}"${active('now')}>Now</a>
        </div></nav>
      </header>
      <main id="journal-main" class="ah-main" tabindex="-1"></main>
      <footer class="ah-footer"><div><a class="ah-footer-wordmark" href="${href('')}">${e(settings.title)}</a><p>Rides, projects, and ordinary good days.</p></div><div><span>A journal, in progress.</span><a href="${href('studio/')}"${active('studio')}>Writing desk </a></div></footer>
    </div>
  </div>`;
}

function journalMarkup(settings, entries) {
  return `<section class="ah-intro" aria-labelledby="journal-heading">
    <div><p class="ah-section-label">A few things worth keeping</p><h1 id="journal-heading" class="ah-display">Good things,<br><em>kept.</em></h1><p class="ah-intro-copy">${e(settings.tagline)}</p></div>
    <div class="ah-stamp" aria-hidden="true"><span>OUT &amp; ABOUT</span><strong>Life<br>in the<br><em>making.</em></strong><span>RIDES · PROJECTS · SMALL JOYS</span></div>
  </section>
  <div class="ah-journal-layout">
    <section class="ah-journal-main" aria-labelledby="notes-heading">
      <div class="ah-section-line"><h2 class="ah-section-label" id="notes-heading">From the notebook</h2><span>Newer notes first</span></div>
      <div class="ah-filters" role="group" aria-label="Filter journal entries">${categories.map((category, index) => `<button type="button" data-filter="${e(category)}" aria-pressed="${index === 0}">${e(category)}</button>`).join('')}</div>
      <div class="ah-entry-list" aria-live="polite">${entryList(entries)}</div>
    </section>
    <aside class="ah-margin"><p class="ah-section-label">A note in the margin</p><h2>Room to<br><em>wander.</em></h2><p>${e(settings.about)}</p><a class="ah-readlink" href="${href('now/')}">What has my attention </a><div class="ah-margin-rule"></div><p class="ah-section-label">In the garage</p><p>${e(settings.bikeName)}</p><a class="ah-readlink" href="${href('garage/')}">Follow the build </a></aside>
  </div>`;
}

function entryList(entries) {
  return entries.length ? entries.map(entryCard).join('')
    : '<div class="ah-empty"><p>A little room for what comes next.</p><p>Notes in this part of the journal will collect here.</p></div>';
}

function garageMarkup(settings, entries) {
  const buildNotes = entries.filter(entry => entry.category === 'Garage');
  return `<section class="ah-garage-hero"><div><p class="ah-section-label">An ongoing project</p><h1 class="ah-page-heading">The <em>garage.</em></h1><p class="ah-lead">${e(settings.bikeName)}</p><p class="ah-intro-copy">${e(settings.garageIntro)}</p></div><div class="ah-bike-number" aria-hidden="true"><span>YAMAHA</span><strong>03</strong><span>BUILT, RIDDEN, RECONSIDERED.</span></div></section>
    <div class="ah-section-line"><h2 class="ah-section-label">The setup</h2><span>A working record</span></div>
    <div class="ah-parts-grid">${settings.garageSections.map((section, index) => `<section class="ah-parts-section"><span class="ah-section-label">${String(index + 1).padStart(2, '0')}</span><h2>${e(section.title)}</h2><ul>${section.items.map(item => `<li>${e(item)}</li>`).join('')}</ul></section>`).join('')}</div>
    <section class="ah-garage-notes"><div class="ah-section-line"><h2 class="ah-section-label">Notes from the garage</h2><span>The reasons behind the changes</span></div>${entryList(buildNotes)}</section>`;
}

function nowMarkup(settings) {
  return `<section class="ah-now-intro"><p class="ah-section-label">A snapshot of the present</p><h1 class="ah-page-heading">Here, <em>lately.</em></h1><p class="ah-lead">${e(settings.nowIntro)}</p></section>
    <div class="ah-now-list">${settings.nowItems.map((item, index) => `<section class="ah-now-item"><span class="ah-entry-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><h2>${e(item.label)}</h2><p>${e(item.text)}</p></section>`).join('')}</div>
    <div class="ah-now-closing"><p>Always a little room for the next thing.</p><a href="${href('')}" class="ah-readlink">Back to the notebook </a></div>`;
}

function attachFilters(main, entries) {
  const group = main.querySelector('.ah-filters');
  const list = main.querySelector('.ah-entry-list');
  group.addEventListener('click', event => {
    const button = event.target.closest('button[data-filter]');
    if (!button || !group.contains(button)) return;
    const category = button.dataset.filter;
    if (!categories.includes(category)) return;
    group.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    list.innerHTML = entryList(category === 'All notes' ? entries : entries.filter(entry => entry.category === category));
  });
}

function attachLightbox(main, entry) {
  const photos = (entry.photos || []).map((photo, originalIndex) => ({
    ...photo, originalIndex, safeUrl: photoUrl(photo.url),
  })).filter(photo => photo.safeUrl);
  if (!photos.length) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'ah-lightbox';
  dialog.setAttribute('aria-label', 'Journal photographs');
  dialog.innerHTML = `<button type="button" class="ah-lightbox-close" aria-label="Close photograph">Close ×</button><img class="ah-lightbox-image" alt="">${photos.length > 1 ? '<div class="ah-lightbox-navigation"><button type="button" data-direction="-1">Previous</button><span aria-live="polite"></span><button type="button" data-direction="1">Next</button></div>' : ''}`;
  main.append(dialog);
  let current = 0;
  const display = index => {
    current = (index + photos.length) % photos.length;
    const photo = photos[current];
    const image = dialog.querySelector('img');
    image.src = photo.safeUrl;
    image.alt = photo.alt || `Photograph ${current + 1} from ${entry.title}`;
    const count = dialog.querySelector('.ah-lightbox-navigation span');
    if (count) count.textContent = `${current + 1} / ${photos.length}`;
  };
  main.querySelectorAll('.ah-photo-gallery button').forEach((button, index) => {
    button.addEventListener('click', () => {
      const originalIndex = Number(button.dataset.photoIndex ?? index);
      const safeIndex = photos.findIndex(photo => photo.originalIndex === originalIndex);
      if (safeIndex < 0) return;
      display(safeIndex);
      dialog.showModal();
    });
  });
  dialog.querySelector('.ah-lightbox-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => display(current + Number(button.dataset.direction))));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      display(current + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
}

async function start() {
  const data = await loadPublicData();
  const settings = data.settings;
  const entries = data.entries.filter(entry => entry.status === 'published')
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));
  root.innerHTML = shell(settings);
  const main = document.getElementById('journal-main');
  const pageNames = {journal: 'A personal field journal', garage: 'The garage', now: 'Here, lately', studio: 'Writing desk'};
  document.title = `${settings.title} — ${pageNames[view] || 'A page from the notebook'}`;

  if (view === 'journal') {
    main.innerHTML = journalMarkup(settings, entries);
    attachFilters(main, entries);
  } else if (view === 'garage') {
    main.innerHTML = garageMarkup(settings, entries);
  } else if (view === 'now') {
    main.innerHTML = nowMarkup(settings);
  } else if (view === 'entry') {
    const id = new URLSearchParams(window.location.search).get('id');
    const entry = entries.find(item => item.id === id);
    if (!entry) {
      main.innerHTML = `<section class="ah-empty"><h1 class="ah-page-heading">A page to find.</h1><p>This entry is not in the published notebook.</p><a class="ah-button" href="${href('')}">Back to the journal</a></section>`;
      return;
    }
    document.title = `${entry.title} — ${settings.title}`;
    main.innerHTML = `<article class="ah-article"><a href="${href('')}" class="ah-backlink">Back to the journal</a>${renderArticle(entry)}<nav class="ah-entry-neighbours" aria-label="Other entries">${entries.filter(item => item.id !== entry.id).slice(0, 2).map(item => `<a href="${e(entryUrl(item.id))}"><span class="ah-section-label">Another page</span><span>${e(item.title)} </span></a>`).join('')}</nav></article>`;
    attachLightbox(main, entry);
  } else if (view === 'studio') {
    const { mountStudio } = await import('./studio.js');
    await mountStudio(main, data);
  }
}

start().catch(error => {
  console.error('The journal could not be opened.', error);
  const main = document.getElementById('journal-main');
  const content = `<section class="ah-empty" role="alert"><h1 class="ah-page-heading">The notebook is taking a moment.</h1><p>${e(error?.message || 'The journal could not be loaded. Please try again.')}</p><a class="ah-button" href="${e(window.location.pathname + window.location.search)}">Try again</a><p class="ah-help">If this continues, the journal’s content file may need attention.</p></section>`;
  if (main) main.innerHTML = content;
  else root.innerHTML = `<div class="ah-shell"><div class="ah-page"><main class="ah-main">${content}</main></div></div>`;
});
