import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defineEventHandler, HTTPError } from 'h3'

// Saves the Eat list into app/data/eat.json, the list everyone sees before signing in (and new accounts
// start from). Development only, like eat-image: a deployed site has no project folder to write into.
const KINDS = new Set(['food', 'place'])
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    throw new HTTPError({ status: 403, message: 'The list can only be published while running the app locally (npm run dev), because it’s saved into the project folder.' })
  }

  const body: unknown = await event.req.json().catch(() => undefined)
  if (!Array.isArray(body)) throw new HTTPError({ status: 400, message: 'Send the list as an array.' })

  // Only the fields worth sharing: no ids or when you last ate something
  const spots = body.flatMap((s: Record<string, unknown>) => {
    const name = text(s?.name, 120)
    if (!name) return []
    const price = [1, 2, 3].includes(s.price as number) ? s.price : 1
    const spot: Record<string, unknown> = { name }
    const nameKm = text(s.nameKm, 120)
    if (nameKm) spot.nameKm = nameKm
    spot.kind = KINDS.has(s.kind as string) ? s.kind : 'food'
    spot.note = text(s.note, 300)
    spot.price = price
    const image = text(s.image, 2000)
    if (image.startsWith('/eat/') || image.startsWith('https://')) spot.image = image
    const focus = text(s.focus, 20)
    if (spot.image && /^\d{1,3}% \d{1,3}%$/.test(focus)) spot.focus = focus
    return [spot]
  })

  await writeFile(join(process.cwd(), 'app', 'data', 'eat.json'), `${JSON.stringify(spots, null, 2)}\n`)
  return { count: spots.length }
})
