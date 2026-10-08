## Spice St. Market — Project Instructions

### Overview
Faithful static port of the Spice St Market Webflow site (`665ec1cc5ff6a46b977004bc` / `spicest.webflow.io`) for Cloudflare Workers. Visuals and interactions come from the published Webflow HTML + custom code. A thin Lenis / View Transitions layer sits on top.

### Setup
```bash
npm install
npm run scrape    # pull published Webflow pages + assets into source/
npm run build     # rewrite asset URLs + emit dist/
npm run dev       # preview dist/ at http://localhost:4174
npm run compare   # screenshot local vs webflow.io vs live → .tmp/compare/
npm run deploy    # build + deploy to Cloudflare Workers
```

### Structure
| Path | Purpose |
|------|---------|
| `source/` | Untouched scrape of published Webflow pages (baseline) |
| `source/custom-code/` | Audit pointers for site/page freeform custom code |
| `src/js/enhance.js` | Lenis only |
| `src/styles/enhance.css` | View Transitions |
| `dist/` | Production output |
| `scripts/` | scrape, build, compare |

### Content updates
Re-scrape from Webflow after Designer publishes: `npm run scrape && npm run build`. Do not hand-edit `dist/`.

### Deploy
- Live: https://spicestmarket.elombe.workers.dev
- Repo: https://github.com/SWFTstudios/spicestmarket
- Pushes to `main` auto-build via Cloudflare Workers Builds (`npm run build` → `npx wrangler deploy`).

### Active todos
- [ ] Wire custom domain spicestmarket.com when zone is in this Cloudflare account
- [ ] Add Amazon URLs for Neighborhood Cook-Out and Around the World packs (in Webflow, then re-scrape)
- [ ] Connect newsletter provider
