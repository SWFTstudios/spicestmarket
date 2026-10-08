# Spice St Market — Optimized Static Site

Lean rebuild of [spicest.webflow.io](https://spicest.webflow.io/) (Webflow site `665ec1cc5ff6a46b977004bc`) with brand-true scroll motion, pack tabs, and page transitions. Packs sell on Amazon.

**Live:** [https://spicestmarket.elombe.workers.dev](https://spicestmarket.elombe.workers.dev)  
**Repo:** [github.com/SWFTstudios/spicestmarket](https://github.com/SWFTstudios/spicestmarket)

Pushes to `main` auto-build and deploy via Cloudflare Workers Builds (`npm run build` → `npx wrangler deploy`).

## Setup

```bash
npm install
npm run scrape   # pull published Webflow pages + assets into source/
npm run fonts    # Chinook / Quatro Slab / Azeret Mono → src/fonts
npm run build    # optimize images + emit dist/
npm run dev      # preview dist/ at http://localhost:4174
npm run deploy   # build + deploy to Cloudflare Workers
```

## Structure

| Path | Purpose |
|------|---------|
| `source/` | Untouched scrape of the published Webflow site (baseline) |
| `src/` | Hand-built HTML (via build), CSS, JS, fonts, data |
| `src/data/` | Packs, recipes, gallery JSON |
| `dist/` | Production output |
| `scripts/` | scrape, fonts, build pipelines |

## Motion

- Lenis smooth scroll + GSAP ScrollTrigger
- Pinned spice tin fan-out scene
- Accessible pack tabs with Flip / shake stagger
- Velocity-linked marquee
- Cross-document View Transitions
- `prefers-reduced-motion` fallbacks

## Source of truth

Webflow design site: **665ec1cc5ff6a46b977004bc** (`spicest.webflow.io`)
