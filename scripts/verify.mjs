#!/usr/bin/env node
/**
 * Release gate. Checks the built output rather than trusting the build.
 *
 *   npm run verify
 *
 * It fails on anything that would reach a visitor as a broken page: a link
 * or asset that does not resolve, a page missing its title or description,
 * a portfolio page that lost its noindex, a sitemap entry that does not
 * exist on disk. Warnings cover things worth knowing but not blocking.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const exists = async (p) => Boolean(await fs.stat(p).catch(() => null));

async function htmlFiles(dir, acc = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'src') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await htmlFiles(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

/** Resolve a site-absolute URL to a file on disk, the way Pages would. */
async function resolveHref(href) {
  const clean = href.split('#')[0].split('?')[0];
  if (!clean || clean === '/') return exists(path.join(ROOT, 'index.html'));
  const target = path.join(ROOT, clean.replace(/^\//, ''));
  if (clean.endsWith('/')) return exists(path.join(target, 'index.html'));
  return exists(target);
}

async function main() {
  const pages = await htmlFiles(ROOT);
  if (pages.length < 40) fail(`only ${pages.length} pages built; expected the full multilingual set`);

  const linkCache = new Map();
  const check = async (href) => {
    if (!linkCache.has(href)) linkCache.set(href, await resolveHref(href));
    return linkCache.get(href);
  };

  let checkedLinks = 0;
  let checkedAssets = 0;

  for (const file of pages) {
    const rel = path.relative(ROOT, file);
    const html = await fs.readFile(file, 'utf8');

    /* --- head essentials ------------------------------------------------ */
    if (!/<title>[^<]{10,}<\/title>/.test(html)) fail(`${rel}: missing or empty <title>`);
    /* Chinese says the same thing in far fewer characters, so the floor is
       set where an empty or truncated description would still be caught. */
    const minDescription = /<html lang="zh"/.test(html) ? 16 : 30;
    if (!new RegExp(`<meta name="description" content="[^"]{${minDescription},}"`).test(html)) {
      fail(`${rel}: missing or short meta description`);
    }
    if (!/<link rel="canonical"/.test(html)) fail(`${rel}: missing canonical`);
    if (!/<html lang="(vi|en|zh)"/.test(html)) fail(`${rel}: missing or unexpected lang`);
    if (!/<a class="skip-link"/.test(html)) fail(`${rel}: missing skip link`);

    /* --- portfolio must stay out of the index ---------------------------- */
    const isPortfolio = rel.includes('portfolio');
    if (isPortfolio && !/name="robots" content="noindex/.test(html)) {
      fail(`${rel}: portfolio page is indexable`);
    }
    if (!isPortfolio && rel !== '404.html' && /name="robots" content="noindex/.test(html)) {
      warn(`${rel}: noindex on a public page`);
    }

    /* --- internal links --------------------------------------------------- */
    for (const match of html.matchAll(/href="(\/[^"#?][^"]*)"/g)) {
      const href = match[1];
      if (href.startsWith('//')) continue;
      checkedLinks += 1;
      if (!(await check(href))) fail(`${rel}: dead link ${href}`);
    }

    /* --- local assets ----------------------------------------------------- */
    for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
      checkedAssets += 1;
      if (!(await exists(path.join(ROOT, match[1].replace(/^\//, ''))))) {
        fail(`${rel}: missing asset ${match[1]}`);
      }
    }
    for (const match of html.matchAll(/url\('(\/assets\/[^']+)'\)/g)) {
      checkedAssets += 1;
      if (!(await exists(path.join(ROOT, match[1].replace(/^\//, ''))))) {
        fail(`${rel}: missing asset ${match[1]}`);
      }
    }

    /* --- images need alt text -------------------------------------------- */
    for (const match of html.matchAll(/<img\b[^>]*>/g)) {
      if (!/\balt=/.test(match[0])) fail(`${rel}: <img> without alt`);
    }

    /* --- no leftover scaffolding ------------------------------------------ */
    for (const token of ['undefined', 'NaN', '[object Object]', 'lorem ipsum', 'TODO']) {
      if (html.includes(`>${token}<`) || html.includes(`"${token}"`)) {
        fail(`${rel}: contains "${token}"`);
      }
    }
  }

  /* --- sitemap --------------------------------------------------------- */
  const sitemap = await fs.readFile(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (!locs.length) fail('sitemap.xml has no entries');
  for (const loc of locs) {
    const pathname = new URL(loc).pathname;
    if (!(await resolveHref(pathname))) fail(`sitemap: ${pathname} does not exist`);
    if (pathname.includes('/portfolio')) fail(`sitemap: portfolio leaked into the sitemap (${pathname})`);
  }

  /* --- newsroom data ----------------------------------------------------- */
  const snapshot = JSON.parse(await fs.readFile(path.join(ROOT, 'data/news.json'), 'utf8'));
  const items = snapshot.items || [];
  if (!items.length) fail('data/news.json has no stories');

  const categories = new Set(items.flatMap((i) => i.categorySlugs || []));
  const publishers = new Set(items.map((i) => i.sourceName));
  const dated = items.filter((i) => i.publishedAt).length;
  const withImage = items.filter((i) => i.imageRightsStatus === 'approved' && i.imageUrl).length;

  for (const item of items) {
    if (!item.canonicalUrl?.startsWith('https://')) fail(`news ${item.id}: non-https canonical URL`);
    if (item.publishedAt && Number.isNaN(Date.parse(item.publishedAt))) {
      fail(`news ${item.id}: unparseable publishedAt`);
    }
    if (!item.fetchedAt) fail(`news ${item.id}: no fetchedAt`);
    if (item.publishedAt === item.fetchedAt) fail(`news ${item.id}: fetch time reused as publish time`);
  }

  if (items.length < 24) {
    warn(
      `newsroom coverage: ${items.length} verified stories, below the 24 target. ` +
        'Run `npm run news` from a machine that can reach the feeds.'
    );
  }
  if (categories.size < 4) warn(`newsroom covers only ${categories.size} categories`);

  for (const lang of ['vi', 'en', 'zh']) {
    const archive = path.join(ROOT, `data/archive-${lang}.json`);
    if (!(await exists(archive))) fail(`missing data/archive-${lang}.json`);
  }

  /* --- weight ----------------------------------------------------------- */
  const sizeOf = async (dir) => {
    let total = 0;
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) total += await sizeOf(full);
      else total += (await fs.stat(full)).size;
    }
    return total;
  };
  const assetBytes = await sizeOf(path.join(ROOT, 'assets'));
  const cssBytes = (await fs.stat(path.join(ROOT, 'assets/css/dng.css'))).size;
  if (cssBytes > 90_000) warn(`CSS bundle is ${(cssBytes / 1024).toFixed(0)} KB`);

  /* --- report ----------------------------------------------------------- */
  console.log('--- verify ---');
  console.log(`pages          : ${pages.length}`);
  console.log(`links checked  : ${checkedLinks}`);
  console.log(`assets checked : ${checkedAssets}`);
  console.log(`sitemap urls   : ${locs.length}`);
  console.log(`news stories   : ${items.length} from ${publishers.size} publishers`);
  console.log(`  categories   : ${[...categories].join(', ')}`);
  console.log(`  with date    : ${dated}/${items.length}`);
  console.log(`  with image   : ${withImage}/${items.length} (rest use DNGWORKS artwork)`);
  console.log(`css bundle     : ${(cssBytes / 1024).toFixed(1)} KB`);
  console.log(`assets total   : ${(assetBytes / 1024 / 1024).toFixed(1)} MB`);

  for (const message of warnings) console.log(`WARN  ${message}`);
  for (const message of errors) console.log(`FAIL  ${message}`);

  console.log(errors.length ? `\n${errors.length} failure(s)` : '\nall checks passed');
  process.exitCode = errors.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
