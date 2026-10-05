import { defineEventHandler } from 'h3'

// Crawl everything people can use; skip the API, the share-image previews and the Supabase demo
export default defineEventHandler((event) => {
  event.res.headers.set('content-type', 'text/plain; charset=utf-8')
  event.res.headers.set('cache-control', 'public, max-age=3600')
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /og-card/',
    'Disallow: /todos',
    '',
    `Sitemap: ${siteUrl(event)}/sitemap.xml`,
    ''
  ].join('\n')
})
