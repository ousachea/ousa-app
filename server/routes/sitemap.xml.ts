import { defineEventHandler } from 'h3'
import { SETTINGS, TOOLS } from '../../app/utils/tools'

// Every public page; the /og-card preview pages are left out on purpose
export default defineEventHandler((event) => {
  const site = siteUrl(event)
  const pages = [
    { path: '/', priority: '1.0' },
    ...TOOLS.map(t => ({ path: t.to, priority: '0.8' })),
    { path: SETTINGS.to, priority: '0.3' }
  ]
  const urls = pages.map(p => `  <url>\n    <loc>${site}${p.path === '/' ? '/' : p.path}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`)
  event.res.headers.set('content-type', 'application/xml; charset=utf-8')
  event.res.headers.set('cache-control', 'public, max-age=3600')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
})
