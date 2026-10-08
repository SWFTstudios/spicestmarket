## Spice St. Market — Project Instructions

### Overview
Lean rebuild of the Spice St Market Webflow site for Cloudflare Workers. Design and imagery come from Webflow; pack copy comes from the live site. Motion uses GSAP + ScrollTrigger + Lenis.

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
| `src/` | Hand-built HTML, CSS, JS, fonts, data |
| `src/data/` | Packs, recipes, gallery JSON |
| `dist/` | Production output |
| `scripts/` | scrape, fonts, build pipelines |

### Content updates
Edit `src/data/packs.json`, `recipes.json`, or `gallery.json`, then `npm run build`.

### Deploy
Pushes to `main` should auto-build via Cloudflare Workers Builds (`npm run build` → `npx wrangler deploy`). Manual: `npm run deploy`.

### Active todos
- [x] Scaffold repo + Cloudflare Worker
- [ ] Wire custom domain spicestmarket.com when zone is in this Cloudflare account
- [ ] Add Amazon URLs for Neighborhood Cook-Out and Around the World packs
- [ ] Connect newsletter provider
