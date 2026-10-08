#!/usr/bin/env node
/**
 * Screenshot compare: local dist vs spicest.webflow.io (+ optional live)
 * Usage: npm run compare
 * Requires: dist/ built, `npx serve dist -p 4174` OR we spawn it.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, '.tmp/compare');
const LOCAL = 'http://127.0.0.1:4174';
const WEBFLOW = 'https://spicest.webflow.io';
const LIVE = 'https://spicestmarket.com';

const PAGES = [
  { path: '/', name: 'home' },
  { path: '/about', name: 'about' },
  { path: '/gallery', name: 'gallery' },
];
const WIDTHS = [1440, 768, 390];

async function waitForServer(url, ms = 20000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status === 404) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server not ready: ${url}`);
}

async function shot(page, url, file) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: file, fullPage: false });
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const serve = spawn(
    'npx',
    ['--yes', 'serve', 'dist', '-l', '4174'],
    { cwd: ROOT, stdio: 'ignore', shell: true }
  );

  try {
    await waitForServer(LOCAL + '/');
    const browser = await chromium.launch();
    const report = [];

    for (const w of WIDTHS) {
      const context = await browser.newContext({
        viewport: { width: w, height: w === 390 ? 844 : 900 },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();

      for (const p of PAGES) {
        for (const [label, base] of [
          ['local', LOCAL],
          ['webflow', WEBFLOW],
          ['live', LIVE],
        ]) {
          const file = join(OUT, `${p.name}-${w}-${label}.png`);
          try {
            await shot(page, base + p.path, file);
            report.push({ ok: true, file, url: base + p.path, width: w });
            console.log('✓', `${p.name}@${w}`, label);
          } catch (err) {
            report.push({ ok: false, file, url: base + p.path, width: w, error: String(err) });
            console.warn('✗', `${p.name}@${w}`, label, err.message);
          }
        }
      }
      await context.close();
    }

    await browser.close();
    await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`\nScreenshots → ${OUT}`);
    console.log('Open local vs webflow pairs side-by-side to verify parity.');
  } finally {
    serve.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
