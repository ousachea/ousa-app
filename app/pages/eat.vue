<script setup lang="ts">
import { toast } from 'vue-sonner'

type Kind = 'food' | 'place'

interface Spot {
  id: string
  name: string
  kind: Kind
  note: string
  price: 1 | 2 | 3
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
const { items, ready, sync, add, remove, restore } = useCollection<Spot>('eat', SEED)

// ---------- Adding ----------
const form = reactive({ name: '', kind: 'food' as Kind, note: '', price: 1 as Spot['price'] })

function save() {
  if (!form.name.trim()) return
  const spot = add({ name: form.name.trim(), kind: form.kind, note: form.note.trim(), price: form.price })
  deck.value.push(spot.id) // new cards join the end of the current deck
  toast.success(`${spot.name} added`)
  play('success')
  Object.assign(form, { name: '', note: '' })
}

function del(s: Spot) {
  const removed = remove(s.id)
  deck.value = deck.value.filter(id => id !== s.id)
  play('delete')
  toast(`${s.name} deleted`, { action: { label: 'Undo', onClick: () => { if (removed) { restore(removed); deck.value.push(removed.id) } } } })
}

// ---------- Deck ----------
const filter = ref<'all' | Kind>('all')
const deck = ref<string[]>([])
const chosen = ref<Spot>()

function shuffle() {
  const ids = items.value.filter(s => filter.value === 'all' || s.kind === filter.value).map(s => s.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
  }
  deck.value = ids
  chosen.value = undefined
}

watch([ready, filter], ([r]) => {
  if (r) shuffle()
})

const byId = (id?: string) => items.value.find(s => s.id === id)
const current = computed(() => byId(deck.value[0]))
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
  play(dir === 'right' ? 'success' : 'swipe')
  setTimeout(() => {
    if (dir === 'right') {
      chosen.value = spot
      toast.success(`${spot.name} it is`, { description: 'Enjoy your meal!' })
    }
    deck.value = deck.value.slice(1)
    flying.value = undefined
    dx.value = 0
  }, reducedMotion ? 0 : 260)
}

function onKey(e: KeyboardEvent) {
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
</script>

<template>
  <ToolPage>
    <div class="workspace">
      <div class="side">
        <Step :n="1" title="Save foods and places">
        <template #aside><ClientOnly><DataSource :sync="sync" /></ClientOnly></template>
          <form class="panel form" @submit.prevent="save">
            <div class="segmented" role="radiogroup" aria-label="Type">
              <label :class="{ active: form.kind === 'food' }"><input v-model="form.kind" type="radio" value="food">A food</label>
              <label :class="{ active: form.kind === 'place' }"><input v-model="form.kind" type="radio" value="place">A place</label>
            </div>
            <label class="field">
              <span class="field-head">Name</span>
              <input v-model="form.name" class="input" :placeholder="form.kind === 'food' ? 'Fried rice' : 'The noodle shop on Street 51'" required>
            </label>
            <label class="field">
              <span class="field-head">Note <span class="optional">Optional</span></span>
              <input v-model="form.note" class="input" placeholder="Extra spicy, good for lunch…">
            </label>
            <div class="field">
              <span class="field-head">Price</span>
              <div class="segmented" role="radiogroup" aria-label="Price">
                <label v-for="p in ([1, 2, 3] as const)" :key="p" :class="{ active: form.price === p }">
                  <input v-model="form.price" type="radio" :value="p">{{ priceText(p) }}
                </label>
              </div>
            </div>
            <button type="submit" class="btn" :disabled="!form.name.trim()">Save</button>
          </form>

          <ClientOnly>
            <details v-if="items.length" class="saved">
              <summary>Your list ({{ items.length }})</summary>
              <ul>
                <li v-for="s in items" :key="s.id">
                  <span>{{ s.name }} <span class="kind">{{ s.kind === 'food' ? 'food' : 'place' }}</span></span>
                  <button type="button" class="link danger" :aria-label="`Delete ${s.name}`" @click="del(s)">Delete</button>
                </li>
              </ul>
            </details>
          </ClientOnly>
        </Step>
      </div>

      <Step :n="2" title="Swipe until something sounds good" hint="Right for “let’s eat”, left for “not today”. Arrow keys work too." class="deck-step">
        <div class="segmented filter" role="radiogroup" aria-label="Show">
          <label v-for="f in FILTERS" :key="f.value" :class="{ active: filter === f.value }">
            <input v-model="filter" type="radio" name="filter" :value="f.value">{{ f.label }}
          </label>
        </div>

        <ClientOnly>
          <div class="stage" tabindex="0" aria-label="Food cards. Use the left and right arrow keys to decide." @keydown="onKey">
            <div v-if="chosen" class="panel chosen" role="status">
              <span class="label">You’re eating</span>
              <h2>{{ chosen.name }}</h2>
              <p v-if="chosen.note">{{ chosen.note }}</p>
              <div class="chosen-actions">
                <button type="button" class="btn" @click="shuffle">Pick again</button>
                <button v-if="current" type="button" class="btn btn-quiet" @click="chosen = undefined">Keep swiping</button>
              </div>
            </div>

            <template v-else-if="current">
              <div v-if="third" class="card behind deep" :data-kind="third.kind" aria-hidden="true" />
              <div v-if="next" class="card behind" :data-kind="next.kind" aria-hidden="true">
                <span class="badge">{{ next.kind === 'food' ? 'Food' : 'Place' }}</span>
                <h3>{{ next.name }}</h3>
              </div>
              <div
                :key="current.id"
                class="card"
                :data-kind="current.kind"
                :style="cardStyle"
                @pointerdown="onPointerDown"
                @pointermove="onPointerMove"
                @pointerup="onPointerUp"
                @pointercancel="onPointerUp"
              >
                <span class="verdict yes" :style="{ opacity: yes }" aria-hidden="true">Let’s eat</span>
                <span class="verdict no" :style="{ opacity: no }" aria-hidden="true">Not today</span>
                <span class="badge">{{ current.kind === 'food' ? 'Food' : 'Place' }}</span>
                <h3>{{ current.name }}</h3>
                <p v-if="current.note">{{ current.note }}</p>
                <span class="price">{{ priceText(current.price) }}</span>
              </div>
            </template>

            <div v-else-if="ready" class="panel out">
              <h2>{{ items.length ? 'That’s everything' : 'Nothing saved yet' }}</h2>
              <p>{{ items.length ? 'Nothing caught your eye? Shuffle the deck and go again.' : 'Save a few foods or places first.' }}</p>
              <button v-if="items.length" type="button" class="btn" @click="shuffle">Shuffle again</button>
            </div>
          </div>

          <div v-if="current && !chosen" class="buttons">
            <button type="button" class="btn btn-quiet round" aria-label="Not today" @click="decide('left')">✕</button>
            <button type="button" class="btn round" aria-label="Let’s eat" @click="decide('right')">♥</button>
          </div>
        </ClientOnly>
      </Step>
    </div>
  </ToolPage>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: minmax(300px, 0.8fr) minmax(0, 1.2fr);
  gap: 2rem 2.5rem;
  align-items: start;
}

.form {
  padding: 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.optional {
  font-weight: 400;
  color: var(--ink-3);
}

.saved {
  margin-top: 1rem;
  padding: 0.9rem 1.1rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 16px;
}

.saved summary {
  font-weight: 600;
  cursor: pointer;
}

.saved ul {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
}

.saved li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.45rem 0;
  border-top: 1px solid var(--line);
}

.kind {
  font-size: 0.8rem;
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

.link.danger {
  color: var(--bad-ink);
}

.filter {
  max-width: 360px;
  margin: 0 auto 1.25rem;
}

.stage {
  position: relative;
  height: 340px;
  max-width: 380px;
  margin: 0 auto;
  border-radius: 24px;
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
  gap: 0.5rem;
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

@media (max-width: 960px) {
  .workspace { grid-template-columns: 1fr; }
}
</style>
