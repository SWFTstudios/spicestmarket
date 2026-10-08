# Spice St Market — Faithful Webflow Port

Static port of [spicest.webflow.io](https://spicest.webflow.io/) (Webflow site `665ec1cc5ff6a46b977004bc`) for Cloudflare Workers. Markup, shared CSS, and custom-code animations (Swiper / GSAP / Materialize / Typed / particles) are preserved from the published Webflow site so the Worker matches [spicestmarket.com](https://spicestmarket.com/).

**Live:** [https://spicestmarket.elombe.workers.dev](https://spicestmarket.elombe.workers.dev)  
**Repo:** [github.com/SWFTstudios/spicestmarket](https://github.com/SWFTstudios/spicestmarket)

Pushes to `main` auto-build and deploy via Cloudflare Workers Builds (`npm run build` → `npx wrangler deploy`).

## Setup

```bash
npm install
npm run scrape    # pull spicest.webflow.io pages + assets → source/
npm run build     # rewrite URLs, copy CDN, emit dist/
npm run dev       # preview dist/ at http://localhost:4174
npm run compare   # screenshot local vs webflow.io vs live
npm run deploy    # build + deploy to Cloudflare Workers
```

## Structure

| Path | Purpose |
|------|---------|
| `source/` | Untouched scrape of published Webflow pages + CDN assets |
| `source/custom-code/` | Audit notes for Webflow freeform custom code |
| `src/js/enhance.js` | Thin Lenis layer (does not replace Webflow scripts) |
| `src/styles/enhance.css` | View Transitions only |
| `dist/` | Production output |
| `scripts/` | scrape, build, compare |

## Pages

Home, About, Shop, Gallery, Recipes, 404. `/contact` redirects to `/#footer`.

## Motion

- Webflow custom code owns carousels, spice-pack tabs, typed hero, 3D shelves
- Optional Lenis smooth scroll (disabled under `prefers-reduced-motion`)
- Cross-document View Transitions via CSS `@view-transition`

## Source of truth

Webflow site **665ec1cc5ff6a46b977004bc** → `spicest.webflow.io`
