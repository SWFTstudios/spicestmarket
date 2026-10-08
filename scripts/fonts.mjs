#!/usr/bin/env node
/**
 * Prepare brand fonts into src/fonts as woff2.
 * Chinook + Quatro Slab from scraped Webflow site 665ec1cc5ff6a46b977004bc.
 * Azeret Mono from Google Fonts.
 */
import { mkdir, copyFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'src/fonts');
const ASSET = join(ROOT, 'source/cdn/cdn.prod.website-files.com/665ec1cc5ff6a46b977004bc');

const SUBSET_PY = `
from fontTools import subset
from pathlib import Path
import sys
src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.parent.mkdir(parents=True, exist_ok=True)
options = subset.Options()
options.layout_features = ["*"]
options.name_IDs = ["*"]
options.name_legacy = True
options.name_languages = ["*"]
options.notdef_outline = True
options.flavor = "woff2"
unicodes = []
for a, b in [(0x0020,0x007E),(0x00A0,0x00FF),(0x0100,0x017F),(0x2010,0x2027),(0x2030,0x203A)]:
  unicodes.extend(range(a, b+1))
font = subset.load_font(str(src), options)
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=unicodes)
subsetter.subset(font)
subset.save_font(font, str(dst), options)
print(dst.stat().st_size)
`;

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

function subset(src, dest) {
  const r = spawnSync('python3', ['-c', SUBSET_PY, src, dest], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.warn(r.stderr || r.stdout);
    return false;
  }
  console.log(`  ✓ ${basename(dest)} (${(+r.stdout.trim() / 1024).toFixed(1)} KB)`);
  return true;
}

async function downloadGoogleFont(family, file) {
  const cssRes = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      },
    }
  );
  if (!cssRes.ok) throw new Error(`Google Fonts CSS ${cssRes.status}`);
  const css = await cssRes.text();
  const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]);
  if (!urls.length) throw new Error('No gstatic urls');
  const bin = Buffer.from(await (await fetch(urls[0])).arrayBuffer());
  await writeFile(join(OUT, file), bin);
  console.log(`  ✓ ${file} (${(bin.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  await ensureDir(OUT);
  const files = await readdir(ASSET);

  const chinook = files.find((f) => /Chinook/i.test(f) && /\.otf$/i.test(f));
  if (chinook) {
    const ok = subset(join(ASSET, chinook), join(OUT, 'chinook.woff2'));
    if (!ok) await copyFile(join(ASSET, chinook), join(OUT, 'Chinook-Regular.otf'));
  }

  const quatro = files.find((f) => /QuatroSlab-Regular\.woff2$/i.test(f));
  if (quatro) {
    await copyFile(join(ASSET, quatro), join(OUT, 'quatro-slab.woff2'));
    console.log('  ✓ quatro-slab.woff2 (copied)');
  } else {
    const quatroTtf = files.find((f) => /QuatroSlab-Regular\.ttf$/i.test(f));
    if (quatroTtf) subset(join(ASSET, quatroTtf), join(OUT, 'quatro-slab.woff2'));
  }

  await downloadGoogleFont('Azeret Mono', 'azeret-mono-latin.woff2');
  console.log('Fonts ready → src/fonts');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
