import { defineEventHandler, getQuery, HTTPError, setResponseHeaders } from 'h3'
import { iconSvg } from '../utils/iconLibrary'

// A line icon from the icon library, served from this site: /api/icon?id=lucide:car&color=%23ffffff.
// Same-origin, so it works as a CSS mask and is cached for the offline app.
const ID = /^lucide:[a-z0-9]+(?:-[a-z0-9]+)*$/
const COLOR = /^#[0-9a-f]{3,8}$/i

export default defineEventHandler((event) => {
  const q = getQuery(event)
  const id = String(q.id ?? '')
  const color = String(q.color ?? '#000000')
  if (!ID.test(id) || !COLOR.test(color)) throw new HTTPError({ status: 400, message: 'That isn’t an icon' })

  const svg = iconSvg(id.slice('lucide:'.length), color)
  if (!svg) throw new HTTPError({ status: 404, message: 'No such icon' })

  setResponseHeaders(event, {
    'content-type': 'image/svg+xml',
    'cache-control': 'public, max-age=2592000, stale-while-revalidate=86400',
    'content-security-policy': 'default-src \'none\'; style-src \'unsafe-inline\'; sandbox',
    'x-content-type-options': 'nosniff'
  })
  return svg
})
