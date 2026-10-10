/**
 * Document shell: the page skeleton, header, footer and inline icons.
 */

import { esc, attr, join, map, href, head, jsonLd } from './lib.mjs';

/* ------------------------------------------------------------------ icons */

export const icons = {
  brandMark: `<svg class="brand-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="1" y="16" width="22" height="4" rx="1"/>
    <rect x="4" y="9.5" width="16" height="4" rx="1"/>
    <rect x="7.5" y="3" width="9" height="4" rx="1"/>
  </svg>`,
  menu: `<svg class="icon-open" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14"/></svg>
    <svg class="icon-close" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>`,
  arrowDown: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 3v10M4 9.5l4 4 4-4"/></svg>`,
  arrowLeft: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M13 8H3M7 3.5 2.5 8 7 12.5"/></svg>`,
  search: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="9" cy="9" r="5.5"/><path d="m13.5 13.5 3.5 3.5"/></svg>`,
  info: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="10" r="7.5"/><path d="M10 9v5M10 6.4v.2"/></svg>`,
  placeholder: `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <rect x="8" y="38" width="48" height="8" rx="2" fill="#285be8" opacity=".55"/>
    <rect x="14" y="26" width="36" height="8" rx="2" fill="#285be8" opacity=".75"/>
    <rect x="20" y="14" width="24" height="8" rx="2" fill="#12bca4"/>
  </svg>`,
};

/* ----------------------------------------------------------------- header */

function header({ site, lang, languages, t, path }) {
  const isCurrent = (target) => path === target;

  const navLinks = map(
    site.navigation,
    (item) => `          <a href="${attr(href(lang, item.path))}"${
      isCurrent(item.path) ? ' aria-current="page"' : ''
    }>${esc(t.nav[item.key])}</a>`
  );

  const langLinks = map(
    languages,
    (l) =>
      `          <a href="${attr(href(l, path))}" lang="${attr(l.code)}" hreflang="${attr(
        l.code
      )}"${l.code === lang.code ? ' aria-current="true"' : ''} title="${attr(l.name)}">${esc(
        l.label
      )}</a>`
  );

  const drawerLinks = map(
    [...site.navigation, { key: 'contact', path: '/contact/' }],
    (item) => `      <a href="${attr(href(lang, item.path))}"${
      isCurrent(item.path) ? ' aria-current="page"' : ''
    }>${esc(t.nav[item.key])}</a>`
  );

  return `  <header class="site-header" data-header>
    <div class="shell header-inner">
      <a class="brand" href="${attr(href(lang, '/'))}">
        ${icons.brandMark}
        <span>${esc(site.brand.name)}</span>
      </a>

      <nav class="main-nav" aria-label="${attr(t.nav.home)}">
${navLinks}
      </nav>

      <div class="header-actions">
        <nav class="lang-switch" aria-label="${attr(t.ui.languageLabel)}">
${langLinks}
        </nav>
        <a class="btn btn--sm" href="${attr(href(lang, '/contact/'))}">${esc(t.nav.contact)}</a>
        <button type="button" class="menu-toggle" data-menu-toggle aria-expanded="false"
          aria-controls="site-drawer"
          aria-label="${attr(t.ui.openMenu)}"
          data-label-open="${attr(t.ui.openMenu)}"
          data-label-close="${attr(t.ui.closeMenu)}">
          ${icons.menu}
        </button>
      </div>
    </div>
  </header>

  <div class="drawer" id="site-drawer" data-drawer data-open="false">
    <nav aria-label="${attr(t.nav.home)}">
${drawerLinks}
    </nav>
    <a class="btn btn--lg" href="${attr(href(lang, '/contact/'))}">${esc(t.ui.primaryCta)}</a>
  </div>`;
}

/* ----------------------------------------------------------------- footer */

function footer({ site, lang, t }) {
  const year = new Date().getFullYear();

  const navItems = map(
    site.footerNavigation,
    (item) => `          <li><a href="${attr(href(lang, item.path))}">${esc(t.nav[item.key])}</a></li>`
  );

  return `  <footer class="site-footer">
    <div class="shell">
      <div class="footer-grid">
        <div>
          <a class="footer-brand" href="${attr(href(lang, '/'))}">
            ${icons.brandMark}
            <span>${esc(site.brand.name)}</span>
          </a>
          <p class="footer-tagline">${esc(t.footer.tagline)}</p>
          <p class="footer-desc">${esc(t.footer.description)}</p>
        </div>

        <div>
          <h2 class="footer-col-title">${esc(t.footer.navTitle)}</h2>
          <ul class="footer-list">
${navItems}
          </ul>
        </div>

        <div>
          <h2 class="footer-col-title">${esc(t.footer.contactTitle)}</h2>
          <ul class="footer-list">
            <li><a href="mailto:${attr(site.contact.email)}">${esc(site.contact.email)}</a></li>
            <li><a href="tel:${attr(site.contact.phone)}">${esc(site.contact.phoneDisplay)}</a></li>
            <li><a href="${attr(site.contact.zalo)}" rel="noopener">Zalo</a></li>
            <li>${esc(site.contact.location.city)}, ${esc(site.contact.location.country)}</li>
          </ul>
        </div>
      </div>

      <div class="footer-meta">
        <span>© ${year} ${esc(t.footer.rights)}</span>
        <span>${esc(site.brand.name)} · ${esc(site.brand.concept)}</span>
      </div>
    </div>
  </footer>`;
}

/* --------------------------------------------------------------- document */

export function document_({
  site,
  lang,
  languages,
  t,
  path,
  title,
  description,
  image,
  noindex,
  bodyClass,
  structuredData,
  extraHead,
  main,
}) {
  const ld = (structuredData || [])
    .filter(Boolean)
    .map((data) => `  <script type="application/ld+json">${jsonLd(data)}</script>`)
    .join('\n');

  return `<!doctype html>
<html lang="${attr(lang.code)}">
<head>
${head({ site, lang, languages, path, title, description, image, noindex, extraHead })}
${ld}
</head>
<body${bodyClass ? ` class="${attr(bodyClass)}"` : ''}>
  <a class="skip-link" href="#main">${esc(t.ui.skipToContent)}</a>

${header({ site, lang, languages, t, path })}

  <main id="main">
${main}
  </main>

${footer({ site, lang, t })}

  <script type="module" src="/assets/js/app.js"></script>
</body>
</html>
`;
}

/* ------------------------------------------------------- shared fragments */

export function ctaBand({ site, lang, t }) {
  return `    <section class="cta-band">
      <div class="shell">
        <p class="marker">${esc(t.home.cta.title ? t.nav.contact : '')}</p>
        <h2>${esc(t.home.cta.title)}</h2>
        <p class="lead">${esc(t.home.cta.lead)}</p>
        <div class="btn-row">
          <a class="btn btn--lg btn--on-dark" href="${attr(href(lang, '/contact/'))}">${esc(
    t.home.cta.cta
  )}</a>
          <a class="btn btn--lg btn--ghost-on-dark" href="tel:${attr(site.contact.phone)}">${esc(
    t.home.cta.secondary
  )} ${esc(site.contact.phoneDisplay)}</a>
        </div>
      </div>
    </section>`;
}

/* Responsive variants produced by scripts/build-images.py. Supplied by the
   build so this module stays free of file-system access. */
let imageManifest = {};
export function setImageManifest(manifest) {
  imageManifest = manifest || {};
}

/** Look up a local image's responsive variants, extension-insensitively. */
function resolveImage(src) {
  if (!src || /^https?:/i.test(src)) return null;
  const key = src.replace(/\.(webp|jpe?g|png|avif)$/i, '');
  return imageManifest[key] || null;
}

const DEFAULT_SIZES = '(max-width: 40rem) 92vw, (max-width: 64rem) 46vw, 30vw';

/**
 * A figure that degrades to branded editorial artwork when no usable image
 * exists, and serves responsive variants when the image is one of ours.
 */
export function figure({ src, alt, ratio = '16x9', credit, sizes, eager, category }) {
  const cat = category ? ` data-category="${attr(category)}"` : '';

  if (!src) {
    return `<figure class="media media--${attr(ratio)} media--placeholder" role="img" aria-label="${attr(
      alt || ''
    )}"${cat}></figure>`;
  }

  const variant = resolveImage(src);
  const url = variant ? variant.src : src;
  const external = /^https?:/i.test(src);

  /* A publisher's image can be withdrawn or hotlink-blocked at any time.
     The inline handler runs even if it fails before the page's scripts have
     parsed, which a listener registered later would miss. */
  const onError = external
    ? ` referrerpolicy="no-referrer" onerror="this.closest('figure').classList.add('media--placeholder')"`
    : '';

  return `<figure class="media media--${attr(ratio)}"${cat}><img src="${attr(url)}"${
    variant ? ` srcset="${attr(variant.srcset)}" sizes="${attr(sizes || DEFAULT_SIZES)}"` : ''
  } alt="${attr(alt || '')}" ${
    eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'
  } decoding="async"${onError}>${
    credit ? `<figcaption class="u-visually-hidden">${esc(credit)}</figcaption>` : ''
  }</figure>`;
}
