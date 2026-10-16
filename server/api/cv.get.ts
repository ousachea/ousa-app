import { defineEventHandler } from 'h3'
import { useRuntimeConfig } from 'nitro/runtime-config'

// The CV as edited on /cv, read from Firestore's public/cv document so the page is rendered with the
// latest version for every visitor. The document is public (see firestore.rules), so this reads it
// through the REST API with no sign-in. It holds the whole CV as one JSON string in `json`.
// Cached briefly in memory; null when nothing has been saved yet, or Firebase isn't set up, and the
// page then shows the built-in content from data/cv.ts.
const CACHE_MS = 30_000

interface CvResponse {
  content: unknown | null
  updatedAt: string | null
}

let cache: { value: CvResponse, at: number } | undefined

export default defineEventHandler(async (): Promise<CvResponse> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value

  const { firebase } = useRuntimeConfig().public as { firebase?: { apiKey?: string, projectId?: string } }
  const empty: CvResponse = { content: null, updatedAt: null }
  if (!firebase?.apiKey || !firebase.projectId) return empty

  const url = `https://firestore.googleapis.com/v1/projects/${firebase.projectId}/databases/(default)/documents/public/cv?key=${firebase.apiKey}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (res.status === 404) {
      cache = { value: empty, at: Date.now() }
      return empty
    }
    if (!res.ok) return cache?.value ?? empty
    const doc = await res.json() as { fields?: { json?: { stringValue?: string }, updatedAt?: { stringValue?: string } } }
    const raw = doc.fields?.json?.stringValue
    const value: CvResponse = {
      content: raw ? JSON.parse(raw) : null,
      updatedAt: doc.fields?.updatedAt?.stringValue ?? null
    }
    cache = { value, at: Date.now() }
    return value
  } catch {
    // Offline or Firestore slow: the last good copy, or the built-in CV
    return cache?.value ?? empty
  }
})
