<script setup lang="ts">
import { toast } from 'vue-sonner'

type Kind = 'food' | 'place'

interface Spot {
  id: string
  name: string
  kind: Kind
  note: string
  price: 1 | 2 | 3
  image?: string // a path inside public/ (e.g. /eat/3f2a….webp), or a link to an image on the web
}

const SEED = (): Spot[] => [
  { name: 'Fish amok', kind: 'food', note: 'Steamed curry in banana leaf', price: 2 },
  { name: 'Bai sach chrouk', kind: 'food', note: 'Grilled pork and rice for breakfast', price: 1 },
  { name: 'Beef lok lak', kind: 'food', note: 'With lime-pepper dip', price: 2 },
  { name: 'Kuy teav', kind: 'food', note: 'Noodle soup', price: 1 },
  { name: 'Num banh chok', kind: 'food', note: 'Rice noodles with green curry', price: 1 },
  { name: 'Lort cha', kind: 'food', note: 'Stir-fried short noodles', price: 1 }
].map(s => ({ ...s, id: crypto.randomUUID() }) as Spot)

const FILTERS: { value: 'all' | Kind, label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'food', label: 'Foods' },
  { value: 'place', label: 'Places' }
]
const SWIPE_THRESHOLD = 110 // px of drag that counts as a decision

const { play } = useSound()
// Demo: a mix of dishes and places to swipe through
const DEMO = (): Omit<Spot, 'id'>[] => [
  { name: 'Fish amok', kind: 'food', note: 'Steamed curry in banana leaf', price: 2 },
  { name: 'Beef lok lak', kind: 'food', note: 'With lime-pepper dip', price: 2 },
  { name: 'Kuy teav', kind: 'food', note: 'Noodle soup for breakfast', price: 1 },
  { name: 'Bai sach chrouk', kind: 'food', note: 'Grilled pork and broken rice', price: 1 },
  { name: 'Nom banh chok', kind: 'food', note: 'Rice noodles with green curry', price: 1 },
  { name: 'Malis', kind: 'place', note: 'Khmer fine dining by the river', price: 3 },
  { name: 'Brown Coffee', kind: 'place', note: 'Iced latte and a quiet corner', price: 2 },
  { name: 'Night market noodle cart', kind: 'place', note: 'Open late, always busy', price: 1 }
]
const { items, ready, sync, add, update, replace, remove, restore } = useCollection<Spot>('eat', SEED, { demo: DEMO })

// ---------- Adding ----------
const form = reactive({ name: '', kind: 'food' as Kind, note: '', price: 1 as Spot['price'], imageUrl: '' })
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
const editForm = reactive({ name: '', kind: 'food' as Kind, note: '', price: 1 as Spot['price'], imageUrl: '', removeImage: false })
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
const PHOTO_SIZE = 800

// Crop to a centred square and shrink to 800×800 WebP in the browser, so files stay small
async function squarePhoto(file: File) {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = PHOTO_SIZE
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE)
  bitmap.close()
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.82))
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
    const blob = await squarePhoto(file)
    if (photo.value) URL.revokeObjectURL(photo.value.preview)
    photo.value = { blob, preview: URL.createObjectURL(blob) }
    play('drop')
  } catch {
    toast.error('Couldn’t read that image')
  }
}

function clearPhoto() {
  if (photo.value) URL.revokeObjectURL(photo.value.preview)
  photo.value = undefined
}

// Saved into public/eat/ by a local-only server route, so the photo lives in the project for git
async function uploadPhoto(blob: Blob) {
  const res = await $fetch<{ path: string }>('/api/eat-image', {
    method: 'POST',
    body: blob,
    headers: { 'Content-Type': blob.type }
  })
  return res.path
}

function edit(s: Spot) {
  editingId.value = s.id
  Object.assign(editForm, { name: s.name, kind: s.kind, note: s.note ?? '', price: s.price, imageUrl: isWebImage(s.image) ? s.image : '', removeImage: false })
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
    const blob = await squarePhoto(file)
    clearEditPhoto()
    editPhoto.value = { blob, preview: URL.createObjectURL(blob) }
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
  const before = update(id, { name: editForm.name.trim(), kind: editForm.kind, note: editForm.note.trim(), price: editForm.price, image })
  toastSaved(before && (() => replace(before)), `${editForm.name.trim()} updated`)
  play('success')
  saving.value = false
  cancelEdit()
}

const nameField = ref<HTMLInputElement>()
const draft = useDraft('eat', form, {
  active: () => true,
  isEmpty: f => !f.name.trim() && !f.note.trim() && !f.imageUrl.trim(),
  summary: f => [f.name, f.note, f.kind === 'place' ? 'A place' : 'A food']
})
onMounted(() => draft.check())
useAddAction(() => focusField(nameField.value))

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
  const spot = add({ name: form.name.trim(), kind: form.kind, note: form.note.trim(), price: form.price, ...(image ? { image } : {}) })
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
  Object.assign(form, { name: '', note: '', imageUrl: '' })
  clearPhoto()
  saving.value = false
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
    const path = await uploadPhoto(await squarePhoto(file))
    update(spot.id, { image: path })
    toast.success(`Photo added to ${spot.name}`, { description: `Saved to public${path}. Commit it to keep it.` })
    play('success')
  } catch (err) {
    const message = (err as { data?: { message?: string } }).data?.message
    toast.error('Photo not saved', { description: message ?? 'Saving it to the project folder failed.' })
    play('error')
  }
}

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
const filter = ref<'all' | Kind>('all')
const deck = ref<string[]>([])
const chosen = ref<Spot>()

// Swiping right adds to this shortlist; the pick is made from it at the end
const liked = ref<string[]>([])

function shuffle() {
  const ids = items.value.filter(s => filter.value === 'all' || s.kind === filter.value).map(s => s.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
  }
  deck.value = ids
  chosen.value = undefined
  duel.value = undefined
}

function startOver() {
  duel.value = undefined
  liked.value = []
  shuffle()
  play('retry')
}

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

function narrow() {
  const ids = [...liked.value]
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
  play('level-up')
  toast.success(`${winner.name} it is`, { description: 'Your favourite, fair and square. Enjoy!' })
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
  play('success')
  toast.success(`${spot.name} it is`, { description: 'Enjoy your meal!' })
}

watch([ready, filter], ([r]) => {
  if (r) shuffle()
})

// Switching the example data on or off swaps every card, so deal a fresh deck from the new list.
// flush 'post' waits until the collection has swapped its items.
const demoActive = useDemoState(useRoute().path).active
watch(demoActive, () => {
  liked.value = []
  editingId.value = undefined
  shuffle()
}, { flush: 'post' })

const byId = (id?: string) => items.value.find(s => s.id === id)
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
onMounted(() => window.addEventListener('keydown', onFocusKey))

// Opening the app goes straight into focus mode, once there's something to swipe.
// With nothing saved yet it stays on the page, where foods and places are added.
let autoFocused = false
watch([ready, () => items.value.length], ([r, count]) => {
  if (!r || autoFocused) return
  autoFocused = true
  if (count) setFocus(true)
}, { immediate: true })
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onFocusKey)
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
const photoStyle = (spot: Spot) => (spot.image ? { '--photo': `url("${spot.image.replace(/["\\\n]/g, encodeURIComponent)}")` } : undefined)
</script>

<template>
  <ToolPage>
    <!-- Centre stage: the deck. Managing the list lives underneath (beside it on wide screens). -->
    <div class="eat-layout">
    <section v-sticky-fit class="stage-area" :class="{ focus }" :role="focus ? 'dialog' : undefined" :aria-modal="focus || undefined" aria-label="Swipe to decide">
      <!-- Focus mode: how many cards are left, and the way out -->
      <div v-if="focus" class="focus-bar">
        <span class="focus-count">{{ deck.length ? `${deck.length} ${deck.length === 1 ? 'card' : 'cards'} left` : 'All done' }}</span>
        <button type="button" class="btn btn-sm focus-done" @click="setFocus(false)">Done</button>
      </div>
      <div class="stage-top">
        <div class="segmented filter" role="radiogroup" aria-label="Show">
          <label v-for="f in FILTERS" :key="f.value" :class="{ active: filter === f.value }">
            <input v-model="filter" type="radio" name="filter" :value="f.value">{{ f.label }}
          </label>
        </div>
        <ClientOnly><DataSource v-if="!focus" :sync="sync" /></ClientOnly>
        <button v-if="!focus" type="button" class="btn btn-quiet btn-sm focus-btn" title="Swipe full screen" @click="setFocus(true)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
          Focus
        </button>
      </div>
      <p class="how">Swipe right to add to your shortlist, left to skip. Arrow keys work too.<template v-if="focus"> Esc to leave.</template></p>

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

          <div v-else-if="chosen" class="panel chosen" role="status">
            <img v-if="chosen.image" :src="chosen.image" alt="" class="chosen-photo">
            <span class="label">You’re eating</span>
            <h2>{{ chosen.name }}</h2>
            <p v-if="chosen.note">{{ chosen.note }}</p>
            <div class="chosen-actions">
              <button v-if="shortlist.length > 1" type="button" class="btn" @click="narrow">Narrow it down</button>
              <button v-if="current" type="button" class="btn btn-quiet" @click="chosen = undefined">Keep swiping</button>
              <button type="button" class="btn btn-quiet" @click="startOver">Start over</button>
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
              <h3>{{ current.name }}</h3>
              <p v-if="current.note">{{ current.note }}</p>
              <span class="price">{{ priceText(current.price) }}</span>
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
            <h2>{{ items.length ? 'That’s everything' : 'Nothing saved yet' }}</h2>
            <p>{{ items.length ? 'Nothing caught your eye? Shuffle the deck and go again.' : 'Add a few foods or places below first.' }}</p>
            <button v-if="items.length" type="button" class="btn" @click="shuffle">Shuffle again</button>
          </div>
        </div>

        <div v-if="current && !chosen && !duel" class="buttons">
          <button type="button" class="btn btn-quiet round" aria-label="Not today" @click="decide('left')">✕</button>
          <button type="button" class="btn round" aria-label="Add to shortlist" @click="decide('right')">♥</button>
        </div>

        <!-- Everything swiped right so far -->
        <section v-if="shortlist.length" class="shortlist" aria-label="Your shortlist">
          <span class="shortlist-label">Shortlist</span>
          <TransitionGroup tag="ul" name="chip" class="chips">
            <li v-for="s in shortlist" :key="s.id" class="chip" :class="{ picked: chosen?.id === s.id }">
              <span class="chip-img" :data-kind="s.kind" :style="photoStyle(s)" aria-hidden="true" />
              {{ s.name }}
              <button v-if="!duel" type="button" class="chip-x" :aria-label="`Remove ${s.name} from shortlist`" @click="unlike(s.id)">×</button>
            </li>
          </TransitionGroup>
          <button v-if="shortlist.length > 1 && !chosen && !duel && current" type="button" class="btn narrow-btn" @click="narrow">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6 7.5V19l-4-2v-4.5z" /></svg>
            Narrow it down
          </button>
        </section>
      </ClientOnly>
    </section>

    <section class="manage" aria-labelledby="manage-title">
      <h2 id="manage-title">Your foods and places</h2>
      <div class="manage-grid">
        <form v-validate class="panel form" @submit.prevent="save">
          <h3>Add one</h3>
          <DraftCard v-if="draft.offered.value" :lines="draft.lines.value" @resume="draft.resume()" @discard="draft.discard()" />
          <div class="segmented" role="radiogroup" aria-label="Type">
            <label :class="{ active: form.kind === 'food' }"><input v-model="form.kind" type="radio" value="food">A food</label>
            <label :class="{ active: form.kind === 'place' }"><input v-model="form.kind" type="radio" value="place">A place</label>
          </div>
          <div class="form-row">
            <label class="photo-pick" :class="{ filled: photo || (photoLink(form.imageUrl) && !addLinkBroken) }">
              <input type="file" accept="image/*" aria-label="Add a photo" @change="onPhotoPick">
              <img v-if="photo" :src="photo.preview" alt="Photo preview">
              <img v-else-if="photoLink(form.imageUrl) && !addLinkBroken" :src="photoLink(form.imageUrl)" alt="Photo from the link" referrerpolicy="no-referrer" @error="addLinkBroken = true">
              <span v-else>+ Photo</span>
            </label>
            <div class="form-fields">
              <label class="field">
                <span class="field-head">Name</span>
                <input ref="nameField" v-model="form.name" class="input" :placeholder="form.kind === 'food' ? 'Fried rice' : 'The noodle shop on Street 51'" required :data-error="form.kind === 'food' ? 'Name the food' : 'Name the place'">
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
          <button type="submit" class="btn" :disabled="saving">{{ saving && !editingId ? 'Saving photo…' : 'Save' }}</button>
          <p class="hint">A photo link works anywhere and syncs with the item. Picked photos are cropped square and saved to <code>public/eat/</code> in this project so you can commit them, which only works while running the app locally.</p>
        </form>

        <ClientOnly>
          <ul v-if="items.length" class="thumbs">
            <li v-for="s in items" :key="s.id" :data-item-id="s.id" class="thumb" :class="{ editing: editingId === s.id }" :data-kind="s.kind">
              <!-- Click a thumbnail to add or replace its photo -->
              <label class="thumb-img" :style="photoStyle(s)" :title="s.image ? 'Replace photo' : 'Add a photo'">
                <input type="file" accept="image/*" :aria-label="s.image ? `Replace photo of ${s.name}` : `Add a photo of ${s.name}`" @change="setPhoto(s, $event)">
                <span v-if="!s.image" aria-hidden="true">{{ s.name.slice(0, 1) }}</span>
                <span class="thumb-hint" aria-hidden="true">{{ s.image ? 'Replace photo' : '+ Photo' }}</span>
              </label>
              <span class="thumb-name">{{ s.name }}</span>
              <span class="thumb-links">
                <button type="button" class="link" :aria-label="`Edit ${s.name}`" @click="edit(s)">Edit</button>
                <ConfirmDelete text :name="s.name" @confirm="del(s)" />
              </span>
            </li>
          </ul>
        </ClientOnly>
      </div>
    </section>
    </div>
    <Modal :open="!!editingId" :title="editingSpot ? `Edit ${editingSpot.name}` : 'Edit'" @close="cancelEdit">
      <form v-validate class="form edit-form" @submit.prevent="saveEdit">
        <div class="segmented" role="radiogroup" aria-label="Type">
          <label :class="{ active: editForm.kind === 'food' }"><input v-model="editForm.kind" type="radio" value="food">A food</label>
          <label :class="{ active: editForm.kind === 'place' }"><input v-model="editForm.kind" type="radio" value="place">A place</label>
        </div>
        <div class="form-row">
          <label class="photo-pick" :class="{ filled: editPhoto || editPreview }">
            <input type="file" accept="image/*" aria-label="Choose a new photo" @change="onEditPhotoPick">
            <img v-if="editPhoto" :src="editPhoto.preview" alt="New photo preview">
            <img v-else-if="editPreview" :src="editPreview" alt="Photo" referrerpolicy="no-referrer" @error="editLinkBroken = true">
            <span v-else>+ Photo</span>
          </label>
          <div class="form-fields">
            <label class="field">
              <span class="field-head">Name</span>
              <input v-model="editForm.name" class="input" required data-error="Give it a name">
            </label>
            <label class="field">
              <span class="field-head">Note <span class="optional">Optional</span></span>
              <input v-model="editForm.note" class="input" placeholder="Extra spicy, good for lunch…">
            </label>
          </div>
        </div>
        <button v-if="editPhoto" type="button" class="link remove-photo" @click="clearEditPhoto">Keep the old photo</button>
        <button v-else-if="editPreview" type="button" class="link remove-photo" @click="editForm.imageUrl = ''; editForm.removeImage = true">Remove photo</button>
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
  </ToolPage>
</template>

<style scoped>
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
  font-size: 0.875rem;
  color: var(--ink-2);
}

.manage {
  max-width: 1080px;
  margin: 4rem auto 0;
}

@media (min-width: 1400px) {
  .eat-layout {
    display: grid;
    grid-template-columns: minmax(380px, 520px) minmax(0, 1fr);
    gap: 3rem;
    align-items: start;
  }

  .stage-area {
    position: sticky;
    top: 5.5rem; /* clear of the menu button */
  }

  .manage {
    max-width: none;
    margin: 0;
  }
}

.manage > h2 {
  margin-bottom: 1rem;
  font-size: 1.25rem;
}

.manage-grid {
  display: grid;
  grid-template-columns: minmax(300px, 420px) minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.form {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.form h3 {
  font-size: 1rem;
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
  overflow: hidden;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface-2);
  border: 2px dashed var(--line);
  border-radius: 14px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.photo-pick:hover {
  border-color: var(--accent);
}

.photo-pick.filled {
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
  font-size: 0.78rem;
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
  grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
  gap: 0.9rem;
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
  font-size: 2rem;
  font-weight: 800;
  color: #fff;
  background: var(--photo, none) center / cover, var(--pink);
  border-radius: 14px;
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
  font-size: 0.75rem;
  font-weight: 700;
  text-align: center;
  color: #fff;
  background: rgb(0 0 0 / 0.55);
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.15s, transform 0.15s cubic-bezier(0.2, 0, 0, 1);
}

.thumb-img:hover .thumb-hint,
.thumb-img:has(input:focus-visible) .thumb-hint {
  opacity: 1;
  transform: none;
}

.thumb[data-kind='place'] .thumb-img {
  background: var(--photo, none) center / cover, var(--indigo);
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
  font-size: 0.875rem;
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

.link {
  padding: 0;
  font: inherit;
  font-size: 0.85rem;
  color: var(--ink-2);
  background: none;
  border: 0;
  text-decoration: underline;
  cursor: pointer;
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
  border-radius: 24px;
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
  font-size: 0.85rem;
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
  border-radius: 24px;
  box-shadow: 0 0 0 4px var(--plastic), 0 18px 40px -16px rgb(var(--shadow) / 0.5);
  cursor: grab;
  touch-action: pan-y; /* let the page scroll vertically; we handle horizontal drags */
  user-select: none;
}

.card.has-photo[data-kind],
.card.behind[style*='--photo'] {
  background:
    linear-gradient(to bottom, rgb(0 0 0 / 0) 35%, rgb(0 0 0 / 0.72)),
    var(--photo) center / cover;
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

.card h3 {
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
  font-size: 0.75rem;
  font-weight: 700;
  background: rgb(255 255 255 / 0.2);
  border-radius: 999px;
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
  font-size: 1.1rem;
  border: 3px solid currentColor;
  border-radius: 10px;
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
  font-size: 1.05rem;
  border-radius: 14px;
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
  font-size: 0.85rem;
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
  font-size: 0.85rem;
  font-weight: 600;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 999px;
}

.chip.picked {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.chip-img {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  background: var(--photo, none) center / cover, var(--pink);
}

.chip-img[data-kind='place'] {
  background: var(--photo, none) center / cover, var(--indigo);
}

.chip-x {
  width: 1.6rem;
  height: 1.6rem;
  display: grid;
  place-items: center;
  padding: 0;
  font-size: 1.05rem;
  line-height: 1;
  color: var(--ink-3);
  background: none;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}

.chip-x:hover {
  color: var(--ink);
  background: var(--surface-2);
}

/* A new chip pops in; removed ones fade */
.chip-enter-active {
  transition: opacity 0.2s, transform 0.25s cubic-bezier(0.2, 0, 0, 1);
}

.chip-leave-active {
  transition: opacity 0.15s;
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
  border-radius: 24px;
}

.chosen {
  border: 3px solid var(--accent);
}

.chosen-photo {
  width: 7rem;
  height: 7rem;
  margin-bottom: 0.75rem;
  object-fit: cover;
  border-radius: 16px;
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
  font-size: 1.1rem;
}

.duel-head span {
  font-size: 0.8rem;
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
  border-radius: 20px;
  box-shadow: 0 0 0 3px var(--plastic), 0 14px 30px -16px rgb(var(--shadow) / 0.5);
  cursor: pointer;
  transition: translate 0.15s, box-shadow 0.15s, scale 0.12s;
}

.duel-card[data-kind='place'] {
  background:
    radial-gradient(circle at 80% 15%, rgb(255 255 255 / 0.22), transparent 45%),
    var(--indigo);
}

.duel-card.has-photo {
  background:
    linear-gradient(to bottom, rgb(0 0 0 / 0) 30%, rgb(0 0 0 / 0.75)),
    var(--photo) center / cover;
}

.duel-card:hover {
  translate: 0 -3px;
  box-shadow: 0 0 0 3px var(--plastic), 0 0 0 7px var(--green), 0 18px 34px -16px rgb(var(--shadow) / 0.55);
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
  font-size: 0.8rem;
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
  font-size: 0.8rem;
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
  border-radius: 999px;
  background: var(--surface-2);
}

.duel-progress span {
  display: block;
  height: 100%;
  background: var(--green);
  border-radius: inherit;
  transition: width 0.3s cubic-bezier(0.2, 0, 0, 1);
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
  font-size: 1.4rem;
  border-radius: 50%;
}

@media (max-width: 860px) {
  .manage-grid { grid-template-columns: minmax(0, 1fr); }
}

/* Phones: three smaller thumbnails across instead of two big ones */
@media (max-width: 520px) {
  .thumbs {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem 0.6rem;
  }

  .thumb-links {
    gap: 0.5rem;
    font-size: 0.8rem;
  }
}
</style>
