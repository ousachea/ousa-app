import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { defineEventHandler, HTTPError } from 'h3'

// Saves a food photo into public/eat/ so it lives in the project and can be committed to GitHub.
// Development only: a deployed site has no project folder to write into.
const TYPES: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }
const MAX_BYTES = 2 * 1024 * 1024

export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    throw new HTTPError({ status: 403, message: 'Photos can only be added while running the app locally (npm run dev), because they’re saved into the project folder.' })
  }

  const type = event.req.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
  const ext = TYPES[type]
  if (!ext) throw new HTTPError({ status: 415, message: 'Only WebP, JPEG or PNG images can be saved.' })

  const bytes = new Uint8Array(await event.req.arrayBuffer())
  if (!bytes.length) throw new HTTPError({ status: 400, message: 'The image was empty.' })
  if (bytes.length > MAX_BYTES) throw new HTTPError({ status: 413, message: 'Images must be under 2 MB.' })

  // The server picks the file name, so nothing can be written outside public/eat/
  const name = `${randomUUID()}.${ext}`
  const dir = join(process.cwd(), 'public', 'eat')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, name), bytes)

  return { path: `/eat/${name}` }
})
