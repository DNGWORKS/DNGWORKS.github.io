#!/usr/bin/env node
/**
 * DNGWORKS — static site build.
 *
 * Renders every page of the site, for all three languages, straight into the
 * repository root. The result is what GitHub Pages serves: plain HTML, CSS
 * and ES modules, no runtime and no server.
 *
 *   node scripts/build.mjs
 *   node scripts/build.mjs --check    render into memory and report only
 *
 * Content lives in content/. Styles and page templates live in src/. Nothing
 * in the published output is hand-edited; re-run this after a content change.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { document_, setImageManifest } from '../src/build/shell.mjs';
import * as pages from '../src/build/pages.mjs';
import {
  href,
  absolute,
  articlePath,
  truncate,
  organisationLd,
  articleLd,
  breadcrumbLd,
} from '../src/build/lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

const STYLE_ORDER = [
  '01-tokens.css',
  '02-fonts.css',
  '03-base.css',
  '04-layout.css',
  '05-components.css',
  '06-hero.css',
  '07-newsroom.css',
  '08-article.css',
  '09-pages.css',
];

const SCRIPTS = [
  'app.js',
  'hero-growth-architecture.js',
  'tools.js',
  'newsroom.js',
  'contact.js',
];

const written = [];

async function readJson(relative) {
  return JSON.parse(await fs.readFile(path.join(ROOT, relative), 'utf8'));
}

async function write(relative, contents) {
  const target = path.join(ROOT, relative);
  written.push({ path: relative, bytes: Buffer.byteLength(contents) });
  if (CHECK) return;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents, 'utf8');
}

/* ------------------------------------------------------------------ styles */

/**
 * Conservative CSS minifier: strips comments and collapses whitespace around
 * structural characters. It does not attempt to rewrite values, so nothing
 * can be silently broken, and it needs no dependency on the build machine.
 */
function minifyCss(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/\s*([+~])\s*(?=[.#:[a-zA-Z*])/g, '$1')
    .trim();
}

async function buildStyles() {
  const parts = [];
  for (const name of STYLE_ORDER) {
    parts.push(await fs.readFile(path.join(ROOT, 'src/styles', name), 'utf8'));
  }
  const banner = '/*! DNGWORKS design system — built from src/styles, do not edit here */\n';
  await write('assets/css/dng.css', banner + minifyCss(parts.join('\n')) + '\n');
}

async function copyScripts() {
  for (const name of SCRIPTS) {
    const source = await fs.readFile(path.join(ROOT, 'src/js', name), 'utf8');
    await write(`assets/js/${name}`, source);
  }
}

/* -------------------------------------------------------------- page specs */

function articleBody(article, lang) {
  const body = article.i18n[lang.code] || article.i18n.vi;
  return {
    title: body.title,
    summary: body.summary,
    body: body.body,
    takeaways: body.takeaways || [],
    evidenceNote: body.evidenceNote || '',
  };
}

/** Flatten an article into the record shape the newsroom components expect. */
function articleRecord(article, lang) {
  const body = articleBody(article, lang);
  return {
    id: article.slug,
    type: article.type,
    title: body.title,
    summary: body.summary,
    localPath: articlePath(article),
    canonicalUrl: null,
    sourceName: 'DNGWORKS',
    publishedAt: article.publishedAt,
    fetchedAt: null,
    categorySlugs: [article.category],
    imageUrl: article.cover,
    imageRightsStatus: 'approved',
    imageCredit: article.coverCredit,
    cover: article.cover,
    featured: article.featured,
    readMinutes: article.readMinutes,
    status: article.status,
  };
}

/* -------------------------------------------------------------------- main */

async function main() {
  const site = await readJson('content/site.json');
  const articlesRaw = await readJson('content/articles.json');
  const portfolioRaw = await readJson('content/portfolio.json');
  const snapshot = await readJson('data/news.json');

  /* Responsive image variants, if scripts/build-images.py has been run. */
  try {
    setImageManifest(await readJson('content/image-manifest.json'));
  } catch {
    console.warn('no content/image-manifest.json — images will be served at one size');
  }

  const languages = site.languages;
  const i18n = {};
  for (const lang of languages) {
    i18n[lang.code] = await readJson(`content/i18n/${lang.code}.json`);
  }

  const published = articlesRaw.filter((a) => a.status === 'published');
  const externalItems = (snapshot.items || []).filter((i) => i.status === 'published');

  await buildStyles();
  await copyScripts();

  /* --- per-language archive: external stories plus this language's own
         writing, which is what the newsroom filter reads ------------------ */
  for (const lang of languages) {
    const records = [
      ...published.map((article) => articleRecord(article, lang)),
      ...externalItems,
    ];
    await write(
      `data/archive-${lang.code}.json`,
      `${JSON.stringify(
        {
          schema: 'dng-newsroom-archive/1',
          language: lang.code,
          snapshotUpdatedAt: snapshot.snapshotUpdatedAt,
          stale: Boolean(snapshot.stale),
          total: records.length,
          items: records,
        },
        null,
        2
      )}\n`
    );
  }

  /* ------------------------------------------------------------- pages --- */
  const sitemap = [];

  const addPage = async ({ lang, pathname, html, priority, noindex }) => {
    const target = href(lang, pathname);
    const file = target === '/' ? 'index.html' : `${target.replace(/^\/|\/$/g, '')}/index.html`;
    await write(file, html);
    if (!noindex) sitemap.push({ loc: absolute(site, target), priority });
  };

  for (const lang of languages) {
    const t = i18n[lang.code];
    const common = { site, lang, languages, t };

    const news = {
      snapshotUpdatedAt: snapshot.snapshotUpdatedAt,
      items: externalItems,
    };
    const langArticles = published.map((article) => ({
      ...articleRecord(article, lang),
      article,
    }));

    /* --- home --------------------------------------------------------- */
    await addPage({
      lang,
      pathname: '/',
      priority: '1.0',
      html: document_({
        ...common,
        path: '/',
        title: t.meta.siteTitle,
        description: t.meta.defaultDescription,
        image: '/assets/images/social/og-home.jpg',
        structuredData: [
          organisationLd(site, lang, t),
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: site.brand.name,
            url: absolute(site, href(lang, '/')),
            inLanguage: lang.code,
          },
        ],
        main: pages.home({ ...common, articles: langArticles, news }),
      }),
    });

    /* --- services ----------------------------------------------------- */
    await addPage({
      lang,
      pathname: '/services/',
      priority: '0.9',
      html: document_({
        ...common,
        path: '/services/',
        title: `${t.services.hero.label} — ${site.brand.name}`,
        description: truncate(t.services.hero.lead, 158),
        structuredData: [
          breadcrumbLd(site, lang, [
            { name: t.nav.home, path: '/' },
            { name: t.nav.services, path: '/services/' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: t.services.hero.title,
            itemListElement: t.services.items.map((item, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: item.title,
              url: `${absolute(site, href(lang, '/services/'))}#${item.slug}`,
            })),
          },
        ],
        main: pages.services(common),
      }),
    });

    /* --- tools -------------------------------------------------------- */
    await addPage({
      lang,
      pathname: '/tools/',
      priority: '0.8',
      html: document_({
        ...common,
        path: '/tools/',
        title: `${t.tools.hero.label} — ${site.brand.name}`,
        description: truncate(t.tools.hero.lead, 158),
        structuredData: [
          breadcrumbLd(site, lang, [
            { name: t.nav.home, path: '/' },
            { name: t.nav.tools, path: '/tools/' },
          ]),
        ],
        main: pages.tools(common),
      }),
    });

    /* --- about -------------------------------------------------------- */
    await addPage({
      lang,
      pathname: '/about/',
      priority: '0.7',
      html: document_({
        ...common,
        path: '/about/',
        title: `${t.about.hero.label} — ${site.brand.name}`,
        description: truncate(t.about.hero.lead, 158),
        structuredData: [
          organisationLd(site, lang, t),
          breadcrumbLd(site, lang, [
            { name: t.nav.home, path: '/' },
            { name: t.nav.about, path: '/about/' },
          ]),
        ],
        main: pages.about(common),
      }),
    });

    /* --- contact ------------------------------------------------------ */
    await addPage({
      lang,
      pathname: '/contact/',
      priority: '0.7',
      html: document_({
        ...common,
        path: '/contact/',
        title: `${t.contact.hero.label} — ${site.brand.name}`,
        description: truncate(t.contact.hero.lead, 158),
        structuredData: [
          breadcrumbLd(site, lang, [
            { name: t.nav.home, path: '/' },
            { name: t.nav.contact, path: '/contact/' },
          ]),
        ],
        main: pages.contact(common),
      }),
    });

    /* --- newsroom ----------------------------------------------------- */
    await addPage({
      lang,
      pathname: '/intelligence/',
      priority: '0.9',
      html: document_({
        ...common,
        path: '/intelligence/',
        title: `${t.intelligence.hero.label} — ${site.brand.name}`,
        description: truncate(t.intelligence.hero.lead, 158),
        structuredData: [
          breadcrumbLd(site, lang, [
            { name: t.nav.home, path: '/' },
            { name: t.nav.intelligence, path: '/intelligence/' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: t.intelligence.hero.title,
            inLanguage: lang.code,
            url: absolute(site, href(lang, '/intelligence/')),
          },
        ],
        main: pages
          .intelligence({ ...common, articles: langArticles, news })
          /* The archive region reads the language's own file. */
          .replace('data-source="/data/news.json"', `data-source="/data/archive-${lang.code}.json"`),
      }),
    });

    await addPage({
      lang,
      pathname: '/intelligence/source-policy/',
      priority: '0.4',
      html: document_({
        ...common,
        path: '/intelligence/source-policy/',
        title: `${t.intelligence.sourcePolicy.title} — ${site.brand.name}`,
        description: truncate(t.intelligence.sourcePolicy.lead, 158),
        structuredData: [
          breadcrumbLd(site, lang, [
            { name: t.nav.home, path: '/' },
            { name: t.nav.intelligence, path: '/intelligence/' },
            { name: t.nav.sourcePolicy, path: '/intelligence/source-policy/' },
          ]),
        ],
        main: pages.sourcePolicy(common),
      }),
    });

    /* --- articles ----------------------------------------------------- */
    for (let index = 0; index < published.length; index += 1) {
      const record = published[index];
      const body = articleBody(record, lang);

      /* Next article stays inside the same section where possible, so the
         reading path is coherent rather than random. */
      const sameType = published.filter((a) => a.type === record.type && a.slug !== record.slug);
      const nextSource = sameType[0] || published[(index + 1) % published.length];
      const next =
        nextSource && nextSource.slug !== record.slug
          ? { article: nextSource, ...articleBody(nextSource, lang) }
          : null;

      const related = published
        .filter((a) => a.slug !== record.slug && a.slug !== nextSource?.slug)
        .filter((a) => a.category === record.category || a.type === record.type)
        .slice(0, 3)
        .map((a) => ({ article: a, ...articleBody(a, lang) }));

      await addPage({
        lang,
        pathname: articlePath(record),
        priority: '0.6',
        html: document_({
          ...common,
          path: articlePath(record),
          title: `${body.title} — ${site.brand.name}`,
          description: truncate(body.summary, 158),
          image: record.cover,
          structuredData: [
            articleLd(site, lang, record, body),
            breadcrumbLd(site, lang, [
              { name: t.nav.home, path: '/' },
              { name: t.nav.intelligence, path: '/intelligence/' },
              { name: body.title, path: articlePath(record) },
            ]),
          ],
          main: pages.article({ ...common, article: record, body, next, related }),
        }),
      });
    }

    /* --- portfolio: reachable by direct link, absent from navigation,
           sitemap and indexing ----------------------------------------- */
    const cases = portfolioRaw.map((item) => ({
      slug: item.slug,
      year: item.year,
      images: item.images,
      body: item.i18n[lang.code] || item.i18n.vi,
    }));

    await addPage({
      lang,
      pathname: '/portfolio/',
      noindex: true,
      html: document_({
        ...common,
        path: '/portfolio/',
        title: `${t.portfolio.hero.label} — ${site.brand.name}`,
        description: truncate(t.portfolio.hero.lead, 158),
        noindex: true,
        main: pages.portfolioIndex({ ...common, cases }),
      }),
    });

    for (const item of cases) {
      await addPage({
        lang,
        pathname: `/portfolio/${item.slug}/`,
        noindex: true,
        html: document_({
          ...common,
          path: `/portfolio/${item.slug}/`,
          title: `${item.body.title} — ${t.portfolio.hero.label}`,
          description: truncate(item.body.context, 158),
          noindex: true,
          main: pages.portfolioIndex({ ...common, cases: [item] }),
        }),
      });
    }
  }

  /* --- 404: one file at the root, in the default language --------------- */
  const defaultLang = languages.find((l) => l.code === site.defaultLanguage) || languages[0];
  await write(
    '404.html',
    document_({
      site,
      lang: defaultLang,
      languages,
      t: i18n[defaultLang.code],
      /* The 404 is served from one file for every path, so its header
         language switcher points at each language's home rather than at a
         translated copy of itself. */
      path: '/',
      title: `${i18n[defaultLang.code].notFound.title} — ${site.brand.name}`,
      description: i18n[defaultLang.code].notFound.lead,
      noindex: true,
      main: pages.notFound({ site, lang: defaultLang, t: i18n[defaultLang.code] }),
    })
  );

  /* --- sitemap and robots ---------------------------------------------- */
  const today = new Date().toISOString().slice(0, 10);
  await write(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap
  .map(
    (entry) =>
      `  <url><loc>${entry.loc}</loc><lastmod>${today}</lastmod><priority>${entry.priority}</priority></url>`
  )
  .join('\n')}
</urlset>
`
  );

  await write(
    'robots.txt',
    `User-agent: *
Allow: /
Disallow: /portfolio/
Disallow: /en/portfolio/
Disallow: /zh/portfolio/

Sitemap: ${absolute(site, '/sitemap.xml')}
`
  );

  /* GitHub Pages runs Jekyll by default, which would skip any path starting
     with an underscore. This file turns that off. */
  await write('.nojekyll', '');

  await write(
    'site.webmanifest',
    `${JSON.stringify(
      {
        name: site.brand.name,
        short_name: site.brand.name,
        description: i18n[site.defaultLanguage].meta.defaultDescription,
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#285be8',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      null,
      2
    )}\n`
  );

  /* --- report ----------------------------------------------------------- */
  const html = written.filter((f) => f.path.endsWith('.html'));
  const total = written.reduce((sum, f) => sum + f.bytes, 0);

  console.log(`${CHECK ? 'checked' : 'built'} ${written.length} files, ${(total / 1024).toFixed(0)} KB`);
  console.log(`  html pages     : ${html.length}`);
  console.log(`  sitemap urls   : ${sitemap.length}`);
  console.log(`  languages      : ${languages.map((l) => l.code).join(', ')}`);
  console.log(`  articles       : ${published.length} × ${languages.length}`);
  console.log(`  external news  : ${externalItems.length}`);
  console.log(
    `  css bundle     : ${(written.find((f) => f.path.endsWith('dng.css')).bytes / 1024).toFixed(1)} KB`
  );

  const heaviest = [...html].sort((a, b) => b.bytes - a.bytes).slice(0, 3);
  for (const file of heaviest) {
    console.log(`  largest page   : ${file.path} ${(file.bytes / 1024).toFixed(0)} KB`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
