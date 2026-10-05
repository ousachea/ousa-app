<script setup lang="ts">
import { toast } from 'vue-sonner'

interface Phrase {
  id: string
  english: string
  khmer: string
  category: string
  favorite: boolean
}

const CATEGORIES = ['Greetings', 'Meetings', 'Email', 'Requests', 'Thanks', 'Apologies', 'Other']

// Starter examples shown once on first visit; they're ordinary entries the user can edit or delete
const SEED = (): Phrase[] => [
  { english: 'Good morning', khmer: 'អរុណសួស្តី', category: 'Greetings' },
  { english: 'Thank you very much', khmer: 'អរគុណច្រើន', category: 'Thanks' },
  { english: 'Please wait a moment', khmer: 'សូមរង់ចាំបន្តិច', category: 'Requests' },
  { english: 'Could you help me, please?', khmer: 'តើអ្នកអាចជួយខ្ញុំបានទេ?', category: 'Requests' },
  { english: 'I’m sorry for the delay', khmer: 'សូមអភ័យទោសចំពោះការយឺតយ៉ាវ', category: 'Apologies' },
  { english: 'See you tomorrow', khmer: 'ជួបគ្នាថ្ងៃស្អែក', category: 'Greetings' }
].map(p => ({ ...p, id: crypto.randomUUID(), favorite: false }))

const { play } = useSound()
const { items, ready, sync, add, update, remove, restore } = useCollection<Phrase>('phrases', SEED)

const blank = () => ({ english: '', khmer: '', category: 'Meetings' })
const form = reactive(blank())
const editingId = ref<string>()
const query = ref('')
const filter = ref<string>('All')

const counts = computed(() => {
  const map: Record<string, number> = { All: items.value.length, Favourites: items.value.filter(p => p.favorite).length }
  for (const p of items.value) map[p.category] = (map[p.category] ?? 0) + 1
  return map
})
const filters = computed(() => ['All', 'Favourites', ...CATEGORIES.filter(c => counts.value[c])])

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  return items.value
    .filter(p => filter.value === 'All' || (filter.value === 'Favourites' ? p.favorite : p.category === filter.value))
    .filter(p => !q || p.english.toLowerCase().includes(q) || p.khmer.includes(query.value.trim()))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.english.localeCompare(b.english))
})

const canSave = computed(() => form.english.trim() && form.khmer.trim())

// ---------- Practice mode: hide one side until the card is tapped ----------
type Practice = 'off' | 'khmer' | 'english'
const PRACTICE: { value: Practice, label: string }[] = [
  { value: 'off', label: 'Show both' },
  { value: 'khmer', label: 'Hide Khmer' },
  { value: 'english', label: 'Hide English' }
]
const practice = ref<Practice>('off')
const revealed = ref(new Set<string>())

watch(practice, () => (revealed.value = new Set()))

const hidden = (p: Phrase, side: 'khmer' | 'english') => practice.value === side && !revealed.value.has(p.id)

function reveal(p: Phrase) {
  if (practice.value === 'off' || revealed.value.has(p.id)) return
  revealed.value = new Set(revealed.value).add(p.id)
  play('open')
}

function save() {
  if (!canSave.value) return
  const record = { english: form.english.trim(), khmer: form.khmer.trim(), category: form.category }
  if (editingId.value) {
    update(editingId.value, record)
    toast.success('Changes saved')
  } else {
    add({ ...record, favorite: false })
    toast.success('Phrase saved')
  }
  play('success')
  cancel()
}

function edit(p: Phrase) {
  editingId.value = p.id
  Object.assign(form, { english: p.english, khmer: p.khmer, category: p.category })
  play('select')
}

function cancel() {
  editingId.value = undefined
  Object.assign(form, blank())
}

function toggleFavorite(p: Phrase) {
  update(p.id, { favorite: !p.favorite })
  play(p.favorite ? 'toggle-off' : 'toggle-on')
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied', { description: text })
    play('copy')
  } catch {
    toast.error('Could not copy')
    play('error')
  }
}

function del(p: Phrase) {
  const removed = remove(p.id)
  if (editingId.value === p.id) cancel()
  play('delete')
  toast('Phrase deleted', { action: { label: 'Undo', onClick: () => removed && restore(removed) } })
}
</script>

<template>
  <ToolPage>
    <div class="workspace">
      <Step :n="1" :title="editingId ? 'Edit phrase' : 'Save a phrase'" class="form-step">
        <form class="panel form" @submit.prevent="save">
          <label class="field">
            <span class="field-head">English</span>
            <textarea v-model="form.english" class="input" rows="2" placeholder="Could you send me the report by Friday?" required />
          </label>
          <label class="field">
            <span class="field-head">Khmer</span>
            <textarea v-model="form.khmer" class="input km" rows="2" lang="km" placeholder="ខ្មែរ" required />
          </label>
          <label class="field">
            <span class="field-head">Category</span>
            <select v-model="form.category" class="input">
              <option v-for="c in CATEGORIES" :key="c">{{ c }}</option>
            </select>
          </label>
          <div class="actions">
            <button type="submit" class="btn" :disabled="!canSave">{{ editingId ? 'Save changes' : 'Save phrase' }}</button>
            <button v-if="editingId" type="button" class="btn btn-quiet" @click="cancel">Cancel</button>
          </div>
        </form>
      </Step>

      <Step :n="2" title="Your phrases" class="list-step">
        <template #aside><ClientOnly><DataSource :sync="sync" /></ClientOnly></template>
        <ClientOnly>
          <template v-if="ready && items.length">
            <input v-model="query" class="input search" type="search" placeholder="Search in English or Khmer" aria-label="Search phrases">
            <div class="chips" role="radiogroup" aria-label="Filter">
              <button
                v-for="f in filters"
                :key="f"
                type="button"
                role="radio"
                class="chip"
                :aria-checked="filter === f"
                @click="filter = f"
              >
                {{ f }} <span class="n">{{ counts[f] ?? 0 }}</span>
              </button>
            </div>

            <div class="practice">
              <span class="practice-label">Practice</span>
              <div class="segmented" role="radiogroup" aria-label="Practice mode">
                <label v-for="m in PRACTICE" :key="m.value" :class="{ active: practice === m.value }">
                  <input v-model="practice" type="radio" name="practice" :value="m.value">{{ m.label }}
                </label>
              </div>
            </div>

            <!-- Index-card flashcards; in practice mode one side stays blurred until the card is tapped -->
            <ul class="phrases">
              <li
                v-for="p in visible"
                :key="p.id"
                class="card"
                :class="{ editing: editingId === p.id, quiz: practice !== 'off' && !revealed.has(p.id) }"
                :tabindex="practice !== 'off' && !revealed.has(p.id) ? 0 : undefined"
                :aria-label="practice !== 'off' && !revealed.has(p.id) ? 'Flashcard. Press Enter to reveal the answer.' : undefined"
                @click="reveal(p)"
                @keydown.enter="reveal(p)"
              >
                <div class="lang">
                  <p class="en" :class="{ veiled: hidden(p, 'english') }">{{ p.english }}</p>
                  <button type="button" class="btn btn-quiet btn-sm" :disabled="hidden(p, 'english')" :aria-label="`Copy English: ${p.english}`" @click.stop="copy(p.english)">Copy</button>
                </div>
                <div class="lang">
                  <p class="km" :class="{ veiled: hidden(p, 'khmer') }" lang="km">{{ p.khmer }}</p>
                  <button type="button" class="btn btn-quiet btn-sm" :disabled="hidden(p, 'khmer')" :aria-label="`Copy Khmer: ${p.khmer}`" @click.stop="copy(p.khmer)">Copy</button>
                </div>
                <p v-if="practice !== 'off' && !revealed.has(p.id)" class="tap" aria-hidden="true">Tap to reveal</p>
                <div class="foot">
                  <span class="cat">{{ p.category }}</span>
                  <button type="button" class="star" :aria-pressed="p.favorite" :aria-label="p.favorite ? 'Remove from favourites' : 'Add to favourites'" @click.stop="toggleFavorite(p)">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" /></svg>
                  </button>
                  <button type="button" class="link" @click.stop="edit(p)">Edit</button>
                  <button type="button" class="link danger" @click.stop="del(p)">Delete</button>
                </div>
              </li>
            </ul>
            <p v-if="!visible.length" class="none">No phrases match. Try another search or filter.</p>
          </template>

          <div v-else-if="ready" class="panel empty">
            <h2>No phrases yet</h2>
            <p>Save phrases you use at work, in English and Khmer, so they’re one click from your clipboard.</p>
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

.form-step {
  position: sticky;
  top: 5.5rem;
}

.form {
  padding: 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Khmer script has tall stacked vowels; give it its own font and more line height */
.km {
  font-family: 'Noto Sans Khmer', var(--font);
  line-height: 1.8;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.actions .btn:first-child {
  flex: 1;
}

.chips {
  margin: 0.75rem 0 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  padding: 0.35rem 0.75rem;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 999px;
  cursor: pointer;
}

.chip[aria-checked='true'] {
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
}

.chip .n {
  margin-left: 0.2rem;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}

.phrases {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 0.6rem;
}

.practice {
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.practice-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-2);
}

.practice .segmented {
  flex: 1;
  max-width: 400px;
}

/* Index card: red margin line under the header, faint blue rules */
.card {
  position: relative;
  padding: 1.1rem 1.15rem 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  background:
    linear-gradient(to bottom, transparent 2.6rem, color-mix(in srgb, var(--red) 55%, transparent) 2.6rem, color-mix(in srgb, var(--red) 55%, transparent) calc(2.6rem + 1px), transparent calc(2.6rem + 1px)),
    repeating-linear-gradient(to bottom, transparent 0 1.85rem, color-mix(in srgb, var(--sky) 14%, transparent) 1.85rem calc(1.85rem + 1px)),
    var(--surface);
  background-position: 0 0, 0 0.85rem, 0 0;
  border-radius: 6px;
  box-shadow: 0 1px 1px rgb(var(--shadow) / 0.1), 0 6px 16px -6px rgb(var(--shadow) / 0.18);
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s;
}

.card.editing {
  box-shadow: 0 0 0 2px var(--accent);
}

.card.quiz {
  cursor: pointer;
}

.card.quiz:hover {
  transform: translateY(-2px) rotate(-0.4deg);
}

.card.quiz:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 3px;
}

/* Hidden side: blurred, then sharpens when revealed */
.veiled {
  filter: blur(6px);
  opacity: 0.55;
  user-select: none;
}

.en,
.km {
  transition: filter 0.3s cubic-bezier(0.2, 0, 0, 1), opacity 0.3s cubic-bezier(0.2, 0, 0, 1);
}

.tap {
  position: absolute;
  right: 1rem;
  bottom: 3.1rem;
  margin: 0;
  padding: 0.15rem 0.55rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  border-radius: 999px;
}

.lang {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.lang p {
  margin: 0;
}

.en {
  font-weight: 600;
}

p.km {
  font-size: 1.35rem;
}

.foot {
  margin-top: auto;
  padding-top: 0.6rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-top: 1px solid var(--line);
}

.cat {
  flex: 1;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-3);
}

.star {
  width: 1.9rem;
  height: 1.9rem;
  display: grid;
  place-items: center;
  padding: 0;
  background: none;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}

.star svg {
  width: 1.2rem;
  height: 1.2rem;
  fill: none;
  stroke: var(--ink-3);
  stroke-width: 2;
  stroke-linejoin: round;
  transition: fill 0.15s, stroke 0.15s, transform 0.2s cubic-bezier(0.3, 1.6, 0.6, 1);
}

.star[aria-pressed='true'] svg {
  fill: var(--yellow);
  stroke: #b8860b;
  transform: scale(1.1);
}

.link {
  padding: 0;
  font: inherit;
  font-size: 0.85rem;
  color: var(--ink-2);
  background: none;
  border: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.link.danger {
  color: var(--bad-ink);
}

.none {
  color: var(--ink-2);
}

.empty {
  padding: 2.5rem 1.5rem;
  text-align: center;
  color: var(--ink-2);
}

.empty h2 {
  font-size: 1.2rem;
  color: var(--ink);
}

.empty p {
  margin: 0.5rem 0 0;
}

@media (prefers-reduced-motion: reduce) {
  .card.quiz:hover { transform: none; }
  .en, .km { transition: none; }
}

@media (max-width: 960px) {
  .workspace { grid-template-columns: 1fr; }
  .form-step { position: static; }
}
</style>
