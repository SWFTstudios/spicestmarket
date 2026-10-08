#!/usr/bin/env node
/**
 * Download published Spice St Market Webflow pages + original assets into source/
 * Site: 665ec1cc5ff6a46b977004bc (spicest.webflow.io)
 */
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE = join(ROOT, 'source');
const SITE_ID = '665ec1cc5ff6a46b977004bc';
const SITE = 'https://spicest.webflow.io';
const PAGES = [
  { path: '/', file: 'index.html' },
  { path: '/about', file: 'about.html' },
  { path: '/recipes', file: 'recipes.html' },
  { path: '/gallery', file: 'gallery.html' },
  { path: '/shop', file: 'shop.html' },
];

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function download(url, dest) {
  await ensureDir(dirname(dest));
  const res = await fetch(url, {
    headers: { 'User-Agent': 'spicestmarket-scrape/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return { url, dest, bytes: buf.length, contentType: res.headers.get('content-type') };
}

function isOriginalAsset(url) {
  return !/-p-\d+\./.test(url);
}

function localPathFor(url) {
  const u = new URL(url);
  if (
    u.hostname.includes('website-files.com') ||
    u.hostname.includes('cloudfront.net') ||
    u.hostname.includes('googleapis.com') ||
    u.hostname.includes('typekit.net') ||
    u.hostname.includes('jsdelivr.net') ||
    u.hostname.includes('cdnjs.cloudflare.com') ||
    u.hostname.includes('unpkg.com')
  ) {
    const safe = u.pathname.replace(/^\//, '').replace(/%20/g, '_').replace(/%2520/g, '_');
    return join(SOURCE, 'cdn', u.hostname, safe);
  }
  return join(SOURCE, 'cdn', u.hostname, basename(u.pathname) || 'index');
}

function extractUrls(html) {
  const urls = new Set();
  const patterns = [
    /(?:href|src)=["'](https?:\/\/[^"']+)["']/gi,
    /srcset=["']([^"']+)["']/gi,
    /url\(["']?(https?:\/\/[^"')]+)["']?\)/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html))) {
      if (re.source.includes('srcset')) {
        for (const part of m[1].split(',')) {
          const u = part.trim().split(/\s+/)[0];
          if (u?.startsWith('http')) urls.add(u);
        }
      } else {
        urls.add(m[1]);
      }
    }
  }
  return [...urls];
}

function wantsUrl(u) {
  try {
    const parsed = new URL(u);
    // Skip bare CDN host and plugin placeholders
    if (parsed.pathname === '/' || parsed.pathname === '') return false;
    if (parsed.pathname.includes('/plugins/')) return false;
    return (
      /\.(css|js|woff2?|ttf|otf|svg|png|jpe?g|webp|avif|gif|ico|JPG|mp4|webm)(\?|$)/i.test(parsed.pathname) ||
      parsed.pathname.includes('/css/') ||
      parsed.pathname.includes('/js/') ||
      (parsed.hostname.includes('website-files.com') && parsed.pathname.includes(SITE_ID))
    );
  } catch {
    return false;
  }
}

async function main() {
  console.log('Scraping', SITE, `(site ${SITE_ID})`);
  // Fresh scrape — drop previous (wrong) site assets
  await rm(SOURCE, { recursive: true, force: true });
  await ensureDir(SOURCE);
  const results = [];
  const seen = new Set();

  for (const page of PAGES) {
    const url = SITE + page.path;
    console.log('Page', url);
    const r = await download(url, join(SOURCE, page.file));
    results.push(r);
    seen.add(url);
  }

  const htmlBlob = (
    await Promise.all(PAGES.map((p) => readFile(join(SOURCE, p.file), 'utf8')))
  ).join('\n');

  const urls = extractUrls(htmlBlob).filter(wantsUrl).filter((u) => {
    if (/\.(png|jpe?g|webp|avif|gif|JPG)$/i.test(u)) return isOriginalAsset(u);
    return true;
  });

  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    const dest = localPathFor(url);
    try {
      const r = await download(url, dest);
      results.push(r);
      console.log(`  ✓ ${(r.bytes / 1024).toFixed(1)} KB  ${url}`);
    } catch (err) {
      console.warn(`  ✗ ${url}: ${err.message}`);
    }
  }

  const cssEntries = results.filter((r) => r.dest.endsWith('.css'));
  for (const css of cssEntries) {
    const cssText = await readFile(css.dest, 'utf8');
    const cssUrls = [...cssText.matchAll(/url\(["']?(https?:\/\/[^"')]+)["']?\)/gi)].map((m) => m[1]);
    for (const url of cssUrls) {
      if (!wantsUrl(url) || seen.has(url)) continue;
      if (/\.(png|jpe?g|webp|avif|gif|JPG)$/i.test(url) && !isOriginalAsset(url)) continue;
      seen.add(url);
      try {
        const r = await download(url, localPathFor(url));
        results.push(r);
        console.log(`  ✓ CSS asset ${(r.bytes / 1024).toFixed(1)} KB  ${url}`);
      } catch (err) {
        console.warn(`  ✗ ${url}: ${err.message}`);
      }
    }
  }

  const totalBytes = results.reduce((s, r) => s + r.bytes, 0);
  const report = {
    scrapedAt: new Date().toISOString(),
    siteId: SITE_ID,
    siteUrl: SITE,
    fileCount: results.length,
    totalBytes,
    totalMB: +(totalBytes / (1024 * 1024)).toFixed(2),
    files: results
      .map((r) => ({
        url: r.url,
        bytes: r.bytes,
        kb: +(r.bytes / 1024).toFixed(1),
        path: r.dest.replace(ROOT + '/', ''),
      }))
      .sort((a, b) => b.bytes - a.bytes),
  };

  await writeFile(join(SOURCE, 'baseline.json'), JSON.stringify(report, null, 2));
  console.log(`\nBaseline: ${report.fileCount} files, ${report.totalMB} MB`);
  console.log(`Report → source/baseline.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
