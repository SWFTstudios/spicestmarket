## Spice St. Market — Project Instructions

### Overview
Lean rebuild of the Spice St Market Webflow site for Cloudflare Workers. Design and imagery come from Webflow site **665ec1cc5ff6a46b977004bc** (`spicest.webflow.io`). Motion uses GSAP + ScrollTrigger + Lenis.

### Setup
```bash
npm install
npm run scrape   # pull published Webflow pages + assets into source/
npm run fonts    # subset / copy brand fonts into src/fonts
npm run build    # optimize images + emit dist/
npm run dev      # preview dist/ at http://localhost:4174
npm run deploy   # build + deploy to Cloudflare Workers
```

### Structure
| Path | Purpose |
|------|---------|
| `source/` | Untouched scrape of published Webflow pages (baseline) |
| `src/` | Hand-built CSS, JS, fonts, data |
| `src/data/` | Packs, recipes, gallery JSON |
| `dist/` | Production output |
| `scripts/` | scrape, fonts, build pipelines |

### Content updates
Edit `src/data/packs.json`, `recipes.json`, or `gallery.json`, then `npm run build`.

### Deploy
- Live: https://spicestmarket.elombe.workers.dev
- Repo: https://github.com/SWFTstudios/spicestmarket
- Pushes to `main` auto-build via Cloudflare Workers Builds (`npm run build` → `npx wrangler deploy`).

### Active todos
- [ ] Wire custom domain spicestmarket.com when zone is in this Cloudflare account
- [ ] Add Amazon URLs for Neighborhood Cook-Out and Around the World packs
- [ ] Connect newsletter provider
