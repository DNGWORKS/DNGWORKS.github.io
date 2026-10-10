#!/usr/bin/env node
/**
 * Build the Chinese font subset.
 *
 * Noto Sans SC in full is tens of megabytes per weight, which has no place in
 * a page budget. This collects every character that actually appears in the
 * site's Chinese content, adds a small safety set, and cuts a subset with
 * fonttools. Re-run it whenever content/i18n/zh.json or the Chinese article
 * bodies change.
 *
 *   node scripts/build-fonts.mjs
 *
 * Requires: python3 with fonttools and brotli, and a Noto Sans CJK source.
 * Without them the script explains what is missing and leaves the existing
 * subset in place; the Chinese pages then fall back to a system CJK face.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/fonts');

/* Weight 400/600/700 match the three weights the stylesheet declares for the
   Chinese stack. 600 is cut from the Medium face, 700 from Bold. */
const WEIGHTS = [
  { weight: 400, faces: ['NotoSansCJK-Regular.ttc', 'NotoSansSC-Regular.otf'] },
  { weight: 600, faces: ['NotoSansCJK-Medium.ttc', 'NotoSansSC-Medium.otf'] },
  { weight: 700, faces: ['NotoSansCJK-Bold.ttc', 'NotoSansSC-Bold.otf'] },
];

/**
 * A .ttc collection packs one face per CJK language; index 2 is Simplified
 * Chinese. Picking the wrong index ships Japanese glyph forms, which a
 * Chinese reader notices immediately.
 */
const SC_FACE_INDEX = 2;

const FONT_DIRS = [
  '/usr/share/fonts/opentype/noto',
  '/usr/share/fonts/truetype/noto',
  '/Library/Fonts',
  path.join(ROOT, 'src/fonts'),
];

/* Punctuation, digits, Latin and the full-width marks Chinese copy needs,
   kept even when a given build of the content does not use all of them. */
const SAFETY_SET =
  ' 0123456789' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'abcdefghijklmnopqrstuvwxyz' +
  '.,:;!?()[]{}<>/\\|-–—_"\'`@#$%^&*+=~₫€£¥' +
  '。，、；：！？（）【】《》“”‘’…·—～％＆' +
  'ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯư' +
  'ẠạẢảẤấẦầẨẩẪẫẬậẮắẰằẲẳẴẵẶặẸẹẺẻẼẽẾếỀềỂểỄễỆệỈỉỊịỌọỎỏỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỤụỦủỨứỪừỬửỮữỰựỲỳỴỵỶỷỸỹ';

async function collectText() {
  const files = [
    'content/i18n/zh.json',
    'content/site.json',
    'content/articles.json',
    'content/portfolio.json',
  ];
  let text = SAFETY_SET;
  for (const file of files) {
    try {
      text += await fs.readFile(path.join(ROOT, file), 'utf8');
    } catch {
      /* A missing optional content file is not fatal. */
    }
  }
  return text;
}

async function findFace(names) {
  for (const dir of FONT_DIRS) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        /* keep looking */
      }
    }
  }
  return null;
}

async function main() {
  try {
    await run('python3', ['-c', 'import fontTools, brotli']);
  } catch {
    console.error('fonttools and brotli are required: pip install fonttools brotli');
    console.error('The existing subset in assets/fonts is left unchanged.');
    process.exitCode = 1;
    return;
  }

  const text = await collectText();
  const chars = [...new Set([...text])].filter((ch) => ch.codePointAt(0) > 31).sort();
  const unicodes = chars.map((ch) => `U+${ch.codePointAt(0).toString(16).toUpperCase()}`);

  const listFile = path.join(ROOT, 'src/fonts-subset.txt');
  await fs.mkdir(path.dirname(listFile), { recursive: true });
  await fs.writeFile(listFile, unicodes.join('\n'), 'utf8');

  await fs.mkdir(OUT, { recursive: true });

  let built = 0;
  for (const { weight, faces } of WEIGHTS) {
    const source = await findFace(faces);
    if (!source) {
      console.error(`weight ${weight}: no source face found (${faces.join(', ')})`);
      continue;
    }

    const target = path.join(OUT, `noto-sans-sc-subset-${weight}.woff2`);
    const args = [
      '-I',
      '-m',
      'fontTools.subset',
      source,
      `--unicodes-file=${listFile}`,
      '--flavor=woff2',
      /* Only kerning is kept. The vertical-writing and language-variant
         feature tables are what make a CJK subset balloon, and this site
         sets Chinese horizontally. */
      '--layout-features=kern',
      '--no-hinting',
      '--desubroutinize',
      '--name-IDs=1,2,3,4,5,6',
      ...(source.endsWith('.ttc') ? [`--font-number=${SC_FACE_INDEX}`] : []),
      `--output-file=${target}`,
    ];

    try {
      await run('python3', args, { maxBuffer: 1024 * 1024 * 32 });
      const { size } = await fs.stat(target);
      console.log(`weight ${weight}: ${(size / 1024).toFixed(0)} KB from ${path.basename(source)}`);
      built += 1;
    } catch (error) {
      console.error(`weight ${weight}: subset failed — ${String(error.message).split('\n')[0]}`);
    }
  }

  console.log(`glyphs requested: ${chars.length}`);
  console.log(`weights built   : ${built} of ${WEIGHTS.length}`);

  /* Record what the subset covers, so a future content change that adds new
     characters is easy to spot. */
  await fs.writeFile(
    path.join(OUT, 'noto-sans-sc-subset-README.txt'),
    [
      'Noto Sans SC subset — SIL Open Font License 1.1',
      'https://github.com/notofonts/noto-cjk',
      '',
      `Built: ${new Date().toISOString()}`,
      `Characters: ${chars.length}`,
      '',
      'Contains only the characters present in this site\'s Chinese content plus a',
      'punctuation and Latin safety set. Re-run scripts/build-fonts.mjs after',
      'editing Chinese copy, or new characters will fall back to a system face.',
      '',
    ].join('\n'),
    'utf8'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
