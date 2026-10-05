// Renders the 1200×630 social-share images into public/og/<slug>.png.
//
// Usage (needs a production server, so dev-only overlays stay out of the images):
//   npm run build && PORT=3100 node .output/server/index.mjs &
//   npm run og:images                      # or: BASE=http://localhost:3100 npm run og:images
//
// Re-run it whenever an app's name, summary, colour or icon changes, then commit public/og.
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://localhost:3100'
const OUT = path.join(__dirname, '..', 'public', 'og')

;(async () => {
  // The slugs come from the sitemap, so every listed page gets a card
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text()
  const slugs = [...xml.matchAll(/<loc>[^<]*?:\/\/[^/]+\/?([^<]*)<\/loc>/g)].map(m => m[1].replace(/\/$/, '') || 'home')

  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  // Reduced motion keeps the home cube solved and still, so every run draws the same picture
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'light' })
  for (const slug of slugs) {
    await page.goto(`${BASE}/og-card/${slug}`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    const card = page.locator('.card')
    if (!(await card.count())) {
      console.warn(`skipped ${slug}: no card`)
      continue
    }
    await card.screenshot({ path: path.join(OUT, `${slug}.png`) })
    console.log(`public/og/${slug}.png`)
  }
  await browser.close()
})()
