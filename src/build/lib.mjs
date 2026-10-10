/**
 * Build helpers: escaping, URL shape, SEO head, structured data.
 * Every string that reaches a template passes through `esc` or `attr`.
 */

const AMP = /&/g;
const LT = /</g;
const GT = />/g;
const QUOT = /"/g;
const APOS = /'/g;

/** Escape text for element content. */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(AMP, '&amp;')
    .replace(LT, '&lt;')
    .replace(GT, '&gt;');
}

/** Escape text for a double-quoted attribute value. */
export function attr(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(AMP, '&amp;')
    .replace(LT, '&lt;')
    .replace(GT, '&gt;')
    .replace(QUOT, '&quot;')
    .replace(APOS, '&#39;');
}

/** JSON embedded in a data attribute or a script block. */
export function jsonAttr(value) {
  return attr(JSON.stringify(value));
}

export function jsonLd(value) {
  /* `</script>` inside JSON would close the block early. */
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export const join = (parts) => parts.filter(Boolean).join('\n');
export const map = (list, fn) => (list || []).map(fn).join('\n');

/* ------------------------------------------------------------------- URLs */

/** Language-prefixed site path. `/` for the default language root. */
export function href(lang, path = '/') {
  const prefix = lang.prefix || '';
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (clean === '/') return prefix ? `${prefix}/` : '/';
  return `${prefix}${clean}`;
}

/** Absolute URL for canonical tags, sitemap and structured data. */
export function absolute(site, path) {
  const base = String(site.urls.production || '').replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export const ARTICLE_ROUTES = {
  briefing: 'briefings',
  analysis: 'analysis',
  playbook: 'playbooks',
};

export function articlePath(article) {
  const segment = ARTICLE_ROUTES[article.type] || 'analysis';
  return `/intelligence/${segment}/${article.slug}/`;
}

/* --------------------------------------------------------- text utilities */

export function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(text, limit = 158) {
  const clean = stripTags(text);
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit - 1).replace(/[\s,;:.]+\S*$/, '')}…`;
}

export function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Add stable ids to the h2/h3 headings of stored article HTML so the reader
 * can build an in-page index and deep links survive.
 */
export function withHeadingIds(html) {
  const used = new Map();
  const headings = [];
  const out = String(html || '').replace(
    /<(h[23])([^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, tag, attrs, inner) => {
      if (/\sid=/i.test(attrs)) return match;
      const text = stripTags(inner);
      let id = slugify(text) || `s-${headings.length + 1}`;
      const seen = used.get(id) || 0;
      used.set(id, seen + 1);
      if (seen) id = `${id}-${seen + 1}`;
      headings.push({ id, text, level: Number(tag[1]) });
      return `<${tag}${attrs} id="${attr(id)}">${inner}</${tag}>`;
    }
  );
  return { html: out, headings };
}

/* --------------------------------------------------------------- SEO head */

export function head({ site, lang, languages, path, title, description, image, noindex, extraHead }) {
  const canonical = absolute(site, href(lang, path));
  const ogImage = absolute(site, image || '/assets/images/social/og-default.jpg');
  const fontPreloads = [
    'be-vietnam-pro-latin-400',
    'be-vietnam-pro-latin-700',
    lang.fontStack === 'vn' ? 'be-vietnam-pro-vietnamese-400' : null,
    lang.fontStack === 'vn' ? 'be-vietnam-pro-vietnamese-700' : null,
    lang.fontStack === 'sc' ? 'noto-sans-sc-subset-400' : null,
  ].filter(Boolean);

  return join([
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '  <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">',
    `  <title>${esc(title)}</title>`,
    `  <meta name="description" content="${attr(description)}">`,
    noindex
      ? '  <meta name="robots" content="noindex, nofollow">'
      : '  <meta name="robots" content="index, follow, max-image-preview:large">',
    `  <link rel="canonical" href="${attr(canonical)}">`,
    /* A page that is not indexed has no translated twin to point at — the
       404 is served from one file for every path. */
    ...(noindex
      ? []
      : [
          ...languages.map(
            (l) =>
              `  <link rel="alternate" hreflang="${attr(l.code)}" href="${attr(
                absolute(site, href(l, path))
              )}">`
          ),
          `  <link rel="alternate" hreflang="x-default" href="${attr(absolute(site, path))}">`,
        ]),
    '  <link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    '  <link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    '  <link rel="manifest" href="/site.webmanifest">',
    ...fontPreloads.map(
      (name) =>
        `  <link rel="preload" href="/assets/fonts/${attr(name)}.woff2" as="font" type="font/woff2" crossorigin>`
    ),
    '  <link rel="stylesheet" href="/assets/css/dng.css">',
    `  <meta property="og:type" content="website">`,
    `  <meta property="og:site_name" content="${attr(site.brand.name)}">`,
    `  <meta property="og:locale" content="${attr(lang.locale)}">`,
    `  <meta property="og:title" content="${attr(title)}">`,
    `  <meta property="og:description" content="${attr(description)}">`,
    `  <meta property="og:url" content="${attr(canonical)}">`,
    `  <meta property="og:image" content="${attr(ogImage)}">`,
    '  <meta name="twitter:card" content="summary_large_image">',
    `  <meta name="twitter:title" content="${attr(title)}">`,
    `  <meta name="twitter:description" content="${attr(description)}">`,
    `  <meta name="twitter:image" content="${attr(ogImage)}">`,
    extraHead || '',
  ]);
}

/* ------------------------------------------------------- structured data */

export function organisationLd(site, lang, t) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${absolute(site, '/')}#organisation`,
    name: site.brand.name,
    description: t.meta.defaultDescription,
    url: absolute(site, href(lang, '/')),
    founder: { '@type': 'Person', name: site.brand.person },
    email: `mailto:${site.contact.email}`,
    telephone: site.contact.phone,
    areaServed: site.contact.location.country,
    address: {
      '@type': 'PostalAddress',
      addressLocality: site.contact.location.city,
      addressCountry: site.contact.location.countryCode,
    },
    knowsLanguage: ['vi', 'en'],
  };
}

export function articleLd(site, lang, article, body) {
  const path = href(lang, articlePath(article));
  return {
    '@context': 'https://schema.org',
    '@type': article.type === 'briefing' ? 'NewsArticle' : 'Article',
    headline: body.title,
    description: truncate(body.summary, 200),
    inLanguage: lang.code,
    datePublished: article.publishedAt || undefined,
    dateModified: article.updatedAt || article.publishedAt || undefined,
    author: { '@type': 'Person', name: article.author },
    publisher: { '@type': 'Organization', name: site.brand.name },
    mainEntityOfPage: absolute(site, path),
    image: article.cover ? absolute(site, article.cover) : undefined,
    articleSection: article.category,
    isAccessibleForFree: true,
  };
}

export function breadcrumbLd(site, lang, trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absolute(site, href(lang, item.path)),
    })),
  };
}
