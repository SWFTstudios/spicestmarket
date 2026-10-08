/**
 * Responsive image pipeline for the Webflow port.
 *
 * Webflow publishes 4–5k px originals and `sizes="(max-width: 5373px) 100vw, 5373px"`,
 * so browsers download 1–4 MB per photo. This module:
 *  - encodes each referenced original once into WebP at a few widths (cached in .cache/img)
 *  - rewrites <img> tags to a tight srcset + `sizes="auto, …"` (lazy images size to their layout box)
 *  - swaps CSS background-image urls for a capped WebP
 * Output names carry a content hash so they can be cached forever.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, copyFile, rename, stat, unlink } from 'node:fs/promises';
import { basename, dirname, extname, join, relative } from 'node:path';
import sharp from 'sharp';

const RASTER = /\.(jpe?g|png|webp|avif)$/i;
const WIDTHS = [480, 960, 1440, 1920];
const BG_WIDTH = 1600;
const QUALITY = 72;
const BG_QUALITY = 60; // textures sit under gradients/overlays
const VERSION = 'v1';
const CONCURRENCY = 3;

/** Tiny promise pool so large originals don't all decode at once. */
function limiter(max) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= max || !queue.length) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => {
      active--;
      next();
    });
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}

export function createImagePipeline({ root, cdnSrc, dist, sizesData = {} }) {
  const cacheDir = join(root, '.cache/img');
  const outDir = join(dist, 'img');
  /** srcPath → Promise<{ variants: [{w, url}], width, height }> */
  const jobs = new Map();
  const stats = { sources: 0, variants: 0, inBytes: 0, outBytes: 0 };
  const limit = limiter(CONCURRENCY);

  /** Map a local /cdn/... URL to a file under source/cdn, or null. */
  function sourceFor(url) {
    if (!url || !url.startsWith('/cdn/')) return null;
    const clean = decodeURIComponent(url.split(/[?#]/)[0]);
    if (!RASTER.test(clean)) return null;
    // Prefer the Webflow original over its -p-500/-p-800 previews
    const original = clean.replace(/-p-\d+(\.\w+)$/, '$1');
    return join(cdnSrc, original.slice('/cdn/'.length));
  }

  async function encode(srcPath, widths, quality = QUALITY) {
    const buf = await readFile(srcPath);
    const hash = createHash('sha1').update(buf).update(VERSION + quality).digest('hex').slice(0, 8);
    const meta = await sharp(buf, { limitInputPixels: false }).metadata();
    const stem = basename(srcPath, extname(srcPath))
      .replace(/^[0-9a-f]{24}_/, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 48);
    const fit = widths.filter((w) => w < meta.width);
    if (!fit.length || fit[fit.length - 1] < Math.min(meta.width, widths[widths.length - 1])) {
      fit.push(Math.min(meta.width, widths[widths.length - 1]));
    }
    await mkdir(cacheDir, { recursive: true });
    await mkdir(outDir, { recursive: true });
    stats.sources++;
    stats.inBytes += buf.length;
    const variants = [];
    for (const w of fit) {
      const name = `${stem}-${hash}-${w}.webp`;
      const cached = join(cacheDir, name);
      const hit = await stat(cached).then((st) => st.size > 0, () => false);
      if (!hit) {
        // Write-then-rename so a failed encode never leaves a poisoned cache entry
        const tmp = `${cached}.${process.pid}.tmp`;
        try {
          await sharp(buf, { limitInputPixels: false })
            .rotate()
            .resize({ width: w, withoutEnlargement: true })
            .webp({ quality, effort: 4, smartSubsample: true })
            .toFile(tmp);
          await rename(tmp, cached);
        } catch (err) {
          await unlink(tmp).catch(() => {});
          throw err;
        }
      }
      await copyFile(cached, join(outDir, name));
      stats.variants++;
      stats.outBytes += (await stat(cached)).size;
      variants.push({ w, url: `/img/${name}` });
    }
    return { variants, width: meta.width, height: meta.height };
  }

  /**
   * Some originals use AVIF features libheif can't decode (e.g. the AdobeStock slides).
   * Webflow's own -p-500/-p-800/… renditions decode fine, so serve those as-is.
   */
  async function siblingVariants(srcPath) {
    const ext = extname(srcPath);
    const stem = basename(srcPath, ext);
    const dir = dirname(srcPath);
    const files = await readdir(dir);
    const variants = files
      .map((f) => f.match(new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-p-(\\d+)\\.\\w+$`, 'i')))
      .filter(Boolean)
      .map((m) => ({ w: Number(m[1]), url: '/cdn/' + relative(cdnSrc, join(dir, m[0])).split(/[\\/]/).join('/') }))
      .sort((a, b) => a.w - b.w);
    return variants.length ? { variants, width: variants[variants.length - 1].w, height: null } : null;
  }

  function optimize(srcPath, widths = WIDTHS, quality = QUALITY) {
    const key = `${srcPath}|${widths.join(',')}|${quality}`;
    if (!jobs.has(key)) {
      jobs.set(
        key,
        limit(() => encode(srcPath, widths, quality)).catch(async (err) => {
          const fallback = await siblingVariants(srcPath);
          if (fallback) return fallback;
          console.warn(`  ✗ image ${basename(srcPath)}: ${err.message}`);
          return null;
        })
      );
    }
    return jobs.get(key);
  }

  const attr = (tag, name) => {
    const m = tag.match(new RegExp(`\\s${name}=(["'])([\\s\\S]*?)\\1`, 'i'));
    return m ? m[2] : null;
  };
  const setAttr = (tag, name, value) => {
    const re = new RegExp(`\\s${name}=(["'])[\\s\\S]*?\\1`, 'i');
    if (value === null) return tag.replace(re, '');
    const pair = ` ${name}="${value}"`;
    return re.test(tag) ? tag.replace(re, pair) : tag.replace(/^<img/i, `<img${pair}`);
  };

  /** Webflow's "(max-width: Npx) 100vw, Npx" is effectively 100vw at any real viewport. */
  function sensibleSizes(sizes) {
    if (!sizes) return '100vw';
    const m = sizes.match(/^\(max-width:\s*(\d+)px\)\s*100vw,\s*(\d+)px$/);
    if (m && +m[1] >= 2000) return '100vw';
    return sizes;
  }

  /**
   * Rewrite every local raster <img> in a page.
   * `eagerCount` first images (in document order) keep eager loading for LCP.
   */
  async function rewriteHtml(html, { page = '', eagerCount = 0 } = {}) {
    const tags = [...html.matchAll(/<img\b[^>]*>/gi)];
    const replacements = await Promise.all(
      tags.map(async (m, index) => {
        let tag = m[0];
        const src = attr(tag, 'src');
        const srcPath = sourceFor(src);
        if (!srcPath) return tag;
        const result = await optimize(srcPath);
        if (!result) return tag;
        const { variants, width } = result;
        const fallback = variants.find((v) => v.w >= 960) || variants[variants.length - 1];
        // An <img> with no srcset/width renders at its natural size; adding a w-descriptor
        // srcset would resize it to `sizes`. Small unsized images (icons) just get a lighter src.
        if (!attr(tag, 'srcset') && !attr(tag, 'width') && width && width < 1000) {
          tag = setAttr(tag, 'src', variants[variants.length - 1].url);
          tag = setAttr(tag, 'sizes', null);
          if (!attr(tag, 'decoding')) tag = setAttr(tag, 'decoding', 'async');
          return tag;
        }
        tag = setAttr(tag, 'src', fallback.url);
        tag = setAttr(tag, 'srcset', variants.map((v) => `${v.url} ${v.w}w`).join(', '));

        const orig = basename(srcPath);
        tag = setAttr(tag, 'data-ssm-orig', orig);
        // Measured sizes (scripts/measure.mjs) are exact and static: no re-pick when an
        // intro animation grows the box. Unmeasured lazy images fall back to sizes="auto".
        const measured = sizesData[`${page}|${orig}`];
        const eager = attr(tag, 'loading') === 'eager' || index < eagerCount;
        let sizes = measured || sensibleSizes(attr(tag, 'sizes'));
        if (!eager) {
          tag = setAttr(tag, 'loading', 'lazy');
          if (!measured && !sizes.startsWith('auto')) sizes = `auto, ${sizes}`;
        } else {
          tag = setAttr(tag, 'loading', 'eager');
          if (index < eagerCount) tag = setAttr(tag, 'fetchpriority', 'high');
        }
        tag = setAttr(tag, 'sizes', sizes);
        if (!attr(tag, 'decoding')) tag = setAttr(tag, 'decoding', 'async');
        return tag;
      })
    );
    let out = '';
    let last = 0;
    tags.forEach((m, i) => {
      out += html.slice(last, m.index) + replacements[i];
      last = m.index + m[0].length;
    });
    return out + html.slice(last);
  }

  /** Swap url(/cdn/…raster) in CSS (or inline style attributes) for a capped WebP. */
  async function rewriteCss(css) {
    const urls = [...new Set([...css.matchAll(/url\(["']?(\/cdn\/[^"')]+)["']?\)/gi)].map((m) => m[1]))];
    for (const url of urls) {
      const srcPath = sourceFor(url);
      if (!srcPath) continue;
      const result = await optimize(srcPath, [BG_WIDTH], BG_QUALITY);
      if (!result) continue;
      const best = result.variants[result.variants.length - 1];
      css = css.split(url).join(best.url);
    }
    return css;
  }

  /** Build a full <img> for content we render ourselves (recipe pages, nav). */
  async function img(src, { alt = '', sizes = '100vw', className = '', eager = false, widths = WIDTHS, extra = '' } = {}) {
    const srcPath = sourceFor(src);
    const result = srcPath ? await optimize(srcPath, widths) : null;
    const cls = className ? ` class="${className}"` : '';
    const loading = eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
    if (!result) return `<img src="${src}" alt="${alt}"${cls} ${loading} decoding="async"${extra} />`;
    const { variants, width, height } = result;
    const fallback = variants.find((v) => v.w >= 960) || variants[variants.length - 1];
    const sz = eager ? sizes : `auto, ${sizes}`;
    const dims = height ? ` width="${width}" height="${height}"` : '';
    return `<img src="${fallback.url}" srcset="${variants.map((v) => `${v.url} ${v.w}w`).join(', ')}" sizes="${sz}"${dims} alt="${alt}"${cls} ${loading} decoding="async"${extra} />`;
  }

  return { rewriteHtml, rewriteCss, img, optimize, stats };
}

export async function writeFileEnsured(path, data) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, data);
}
