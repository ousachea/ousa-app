import { defineEventHandler, getRouterParam, HTTPError } from 'h3'
import { useRuntimeConfig } from 'nitro/runtime-config'

// A shared bookmark folder (/shared/<id>), read from Firestore's shares/<id> document. Shares are
// public (see firestore.rules), so this reads through the REST API with no sign-in, the way the CV
// does. The document holds the folder as one JSON string in `json`. Cached for a few seconds, so a
// link passed around a group chat doesn't read Firestore for every visitor.
const CACHE_MS = 15_000
const cache = new Map<string, { value: ShareResponse, at: number }>()

interface ShareResponse {
  share: unknown
  updatedAt: string | null
}

export default defineEventHandler(async (event): Promise<ShareResponse> => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[A-Za-z0-9]{12,40}$/.test(id)) throw new HTTPError({ status: 404, message: 'No shared folder here' })
  const hit = cache.get(id)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value

  const { firebase } = useRuntimeConfig().public as { firebase?: { apiKey?: string, projectId?: string } }
  if (!firebase?.apiKey || !firebase.projectId) throw new HTTPError({ status: 503, message: 'Sharing isn’t set up on this site' })

  const url = `https://firestore.googleapis.com/v1/projects/${firebase.projectId}/databases/(default)/documents/shares/${id}?key=${firebase.apiKey}`
  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(6000) })
  } catch {
    if (hit) return hit.value
    throw new HTTPError({ status: 503, message: 'Couldn’t reach the shared folder right now' })
  }
  if (res.status === 404) {
    cache.delete(id)
    throw new HTTPError({ status: 404, message: 'This folder isn’t shared any more' })
  }
  if (!res.ok) {
    if (hit) return hit.value
    throw new HTTPError({ status: 503, message: 'Couldn’t read the shared folder right now' })
  }
  const doc = await res.json() as { fields?: { json?: { stringValue?: string }, updatedAt?: { stringValue?: string } } }
  const raw = doc.fields?.json?.stringValue
  const value: ShareResponse = { share: raw ? JSON.parse(raw) : null, updatedAt: doc.fields?.updatedAt?.stringValue ?? null }
  cache.set(id, { value, at: Date.now() })
  if (cache.size > 500) cache.delete(cache.keys().next().value!)
  return value
})
