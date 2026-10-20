// Sharing a bookmark folder as a public page (/shared/<id>): anyone with the link can see the
// bookmarks in the folder and its sub-folders, without signing in. The owner's device writes a copy
// to Firestore's shares/<id> (firestore.rules: anyone reads, only the owner writes) and keeps it up to
// date while the folder changes. Your own notes on bookmarks stay private; only what the sites say
// about themselves (title, description, icon, picture) is shared.
import type { Bookmark } from './bookmarks'
import type { Folder } from './folders'

export interface SharedFolder {
  id: string
  name: string
  icon: string
  color: string
  parentId: string
  order: number
}

export interface SharedBookmark {
  url: string
  title: string
  description: string
  icon: string
  image?: string
  siteName?: string
  /** The shared folders it's in */
  folders: string[]
}

export interface SharePayload {
  v: 1
  /** The shared folder; its parentId is '' here */
  rootId: string
  folders: SharedFolder[]
  bookmarks: SharedBookmark[]
}

/** Firestore keeps a document under 1 MiB; leave room for the fields around it */
export const SHARE_MAX_BYTES = 900_000

/** A long random id, so a link can't be guessed */
export function newShareId() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  return [...crypto.getRandomValues(new Uint8Array(22))].map(b => abc[b % abc.length]).join('')
}

export const isShareId = (id: string) => /^[A-Za-z0-9]{12,40}$/.test(id)

export const shareLink = (id: string) => `${window.location.origin}/shared/${id}`

/** What the shared page shows for a folder: it, its sub-folders, and every bookmark in them */
export function buildShare(root: Folder, folders: readonly Folder[], bookmarks: readonly Bookmark[]): SharePayload {
  const inside = new Set([root.id, ...descendantsOf(folders, root.id)])
  const shared = folders.filter(f => inside.has(f.id)).map<SharedFolder>(f => ({
    id: f.id,
    name: f.name,
    icon: f.icon,
    color: f.color,
    parentId: f.id === root.id ? '' : f.parentId,
    order: f.order
  }))
  const marks = bookmarks
    .filter(b => (b.folders ?? []).some(id => inside.has(id)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map<SharedBookmark>(b => ({
      url: b.url,
      title: b.title,
      description: b.description ?? '',
      icon: b.icon,
      ...(b.image ? { image: b.image } : {}),
      ...(b.siteName ? { siteName: b.siteName } : {}),
      folders: (b.folders ?? []).filter(id => inside.has(id))
    }))
  return { v: 1, rootId: root.id, folders: shared, bookmarks: marks }
}
