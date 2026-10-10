#!/usr/bin/env node
/**
 * DNG Intelligence — news ingestion.
 *
 * Produces data/news.json: the durable snapshot the website reads. The site
 * is static, so collection happens here (on a schedule or by hand), never on
 * a visitor's request.
 *
 *   node scripts/ingest-news.mjs                      fetch the verified feeds
 *   node scripts/ingest-news.mjs --from <file.json>   normalise an export
 *   node scripts/ingest-news.mjs --dry-run            report, write nothing
 *
 * Rules this script enforces, from the editorial policy:
 *   - only sources marked verified in content/news-sources.json are fetched
 *   - relevance is scored against the newsroom's subject matter; off-industry
 *     stories are rejected with a recorded reason
 *   - a story's publication time is kept distinct from the fetch time, and a
 *     missing publication time stays null rather than being guessed
 *   - image rights come from the source register, never from assumption
 *   - a failed run leaves the previous valid snapshot in place and marks it
 *     stale; it never empties the newsroom and never invents a story
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse, findAll, child, text, decodeEntities } from './lib/xml.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT = path.join(ROOT, 'data', 'news.json');
const REGISTER = path.join(ROOT, 'content', 'news-sources.json');

const MAX_AGE_DAYS = 45;
const FETCH_TIMEOUT = 12000;

/* A story must either name a primary subject of the newsroom, or carry
   enough secondary business signal to stand on its own. Substring matching
   is never used: "said" contains "ai" and "campaign" contains "ai", which
   would wave general news straight through. */
const PRIMARY_WEIGHT = 4;
const MIN_SCORE_WITHOUT_PRIMARY = 6;

/* ------------------------------------------------------------- relevance */

const SIGNALS = [
  {
    weight: 4,
    categories: ['ai-platforms'],
    terms: ['ai', 'a.i.', 'trí tuệ nhân tạo', 'openai', 'chatgpt', 'gpt', 'gemini', 'claude',
      'anthropic', 'llm', 'machine learning', 'mô hình ngôn ngữ', 'nvidia', 'gpu', 'copilot',
      'generative', 'ai agent', 'deepmind', 'inference', 'ai chip'],
  },
  {
    weight: 4,
    categories: ['advertising'],
    terms: ['quảng cáo', 'advertising', 'advertiser', 'ad spend', 'ad revenue', 'meta ads',
      'google ads', 'tiktok ads', 'cpm', 'cpc', 'roas', 'ad targeting', 'remarketing',
      'retargeting', 'attribution', 'performance marketing', 'media buying', 'ad platform',
      'marketing', 'truyền thông thương hiệu'],
  },
  {
    weight: 4,
    categories: ['ecommerce'],
    terms: ['thương mại điện tử', 'e-commerce', 'ecommerce', 'shopee', 'lazada', 'tiki',
      'tiktok shop', 'amazon', 'marketplace', 'asos', 'shein', 'alibaba', 'etsy', 'walmart',
      'online retailer', 'online store', 'nhà bán hàng', 'sàn thương mại', 'logistics',
      'chuỗi cung ứng', 'supply chain'],
  },
  {
    weight: 4,
    categories: ['search-seo'],
    terms: ['seo', 'google search', 'search engine', 'search console', 'serp', 'core update',
      'google maps', 'tìm kiếm trực tuyến', 'organic search'],
  },
  {
    weight: 3,
    categories: ['business-market'],
    terms: ['doanh nghiệp', 'doanh thu', 'thị trường', 'kinh doanh', 'xuất khẩu', 'lạm phát',
      'gdp', 'startup', 'đầu tư', 'cổ phiếu', 'chứng khoán', 'business', 'revenue', 'profit',
      'profits', 'earnings', 'market', 'economy', 'tăng trưởng', 'quý iii', 'quý iv',
      'funding round', 'valuation', 'ipo'],
  },
  {
    weight: 3,
    categories: ['ai-platforms'],
    terms: ['công nghệ', 'technology', 'tech', 'phần mềm', 'software', 'cloud', 'dữ liệu',
      'data', 'data centre', 'data center', 'chip', 'bán dẫn', 'semiconductor', 'apple',
      'google', 'microsoft', 'samsung', 'meta', 'tiktok', 'platform', 'cybersecurity',
      'bảo mật', 'automation', 'tự động hoá'],
  },
  {
    weight: 2,
    categories: ['business-market'],
    terms: ['người tiêu dùng', 'consumer', 'consumers', 'bán lẻ', 'retail', 'thương hiệu',
      'brand', 'giá vàng', 'tỷ giá', 'giá xăng', 'regulation', 'quy định', 'antitrust',
      'eu rules', 'privacy'],
  },
];

/** Subjects the newsroom does not cover, whatever a feed is promoting. */
const EXCLUSIONS = [
  'bóng đá', 'thể thao', 'world cup', 'ngoại hạng', 'cầu thủ', 'football', 'sport', 'sports',
  'premier league', 'olympic',
  'hoa hậu', 'ca sĩ', 'diễn viên', 'showbiz', 'nghệ sĩ', 'giải trí', 'celebrity', 'film',
  'movie', 'puzzle game', 'album',
  'tử vi', 'xổ số', 'tình yêu', 'hôn nhân', 'tâm sự',
  'ung thư', 'bệnh viện', 'triệu chứng', 'dịch bệnh', 'cancer', 'hospital', 'symptoms',
  'tai nạn', 'cháy nhà', 'bắt giữ', 'khởi tố', 'án mạng', 'execution', 'executed',
  'firing squad', 'killed', 'kills', 'attacker', 'bomb', 'shooting', 'murder', 'war',
  'airstrike', 'strike kills', 'protesters', 'flooding', 'hurricane', 'earthquake',
  'sewage', 'wildfire', 'airlifted', 'scam calls',
];

/* Compiled once. The boundary class covers Vietnamese letters, so "ai" will
   not match inside "said" but will match in "AI chip" and "ai agent". */
const BOUNDARY = '[^\\p{L}\\p{N}]';
const compile = (term) =>
  new RegExp(`(^|${BOUNDARY})${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|${BOUNDARY})`, 'iu');

const COMPILED_SIGNALS = SIGNALS.map((signal) => ({
  ...signal,
  matchers: signal.terms.map((term) => ({ term, re: compile(term) })),
}));
const COMPILED_EXCLUSIONS = EXCLUSIONS.map((term) => ({ term, re: compile(term) }));

function score(title, summary) {
  /* The headline defines the subject, so an exclusion is a veto only when it
     appears there. Vetoing on the body text would throw out a legitimate
     business story that merely mentions a conflict or an accident. */
  for (const { term, re } of COMPILED_EXCLUSIONS) {
    if (re.test(title)) {
      return { score: 0, primary: false, categories: [], reasons: [`excluded: ${term}`] };
    }
  }

  const haystack = `${title} ${summary}`;
  let total = 0;
  let primary = false;
  const categories = new Set();
  const reasons = [];

  for (const signal of COMPILED_SIGNALS) {
    const hit = signal.matchers.find(({ re }) => re.test(haystack));
    if (!hit) continue;
    total += signal.weight;
    if (signal.weight >= PRIMARY_WEIGHT) primary = true;
    for (const category of signal.categories) categories.add(category);
    reasons.push(`${hit.term} (+${signal.weight})`);
  }

  return { score: total, primary, categories: [...categories], reasons };
}

/** The editorial gate: a named subject, or enough combined business signal. */
function passesReview(relevance) {
  if (relevance.score === 0) return false;
  return relevance.primary || relevance.score >= MIN_SCORE_WITHOUT_PRIMARY;
}

/* ------------------------------------------------------- normalise fields */

function canonicalise(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref|source$|sessionid)/i.test(key)) parsed.searchParams.delete(key);
    }
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

function idFor(url) {
  return crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
}

/**
 * Many Vietnamese feeds expose a display string such as `08/10 · 11:34`
 * rather than a timestamp. The year is taken from the reference date and the
 * result is rejected if it lands in the future or outside the age window, so
 * a guessed year can never masquerade as a verified publication time. The
 * original string is kept on the record for audit.
 */
function parsePublished(raw, reference) {
  if (!raw) return { iso: null, precision: null, derivedFrom: null };

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime()) && /\d{4}/.test(String(raw))) {
    return { iso: direct.toISOString(), precision: 'exact', derivedFrom: null };
  }

  const match = String(raw).match(/(\d{1,2})[/-](\d{1,2})(?:[^\d]+(\d{1,2}):(\d{2}))?/);
  if (!match) return { iso: null, precision: null, derivedFrom: String(raw) };

  const [, d, m, hh, mm] = match;
  const year = reference.getUTCFullYear();
  const candidate = new Date(
    Date.UTC(year, Number(m) - 1, Number(d), Number(hh || 0) - 7, Number(mm || 0))
  );

  const ageDays = (reference.getTime() - candidate.getTime()) / 86400000;
  if (ageDays < -1 || ageDays > MAX_AGE_DAYS) {
    return { iso: null, precision: null, derivedFrom: String(raw) };
  }
  return { iso: candidate.toISOString(), precision: 'derived-year', derivedFrom: String(raw) };
}

function clean(value) {
  return decodeEntities(String(value || ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Some newsroom pages append their own section and date to the link text, so
 * a scraped title arrives as "Headline Product Oct 7, 2026". That tail is
 * navigation furniture, not part of the headline, and is removed.
 */
function cleanTitleText(value) {
  return clean(value)
    .replace(
      /\s+(Safety|Product|Research|Company|Policy|Security|Business|Blog|News)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2},?\s+\d{4}$/i,
      ''
    )
    .replace(/\s+[-–|]\s+(BBC News|BBC|VnExpress)$/i, '')
    .trim();
}

/** Loose duplicate detection on the headline, after canonical-URL dedupe. */
function headlineKey(title) {
  return clean(title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .slice(0, 9)
    .join(' ');
}

function buildRecord({ title, summary, url, image, source, publishedRaw }, register, reference) {
  const canonicalUrl = canonicalise(url);
  if (!canonicalUrl) return { rejected: 'invalid-url', title };

  const host = new URL(canonicalUrl).hostname.replace(/^www\./, '');
  const entry =
    register.sources.find((s) => host === s.domain || host.endsWith(`.${s.domain}`)) || null;

  const cleanTitle = cleanTitleText(title);
  const cleanSummary = clean(summary);
  if (!cleanTitle) return { rejected: 'no-title', title };

  const relevance = score(cleanTitle, cleanSummary);
  if (!passesReview(relevance)) {
    return {
      rejected: `low-relevance (${relevance.score})`,
      title: cleanTitle,
      reasons: relevance.reasons,
    };
  }

  const published = parsePublished(publishedRaw, reference);

  /* Image rights come from the register. An unknown publisher gets artwork. */
  const policy = entry?.imagePolicy || 'link_only';
  const imageUrl = policy === 'link_only' ? null : canonicalise(image);
  const imageRightsStatus =
    imageUrl && (policy === 'feed_thumbnail' || policy === 'licensed') ? 'approved' : 'source_link_only';

  return {
    record: {
      id: idFor(canonicalUrl),
      type: 'external_news',
      title: cleanTitle,
      summary: cleanSummary ? cleanSummary.slice(0, 280) : '',
      canonicalUrl,
      sourceName: entry?.publisher || source || host,
      sourceId: entry?.id || null,
      sourceUrl: `https://${host}/`,
      trustTier: entry?.trustTier ?? null,
      publishedAt: published.iso,
      publishedAtPrecision: published.precision,
      publishedAtDerivedFrom: published.derivedFrom,
      fetchedAt: reference.toISOString(),
      categorySlugs: relevance.categories.length ? relevance.categories : ['business-market'],
      relevanceScore: relevance.score,
      relevanceReasons: relevance.reasons,
      imageUrl: imageUrl || null,
      imageCredit: entry?.publisher || source || host,
      imageRightsStatus,
      language: entry?.language || null,
      status: 'published',
    },
  };
}

/* ------------------------------------------------------------------ feeds */

async function fetchFeed(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await fetch(source.feed, {
      signal: controller.signal,
      headers: { 'user-agent': 'DNGWORKS-newsroom/1.0 (+https://dngworks.github.io)' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function readFeed(xml) {
  const doc = parse(xml);
  const entries = [...findAll(doc, 'item'), ...findAll(doc, 'entry')];

  return entries.map((entry) => {
    const media =
      child(entry, 'media:content') ||
      child(entry, 'content') ||
      child(entry, 'media:thumbnail') ||
      child(entry, 'thumbnail') ||
      child(entry, 'enclosure');

    let link = text(entry, 'link');
    if (!link) {
      const linkNode = entry.children.find((c) => c.name.endsWith('link') && c.attrs.href);
      link = linkNode?.attrs.href || '';
    }

    const description = text(entry, 'description') || text(entry, 'summary');
    let image = media?.attrs?.url || media?.attrs?.href || '';
    if (!image) {
      /* Some feeds only embed the image inside the description markup. */
      const found = description.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (found) image = found[1];
    }

    return {
      title: text(entry, 'title'),
      summary: description,
      url: link,
      image,
      publishedRaw: text(entry, 'pubdate') || text(entry, 'published') || text(entry, 'updated'),
    };
  });
}

/* ------------------------------------------------------- legacy normalise */

function readLegacy(data) {
  const out = [];
  for (const [group, items] of Object.entries(data)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      out.push({
        title: item.title,
        summary: item.summary || item.description || '',
        url: item.url || item.link,
        image: item.image || item.media_url || '',
        source: item.source || '',
        publishedRaw: item.time || item.published || item.date || '',
        group,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------- main */

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fromIndex = args.indexOf('--from');
  const fromFile = fromIndex !== -1 ? args[fromIndex + 1] : null;

  const register = await readJson(REGISTER, { sources: [] });
  const previous = await readJson(SNAPSHOT, null);
  const reference = new Date();

  let raw = [];
  const log = { ok: [], failed: [] };

  if (fromFile) {
    const data = await readJson(path.resolve(fromFile), null);
    if (!data) throw new Error(`cannot read ${fromFile}`);
    raw = readLegacy(data);
    log.ok.push({ source: path.basename(fromFile), entries: raw.length });
  } else {
    const verified = register.sources.filter((s) => s.verified && s.feed);
    if (!verified.length) {
      console.error('No verified feed in content/news-sources.json. Nothing fetched.');
    }
    for (const source of verified) {
      try {
        const xml = await fetchFeed(source);
        const entries = readFeed(xml);
        raw.push(...entries.map((e) => ({ ...e, source: source.publisher })));
        log.ok.push({ source: source.id, entries: entries.length });
      } catch (error) {
        log.failed.push({ source: source.id, error: String(error.message || error) });
      }
    }
  }

  /* --- normalise, score, dedupe ---------------------------------------- */
  const accepted = [];
  const rejected = [];
  const seenUrl = new Set();
  const seenHeadline = new Set();

  for (const entry of raw) {
    const result = buildRecord(entry, register, reference);
    if (result.rejected) {
      rejected.push({ title: result.title, reason: result.rejected });
      continue;
    }
    const { record } = result;
    if (seenUrl.has(record.canonicalUrl)) {
      rejected.push({ title: record.title, reason: 'duplicate-url' });
      continue;
    }
    const key = headlineKey(record.title);
    if (key && seenHeadline.has(key)) {
      rejected.push({ title: record.title, reason: 'duplicate-headline' });
      continue;
    }
    seenUrl.add(record.canonicalUrl);
    seenHeadline.add(key);
    accepted.push(record);
  }

  /* Newest first; records with no publication time sort last rather than
     being given an invented date to sort by. */
  accepted.sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return b.relevanceScore - a.relevanceScore;
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return b.publishedAt.localeCompare(a.publishedAt);
  });

  /* --- keep the last known good snapshot on total failure --------------- */
  const everyFeedFailed = !fromFile && log.ok.length === 0 && log.failed.length > 0;
  if ((everyFeedFailed || accepted.length === 0) && previous?.items?.length) {
    const stale = {
      ...previous,
      stale: true,
      lastAttemptAt: reference.toISOString(),
      lastAttemptResult: everyFeedFailed ? 'all-sources-failed' : 'no-records-passed-review',
      log,
    };
    if (!dryRun) await fs.writeFile(SNAPSHOT, `${JSON.stringify(stale, null, 2)}\n`, 'utf8');
    console.error('Ingestion produced nothing usable. Previous snapshot kept and marked stale.');
    report(accepted, rejected, log);
    process.exitCode = 1;
    return;
  }

  const counts = {};
  for (const record of accepted) {
    for (const category of record.categorySlugs) {
      counts[category] = (counts[category] || 0) + 1;
    }
  }

  const snapshot = {
    schema: 'dng-newsroom/1',
    snapshotUpdatedAt: reference.toISOString(),
    lastSuccessfulFetch: reference.toISOString(),
    lastAttemptAt: reference.toISOString(),
    lastAttemptResult: 'ok',
    stale: false,
    sourceCount: new Set(accepted.map((r) => r.sourceName)).size,
    total: accepted.length,
    counts,
    log,
    items: accepted,
  };

  if (!dryRun) {
    await fs.mkdir(path.dirname(SNAPSHOT), { recursive: true });
    await fs.writeFile(SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }

  report(accepted, rejected, log);
}

function report(accepted, rejected, log) {
  const withImage = accepted.filter((r) => r.imageRightsStatus === 'approved').length;
  const withDate = accepted.filter((r) => r.publishedAt).length;
  const categories = new Set(accepted.flatMap((r) => r.categorySlugs));

  console.log('--- ingestion report ---');
  console.log(`sources ok      : ${log.ok.map((o) => `${o.source}(${o.entries})`).join(', ') || 'none'}`);
  if (log.failed.length) {
    console.log(`sources failed  : ${log.failed.map((f) => `${f.source}: ${f.error}`).join('; ')}`);
  }
  console.log(`accepted        : ${accepted.length}`);
  console.log(`rejected        : ${rejected.length}`);
  console.log(`categories      : ${[...categories].join(', ') || 'none'}`);
  console.log(`publishers      : ${new Set(accepted.map((r) => r.sourceName)).size}`);
  console.log(`with usable img : ${withImage}`);
  console.log(`with pub date   : ${withDate}`);

  const byReason = {};
  for (const item of rejected) {
    const key = item.reason.replace(/\s*\(.*\)$/, '');
    byReason[key] = (byReason[key] || 0) + 1;
  }
  for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    console.log(`  rejected: ${reason} × ${count}`);
  }

  /* `--explain` prints the editorial decision for every story, which is how
     the filter gets tuned without guessing. */
  if (process.argv.includes('--explain')) {
    console.log('\n--- accepted ---');
    for (const record of accepted) {
      console.log(
        `  [${record.relevanceScore}] ${record.categorySlugs.join(',')} | ${record.title.slice(0, 70)}`
      );
      console.log(`        ${record.relevanceReasons.join(', ')}`);
    }
    console.log('\n--- rejected ---');
    for (const item of rejected) {
      console.log(`  ${item.reason} | ${String(item.title).slice(0, 70)}`);
      if (item.reasons?.length) console.log(`        ${item.reasons.join(', ')}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
