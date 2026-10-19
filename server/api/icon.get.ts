import { defineEventHandler, getQuery, HTTPError, setResponseHeaders } from 'h3'
import { iconSvg } from '../utils/iconLibrary'
import { brandSvg } from '../utils/brandLogos'

// An icon from the icon library, served from this site: /api/icon?id=lucide:car&color=%23ffffff for a line
// icon, /api/icon?id=simple-icons:stripe for a brand logo (in its brand colour unless a colour is given).
// Same-origin, so it works as a CSS mask and is cached for the offline app.
const ID = /^(lucide|simple-icons):([a-z0-9]+(?:-[a-z0-9]+)*)$/
const COLOR = /^#[0-9a-f]{3,8}$/i

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const id = String(q.id ?? '').match(ID)
  const color = q.color === undefined ? undefined : String(q.color)
  if (!id || (color !== undefined && !COLOR.test(color))) throw new HTTPError({ status: 400, message: 'That isn’t an icon' })

  const svg = id[1] === 'lucide' ? iconSvg(id[2]!, color ?? '#000000') : await brandSvg(id[2]!, color)
  if (!svg) throw new HTTPError({ status: 404, message: 'No such icon' })

  setResponseHeaders(event, {
    'content-type': 'image/svg+xml',
    'cache-control': 'public, max-age=2592000, stale-while-revalidate=86400',
    'content-security-policy': 'default-src \'none\'; style-src \'unsafe-inline\'; sandbox',
    'x-content-type-options': 'nosniff'
  })
  return svg
})
