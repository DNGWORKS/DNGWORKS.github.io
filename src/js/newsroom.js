/**
 * DNGWORKS — newsroom archive: search, topic and type filters, pagination.
 *
 * The first screen of /intelligence/ is real HTML written at build time, so
 * the page is useful with JavaScript off and indexable. This module powers
 * the archive below it, reading the same static snapshot the page was built
 * from — which means it works on plain static hosting with no API route.
 *
 * Every value from the snapshot reaches the DOM through textContent or an
 * attribute setter, never through innerHTML, and only https URLs on the
 * allowed-scheme check are ever linked.
 */

const root = document.querySelector('[data-newsroom]');
const locale = document.documentElement.lang || 'vi';
const strings = JSON.parse(root?.dataset.strings || '{}');
const PAGE_SIZE = Number(root?.dataset.pageSize) || 24;

const state = {
  all: [],
  filtered: [],
  page: 1,
  query: '',
  type: 'all',
  category: 'all',
};

/* ------------------------------------------------------------------ format */

const dateFmt = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' });

function formatDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return dateFmt.format(date);
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Only absolute https links are ever rendered. */
function safeUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url, location.origin);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------- build */

function buildMedia(record) {
  const figure = document.createElement('figure');
  figure.className = 'media media--16x9';

  /* Category artwork, so a run of fallbacks is not a run of grey boxes. */
  const toArtwork = () => {
    figure.classList.add('media--placeholder');
    figure.setAttribute('role', 'img');
    figure.setAttribute('aria-label', strings.illustration || 'Illustration');
  };
  figure.dataset.category = (record.categorySlugs || [])[0] || 'business-market';

  const src = record.imageRightsStatus === 'approved' ? safeUrl(record.imageUrl) : null;
  if (!src) {
    toArtwork();
    return figure;
  }

  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  /* A blocked or missing publisher image becomes branded artwork rather
     than a broken image frame. */
  img.addEventListener('error', toArtwork, { once: true });
  figure.append(img);
  return figure;
}

function buildMeta(record) {
  const meta = document.createElement('div');
  meta.className = 'story-meta';

  const kind = document.createElement('span');
  kind.className = 'story-kind';
  kind.dataset.type = record.type;
  kind.textContent = strings.types?.[record.type] || record.type;
  meta.append(kind);

  if (record.sourceName) {
    const source = document.createElement('span');
    source.className = 'story-source';
    source.textContent = record.sourceName;
    meta.append(source);
  }

  const time = document.createElement('time');
  time.className = 'story-time';
  const formatted = formatDate(record.publishedAt);
  if (formatted) {
    time.dateTime = record.publishedAt;
    time.textContent = formatted;
  } else {
    time.dataset.unknown = 'true';
    time.textContent = strings.unknownDate || 'Date unknown';
  }
  meta.append(time);

  return meta;
}

function buildCard(record) {
  const card = document.createElement('article');
  card.className = 'result-card';

  const href = record.localPath ? safeUrl(record.localPath) : safeUrl(record.canonicalUrl);
  const link = document.createElement('a');
  if (href) {
    link.href = href;
    if (!record.localPath) {
      link.target = '_blank';
      link.rel = 'noopener nofollow';
    }
  }

  link.append(buildMedia(record));

  const title = document.createElement('h3');
  title.textContent = record.title || '';
  link.append(title);

  if (record.summary) {
    const summary = document.createElement('p');
    summary.textContent = record.summary;
    link.append(summary);
  }

  link.append(buildMeta(record));
  card.append(link);
  return card;
}

/* ------------------------------------------------------------------ filter */

function matches(record) {
  if (state.type !== 'all' && record.type !== state.type) return false;
  if (state.category !== 'all' && !(record.categorySlugs || []).includes(state.category)) return false;
  if (state.query) {
    const haystack = [record.title, record.summary, record.sourceName, ...(record.categorySlugs || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(state.query)) return false;
  }
  return true;
}

function applyFilters(resetPage = true) {
  state.filtered = state.all.filter(matches);
  if (resetPage) state.page = 1;
  render();
}

/* ------------------------------------------------------------------ render */

function render() {
  const grid = root.querySelector('[data-results]');
  const count = root.querySelector('[data-results-count]');
  const empty = root.querySelector('[data-empty]');
  const more = root.querySelector('[data-load-more]');
  if (!grid) return;

  const visible = state.filtered.slice(0, state.page * PAGE_SIZE);

  grid.replaceChildren(...visible.map(buildCard));

  if (count) {
    count.textContent = `${new Intl.NumberFormat(locale).format(state.filtered.length)} ${strings.results || ''}`.trim();
  }

  const isEmpty = state.filtered.length === 0;
  grid.hidden = isEmpty;
  if (empty) empty.hidden = !isEmpty;

  if (more) {
    const remaining = state.filtered.length - visible.length;
    more.hidden = remaining <= 0;
    more.textContent = `${strings.loadMore || 'Load more'}${remaining > 0 ? ` (${remaining})` : ''}`;
  }
}

/* -------------------------------------------------------------------- bind */

function bind() {
  const search = root.querySelector('[data-search]');
  if (search) {
    let timer;
    search.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        state.query = search.value.trim().toLowerCase();
        applyFilters();
      }, 180);
    });
  }

  for (const group of root.querySelectorAll('[data-filter-group]')) {
    const key = group.dataset.filterGroup;
    group.addEventListener('click', (event) => {
      const button = event.target.closest('[data-value]');
      if (!button) return;
      state[key] = button.dataset.value;
      for (const chip of group.querySelectorAll('[data-value]')) {
        chip.setAttribute('aria-pressed', String(chip === button));
      }
      applyFilters();
    });
  }

  const clear = root.querySelector('[data-clear]');
  if (clear) {
    clear.addEventListener('click', () => {
      state.query = '';
      state.type = 'all';
      state.category = 'all';
      if (search) search.value = '';
      for (const group of root.querySelectorAll('[data-filter-group]')) {
        for (const chip of group.querySelectorAll('[data-value]')) {
          chip.setAttribute('aria-pressed', String(chip.dataset.value === 'all'));
        }
      }
      applyFilters();
    });
  }

  const more = root.querySelector('[data-load-more]');
  if (more) {
    more.addEventListener('click', () => {
      state.page += 1;
      render();
    });
  }
}

/* -------------------------------------------------------------------- load */

async function load() {
  const url = root.dataset.source;
  if (!url) return;

  try {
    const response = await fetch(url, { cache: 'no-cache' });
    const contentType = response.headers.get('content-type') || '';
    /* A 200 that returns HTML is a routing failure, not data. */
    if (!response.ok || !contentType.includes('json')) {
      throw new Error(`snapshot unavailable (${response.status} ${contentType})`);
    }

    const data = await response.json();
    state.all = Array.isArray(data.items) ? data.items.filter((r) => r && r.title) : [];

    const sync = root.querySelector('[data-sync]');
    if (sync && data.snapshotUpdatedAt) {
      const label = sync.querySelector('[data-sync-time]');
      const stamp = new Date(data.snapshotUpdatedAt);
      if (label && !Number.isNaN(stamp.getTime())) {
        label.textContent = new Intl.DateTimeFormat(locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(stamp);
      }
      sync.dataset.stale = String(Boolean(data.stale));
      sync.hidden = false;
    }

    applyFilters();
  } catch (error) {
    /* Be honest: say the archive could not load and offer a retry. Never
       substitute invented stories. */
    const grid = root.querySelector('[data-results]');
    const empty = root.querySelector('[data-empty]');
    if (grid) grid.hidden = true;
    if (empty) {
      empty.hidden = false;
      const title = empty.querySelector('[data-empty-title]');
      const body = empty.querySelector('[data-empty-body]');
      if (title) title.textContent = strings.errorTitle || 'Could not load';
      if (body) body.textContent = strings.errorBody || '';
      const retry = empty.querySelector('[data-retry]');
      if (retry) {
        retry.hidden = false;
        retry.addEventListener('click', () => load(), { once: true });
      }
    }
    /* eslint-disable-next-line no-console */
    console.warn('[dng] newsroom snapshot failed', error);
  }
}

if (root) {
  bind();
  load();
}
