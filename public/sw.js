// Service worker for Ousa's Apps (CHECKLIST.md #19, #20): makes the app installable and lets it open
// with no internet.
//
// - Pages: network first (always the latest), falling back to the copy saved last time.
// - Built files under /_nuxt/ have a hash in their name, so a saved copy never goes stale: cache first.
// - /api/ requests always go to the network; the pages keep their own last-known answers.
// - Icons, images and fonts: served from the cache straight away, refreshed in the background.
// After installing, every app page and the files it needs are fetched once in the background,
// so apps you haven't opened yet also work offline.
const VERSION = 'v3'
const PAGES = `pages-${VERSION}`
const ASSETS = `assets-${VERSION}`
const STATIC = `static-${VERSION}`

const APP_PAGES = ['/', '/qr', '/phone', '/compress', '/text', '/password', '/exchange', '/things', '/eat', '/weight', '/countdown', '/renewals', '/bookmarks', '/notes', '/battery', '/salary', '/gold', '/settings', '/trash']
const SHELL = ['/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([PAGES, ASSETS, STATIC])
    for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key)
    await self.clients.claim()
    warm()
  })())
})

// Fetch each app page and the scripts and styles it links to, quietly, a few at a time
async function warm() {
  const pages = await caches.open(PAGES)
  const assets = await caches.open(ASSETS)
  for (const path of APP_PAGES) {
    try {
      const res = await fetch(path, { credentials: 'same-origin' })
      if (!res.ok) continue
      const html = await res.clone().text()
      await pages.put(path, res)
      const files = [...html.matchAll(/(?:href|src)="(\/_nuxt\/[^"]+)"/g)].map(m => m[1])
      for (const f of new Set(files)) {
        if (!(await assets.match(f))) await assets.add(f).catch(() => {})
      }
    } catch {
      return // offline or the server is down: try again next time
    }
  }
}

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
  if (event.data === 'warm') warm()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Google Fonts: keep a copy so text looks right offline
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req, STATIC))
    return
  }
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/__nuxt') || url.pathname.startsWith('/_nuxt/@')) return

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstPage(req))
    return
  }
  if (url.pathname.startsWith('/_nuxt/')) {
    event.respondWith(cacheFirst(req, ASSETS))
    return
  }
  event.respondWith(staleWhileRevalidate(req, STATIC))
})

async function networkFirstPage(req) {
  const cache = await caches.open(PAGES)
  const url = new URL(req.url)
  const key = url.pathname
  try {
    const res = await withTimeout(fetch(req), 6000)
    if (res.ok) cache.put(key, res.clone())
    return res
  } catch {
    // Offline: this page as it was last time, or the home page (the app routes from there)
    return (await cache.match(key)) ?? (await cache.match('/')) ?? new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) cache.put(req, res.clone())
  return res
}

async function staleWhileRevalidate(req, name) {
  const cache = await caches.open(name)
  const hit = await cache.match(req)
  const fresh = fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone())
    return res
  }).catch(() => hit ?? Response.error())
  return hit ?? fresh
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then((v) => {
      clearTimeout(t)
      resolve(v)
    }, (e) => {
      clearTimeout(t)
      reject(e)
    })
  })
}

// Only if nothing at all was saved yet (the very first visit happened offline)
const OFFLINE_HTML = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline · Ousa’s Apps</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#e8ebf0;color:#1b1f2a;text-align:center;padding:1.5rem">
<div><h1 style="font-size:1.6rem;margin:0 0 .5rem">You’re offline</h1>
<p style="margin:0 0 1.25rem;color:#555d70">Ousa’s Apps needs the internet the first time it opens. After that it works offline too.</p>
<button onclick="location.reload()" style="font:inherit;font-weight:600;padding:.7rem 1.2rem;border:0;border-radius:12px;background:#1b1f2a;color:#fff">Try again</button></div>`
