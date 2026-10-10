#!/usr/bin/env node
/**
 * Render the brand assets that are easiest to produce from the site itself:
 * the hero poster (a real frame of the 3D scene, so the fallback matches the
 * art direction exactly) and the social cards.
 *
 *   node scripts/render-assets.mjs            poster + social cards
 *   node scripts/render-assets.mjs --shots    also write QA screenshots
 *
 * Optional. Requires Playwright (npm i -D playwright). The outputs are
 * committed, so the published site never needs this to run.
 */

import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4317;
const SHOTS = process.argv.includes('--shots');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function serve() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      let file = path.join(ROOT, decodeURIComponent(url.pathname));
      const stat = await fs.stat(file).catch(() => null);
      if (stat?.isDirectory()) file = path.join(file, 'index.html');

      const body = await fs.readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

/* ------------------------------------------------------------ social card */

async function socialCard(page, { title, label, out }) {
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<link rel="stylesheet" href="http://localhost:${PORT}/assets/css/dng.css">
<style>
  html,body{margin:0}
  body{width:1200px;height:630px;display:flex;flex-direction:column;justify-content:space-between;
    padding:72px 80px;background:
      radial-gradient(90% 80% at 88% 10%, #e7f0fd 0%, transparent 60%),
      linear-gradient(170deg,#ffffff 0%,#f2f7ff 100%);
    font-family:"Be Vietnam Pro",sans-serif}
  .top{display:flex;align-items:center;gap:14px}
  .top svg{width:34px;height:34px}
  .top svg rect{fill:#285be8} .top svg rect:last-child{fill:#12bca4}
  .top span{font-size:27px;font-weight:700;letter-spacing:-.02em;color:#112743}
  h1{margin:0;max-width:19ch;font-size:74px;font-weight:700;line-height:1.02;
    letter-spacing:-.034em;color:#112743}
  .label{display:flex;align-items:center;gap:10px;margin-bottom:22px;
    font-size:21px;font-weight:600;color:#173da7}
  .label::before{content:"";width:11px;height:11px;background:#12bca4}
  .foot{display:flex;align-items:center;justify-content:space-between;
    padding-top:26px;border-top:1px solid #c2d5ee;font-size:20px;color:#6b7f99}
  .plates{position:absolute;right:-40px;bottom:-70px;width:470px;opacity:.5}
</style></head><body>
  <div class="top">
    <svg viewBox="0 0 24 24"><rect x="1" y="16" width="22" height="4" rx="1"/>
      <rect x="4" y="9.5" width="16" height="4" rx="1"/><rect x="7.5" y="3" width="9" height="4" rx="1"/></svg>
    <span>DNGWORKS</span>
  </div>
  <div>
    <p class="label">${label}</p>
    <h1>${title}</h1>
  </div>
  <div class="foot"><span>dngworks.github.io</span><span>Đà Nẵng · Việt Nam</span></div>
  <svg class="plates" viewBox="0 0 200 150" fill="none">
    <rect x="12" y="104" width="176" height="26" rx="6" fill="#285be8" opacity=".22"/>
    <rect x="30" y="68" width="140" height="24" rx="6" fill="#285be8" opacity=".32"/>
    <rect x="50" y="34" width="100" height="22" rx="6" fill="#12bca4" opacity=".42"/>
    <rect x="68" y="4" width="64" height="20" rx="6" fill="#285be8" opacity=".5"/>
  </svg>
</body></html>`;

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(ROOT, out), type: 'jpeg', quality: 88 });
  return out;
}

/* ------------------------------------------------------------ hero poster */

async function heroPoster(page, { width, height, out, progress }) {
  await page.setViewportSize({ width, height });
  /* debug3d exposes the scene instance, so the still can be driven straight
     to the frame we want. Scrolling the page would move the hero out of the
     viewport and crop the shot. */
  await page.goto(`http://localhost:${PORT}/?debug3d`, { waitUntil: 'load' });

  /* Wait for a verified first frame rather than a fixed delay. */
  await page.waitForFunction(
    () => document.querySelector('[data-hero-stage]')?.dataset.renderState === 'live',
    { timeout: 20000 }
  );

  /* The assembled state: the frame where the structure reads as one system,
     which is what a still should show. */
  await page.evaluate((p) => {
    const hero = window.__DNG_3D;
    if (!hero) return;
    hero.handleScroll = () => {};
    hero.scrollProgress = p;
    hero.renderedProgress = p;
  }, progress);

  await page.waitForTimeout(2400);

  /* Hide the text layer and the scrim so the poster is pure scene; the HTML
     headline sits on top of it at runtime. */
  await page.addStyleTag({
    content: '.hero-scrim,.hero-inner,.site-header{opacity:0 !important}',
  });
  await page.waitForTimeout(260);

  /* The scene animates continuously, so the screenshot is taken from an
     explicit clip rather than waiting for the element to settle. */
  const box = await page.evaluate(() => {
    const rect = document.querySelector('[data-hero-stage]').getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  await page.screenshot({
    path: path.join(ROOT, out),
    type: 'png',
    clip: box,
    animations: 'allow',
  });
  return out;
}

/* -------------------------------------------------------------------- main */

async function main() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('Playwright is not installed: npm i -D playwright');
    console.error('The committed assets in assets/images are left unchanged.');
    process.exitCode = 1;
    return;
  }

  const server = await serve();
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });

  const written = [];
  try {
    const page = await browser.newPage({ deviceScaleFactor: 2 });

    written.push(
      await heroPoster(page, {
        width: 1440,
        height: 900,
        progress: 0.34,
        out: 'src/images/hero/growth-architecture-poster.png',
      })
    );
    written.push(
      await heroPoster(page, {
        width: 430,
        height: 932,
        progress: 0.28,
        out: 'src/images/hero/growth-architecture-poster-mobile.png',
      })
    );

    const cards = [
      { out: 'assets/images/social/og-default.jpg', label: 'Growth architecture', title: 'Hiểu đúng vấn đề. Chọn đúng hướng tăng trưởng.' },
      { out: 'assets/images/social/og-home.jpg', label: 'Growth architecture', title: 'Hiểu đúng vấn đề. Chọn đúng hướng tăng trưởng.' },
      { out: 'assets/images/social/og-services.jpg', label: 'Giải pháp', title: 'Từ chiến lược đến triển khai, không đứt gãy ở giữa.' },
      { out: 'assets/images/social/og-tools.jpg', label: 'Công cụ', title: 'Sáu phép tính trước khi tiêu tiền.' },
      { out: 'assets/images/social/og-intelligence.jpg', label: 'DNG Intelligence', title: 'Tin ngành, bản tin biên tập và phân tích gốc.' },
      { out: 'assets/images/social/og-about.jpg', label: 'Về DNGWORKS', title: 'Marketing không bắt đầu từ quảng cáo.' },
      { out: 'assets/images/social/og-contact.jpg', label: 'Liên hệ', title: 'Nói về bài toán thật.' },
    ];
    for (const card of cards) {
      await fs.mkdir(path.join(ROOT, path.dirname(card.out)), { recursive: true });
      written.push(await socialCard(page, card));
    }

    if (SHOTS) {
      const shots = [
        { name: 'home-1440', url: '/', width: 1440, height: 900 },
        { name: 'home-390', url: '/', width: 390, height: 844 },
        { name: 'intelligence-1440', url: '/intelligence/', width: 1440, height: 900 },
        { name: 'tools-1440', url: '/tools/', width: 1440, height: 900 },
      ];
      await fs.mkdir(path.join(ROOT, 'docs/screenshots'), { recursive: true });
      for (const shot of shots) {
        await page.setViewportSize({ width: shot.width, height: shot.height });
        await page.goto(`http://localhost:${PORT}${shot.url}`, { waitUntil: 'load' });
        await page.waitForTimeout(2600);
        const out = `docs/screenshots/${shot.name}.png`;
        await page.screenshot({ path: path.join(ROOT, out) });
        written.push(out);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  for (const file of written) {
    const { size } = await fs.stat(path.join(ROOT, file));
    console.log(`${file} — ${(size / 1024).toFixed(0)} KB`);
  }
  console.log('\nHero posters are written to src/images/hero/. Run');
  console.log('  python3 scripts/build-images.py');
  console.log('to produce the webp variants the pages reference.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
