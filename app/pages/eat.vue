<script setup lang="ts">
import type { BulkAction } from '~/composables/useBulkSelect'
import { toast } from 'vue-sonner'
import published from '~/data/eat.json'

type Kind = 'food' | 'place'

interface Spot {
  id: string
  name: string
  nameKm?: string // the name in Khmer, shown under the English one
  kind: Kind
  note: string
  price: 1 | 2 | 3
  image?: string // a path inside public/ (e.g. /eat/3f2a….webp), or a link to an image on the web
  focus?: string // which part of the photo shows in its square frame, as a CSS position ("30% 60%"); centred when unset
  lastEaten?: string // when you last picked it and pressed Let's eat (ISO); recent ones sink down the deck
}

// The list published from a local run (Publish, below): what everyone sees before signing in, and what
// a new account starts from
const PUBLISHED = published as Omit<Spot, 'id'>[]
const SEED = (): Spot[] => PUBLISHED.map(s => ({ ...s, id: crypto.randomUUID() }))

const FILTERS: { value: 'all' | Kind, label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'food', label: 'Foods' },
  { value: 'place', label: 'Places' }
]
const SWIPE_THRESHOLD = 110 // px of drag that counts as a decision

const { play } = useSound()
// Demo: the published list too
const DEMO = (): Omit<Spot, 'id'>[] => PUBLISHED.map(s => ({ ...s }))
const { items, ready, sync, add, update, replace, remove, restore } = useCollection<Spot>('eat', SEED, { demo: DEMO })

// ---------- Shared with everyone ----------
// Every signed-in person's foods that have a photo are copied to eatShared/<id> in Firestore, which anyone
// can read, so they join everyone's deck straight away. Each copy keeps its owner: they can change or
// delete it, and so can the site owner's account (firestore.rules). Kept in step with your own list by
// shareMine, so adding, editing and deleting anywhere (Recycle Bin, other devices) carries over.
interface SharedSpot extends Omit<Spot, 'lastEaten'> { owner: string }
const shared = ref<SharedSpot[]>([])
const sharedReady = ref(false)
const myUid = ref<string>()
// The same account firestore.rules lets take things down
const ownerEmail = ((useRuntimeConfig().public.ownerEmail as string | undefined)?.trim() || 'ousauser@gmail.com').toLowerCase()
const isSiteOwner = ref(false)
const SHARED_FIELDS = ['name', 'nameKm', 'kind', 'note', 'price', 'image', 'focus'] as const
const shareable = (s: Spot) => Object.fromEntries(SHARED_FIELDS.filter(k => s[k] !== undefined && s[k] !== '').map(k => [k, s[k]]))

let stopShared: (() => void) | undefined
let left = false
onMounted(() => {
  if (!firebaseConfigured()) return
  loadFirebase().then(({ db, auth, sdk }) => {
    if (left) return
    const off = sdk.onSnapshot(sdk.query(sdk.collection(db, 'eatShared'), sdk.orderBy('createdAt', 'desc'), sdk.limit(300)), (snap) => {
      shared.value = snap.docs.map(d => ({ ...(d.data() as Omit<SharedSpot, 'id'>), id: d.id }))
      sharedReady.value = true
    }, (e) => console.warn('Shared foods unavailable', e))
    const offAuth = sdk.onAuthStateChanged(auth, (user) => {
      myUid.value = user?.uid
      isSiteOwner.value = !!user?.email && user.email.toLowerCase() === ownerEmail && user.emailVerified
    })
    stopShared = () => {
      off()
      offAuth()
    }
  }).catch(() => {})
})
onBeforeUnmount(() => {
  left = true
  stopShared?.()
})

// Puts your foods with photos into the shared list, changes them there when they change here, and takes
// them out when they're deleted here or lose their photo. Only once both lists have loaded.
const writing = new Set<string>()
async function shareMine() {
  const uid = myUid.value
  if (!uid || !ready.value || !sharedReady.value || sync.state.value === 'demo' || sync.state.value === 'device') return
  const fb = firebaseNow()
  if (!fb) return
  const { db, sdk } = fb
  const mine = new Map(items.value.filter(s => s.image).map(s => [s.id, s]))
  const there = new Map(shared.value.filter(s => s.owner === uid).map(s => [s.id, s]))
  const jobs: Promise<unknown>[] = []
  for (const [id, s] of mine) {
    const want = shareable(s)
    const have = there.get(id)
    const same = have && SHARED_FIELDS.every(k => (have[k] ?? '') === (want[k] ?? ''))
    if (same || writing.has(id)) continue
    writing.add(id)
    jobs.push(sdk.setDoc(sdk.doc(db, 'eatShared', id), { ...want, owner: uid, createdAt: have ? (have as { createdAt?: unknown }).createdAt ?? sdk.serverTimestamp() : sdk.serverTimestamp() })
      .catch(e => console.warn('Couldn’t share', s.name, e))
      .finally(() => writing.delete(id)))
  }
  for (const id of there.keys()) {
    if (mine.has(id) || writing.has(id)) continue
    writing.add(id)
    jobs.push(sdk.deleteDoc(sdk.doc(db, 'eatShared', id)).catch(e => console.warn('Couldn’t unshare', e)).finally(() => writing.delete(id)))
  }
  await Promise.all(jobs)
}
watch([items, shared, myUid, ready, sharedReady], () => void shareMine(), { deep: true })

// Others' shared foods: in the deck alongside yours (or, signed out, alongside the published list)
const others = computed(() => {
  const own = new Set(items.value.map(s => s.id))
  return shared.value.filter(s => s.owner !== myUid.value && !own.has(s.id)) as Spot[]
})
const pool = computed(() => [...items.value, ...others.value])
const isMine = (s: Spot) => items.value.some(i => i.id === s.id)

// The site owner can take down anything shared
async function takeDown(s: Spot) {
  const fb = firebaseNow()
  if (!fb) return
  try {
    await fb.sdk.deleteDoc(fb.sdk.doc(fb.db, 'eatShared', s.id))
    deck.value = deck.value.filter(id => id !== s.id)
    liked.value = liked.value.filter(id => id !== s.id)
    toast.success(`${s.name} removed for everyone`)
    play('delete')
  } catch {
    toast.error('Couldn’t remove it', { description: 'Check that the Firestore rules allow your account to.' })
    play('error')
  }
}

// Signed out, the published list is the real thing to choose from, not an example
const exampleNote = PUBLISHED.length
  ? { title: 'Foods to choose from.', long: 'Swipe and pick as much as you like. Sign in to keep a list of your own; changes here aren’t saved.', short: 'Sign in to save your own.' }
  : undefined

// Running locally: write this list into the project (app/data/eat.json) so it goes live with the next deploy
const publishing = ref(false)
async function publish() {
  if (publishing.value || sync.state.value === 'demo') return
  publishing.value = true
  try {
    const { count } = await $fetch<{ count: number }>('/api/eat-foods', { method: 'POST', body: items.value })
    toast.success(`Published ${count} ${count === 1 ? 'item' : 'items'}`, { description: 'Saved to app/data/eat.json. Commit it with the photos in public/eat/ to put it live.' })
    play('success')
  } catch (e) {
    const message = (e as { data?: { message?: string } }).data?.message
    toast.error('List not published', { description: message ?? 'Saving it to the project folder failed.' })
    play('error')
  } finally {
    publishing.value = false
  }
}

// ---------- Adding ----------
const form = reactive({ name: '', nameKm: '', kind: 'food' as Kind, note: '', price: 1 as Spot['price'], imageUrl: '' })
const photo = ref<{ blob: Blob, preview: string }>()

// A photo can also be a link to an image anywhere on the web. It's stored as is, so it works on the live
// site and syncs with the item, unlike picked files, which are saved into the project folder.
const photoLink = (text: string) => {
  const t = text.trim()
  return /^https?:\/\/\S+$/i.test(t) ? t : ''
}
const isWebImage = (path?: string) => !!path && /^https?:\/\//i.test(path)
// Set when a pasted link doesn't load as an image, so the form can say so
const addLinkBroken = ref(false)
const editLinkBroken = ref(false)
const saving = ref(false)
// Editing happens in a popup with its own copy of the fields
const editingId = ref<string>()
const editForm = reactive({ name: '', nameKm: '', kind: 'food' as Kind, note: '', price: 1 as Spot['price'], imageUrl: '', removeImage: false, focus: { x: 50, y: 50 } })
watch(() => form.imageUrl, () => (addLinkBroken.value = false))
watch(() => editForm.imageUrl, () => (editLinkBroken.value = false))
const editPhoto = ref<{ blob: Blob, preview: string }>()
const editingSpot = computed(() => items.value.find(s => s.id === editingId.value))
// What the edit popup's photo box shows: a pasted link, else the current photo (unless removed)
const editPreview = computed(() => {
  const link = photoLink(editForm.imageUrl)
  if (link) return editLinkBroken.value ? '' : link
  if (editForm.removeImage) return ''
  const current = editingSpot.value?.image
  return isWebImage(current) ? '' : current ?? '' // a cleared link field means no link photo
})
const PHOTO_SIZE = 1200 // longest side

// Shrink to WebP in the browser, so files stay small. The whole picture is kept (not cropped),
// so which part shows in the square frames can be moved later (Edit → Position).
async function shrinkPhoto(file: Blob, size = PHOTO_SIZE, quality = 0.82) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality))
  if (!blob) throw new Error('Could not prepare the photo')
  return blob
}

async function onPhotoPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.error('That file isn’t an image')
    return
  }
  try {
    const blob = await shrinkPhoto(file)
    if (photo.value) URL.revokeObjectURL(photo.value.preview)
    photo.value = { blob, preview: URL.createObjectURL(blob) }
    play('drop')
    if (canBulkPhotos && !form.name.trim()) fillFromPhoto(blob)
  } catch {
    toast.error('Couldn’t read that image')
  }
}

// Fills only what's still empty, so nothing typed meanwhile is overwritten
const naming = ref(false)
async function fillFromPhoto(blob: Blob) {
  naming.value = true
  try {
    const named = await namePhoto(blob)
    if (photo.value?.blob !== blob) return
    if (!form.name.trim()) Object.assign(form, { name: named.name, kind: named.kind, price: named.price })
    if (!form.nameKm.trim()) form.nameKm = named.nameKm
    if (!form.note.trim()) form.note = named.note
  } catch (e) {
    toast.error('Couldn’t name the photo', { description: nameError(e) })
  } finally {
    naming.value = false
  }
}

function clearPhoto() {
  if (photo.value) URL.revokeObjectURL(photo.value.preview)
  photo.value = undefined
}

// Running locally, saved into public/eat/ by a local-only server route, so the photo lives in the project
// for git. On the site there's no folder to save into, so the photo is kept in the record itself as a
// small data: URL (SHARED_PHOTO_SIZE), which also lets it be shared with everyone (shareMine, below).
const SHARED_PHOTO_SIZE = 640
async function uploadPhoto(blob: Blob) {
  if (!import.meta.dev) {
    const small = await shrinkPhoto(blob, SHARED_PHOTO_SIZE, 0.75)
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(small)
    })
  }
  const res = await $fetch<{ path: string }>('/api/eat-image', {
    method: 'POST',
    body: blob,
    headers: { 'Content-Type': blob.type }
  })
  return res.path
}

// ---------- Positioning a photo in its square frame (Edit → Position) ----------
const parseFocus = (focus?: string) => {
  const [x = 50, y = 50] = focus?.match(/-?[\d.]+/g)?.map(Number) ?? []
  return { x, y }
}
const focusText = (f: { x: number, y: number }) => `${Math.round(f.x)}% ${Math.round(f.y)}%`
const clamp = (n: number) => Math.min(100, Math.max(0, n))
const cssUrl = (src: string) => `url("${src.replace(/["\\\n]/g, encodeURIComponent)}")`

// The photo being positioned: the whole picture shows, and a click (or drag) puts the dot on the part
// that should stay in view. The dot's place on the photo is its CSS position in the square frames.
const framePhoto = computed(() => editPhoto.value?.preview || editPreview.value)
const frameStyle = computed(() => framePhoto.value && { backgroundImage: cssUrl(framePhoto.value), backgroundPosition: focusText(editForm.focus) })

let placingDot = false
function placeDot(e: PointerEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  editForm.focus = { x: clamp(((e.clientX - rect.left) / rect.width) * 100), y: clamp(((e.clientY - rect.top) / rect.height) * 100) }
}
function onDotDown(e: PointerEvent) {
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  placingDot = true
  placeDot(e)
}
function onDotMove(e: PointerEvent) {
  if (placingDot) placeDot(e)
}
function onDotUp() {
  placingDot = false
}
function onDotKey(e: KeyboardEvent) {
  const step = e.shiftKey ? 20 : 5
  const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
  const d = move[e.key]
  if (!d) return
  e.preventDefault()
  editForm.focus = { x: clamp(editForm.focus.x + d[0]), y: clamp(editForm.focus.y + d[1]) }
}

function edit(s: Spot) {
  editingId.value = s.id
  Object.assign(editForm, { name: s.name, nameKm: s.nameKm ?? '', kind: s.kind, note: s.note ?? '', price: s.price, imageUrl: isWebImage(s.image) ? s.image : '', removeImage: false, focus: parseFocus(s.focus) })
  clearEditPhoto()
  play('open')
}

function clearEditPhoto() {
  if (editPhoto.value) URL.revokeObjectURL(editPhoto.value.preview)
  editPhoto.value = undefined
}

function cancelEdit() {
  editingId.value = undefined
  clearEditPhoto()
}

async function onEditPhotoPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.error('That file isn’t an image')
    return
  }
  try {
    const blob = await shrinkPhoto(file)
    clearEditPhoto()
    editPhoto.value = { blob, preview: URL.createObjectURL(blob) }
    editForm.focus = { x: 50, y: 50 }
    play('drop')
  } catch {
    toast.error('Couldn’t read that image')
  }
}

async function saveEdit() {
  const id = editingId.value
  if (!id || !editForm.name.trim() || saving.value) return
  saving.value = true
  // Which photo to keep: a newly picked file, else a pasted link, else the current one (unless removed)
  const current = editingSpot.value?.image
  let image = editForm.removeImage ? undefined : current
  const link = photoLink(editForm.imageUrl)
  if (link) image = link
  else if (isWebImage(current) && !editForm.imageUrl.trim()) image = undefined // the link field was cleared
  try {
    if (editPhoto.value) image = await uploadPhoto(editPhoto.value.blob)
  } catch (e) {
    const message = (e as { data?: { message?: string } }).data?.message
    toast.error('Photo not saved', { description: message ?? 'Saving it to the project folder failed. Your other changes were saved.' })
  }
  // Changes show straight away on its card, in the deck and on the shortlist
  const focus = image && (editForm.focus.x !== 50 || editForm.focus.y !== 50) ? focusText(editForm.focus) : undefined
  const before = update(id, { name: editForm.name.trim(), nameKm: editForm.nameKm.trim() || undefined, kind: editForm.kind, note: editForm.note.trim(), price: editForm.price, image, focus })
  toastSaved(before && (() => replace(before)), `${editForm.name.trim()} updated`)
  play('success')
  saving.value = false
  cancelEdit()
}

const nameField = ref<HTMLInputElement>()
const draft = useDraft('eat', form, {
  active: () => true,
  isEmpty: f => !f.name.trim() && !f.nameKm.trim() && !f.note.trim() && !f.imageUrl.trim(),
  summary: f => [f.name, f.nameKm, f.note, f.kind === 'place' ? 'A place' : 'A food']
})
onMounted(() => draft.check())
useAddAction(() => openAdd())

// ---------- Adding opens in a popup (+ Add in Your foods and places, or A anywhere) ----------
const addOpen = ref(false)
function openAdd() {
  addOpen.value = true
  play('open')
}
function closeAdd() {
  addOpen.value = false
}

async function save() {
  if (!form.name.trim() || saving.value) return
  saving.value = true
  // A picked file wins over a pasted link
  let image: string | undefined = photoLink(form.imageUrl) || undefined
  let uploaded = false
  try {
    if (photo.value) {
      image = await uploadPhoto(photo.value.blob)
      uploaded = true
    }
  } catch (e) {
    const message = (e as { data?: { message?: string } }).data?.message
    toast.error('Photo not saved', { description: message ?? 'Saving it to the project folder failed. The item was added without it.' })
  }
  const spot = add({ name: form.name.trim(), ...(form.nameKm.trim() ? { nameKm: form.nameKm.trim() } : {}), kind: form.kind, note: form.note.trim(), price: form.price, ...(image ? { image } : {}) })
  draft.clear()
  deck.value.push(spot.id) // new cards join the end of the current deck
  toast.success(`${spot.name} added`, {
    description: uploaded ? `Photo saved to public${image}. Commit it to keep it.` : undefined,
    action: {
      label: 'Undo',
      onClick: () => {
        remove(spot.id, { undoAdd: true })
        deck.value = deck.value.filter(id => id !== spot.id)
      }
    }
  })
  play('success')
  Object.assign(form, { name: '', nameKm: '', note: '', imageUrl: '' })
  clearPhoto()
  saving.value = false
  closeAdd()
}

// Running locally, several photos can be added at once: one food per photo, named after its file
// (rename any of them with Edit). Photos are saved into the project, so this only works in npm run dev.
const canBulkPhotos = import.meta.dev
const bulkAdding = ref(false)
const nameFromFile = (file: File) => file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Untitled'

// Running locally, Claude names a photo: the dish (or place) in English and Khmer, a short note and a price
type Named = Pick<Spot, 'name' | 'kind' | 'note' | 'price'> & { nameKm: string }
const nameError = (e: unknown) => (e as { data?: { message?: string } }).data?.message ?? 'Naming it with Claude failed.'
const namePhoto = (blob: Blob) => $fetch<Named>('/api/eat-name', { method: 'POST', body: blob, headers: { 'Content-Type': blob.type } })

async function addPhotos(e: Event) {
  const input = e.target as HTMLInputElement
  const files = [...(input.files ?? [])].filter(f => f.type.startsWith('image/'))
  input.value = ''
  if (!files.length || bulkAdding.value) return
  bulkAdding.value = true
  const added: Spot[] = []
  let failed = 0
  let unnamed: string | undefined // why naming failed, said once; those keep their file names
  for (const file of files) {
    try {
      const blob = await shrinkPhoto(file)
      const [image, named] = await Promise.all([
        uploadPhoto(blob),
        namePhoto(blob).catch((err) => {
          unnamed = nameError(err)
          return undefined
        })
      ])
      const { nameKm, ...rest } = named ?? { name: nameFromFile(file), nameKm: '', kind: 'food' as Kind, note: '', price: 1 as Spot['price'] }
      const spot = add({ ...rest, ...(nameKm ? { nameKm } : {}), image })
      deck.value.push(spot.id)
      added.push(spot)
    } catch {
      failed++
    }
  }
  bulkAdding.value = false
  if (added.length) {
    toast.success(`${added.length} ${added.length === 1 ? 'food' : 'foods'} added`, {
      description: `${failed ? `${failed} couldn’t be saved. ` : ''}${unnamed ? `Some kept their file names: ${unnamed} ` : ''}Photos saved to public/eat/. Commit them to keep them.`,
      action: {
        label: 'Undo',
        onClick: () => {
          const ids = new Set(added.map(a => a.id))
          for (const a of added) remove(a.id, { undoAdd: true })
          deck.value = deck.value.filter(id => !ids.has(id))
        }
      }
    })
    play('success')
  } else {
    toast.error('No photos saved', { description: 'Saving them to the project folder failed.' })
    play('error')
  }
}

onBeforeUnmount(() => {
  clearPhoto()
  clearEditPhoto()
})

// Add or replace the photo of something already in the list
async function setPhoto(spot: Spot, e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const path = await uploadPhoto(await shrinkPhoto(file))
    update(spot.id, { image: path, focus: undefined })
    toast.success(`Photo added to ${spot.name}`, { description: `Saved to public${path}. Commit it to keep it.` })
    play('success')
  } catch (err) {
    const message = (err as { data?: { message?: string } }).data?.message
    toast.error('Photo not saved', { description: message ?? 'Saving it to the project folder failed.' })
    play('error')
  }
}

// ---------- Select several (useBulkSelect) ----------
const bulkText = (n: number) => `${n} ${n === 1 ? 'place' : 'places'}`
const sel = useBulkSelect({ items, shown: items, onDelete: () => deleteSelected() })
function deleteSelected() {
  sel.guard(`Delete ${bulkText(sel.selected.size)}?`, () => bulkRemove(sel.selectedItems as Spot[], remove, restore, bulkText))
}
const bulkActions = computed<BulkAction[]>(() => [
  { label: 'Delete', icon: 'delete', danger: true, run: deleteSelected }
])

function del(s: Spot) {
  const removed = remove(s.id)
  deck.value = deck.value.filter(id => id !== s.id)
  liked.value = liked.value.filter(id => id !== s.id)
  if (editingId.value === s.id) cancelEdit()
  // A head-to-head that included it starts over with what's left
  if (duel.value && (duel.value.champ === s.id || duel.value.queue.includes(s.id))) duel.value = undefined
  play('delete')
  toastDeleted(s.name, () => { if (removed) { restore(removed); deck.value.push(removed.id) } })
}

// ---------- Deck ----------
// Eat settings (the gear in the header): what the deck shows when you open it
const { prefs: eatPrefs } = useAppPrefs('eat', { filter: 'all' })
const filter = smoothRef(ref<'all' | Kind>('all'))
onMounted(() => (filter.value = eatPrefs.filter as 'all' | Kind))
const deck = ref<string[]>([])
const chosen = ref<Spot>()
// Pressed Let's eat on the result: it says enjoy, and offers to decide again
const ate = ref(false)

// Swiping right adds to this shortlist; the pick is made from it at the end
const liked = ref<string[]>([])

// Before you swipe: which prices, and whether to leave out what you had in the last few days
const RECENT_DAYS = 3
const prices = ref<Spot['price'][]>([1, 2, 3])
const skipRecent = ref(false)
function togglePrice(p: Spot['price']) {
  // At least one price stays on, or the deck would be empty
  if (prices.value.includes(p)) prices.value = prices.value.length > 1 ? prices.value.filter(x => x !== p) : prices.value
  else prices.value = [...prices.value, p].sort()
  play('select')
}

// Whole days since you last had it (undefined if never)
const daysSince = (s: Spot) => {
  if (!s.lastEaten) return undefined
  const then = new Date(s.lastEaten)
  const today = new Date()
  return Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) / 86_400_000)
}
const lastHad = (s: Spot) => {
  const d = daysSince(s)
  if (d === undefined) return ''
  if (d <= 0) return 'Had today'
  if (d === 1) return 'Had yesterday'
  if (d < 14) return `Had ${d} days ago`
  if (d < 60) return `Had ${Math.round(d / 7)} weeks ago`
  return `Had ${Math.round(d / 30)} months ago`
}

const inDeck = (s: Spot) => (filter.value === 'all' || s.kind === filter.value)
  && prices.value.includes(s.price)
  && !(skipRecent.value && (daysSince(s) ?? Infinity) < RECENT_DAYS)

function shuffle() {
  const ids = pool.value.filter(inDeck).map(s => s.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
  }
  // What you had this past week goes to the back, the most recent last, so the same dish doesn't
  // come up every night
  const recency = (id: string) => {
    const d = daysSince(byId(id)!)
    return d === undefined || d >= 7 ? 99 : d
  }
  deck.value = [...ids].sort((a, b) => recency(b) - recency(a))
  chosen.value = undefined
  ate.value = false
  duel.value = undefined
  // Open straight into the head-to-head over the whole deck; Stop drops back to swiping
  if (deck.value.length > 1) narrow(deck.value)
}

function startOver() {
  duel.value = undefined
  liked.value = []
  shuffle()
  play('retry')
}

// ---------- The result ----------
// Let's eat: remembered on the item, so it shows "Had today" and sinks down the deck for a while
function eatIt(spot: Spot) {
  if (isMine(spot)) update(spot.id, { lastEaten: new Date().toISOString() }, { quiet: true })
  // The result card shows the updated item (Had today)
  chosen.value = byId(spot.id) ?? spot
  ate.value = true
  play('level-up')
  toast.success(`Enjoy your ${spot.name}!`, { description: 'It’ll come up less for the next few days.' })
}
// Another go from the same shortlist, or a fresh deck when there's nothing left to choose between
function pickAgain() {
  ate.value = false
  if (shortlist.value.length > 1) narrow()
  else startOver()
}
// Places open in Google Maps by name (around wherever the phone is)
const directionsUrl = (s: Spot) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name)}`

function unlike(id: string) {
  liked.value = liked.value.filter(x => x !== id)
  play('remove-from-cart')
}

// ---------- Narrow it down: two at a time until one is left ----------
// The one you'd rather have stays and meets the next; the other leaves the shortlist.
const duel = ref<{ champ: string, queue: string[], round: number, total: number }>()
const duelPair = computed(() => {
  if (!duel.value) return undefined
  const a = byId(duel.value.champ)
  const b = byId(duel.value.queue[0])
  return a && b ? [a, b] as const : undefined
})

function narrow(from = liked.value) {
  const ids = [...from]
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
  }
  if (ids.length < 2) return pickOne()
  chosen.value = undefined
  duel.value = { champ: ids[0]!, queue: ids.slice(1), round: 1, total: ids.length - 1 }
  play('start')
}

function keep(side: 0 | 1) {
  const d = duel.value
  const pair = duelPair.value
  if (!d || !pair) return
  const winner = pair[side]
  const loser = pair[side === 0 ? 1 : 0]
  liked.value = liked.value.filter(id => id !== loser.id)
  const rest = d.queue.slice(1)
  if (rest.length) {
    duel.value = { ...d, champ: winner.id, queue: rest, round: d.round + 1 }
    play('select')
    return
  }
  duel.value = undefined
  chosen.value = winner
  ate.value = false
  play('success')
}

function randomFromDuel() {
  duel.value = undefined
  pickOne()
}

// Choose at random among the liked ones, avoiding the current pick when there's another option
function pickOne() {
  const pool = shortlist.value.length > 1 ? shortlist.value.filter(s => s.id !== chosen.value?.id) : shortlist.value
  const spot = pool[Math.floor(Math.random() * pool.length)]
  if (!spot) return
  chosen.value = spot
  ate.value = false
  play('success')
}

watch([ready, filter, prices, skipRecent], ([r]) => {
  if (r) shuffle()
})

// ---------- Your foods and places: the library under the deck ----------
const libQuery = ref('')
const libKind = ref<'all' | Kind>('all')
const library = computed(() => {
  const q = libQuery.value.trim().toLowerCase()
  return items.value.filter(s => (libKind.value === 'all' || s.kind === libKind.value)
    && (!q || s.name.toLowerCase().includes(q) || s.nameKm?.includes(q) || s.note?.toLowerCase().includes(q)))
})

// Switching the example data on or off swaps every card, so deal a fresh deck from the new list.
// flush 'post' waits until the collection has swapped its items.
const demoActive = useDemoState(useRoute().path).active
watch(demoActive, () => {
  liked.value = []
  editingId.value = undefined
  shuffle()
}, { flush: 'post' })

const byId = (id?: string) => pool.value.find(s => s.id === id)

// Foods others share while you're here join the end of the deck
watch(() => others.value.map(s => s.id), (ids, before) => {
  const seen = new Set([...(before ?? []), ...deck.value])
  for (const id of ids) {
    const s = byId(id)
    if (!seen.has(id) && s && inDeck(s)) deck.value.push(id)
  }
})
const shortlist = computed(() => liked.value.map(id => byId(id)).filter((s): s is Spot => !!s))
const current = computed(() => byId(deck.value[0]))

// ---------- Focus mode: just the cards, filling the screen ----------
const focus = ref(false)
const stageEl = ref<HTMLElement>()

function setFocus(on: boolean) {
  if (focus.value === on || import.meta.server) return
  focus.value = on
  play(on ? 'expand' : 'collapse')
  // The page behind stays put while you swipe
  document.documentElement.style.overflow = on ? 'hidden' : ''
  if (on) nextTick(() => stageEl.value?.focus({ preventScroll: true }))
}

function onFocusKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && focus.value && !document.querySelector('dialog[open]')) {
    e.preventDefault()
    setFocus(false)
  }
}
// Capture, so Esc closes focus mode before the app-wide Esc (go back) sees it
onMounted(() => window.addEventListener('keydown', onFocusKey, true))

// The app opens on the page; Start deciding takes the deck full screen
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onFocusKey, true)
  document.documentElement.style.overflow = ''
})
const next = computed(() => byId(deck.value[1]))
const third = computed(() => byId(deck.value[2]))

// ---------- Swiping ----------
const dx = ref(0)
const dragging = ref(false)
const flying = ref<'left' | 'right'>()
let startX = 0
let reducedMotion = false
onMounted(() => (reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches))

function onPointerDown(e: PointerEvent) {
  if (flying.value) return
  dragging.value = true
  startX = e.clientX
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (dragging.value) dx.value = e.clientX - startX
}

function onPointerUp() {
  if (!dragging.value) return
  dragging.value = false
  if (Math.abs(dx.value) > SWIPE_THRESHOLD) decide(dx.value > 0 ? 'right' : 'left')
  else dx.value = 0
}

function decide(dir: 'left' | 'right') {
  const spot = current.value
  if (!spot || flying.value) return
  flying.value = dir
  play(dir === 'right' ? 'add-to-cart' : 'swipe')
  setTimeout(() => {
    if (dir === 'right' && !liked.value.includes(spot.id)) liked.value = [...liked.value, spot.id]
    deck.value = deck.value.slice(1)
    flying.value = undefined
    dx.value = 0
    if (!deck.value.length) finishDeck()
  }, reducedMotion ? 0 : 260)
}

// The last card is decided: go straight on to choosing. Two or more liked starts the head-to-head,
// one liked is the pick; none leaves the "That's everything" panel to shuffle again.
function finishDeck() {
  if (chosen.value || duel.value) return
  if (shortlist.value.length > 1) setTimeout(narrow, reducedMotion ? 0 : 250)
  else if (shortlist.value.length === 1) pickOne()
}

function onKey(e: KeyboardEvent) {
  if (duelPair.value) {
    if (e.key === 'ArrowLeft') keep(0)
    else if (e.key === 'ArrowRight') keep(1)
    else return
    e.preventDefault()
    return
  }
  if (chosen.value || !current.value) return
  if (e.key === 'ArrowRight') decide('right')
  else if (e.key === 'ArrowLeft') decide('left')
  else return
  e.preventDefault()
}

// How strongly each verdict label shows while dragging
const yes = computed(() => Math.min(Math.max(dx.value / SWIPE_THRESHOLD, 0), 1))
const no = computed(() => Math.min(Math.max(-dx.value / SWIPE_THRESHOLD, 0), 1))

const cardStyle = computed(() => {
  if (flying.value) {
    const x = flying.value === 'right' ? 600 : -600
    return { transform: `translateX(${x}px) rotate(${x / 20}deg)`, opacity: 0, transition: 'transform 0.26s ease-in, opacity 0.26s' }
  }
  // A ring that grows in the decision's colour while dragging: green for yes, red for no
  const strength = Math.max(yes.value, no.value)
  const ring = yes.value > 0 ? 'var(--green)' : 'var(--red)'
  return {
    boxShadow: strength
      ? `0 0 0 4px var(--plastic), 0 0 0 ${4 + strength * 6}px ${ring}, 0 18px 40px -16px rgb(var(--shadow) / 0.5)`
      : undefined,
    transform: `translateX(${dx.value}px) rotate(${dx.value / 18}deg)`,
    transition: dragging.value ? 'none' : 'transform 0.3s cubic-bezier(0.3, 1.4, 0.6, 1)'
  }
})

const priceText = (p: number) => '$'.repeat(p)
// A card's photo as a CSS variable; the card styles add a gradient so text stays readable
const photoStyle = (spot: Spot) => (spot.image ? { '--photo': cssUrl(spot.image), ...(spot.focus ? { '--photo-pos': spot.focus } : {}) } : undefined)
</script>

<template>
  <ToolPage header="bar" :example-note="exampleNote">
    <template #settings>
      <SettingChoice v-model="eatPrefs.filter" title="Show" description="What the deck deals when you open the app." :options="[{ value: 'all', label: 'Both' }, { value: 'food', label: 'Foods' }, { value: 'place', label: 'Places' }]" />
    </template>
    <!-- Deciding comes first: the deck and the shortlist side by side, your list of foods and places below -->
    <div class="decide">
    <Step :n="1" title="Swipe to decide" hint="Right adds it to your shortlist, left skips it. Arrow keys work too." class="deck-step">
    <section class="stage-area" :class="{ focus }" :role="focus ? 'dialog' : undefined" :aria-modal="focus || undefined" aria-label="Swipe to decide">
      <!-- Focus mode: how many cards are left, and the way out -->
      <div v-if="focus" class="focus-bar">
        <span class="focus-count">{{ deck.length ? `${deck.length} ${deck.length === 1 ? 'card' : 'cards'} left` : 'All done' }}</span>
        <button type="button" class="btn btn-sm focus-done" @click="setFocus(false)">Done</button>
      </div>
      <!-- Before you swipe: what's in the deck -->
      <div class="stage-top">
        <div class="segmented filter" role="radiogroup" aria-label="Show">
          <label v-for="f in FILTERS" :key="f.value" :class="{ active: filter === f.value }">
            <input v-model="filter" type="radio" name="filter" :value="f.value">{{ f.label }}
          </label>
        </div>
        <div class="deck-options">
          <div class="prices" role="group" aria-label="Prices">
            <button v-for="p in ([1, 2, 3] as const)" :key="p" type="button" class="price-toggle" :aria-pressed="prices.includes(p)" @click="togglePrice(p)">{{ priceText(p) }}</button>
          </div>
          <label class="skip-recent">
            <input v-model="skipRecent" type="checkbox">
            Skip what I had lately
          </label>
        </div>
      </div>
      <!-- Off full screen, step 1's hint says this -->
      <p v-if="focus" class="how">Swipe right to add to your shortlist, left to skip. Arrow keys work too. Esc to leave.</p>

      <ClientOnly>
        <div ref="stageEl" class="stage" tabindex="0" aria-label="Food cards. Use the left and right arrow keys to decide." @keydown="onKey">
          <!-- Narrowing down: tap the one you'd rather have -->
          <div v-if="duelPair && duel" class="duel" role="group" aria-label="Which one would you rather have?">
            <div class="duel-head">
              <strong>Which sounds better?</strong>
              <span>Round {{ duel.round }} of {{ duel.total }}</span>
            </div>
            <div class="duel-cards">
              <button
                v-for="(s, i) in duelPair"
                :key="s.id"
                type="button"
                class="duel-card"
                :class="{ 'has-photo': s.image }"
                :data-kind="s.kind"
                :style="photoStyle(s)"
                :aria-label="`Keep ${s.name}`"
                @click="keep(i as 0 | 1)"
              >
                <span class="badge">{{ s.kind === 'food' ? 'Food' : 'Place' }}</span>
                <strong>{{ s.name }}</strong>
                <span v-if="s.nameKm" class="name-km" lang="km">{{ s.nameKm }}</span>
                <span v-if="s.note" class="duel-note">{{ s.note }}</span>
                <span class="price">{{ priceText(s.price) }}</span>
              </button>
              <span class="vs" aria-hidden="true">or</span>
            </div>
            <div class="duel-progress" aria-hidden="true"><span :style="{ width: `${((duel.round - 1) / duel.total) * 100}%` }" /></div>
            <div class="duel-foot">
              <button type="button" class="link" @click="randomFromDuel">Can’t decide? Pick at random</button>
              <button type="button" class="link" @click="duel = undefined">Stop</button>
            </div>
          </div>

          <!-- The result: one big card, and what to do about it -->
          <div v-else-if="chosen" class="result" :class="{ 'has-photo': chosen.image }" :data-kind="chosen.kind" :style="photoStyle(chosen)" role="status">
            <span class="result-label">{{ ate ? 'Enjoy!' : 'Tonight it’s' }}</span>
            <h2>{{ chosen.name }}</h2>
            <span v-if="chosen.nameKm" class="name-km" lang="km">{{ chosen.nameKm }}</span>
            <p v-if="chosen.note">{{ chosen.note }}</p>
            <span class="result-meta">{{ chosen.kind === 'food' ? 'Food' : 'Place' }} · {{ priceText(chosen.price) }}<template v-if="lastHad(chosen)"> · {{ lastHad(chosen) }}</template></span>
            <div class="result-actions">
              <button v-if="!ate" type="button" class="btn result-go" @click="eatIt(chosen)">Let’s eat</button>
              <a v-if="chosen.kind === 'place'" class="btn btn-quiet" :href="directionsUrl(chosen)" target="_blank" rel="noopener">Directions</a>
              <button type="button" class="btn btn-quiet" @click="ate ? startOver() : pickAgain()">{{ ate ? 'Decide again' : 'Pick again' }}</button>
            </div>
          </div>

          <template v-else-if="current">
            <div v-if="third" class="card behind deep" :data-kind="third.kind" :style="photoStyle(third)" aria-hidden="true" />
            <div v-if="next" class="card behind" :data-kind="next.kind" :style="photoStyle(next)" aria-hidden="true" />
            <div
              :key="current.id"
              class="card"
              :class="{ 'has-photo': current.image }"
              :data-kind="current.kind"
              :style="[photoStyle(current), cardStyle]"
              @pointerdown="onPointerDown"
              @pointermove="onPointerMove"
              @pointerup="onPointerUp"
              @pointercancel="onPointerUp"
            >
              <span class="verdict yes" :style="{ opacity: yes }" aria-hidden="true">Shortlist</span>
              <span class="verdict no" :style="{ opacity: no }" aria-hidden="true">Skip</span>
              <span class="badge">{{ current.kind === 'food' ? 'Food' : 'Place' }}</span>
              <h2 class="card-title">{{ current.name }}</h2>
              <span v-if="current.nameKm" class="name-km" lang="km">{{ current.nameKm }}</span>
              <p v-if="current.note">{{ current.note }}</p>
              <span class="price">{{ priceText(current.price) }}<span v-if="lastHad(current)" class="card-had"> · {{ lastHad(current) }}</span></span>
            </div>
          </template>

          <div v-else-if="ready && shortlist.length" class="panel out">
            <h2>You liked {{ shortlist.length }}</h2>
            <p>{{ shortlist.length === 1 ? `Looks like ${shortlist[0]!.name} it is.` : 'Compare them two at a time until one is left, or let the app choose.' }}</p>
            <div class="chosen-actions">
              <button type="button" class="btn" @click="shortlist.length === 1 ? pickOne() : narrow()">{{ shortlist.length === 1 ? `Eat ${shortlist[0]!.name}` : 'Narrow it down' }}</button>
              <button v-if="shortlist.length > 1" type="button" class="btn btn-quiet" @click="pickOne">Pick at random</button>
              <button type="button" class="btn btn-quiet" @click="startOver">Start over</button>
            </div>
          </div>

          <div v-else-if="ready" class="panel out">
            <h2>{{ items.length ? (items.some(inDeck) ? 'That’s everything' : 'Nothing matches') : 'Nothing saved yet' }}</h2>
            <p>{{ !items.length ? 'Add a few foods or places below first.' : items.some(inDeck) ? 'Nothing caught your eye? Shuffle the deck and go again.' : 'Try more prices, or turn off Skip what I had lately.' }}</p>
            <button v-if="items.some(inDeck)" type="button" class="btn" @click="shuffle">Shuffle again</button>
          </div>
        </div>

        <div v-if="current && !chosen && !duel" class="buttons">
          <button type="button" class="btn btn-quiet round" aria-label="Not today" @click="decide('left')">✕</button>
          <button type="button" class="btn round" aria-label="Add to shortlist" @click="decide('right')">♥</button>
        </div>
        <!-- Start the deck full screen; once you're going it's just a way to get more room -->
        <button v-if="!focus && current && !chosen && !duel" type="button" class="btn start-btn" :class="{ 'btn-quiet': liked.length }" @click="setFocus(true)">
          <AppIcon name="maximize" />
          {{ liked.length ? 'Full screen' : 'Start deciding' }}
        </button>

        <!-- Full screen, the shortlist rides along under the deck as chips -->
        <section v-if="focus && shortlist.length" class="shortlist focus-shortlist" aria-label="Your shortlist">
          <span class="shortlist-label">Shortlist</span>
          <TransitionGroup tag="ul" name="chip" class="chips">
            <li v-for="s in shortlist" :key="s.id" class="chip" :class="{ picked: chosen?.id === s.id }">
              <span class="chip-img" :data-kind="s.kind" :style="photoStyle(s)" aria-hidden="true" />
              {{ s.name }}
              <button v-if="!duel" type="button" class="chip-x" :aria-label="`Remove ${s.name} from shortlist`" @click="unlike(s.id)">×</button>
            </li>
          </TransitionGroup>
        </section>
      </ClientOnly>
    </section>
    </Step>

    <!-- Step 2, beside the deck: everything swiped right so far, and how to choose between them -->
    <Step :n="2" title="Pick from your shortlist" hint="Compare them two at a time until one is left, or let the app choose." class="shortlist-step">
      <ClientOnly>
        <section v-if="shortlist.length" class="panel shortlist-panel" aria-label="Your shortlist">
          <TransitionGroup tag="ul" name="chip" class="chips">
            <li v-for="s in shortlist" :key="s.id" class="chip" :class="{ picked: chosen?.id === s.id }">
              <span class="chip-img" :data-kind="s.kind" :style="photoStyle(s)" aria-hidden="true" />
              {{ s.name }}
              <button v-if="!duel" type="button" class="chip-x" :aria-label="`Remove ${s.name} from shortlist`" @click="unlike(s.id)">×</button>
            </li>
          </TransitionGroup>
          <div v-if="!chosen && !duel" class="shortlist-actions">
            <button v-if="shortlist.length > 1" type="button" class="btn narrow-btn" @click="narrow()">
              <AppIcon name="funnel" />
              Narrow it down
            </button>
            <button type="button" class="btn btn-quiet" @click="pickOne">{{ shortlist.length > 1 ? 'Pick at random' : `Eat ${shortlist[0]!.name}` }}</button>
          </div>
        </section>
        <p v-else class="panel step-empty">Swipe right on a few and they gather here.</p>
        <template #fallback><p class="panel step-empty">Swipe right on a few and they gather here.</p></template>
      </ClientOnly>
    </Step>
    </div>

    <!-- Step 3: the library the deck deals from -->
    <Step :n="3" title="Your foods and places" hint="Everything the deck deals from. Give each a photo and a price." class="manage">
      <template #aside>
        <ClientOnly><span class="manage-tools"><BulkToggle v-if="items.length" :select="sel" /><DataSource :sync="sync" /></span></ClientOnly>
      </template>
      <div class="library-bar">
        <input v-model="libQuery" class="input lib-search" type="search" placeholder="Search your foods and places" aria-label="Search your foods and places">
        <div class="segmented lib-kind" role="radiogroup" aria-label="Show in the list">
          <label v-for="f in FILTERS" :key="f.value" :class="{ active: libKind === f.value }">
            <input v-model="libKind" type="radio" name="lib-kind" :value="f.value">{{ f.label }}
          </label>
        </div>
        <button type="button" class="btn add-btn" @click="openAdd">+ Add</button>
        <label v-if="canBulkPhotos" class="btn btn-quiet add-btn add-photos" :aria-disabled="bulkAdding || undefined">
          <input type="file" accept="image/*" multiple :disabled="bulkAdding" aria-label="Add foods from photos" @change="addPhotos">
          {{ bulkAdding ? 'Adding…' : '+ Photos' }}
        </label>
        <button v-if="canBulkPhotos && items.length" type="button" class="btn btn-quiet add-btn" :disabled="publishing || sync.state.value === 'demo'" title="Make this the list everyone sees before signing in" @click="publish">{{ publishing ? 'Publishing…' : 'Publish' }}</button>
      </div>
      <ClientOnly>
        <TransitionGroup v-if="library.length" tag="ul" name="list" class="thumbs">
          <li v-for="s in library" :key="s.id" :data-item-id="s.id" class="thumb bulk-row" :data-bulk="sel.selecting || undefined" @click.capture="sel.onRowClick($event, s.id)" :class="{ editing: editingId === s.id, 'bulk-picked': sel.has(s.id) }" :data-kind="s.kind">
            <BulkCheck v-if="sel.selecting" :checked="sel.has(s.id)" :label="`Select ${s.name}`" @pick="sel.pick(s.id, $event)" />
            <!-- Click a thumbnail to add or replace its photo -->
            <label class="thumb-img" :style="photoStyle(s)" :title="s.image ? 'Replace photo' : 'Add a photo'">
              <input type="file" accept="image/*" :aria-label="s.image ? `Replace photo of ${s.name}` : `Add a photo of ${s.name}`" @change="setPhoto(s, $event)">
              <!-- No photo yet: what it is, a bowl for a food, a pin for a place -->
              <AppIcon v-if="!s.image" class="thumb-icon" :name="s.kind === 'food' ? 'soup' : 'map-pin'" />
              <span class="thumb-hint" aria-hidden="true">{{ s.image ? 'Replace photo' : '+ Photo' }}</span>
            </label>
            <span class="thumb-name">{{ s.name }}</span>
            <span v-if="s.nameKm" class="thumb-name-km" lang="km">{{ s.nameKm }}</span>
            <span class="thumb-meta">{{ priceText(s.price) }}<template v-if="lastHad(s)"> · {{ lastHad(s) }}</template></span>
            <span class="thumb-links">
              <button type="button" class="link" :aria-label="`Edit ${s.name}`" @click="edit(s)">Edit</button>
              <ConfirmDelete text :name="s.name" @confirm="del(s)" />
            </span>
          </li>
        </TransitionGroup>
        <p v-else-if="items.length" class="panel step-empty">Nothing matches{{ libQuery ? ` “${libQuery}”` : '' }}. <button type="button" class="link" @click="libQuery = ''; libKind = 'all'">Show everything</button></p>
        <p v-else class="panel step-empty">Add a few foods or places and they’ll show here, and in the deck.</p>
        <!-- Everyone else's shared foods: in the deck too; the site owner can take any of them down -->
        <template v-if="others.length">
          <h3 class="others-head">Shared by others <span class="optional">{{ others.length }}</span></h3>
          <ul class="thumbs">
            <li v-for="s in others" :key="s.id" class="thumb" :data-kind="s.kind">
              <span class="thumb-img" :style="photoStyle(s)" aria-hidden="true" />
              <span class="thumb-name">{{ s.name }}</span>
              <span v-if="s.nameKm" class="thumb-name-km" lang="km">{{ s.nameKm }}</span>
              <span class="thumb-meta">{{ priceText(s.price) }}</span>
              <span v-if="isSiteOwner" class="thumb-links">
                <button type="button" class="link" :aria-label="`Remove ${s.name} for everyone`" @click="takeDown(s)">Remove</button>
              </span>
            </li>
          </ul>
        </template>
      </ClientOnly>
    </Step>

    <Modal :open="addOpen" title="Add a food or place" @close="closeAdd">
      <form v-validate class="form edit-form" @submit.prevent="save">
          <DraftCard v-if="draft.offered.value" :lines="draft.lines.value" @resume="draft.resume()" @discard="draft.discard()" />
        <div class="segmented" role="radiogroup" aria-label="Type">
          <label :class="{ active: form.kind === 'food' }"><input v-model="form.kind" type="radio" value="food">A food</label>
          <label :class="{ active: form.kind === 'place' }"><input v-model="form.kind" type="radio" value="place">A place</label>
        </div>
        <div class="form-row">
          <label v-ants class="photo-pick" :class="{ filled: photo || (photoLink(form.imageUrl) && !addLinkBroken) }">
            <input type="file" accept="image/*" aria-label="Add a photo" @change="onPhotoPick">
            <img v-if="photo" :src="photo.preview" alt="Photo preview">
            <img v-else-if="photoLink(form.imageUrl) && !addLinkBroken" :src="photoLink(form.imageUrl)" alt="Photo from the link" referrerpolicy="no-referrer" @error="addLinkBroken = true">
            <span v-else>+ Photo</span>
          </label>
          <div class="form-fields">
            <label class="field">
              <span class="field-head">Name</span>
              <input ref="nameField" v-model="form.name" class="input" :placeholder="naming ? 'Naming the photo…' : form.kind === 'food' ? 'Fried rice' : 'The noodle shop on Street 51'" required :data-error="form.kind === 'food' ? 'Name the food' : 'Name the place'">
            </label>
            <label class="field">
              <span class="field-head">Khmer name <span class="optional">Optional</span></span>
              <input v-model="form.nameKm" class="input" lang="km" placeholder="អាម៉ុកត្រី">
            </label>
            <label class="field">
              <span class="field-head">Note <span class="optional">Optional</span></span>
              <input v-model="form.note" class="input" placeholder="Extra spicy, good for lunch…">
            </label>
          </div>
        </div>
        <button v-if="photo" type="button" class="link remove-photo" @click="clearPhoto">Remove photo</button>
        <label class="field">
          <span class="field-head">Photo link <span class="optional">Optional</span></span>
          <input v-model="form.imageUrl" class="input" type="url" inputmode="url" spellcheck="false" placeholder="https://… paste an image address">
          <small v-if="form.imageUrl.trim() && !photoLink(form.imageUrl)" class="hint warn">Use a link that starts with https://</small>
          <small v-else-if="addLinkBroken" class="hint warn">Couldn’t load a picture from that link. Use a direct link to an image (right-click it, then Copy image address).</small>
          <small v-else-if="photo && photoLink(form.imageUrl)" class="hint">The photo you picked is used instead of the link.</small>
        </label>
        <div class="field">
          <span class="field-head">Price</span>
          <div class="segmented" role="radiogroup" aria-label="Price">
            <label v-for="p in ([1, 2, 3] as const)" :key="p" :class="{ active: form.price === p }">
              <input v-model="form.price" type="radio" :value="p">{{ priceText(p) }}
            </label>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn" :disabled="saving">{{ saving && !editingId ? 'Saving photo…' : 'Add' }}</button>
          <button type="button" class="btn btn-quiet" @click="closeAdd">Cancel</button>
        </div>
        <p class="hint">A photo link works anywhere and syncs with the item. Signed in, foods with a photo are shared, so everyone sees them in their deck.</p>
      </form>
    </Modal>
    <Modal :open="!!editingId" :title="editingSpot ? `Edit ${editingSpot.name}` : 'Edit'" @close="cancelEdit">
      <form v-validate class="form edit-form" @submit.prevent="saveEdit">
        <div class="segmented" role="radiogroup" aria-label="Type">
          <label :class="{ active: editForm.kind === 'food' }"><input v-model="editForm.kind" type="radio" value="food">A food</label>
          <label :class="{ active: editForm.kind === 'place' }"><input v-model="editForm.kind" type="radio" value="place">A place</label>
        </div>
        <div class="form-row">
          <label v-ants class="photo-pick" :class="{ filled: editPhoto || editPreview }">
            <input type="file" accept="image/*" aria-label="Choose a new photo" @change="onEditPhotoPick">
            <img v-if="editPhoto" :src="editPhoto.preview" alt="New photo preview" :style="{ objectPosition: focusText(editForm.focus) }">
            <img v-else-if="editPreview" :src="editPreview" alt="Photo" referrerpolicy="no-referrer" :style="{ objectPosition: focusText(editForm.focus) }" @error="editLinkBroken = true">
            <span v-else>+ Photo</span>
          </label>
          <div class="form-fields">
            <label class="field">
              <span class="field-head">Name</span>
              <input v-model="editForm.name" class="input" required data-error="Give it a name">
            </label>
            <label class="field">
              <span class="field-head">Khmer name <span class="optional">Optional</span></span>
              <input v-model="editForm.nameKm" class="input" lang="km" placeholder="អាម៉ុកត្រី">
            </label>
            <label class="field">
              <span class="field-head">Note <span class="optional">Optional</span></span>
              <input v-model="editForm.note" class="input" placeholder="Extra spicy, good for lunch…">
            </label>
          </div>
        </div>
        <button v-if="editPhoto" type="button" class="link remove-photo" @click="clearEditPhoto">Keep the old photo</button>
        <button v-else-if="editPreview" type="button" class="link remove-photo" @click="editForm.imageUrl = ''; editForm.removeImage = true">Remove photo</button>
        <div v-if="framePhoto" class="field">
          <span class="field-head">Position <span class="optional">Click the part of the photo to keep in view</span></span>
          <div class="frame-row">
            <div
              class="focus-pick"
              role="slider"
              tabindex="0"
              aria-label="Photo position. Use the arrow keys to move the dot"
              :aria-valuetext="`${Math.round(editForm.focus.x)}% across, ${Math.round(editForm.focus.y)}% down`"
              @pointerdown="onDotDown"
              @pointermove="onDotMove"
              @pointerup="onDotUp"
              @pointercancel="onDotUp"
              @keydown="onDotKey"
            >
              <img :src="framePhoto" alt="" draggable="false" referrerpolicy="no-referrer">
              <span class="focus-dot" :style="{ left: `${editForm.focus.x}%`, top: `${editForm.focus.y}%` }" aria-hidden="true" />
            </div>
            <div class="frame-side">
              <!-- What the cards will show -->
              <div class="photo-frame" :style="frameStyle || undefined" aria-hidden="true" />
              <button v-if="editForm.focus.x !== 50 || editForm.focus.y !== 50" type="button" class="link" @click="editForm.focus = { x: 50, y: 50 }">Centre it</button>
            </div>
          </div>
        </div>
        <label class="field">
          <span class="field-head">Photo link <span class="optional">Optional</span></span>
          <input v-model="editForm.imageUrl" class="input" type="url" inputmode="url" spellcheck="false" placeholder="https://… paste an image address" @input="editForm.removeImage = false">
          <small v-if="editForm.imageUrl.trim() && !photoLink(editForm.imageUrl)" class="hint warn">Use a link that starts with https://</small>
          <small v-else-if="editLinkBroken && photoLink(editForm.imageUrl)" class="hint warn">Couldn’t load a picture from that link. Use a direct link to an image (right-click it, then Copy image address).</small>
        </label>
        <div class="field">
          <span class="field-head">Price</span>
          <div class="segmented" role="radiogroup" aria-label="Price">
            <label v-for="p in ([1, 2, 3] as const)" :key="p" :class="{ active: editForm.price === p }">
              <input v-model="editForm.price" type="radio" :value="p">{{ priceText(p) }}
            </label>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn" :disabled="saving">{{ saving ? 'Saving photo…' : 'Save changes' }}</button>
          <button type="button" class="btn btn-quiet" @click="cancelEdit">Cancel</button>
        </div>
      </form>
    </Modal>
    <BulkBar :select="sel" :actions="bulkActions" label="Selected places" noun="places" />
  </ToolPage>
</template>

<style scoped>
.deck-step {
  min-width: 0;
}

.stage-area {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stage-top {
  max-width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem 0.75rem;
}

.how {
  margin: 0.6rem 0 1.5rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.manage {
  margin-top: 3.5rem;
}

/* ---------- Deciding: the deck and the shortlist side by side on wide screens ---------- */
.decide {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
}

@media (min-width: 1100px) {
  .decide {
    grid-template-columns: minmax(0, 1.3fr) minmax(300px, 1fr);
    gap: 2.5rem;
  }
}

/* Room between the filters and the deck (full screen, the "how to" line gives it) */
.stage-area:not(.focus) .stage-top {
  margin-bottom: 1.5rem;
}

/* Before you swipe: prices and Skip what I had lately, under Everything / Foods / Places */
.deck-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem 1rem;
  flex-basis: 100%;
}

.prices {
  display: inline-flex;
  gap: 0.3rem;
}

.price-toggle {
  min-width: 3rem;
  height: 2.2rem;
  padding: 0 0.7rem;
  font: inherit;
  font-weight: 700;
  color: var(--ink-3);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: color var(--dur-fast, 0.15s), border-color var(--dur-fast, 0.15s), background-color var(--dur-fast, 0.15s);
}

.price-toggle[aria-pressed='true'] {
  color: var(--accent-btn, var(--accent));
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
}

.skip-recent {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--text-base);
  color: var(--ink-2);
  cursor: pointer;
}

.skip-recent input {
  width: 1.05rem;
  height: 1.05rem;
  accent-color: var(--accent);
}

/* Start deciding: the deck full screen. Primary until you've started, then just a way to get more room */
.start-btn {
  margin-top: 1rem;
  gap: 0.45rem;
}

.start-btn svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.card-had {
  font-weight: 600;
  opacity: 0.85;
}

/* ---------- The result: one big card with what to do next ---------- */
.result {
  position: absolute;
  inset: 0;
  padding: 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  text-align: center;
  color: #fff;
  border-radius: var(--radius-2xl);
  background:
    linear-gradient(to top, rgb(0 0 0 / 0.7), rgb(0 0 0 / 0.1) 60%, transparent),
    var(--photo, none) var(--photo-pos, center) / cover,
    var(--pink);
  box-shadow: 0 0 0 4px var(--plastic), 0 0 0 9px var(--accent), 0 18px 40px -16px rgb(var(--shadow) / 0.5);
  animation: result-in 0.45s cubic-bezier(0.3, 1.4, 0.6, 1);
}

.result[data-kind='place'] {
  background:
    linear-gradient(to top, rgb(0 0 0 / 0.7), rgb(0 0 0 / 0.1) 60%, transparent),
    var(--photo, none) var(--photo-pos, center) / cover,
    var(--indigo);
}

.result-label {
  font-size: var(--text-base);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.85;
}

.result h2 {
  margin-top: 0.2rem;
  font-size: clamp(2.1rem, 6vw, 2.8rem);
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.result p {
  margin: 0.4rem 0 0;
  opacity: 0.9;
}

.result-meta {
  margin-top: 0.5rem;
  font-size: var(--text-sm);
  font-weight: 600;
  opacity: 0.85;
}

.result-actions {
  margin-top: 1.25rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

/* On the photo, the quiet buttons turn to frosted glass and Let's eat is white */
.result .btn-quiet {
  color: #fff;
  background: rgb(255 255 255 / 0.16);
  border-color: rgb(255 255 255 / 0.35);
  box-shadow: none;
  backdrop-filter: blur(6px);
}

.result-go {
  min-width: 9rem;
  /* Fixed colours, not the theme's: it always sits on the card's dark overlay, so it stays dark text on
     white in dark mode too, and hovering only greys it a little instead of turning it pink */
  color: #1b1f2a;
  background: #fff;
}

.result-go:hover:not(:disabled) {
  color: #1b1f2a;
  background: #e9ebf0;
}

@keyframes result-in {
  from { scale: 0.92; opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .result { animation: none; }
}

/* ---------- Step 2: the shortlist panel ---------- */
.shortlist-panel {
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.shortlist-panel .chips {
  justify-content: flex-start;
}

.shortlist-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* ---------- Step 3: the library ---------- */
.manage-tools {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.library-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1.1rem;
}

.lib-search {
  flex: 1 1 14rem;
  min-width: 0;
}

.lib-kind {
  width: auto;
}

.add-btn {
  flex: none;
}

.focus-pick {
  position: relative;
  flex: 0 1 auto;
  min-width: 0;
  width: fit-content; /* hugs the photo, so a click's place in the box is its place on the photo */
  cursor: crosshair;
  touch-action: none;
  border-radius: var(--radius-lg);
}

.focus-pick img {
  display: block;
  max-width: 100%;
  max-height: 16rem;
  border-radius: var(--radius-lg);
  user-select: none;
  pointer-events: none;
}

.focus-pick:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 2px;
}

/* The chosen spot: a white ring that reads on light and dark photos */
.focus-dot {
  position: absolute;
  width: 1.1rem;
  height: 1.1rem;
  translate: -50% -50%;
  background: var(--accent);
  border: 3px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.35), 0 2px 6px rgb(0 0 0 / 0.35);
  pointer-events: none;
}

.frame-side {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.photo-frame {
  width: 6rem;
  aspect-ratio: 1; /* the same square as the cards */
  background: var(--surface-2) center / cover no-repeat;
  border-radius: var(--radius-sm);
  outline: 1px solid rgb(0 0 0 / 0.1);
  outline-offset: -1px;
}

.frame-row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.name-km {
  font-family: 'Noto Sans Khmer', var(--font);
  font-size: 1.05em;
  font-weight: 600;
  line-height: 1.5;
  opacity: 0.95;
}

.thumb-name-km {
  margin-top: -0.3rem;
  font-family: 'Noto Sans Khmer', var(--font);
  font-size: var(--text-xs);
  color: var(--ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.others-head {
  margin: 1.6rem 0 0.8rem;
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--ink-2);
}

.add-photos {
  position: relative;
  cursor: pointer;
}

.add-photos input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.add-photos:has(input:focus-visible) {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 2px;
}

.thumb-icon {
  width: 42%;
  height: 42%;
  fill: none;
  stroke: rgb(255 255 255 / 0.95);
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.thumb-meta {
  margin-top: -0.2rem;
  font-size: var(--text-xs);
  color: var(--ink-3);
}


.shortlist-step {
  min-width: 0;
}

.step-empty {
  margin: 0;
  padding: 1rem 1.25rem;
  font-size: var(--text-base);
  color: var(--ink-2);
}



.form {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.form h3 {
  font-size: var(--text-md);
}

.form-row {
  display: flex;
  gap: 0.9rem;
}

.form-fields {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Square photo picker, the same shape the card will be */
.photo-pick {
  position: relative;
  flex: none;
  width: 7.5rem;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface-2);
  border: 2px dashed var(--line);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: border-color var(--dur-fast);
}

@media (hover: hover) {
  .photo-pick:hover {
    border-color: var(--accent);
  }
}

.photo-pick.filled {
  /* Clips the photo to the corners; empty, the walking dashes sit on the border, outside the clip */
  overflow: hidden;
  border-style: solid;
}

.photo-pick:has(input:focus-visible) {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 2px;
}

.photo-pick input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.photo-pick img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  outline: 1px solid rgb(0 0 0 / 0.1);
  outline-offset: -1px;
}

.remove-photo {
  align-self: flex-start;
  margin-top: -0.4rem;
}

.hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--ink-3);
}

.hint.warn {
  color: var(--bad-ink);
  font-weight: 600;
}

.hint code {
  font-size: 0.9em;
}

.thumbs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7.25rem, 1fr));
  gap: 1rem 0.85rem;
}

.thumb {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.thumb-img {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  font-size: var(--text-2xl);
  font-weight: 800;
  color: #fff;
  background: var(--photo, none) var(--photo-pos, center) / cover, var(--pink);
  border-radius: var(--radius-lg);
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.08);
}

.thumb-img {
  position: relative;
  overflow: hidden;
  cursor: pointer;
}

.thumb-img input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.thumb-img:has(input:focus-visible) {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 2px;
}

/* Hint slides up on hover */
.thumb-hint {
  position: absolute;
  inset: auto 0 0;
  padding: 0.35rem;
  font-size: var(--text-xs);
  font-weight: 700;
  text-align: center;
  color: #fff;
  background: rgb(0 0 0 / 0.55);
  opacity: 0;
  transform: translateY(4px);
  transition: opacity var(--dur-fast), transform var(--dur-fast) cubic-bezier(0.2, 0, 0, 1);
}

.thumb-img:hover .thumb-hint,
.thumb-img:has(input:focus-visible) .thumb-hint {
  opacity: 1;
  transform: none;
}

.thumb[data-kind='place'] .thumb-img {
  background: var(--photo, none) var(--photo-pos, center) / cover, var(--indigo);
}

.thumb-links {
  display: flex;
  gap: 0.6rem;
}

.thumb.editing .thumb-img {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

/* Inside the popup the dialog is already the panel */
.edit-form {
  padding: 0;
  background: none;
  border: 0;
  box-shadow: none;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
}

.form-actions .btn:first-child {
  flex: 1;
}

.thumb-name {
  font-size: var(--text-sm);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thumb .link {
  align-self: flex-start;
}

.optional {
  font-weight: 400;
  color: var(--ink-3);
}


.filter {
  width: 340px;
  max-width: 100%;
  min-width: 0;
}

.stage {
  position: relative;
  width: min(400px, 100%);
  aspect-ratio: 1; /* square cards */
  border-radius: var(--radius-2xl);
}

/* ---------- Focus mode ---------- */
.focus-btn {
  gap: 0.35rem;
}

.focus-btn svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Over everything, including the menu and back buttons; !important beats the sticky column's inline top */
.stage-area.focus {
  position: fixed;
  inset: 0 !important;
  z-index: 300;
  /* Room at the top for the count and Done button */
  padding: calc(max(1rem, env(safe-area-inset-top)) + 3rem) 1rem max(1.25rem, env(safe-area-inset-bottom));
  justify-content: center;
  overflow-y: auto;
  overscroll-behavior: contain;
  background:
    radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--accent) 16%, var(--bg)), var(--bg) 70%);
  animation: focus-in 0.25s cubic-bezier(0.2, 0, 0, 1);
}

/* The card grows to fill the screen, but leaves room for the buttons and shortlist */
.stage-area.focus .stage {
  width: min(560px, 92vw, calc(100dvh - 17rem));
}

.stage-area.focus .stage-top {
  margin-top: 0.5rem;
}

.stage-area.focus .how {
  margin-bottom: 1rem;
}

.focus-bar {
  position: absolute;
  top: max(1rem, env(safe-area-inset-top));
  left: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.focus-count {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

@keyframes focus-in {
  from { opacity: 0; scale: 0.98; }
}

@media (prefers-reduced-motion: reduce) {
  .stage-area.focus { animation: none; }
}

.stage:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 6px;
}

.card {
  position: absolute;
  inset: 0;
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.4rem;
  color: #fff;
  background:
    radial-gradient(circle at 80% 15%, rgb(255 255 255 / 0.22), transparent 45%),
    var(--accent);
  border-radius: var(--radius-2xl);
  box-shadow: 0 0 0 4px var(--plastic), 0 18px 40px -16px rgb(var(--shadow) / 0.5);
  cursor: grab;
  touch-action: pan-y; /* let the page scroll vertically; we handle horizontal drags */
  user-select: none;
}

.card.has-photo[data-kind],
.card.behind[style*='--photo'] {
  background:
    linear-gradient(to bottom, rgb(0 0 0 / 0) 35%, rgb(0 0 0 / 0.72)),
    var(--photo) var(--photo-pos, center) / cover;
}

.card[data-kind='place'] {
  background:
    radial-gradient(circle at 80% 15%, rgb(255 255 255 / 0.22), transparent 45%),
    var(--indigo);
}

.card.behind.deep {
  transform: scale(0.88) translateY(28px);
  opacity: 0.35;
}

.card:active {
  cursor: grabbing;
}

.card.behind {
  transform: scale(0.94) translateY(14px);
  opacity: 0.6;
  pointer-events: none;
}

.card .card-title {
  font-size: clamp(1.8rem, 5vw, 2.4rem);
  letter-spacing: -0.03em;
  line-height: 1.05;
}

.card p {
  margin: 0;
  opacity: 0.9;
}

.badge {
  align-self: flex-start;
  padding: 0.2rem 0.6rem;
  font-size: var(--text-xs);
  font-weight: 700;
  color: #fff;
  background: rgb(255 255 255 / 0.2);
  border-radius: var(--radius-pill);
}

/* On a photo the see-through tag disappears into bright food, so it gets a dark frosted chip */
.has-photo .badge {
  color: #fff;
  background: rgb(0 0 0 / 0.55);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.22);
  backdrop-filter: blur(8px) saturate(1.4);
  -webkit-backdrop-filter: blur(8px) saturate(1.4);
}

:root[data-effects='lite'] .has-photo .badge {
  background: rgb(0 0 0 / 0.7);
}

.price {
  font-weight: 700;
  opacity: 0.85;
  letter-spacing: 0.08em;
}

.verdict {
  position: absolute;
  top: 1.5rem;
  padding: 0.3rem 0.8rem;
  font-weight: 800;
  font-size: var(--text-title);
  border: 3px solid currentColor;
  border-radius: var(--radius-sm);
  background: rgb(255 255 255 / 0.95);
  pointer-events: none;
}

.shortlist {
  width: min(640px, 100%);
  margin-top: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
}

/* Its own centred row under the shortlist, a full-size button */
.narrow-btn {
  flex-basis: 100%;
  max-width: 18rem;
  min-height: 3rem;
  margin-top: 0.4rem;
  gap: 0.5rem;
  font-size: var(--text-title);
  border-radius: var(--radius-lg);
}

.narrow-btn svg {
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linejoin: round;
}

.shortlist-label {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--ink-2);
}

.chips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.4rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.2rem 0.2rem 0.25rem;
  font-size: var(--text-sm);
  font-weight: 600;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
}

.chip.picked {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.chip-img {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  background: var(--photo, none) var(--photo-pos, center) / cover, var(--pink);
}

.chip-img[data-kind='place'] {
  background: var(--photo, none) var(--photo-pos, center) / cover, var(--indigo);
}

.chip-x {
  width: 1.6rem;
  height: 1.6rem;
  display: grid;
  place-items: center;
  padding: 0;
  font-size: var(--text-title);
  line-height: 1;
  color: var(--ink-3);
  background: none;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}

@media (hover: hover) {
  .chip-x:hover {
    color: var(--ink);
    background: var(--surface-2);
  }
}

/* A new chip pops in; removed ones fade */
.chip-enter-active {
  transition: opacity var(--dur), transform var(--dur) cubic-bezier(0.2, 0, 0, 1);
}

.chip-leave-active {
  transition: opacity var(--dur-fast);
}

.chip-enter-from {
  opacity: 0;
  transform: scale(0.6);
}

.chip-leave-to {
  opacity: 0;
}

.verdict.yes {
  left: 1.5rem;
  color: var(--green);
  transform: rotate(-8deg);
}

.verdict.no {
  right: 1.5rem;
  color: var(--red);
  transform: rotate(8deg);
}

.chosen,
.out {
  position: absolute;
  inset: 0;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  border-radius: var(--radius-2xl);
}

.chosen {
  border: 3px solid var(--accent);
}

.chosen-photo {
  width: 7rem;
  height: 7rem;
  margin-bottom: 0.75rem;
  object-fit: cover;
  border-radius: var(--radius-lg);
  outline: 1px solid rgb(0 0 0 / 0.1);
  outline-offset: -1px;
}

.chosen .label {
  font-weight: 600;
  color: var(--ink-2);
}

.chosen h2 {
  margin-top: 0.25rem;
  font-size: clamp(2rem, 5vw, 2.6rem);
  letter-spacing: -0.03em;
}

.chosen p,
.out p {
  margin: 0.5rem 0 0;
  color: var(--ink-2);
}

.chosen-actions {
  margin-top: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

/* ---------- Narrow it down: two cards, tap the keeper ---------- */
.duel {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.duel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.duel-head strong {
  font-size: var(--text-title);
}

.duel-head span {
  font-size: var(--text-sm);
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.duel-cards {
  position: relative;
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  min-height: 0;
}

.duel-card {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-start;
  gap: 0.3rem;
  text-align: left;
  font: inherit;
  color: #fff;
  background:
    radial-gradient(circle at 80% 15%, rgb(255 255 255 / 0.22), transparent 45%),
    var(--accent);
  border: 0;
  border-radius: var(--radius-xl);
  box-shadow: 0 0 0 3px var(--plastic), 0 14px 30px -16px rgb(var(--shadow) / 0.5);
  cursor: pointer;
  transition: translate var(--dur-fast), box-shadow var(--dur-fast), scale var(--dur-fast);
}

.duel-card[data-kind='place'] {
  background:
    radial-gradient(circle at 80% 15%, rgb(255 255 255 / 0.22), transparent 45%),
    var(--indigo);
}

.duel-card.has-photo {
  background:
    linear-gradient(to bottom, rgb(0 0 0 / 0) 30%, rgb(0 0 0 / 0.75)),
    var(--photo) var(--photo-pos, center) / cover;
}

/* Only with a mouse: on a phone the tapped card kept its hover ring into the next round,
   so the card you'd just picked looked selected */
@media (hover: hover) {
  .duel-card:hover {
    translate: 0 -3px;
    box-shadow: 0 0 0 3px var(--plastic), 0 0 0 7px var(--green), 0 18px 34px -16px rgb(var(--shadow) / 0.55);
  }
}

.duel-card:active {
  scale: 0.97;
}

.duel-card:focus-visible {
  outline: 3px solid var(--green);
  outline-offset: 4px;
}

.duel-card strong {
  font-size: clamp(1.15rem, 3.5vw, 1.45rem);
  line-height: 1.1;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}

.duel-note {
  font-size: var(--text-sm);
  opacity: 0.9;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* "or" sits on the seam between the two cards */
.vs {
  position: absolute;
  left: 50%;
  top: 50%;
  translate: -50% -50%;
  width: 2.4rem;
  height: 2.4rem;
  display: grid;
  place-items: center;
  font-size: var(--text-sm);
  font-weight: 800;
  color: var(--ink);
  background: var(--surface);
  border-radius: 50%;
  box-shadow: 0 0 0 4px var(--bg), 0 4px 10px rgb(var(--shadow) / 0.2);
  pointer-events: none;
}

.duel-progress {
  height: 4px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
}

.duel-progress span {
  display: block;
  height: 100%;
  background: var(--green);
  border-radius: inherit;
  transition: width var(--dur-slow) cubic-bezier(0.2, 0, 0, 1);
}

.duel-foot {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

@media (prefers-reduced-motion: reduce) {
  .duel-card { transition: none; }
  .duel-card:hover { translate: none; }
}

.out button {
  margin-top: 1.25rem;
}

.buttons {
  margin-top: 1.5rem;
  display: flex;
  justify-content: center;
  gap: 1.25rem;
}

.round {
  width: 3.75rem;
  height: 3.75rem;
  padding: 0;
  font-size: var(--text-xl);
  border-radius: 50%;
}

/* Phones: three smaller thumbnails across instead of two big ones */
@media (max-width: 480px) {
  .thumbs {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem 0.6rem;
  }

  .thumb-links {
    gap: 0.5rem;
    font-size: var(--text-sm);
  }
}

/* A picked tile: the outline follows the photo's rounded corners, with a little room */
.thumb.bulk-picked {
  outline-offset: 4px;
  border-radius: var(--radius-lg);
}
</style>
