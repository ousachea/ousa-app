import { toast } from 'vue-sonner'
import { CV_DEFAULT, withDefaults, type CvContent } from '~/data/cv'

// The CV page's content: rendered from Firestore's public/cv (server/api/cv.get.ts) so every visitor
// gets the latest version, falling back to the built-in content in data/cv.ts. Only the owner
// (NUXT_PUBLIC_OWNER_EMAIL, signed in with Google) can change it; firestore.rules enforces that too.
// Each change is saved straight away, with Undo.

/** Reads a value by path, like 'work.0.title' */
export function cvGet(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj)
}

/** Writes a value by path; an empty string in a list of strings removes that entry instead */
export function cvSet(obj: unknown, path: string, value: unknown) {
  const keys = path.split('.')
  const last = keys.pop()!
  const parent = keys.reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj) as Record<string, unknown> | unknown[]
  if (Array.isArray(parent) && value === '' && typeof parent[Number(last)] === 'string') parent.splice(Number(last), 1)
  else (parent as Record<string, unknown>)[last] = value
}

export function useCvContent() {
  const content = useState<CvContent>('cv-content', () => structuredClone(CV_DEFAULT))
  const isOwner = useState('cv-owner', () => false)
  const saving = useState('cv-saving', () => false)

  async function load() {
    const { data } = await useFetch('/api/cv', { key: 'cv-content' })
    content.value = withDefaults(data.value?.content as Partial<CvContent> | null)
  }

  // Watches who is signed in (browser only); the owner gets the editing tools
  function watchOwner() {
    if (import.meta.server || !firebaseConfigured()) return
    const owner = String(useRuntimeConfig().public.ownerEmail ?? '').trim().toLowerCase()
    if (!owner) return
    // Firebase arrives just after the page (loadFirebase); the editing tools show once it says who you are
    let stop: (() => void) | undefined
    let left = false
    onBeforeUnmount(() => {
      left = true
      stop?.()
    })
    loadFirebase().then(({ auth, sdk }) => {
      if (left) return
      stop = sdk.onAuthStateChanged(auth, (user) => {
        isOwner.value = !!user && user.emailVerified && user.email?.toLowerCase() === owner
      })
    }).catch(() => {})
  }

  async function publish(next: CvContent) {
    const { db, sdk } = await loadFirebase()
    await withTimeout(sdk.setDoc(sdk.doc(db, 'public', 'cv'), {
      json: JSON.stringify(next),
      updatedAt: new Date().toISOString()
    }))
  }

  /** Applies a change, saves it, and offers Undo; goes back to how it was if saving fails */
  async function save(change: (draft: CvContent) => void, label = 'CV updated') {
    // Plain JSON copies throughout: edited values can arrive wrapped in Vue's reactive proxies, which
    // structuredClone refuses, and Firestore stores JSON anyway
    const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v))
    const before = plain(content.value)
    const draft = plain(before)
    change(draft)
    const next = plain(draft)
    content.value = next
    saving.value = true
    try {
      await publish(next)
      toast.success(label, {
        description: 'Visitors see it now.',
        action: { label: 'Undo', onClick: () => restore(before) }
      })
    } catch (e) {
      content.value = before
      toast.error('Couldn’t save the CV', {
        description: needsFirestoreSetup(e)
          ? 'Publish the latest firestore.rules in the Firebase console, then try again.'
          : 'Check your connection and try again.'
      })
    } finally {
      saving.value = false
    }
  }

  async function restore(version: CvContent) {
    await save(draft => Object.assign(draft, version), 'Change undone')
  }

  /** Back to the built-in content from data/cv.ts */
  async function reset() {
    await save(draft => Object.assign(draft, CV_DEFAULT), 'CV reset to the original')
  }

  return { content, isOwner, saving, load, watchOwner, save, reset }
}
