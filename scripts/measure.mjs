#!/usr/bin/env node
/**
 * Measure how big every image actually renders at phone / tablet / laptop / desktop widths
 * and write src/data/image-sizes.json. The build turns that into exact `sizes` attributes,
 * so browsers pick the right srcset width on first paint (no guessing, no double downloads).
 *
 * Usage: npm run build && npm run measure && npm run build
 * Re-run after layout changes in Webflow (new sections, resized images).
 */
import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'src/data/image-sizes.json');
const PORT = 4179;

const PAGES = [
  ['index', '/'],
  ['about', '/about/'],
  ['gallery', '/gallery/'],
  ['shop', '/shop/'],
  ['recipes', '/recipes/'],
];
// One viewport per Webflow breakpoint band
const BANDS = [
  { max: 479, width: 390, height: 844 },
  { max: 767, width: 700, height: 1000 },
  { max: 991, width: 900, height: 1000 },
  { max: 1440, width: 1366, height: 820 },
  { max: null, width: 1920, height: 1080 },
];

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };

function serve() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = join(DIST, p);
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      } catch {
        file = join(DIST, p.replace(/\/?$/, '/index.html'));
      }
      try {
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404).end();
      }
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

/** Runs in the page: effective CSS px each <img> needs (accounts for object-fit: cover crops). */
function collect() {
  const out = [];
  for (const img of document.images) {
    const src = img.getAttribute('data-ssm-orig');
    if (!src) continue;
    const r = img.getBoundingClientRect();
    if (!r.width || !r.height) {
      out.push({ src, cls: img.className, w: 0 });
      continue;
    }
    let w = r.width;
    const cs = getComputedStyle(img);
    if (cs.objectFit === 'cover' && img.naturalWidth && img.naturalHeight) {
      w = Math.max(w, r.height * (img.naturalWidth / img.naturalHeight));
    }
    out.push({ src, cls: img.className, w: Math.ceil(w) });
  }
  return out;
}

async function measurePage(browser, path, band) {
  const ctx = await browser.newContext({ viewport: { width: band.width, height: band.height }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}${path}?measure`, { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  // Walk the page so scroll-triggered sections lay out
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += band.height * 0.8) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(800);
  const items = await page.evaluate(collect);
  await ctx.close();
  return items;
}

const roundVw = (w, vw) => Math.min(100, Math.ceil(((w / vw) * 100) / 5) * 5);

async function main() {
  try {
    await stat(join(DIST, 'index.html'));
  } catch {
    throw new Error('Run `npm run build` first.');
  }
  const server = await serve();
  const browser = await chromium.launch();
  const result = {};
  try {
    for (const [name, path] of PAGES) {
      const perBand = [];
      for (const band of BANDS) perBand.push(await measurePage(browser, path, band));

      const keys = new Set(perBand.flat().map((i) => i.src));
      for (const src of keys) {
        const bandVw = BANDS.map((band, b) => {
          const hits = perBand[b].filter((i) => i.src === src);
          let w = Math.max(0, ...hits.map((i) => i.w));
          if (!w) {
            // Hidden tab panel / inactive slide: borrow the size of visible siblings with the same class
            const cls = hits[0]?.cls;
            w = Math.max(0, ...perBand[b].filter((i) => cls && i.cls === cls).map((i) => i.w));
          }
          return w ? roundVw(w, band.width) : null;
        });
        if (bandVw.every((v) => v === null)) continue;
        const filled = bandVw.map((v, i) => v ?? bandVw.slice(i).find((x) => x !== null) ?? bandVw.slice(0, i).reverse().find((x) => x !== null));
        const parts = [];
        BANDS.forEach((band, i) => {
          const value = `${filled[i]}vw`;
          if (band.max === null) parts.push(value);
          else if (filled[i] !== filled[i + 1]) parts.push(`(max-width: ${band.max}px) ${value}`);
        });
        result[`${name}|${src}`] = parts.join(', ');
      }
      console.log(`  ✓ ${path} (${keys.size} images)`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(OUT, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Wrote ${Object.keys(sorted).length} entries → src/data/image-sizes.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
