<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { BudgetCategory, ColorSlot, Kind } from '~/utils/budget/types'
import { COLOR_SLOTS, ICONS } from '~/utils/budget/defaults'

// Categories and subcategories: rename, reorder, pin, recolour, archive. A category that still has
// transactions can't be deleted outright; archive it, or move its transactions somewhere else first.
const store = useBudget()
const { categories, transactions, limits, recurring, subsOf, categoryById } = store
const { play } = useSound()

const showArchived = ref(false)
const kind = ref<Kind>('expense')
const open = ref(new Set<string>())
const toggle = (id: string) => {
  const next = new Set(open.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  open.value = next
}

const tops = computed(() => categories.items.value
  .filter(c => !c.parentId && c.kind === kind.value && (showArchived.value || !c.archived))
  .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)))
const kids = (id: string) => subsOf(id).filter(s => showArchived.value || !s.archived)

// How many transactions use a category (its own and its subcategories')
const usage = computed(() => {
  const m = new Map<string, number>()
  for (const t of transactions.items.value) {
    m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + 1)
    if (t.subcategoryId) m.set(t.subcategoryId, (m.get(t.subcategoryId) ?? 0) + 1)
  }
  return m
})
const used = (id: string) => usage.value.get(id) ?? 0
const archivedCount = computed(() => categories.items.value.filter(c => c.archived && c.kind === kind.value).length)

// ---------- Order ----------
function move(c: BudgetCategory, by: -1 | 1) {
  const list = c.parentId ? subsOf(c.parentId) : categories.items.value.filter(x => !x.parentId && x.kind === c.kind).sort((a, b) => a.order - b.order)
  const i = list.findIndex(x => x.id === c.id)
  const j = i + by
  if (j < 0 || j >= list.length) return
  // Renumber the whole list so equal orders (from older data or imports) can't make a move do nothing
  const next = [...list]
  ;[next[i], next[j]] = [next[j]!, next[i]!]
  next.forEach((x, n) => {
    if (x.order !== n) categories.update(x.id, { order: n }, { quiet: true })
  })
  play('select')
}

function toggleArchive(c: BudgetCategory) {
  const before = categories.update(c.id, { archived: !c.archived })
  play(c.archived ? 'success' : 'toggle-off')
  toast(c.archived ? `${c.name} is back` : `${c.name} archived`, {
    description: c.archived ? undefined : 'Hidden from the add form. Its transactions and reports stay as they are.',
    action: { label: 'Undo', onClick: () => before && categories.replace(before) }
  })
}

function togglePin(c: BudgetCategory) {
  categories.update(c.id, { favorite: !c.favorite }, { quiet: true })
  play(c.favorite ? 'toggle-off' : 'toggle-on')
}

// ---------- Edit ----------
const editOpen = ref(false)
const editing = ref<BudgetCategory>()
const parentForNew = ref<BudgetCategory>()
const form = reactive({ name: '', icon: '🧾', color: 'gray' as ColorSlot, group: '' })

function openEdit(c?: BudgetCategory, parent?: BudgetCategory) {
  editing.value = c
  parentForNew.value = parent
  Object.assign(form, c
    ? { name: c.name, icon: c.icon, color: c.color, group: c.group ?? '' }
    : { name: '', icon: parent?.icon ?? '🧾', color: parent?.color ?? 'c1', group: '' })
  editOpen.value = true
  play('open')
}

const isSub = computed(() => !!(editing.value?.parentId || parentForNew.value))
const groupOptions = computed(() => {
  const pid = editing.value?.parentId ?? parentForNew.value?.id
  return pid ? [...new Set(subsOf(pid).map(s => s.group).filter(Boolean))] as string[] : []
})
const siblings = computed(() => {
  const pid = editing.value?.parentId ?? parentForNew.value?.id ?? null
  return categories.items.value.filter(c => c.parentId === pid && c.kind === (editing.value?.kind ?? parentForNew.value?.kind ?? kind.value) && c.id !== editing.value?.id)
})
const nameTaken = computed(() => siblings.value.some(s => s.name.trim().toLowerCase() === form.name.trim().toLowerCase()))

function saveEdit() {
  const name = form.name.trim()
  if (!name || nameTaken.value) return
  if (editing.value) {
    const patch = { name, icon: form.icon, color: form.color, group: form.group.trim() || undefined }
    const before = categories.update(editing.value.id, patch)
    // A category's colour and icon carry to its subcategories that still match the old ones
    if (!editing.value.parentId) {
      for (const s of subsOf(editing.value.id)) {
        const p: Partial<BudgetCategory> = {}
        if (s.color === editing.value.color && form.color !== s.color) p.color = form.color
        if (s.icon === editing.value.icon && form.icon !== s.icon) p.icon = form.icon
        if (Object.keys(p).length) categories.update(s.id, p, { quiet: true })
      }
    }
    toastSaved(before && (() => categories.replace(before)))
  } else {
    const parent = parentForNew.value
    const created = categories.add({
      kind: parent?.kind ?? kind.value, name, parentId: parent?.id ?? null, group: form.group.trim() || undefined,
      icon: form.icon, color: form.color, order: siblings.value.length
    })
    if (parent) open.value = new Set([...open.value, parent.id])
    toast.success(`${name} added`, { action: { label: 'Undo', onClick: () => categories.remove(created.id, { undoAdd: true }) } })
  }
  play('success')
  editOpen.value = false
}

// ---------- Delete or move ----------
const moveOpen = ref(false)
const moving = ref<BudgetCategory>()
const target = reactive({ cat: '', sub: '' })
const moveCatOptions = computed(() => categories.items.value
  .filter(c => !c.parentId && c.kind === moving.value?.kind && !c.archived && c.id !== moving.value?.id)
  .sort((a, b) => a.order - b.order)
  .map(c => ({ value: c.id, label: c.name })))
const moveSubOptions = computed(() => [{ value: '', label: 'No subcategory' }, ...(target.cat ? subsOf(target.cat).filter(s => !s.archived && s.id !== moving.value?.id).map(s => ({ value: s.id, label: s.name })) : [])])
watch(() => target.cat, () => (target.sub = ''))

function askDelete(c: BudgetCategory) {
  const childIds = c.parentId ? [] : subsOf(c.id).map(s => s.id)
  const inUse = used(c.id) + childIds.reduce((n, id) => n + used(id), 0)
  if (!inUse) return remove(c)
  moving.value = c
  // A subcategory moves to a sibling by default; a category picks its new home
  target.cat = c.parentId ?? ''
  target.sub = ''
  moveOpen.value = true
  play('warning')
}

function remove(c: BudgetCategory) {
  const removed = [c, ...(c.parentId ? [] : subsOf(c.id))].map(x => categories.remove(x.id)).filter(Boolean) as BudgetCategory[]
  play('delete')
  toastDeleted(c.name, () => removed.forEach(r => categories.restore(r)))
}

const canMove = computed(() => !!target.cat && (moving.value?.parentId ? !!target.sub || moving.value.parentId !== target.cat : true))
function moveAndDelete() {
  const c = moving.value
  if (!c || !canMove.value) return
  const from = new Set([c.id, ...(c.parentId ? [] : subsOf(c.id).map(s => s.id))])
  let n = 0
  for (const t of transactions.items.value) {
    if (!from.has(t.categoryId) && !from.has(t.subcategoryId)) continue
    transactions.update(t.id, { categoryId: target.cat, subcategoryId: c.kind === 'income' ? '' : target.sub }, { quiet: true })
    n++
  }
  // Bills and budgets that pointed at it follow too, so nothing is left pointing at a deleted category
  for (const r of recurring.items.value) if (from.has(r.categoryId) || from.has(r.subcategoryId)) recurring.update(r.id, { categoryId: target.cat, subcategoryId: target.sub }, { quiet: true })
  for (const l of limits.items.value) if (l.scope !== 'overall' && from.has(l.targetId)) limits.remove(l.id)
  for (const id of from) categories.remove(id)
  moveOpen.value = false
  play('success')
  toast.success(`Moved ${n} ${n === 1 ? 'transaction' : 'transactions'} and deleted ${c.name}`, { description: 'The category is in the Recycle Bin if you need it back.' })
}
const nameOf = (id: string) => categoryById.value.get(id)?.name ?? ''
</script>

<template>
  <div>
    <div class="b-head">
      <h2>Categories</h2>
      <div class="b-row">
        <button type="button" class="btn" @click="openEdit()">+ {{ kind === 'income' ? 'Income source' : 'Category' }}</button>
      </div>
    </div>

    <div class="b-row bar">
      <div class="segmented" role="radiogroup" aria-label="Kind">
        <label :class="{ active: kind === 'expense' }"><input v-model="kind" type="radio" name="cat-kind" value="expense">Expense categories</label>
        <label :class="{ active: kind === 'income' }"><input v-model="kind" type="radio" name="cat-kind" value="income">Income sources</label>
      </div>
      <label v-if="archivedCount" class="check"><input v-model="showArchived" type="checkbox"> Show {{ archivedCount }} archived</label>
    </div>

    <ul class="cats">
      <li v-for="(c, i) in tops" :key="c.id" class="panel cat" :class="[`slot-${c.color}`, { archived: c.archived }]">
        <div class="cat-row">
          <button v-if="kind === 'expense'" type="button" class="expand" :aria-expanded="open.has(c.id)" :aria-label="`${open.has(c.id) ? 'Hide' : 'Show'} subcategories of ${c.name}`" @click="toggle(c.id)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <span class="icon" aria-hidden="true">{{ c.icon }}</span>
          <span class="name">
            <strong>{{ c.name }}</strong>
            <span class="b-muted">
              <template v-if="kind === 'expense'">{{ kids(c.id).length }} {{ kids(c.id).length === 1 ? 'subcategory' : 'subcategories' }} · </template>{{ used(c.id) }} {{ used(c.id) === 1 ? 'transaction' : 'transactions' }}<template v-if="c.archived"> · Archived</template>
            </span>
          </span>
          <span class="tools">
            <button type="button" class="icon-btn" :aria-pressed="!!c.favorite" :aria-label="c.favorite ? `Unpin ${c.name}` : `Pin ${c.name} to the top of the add form`" :title="c.favorite ? 'Pinned' : 'Pin to the top'" @click="togglePin(c)">{{ c.favorite ? '★' : '☆' }}</button>
            <button type="button" class="icon-btn" :disabled="i === 0" :aria-label="`Move ${c.name} up`" @click="move(c, -1)">↑</button>
            <button type="button" class="icon-btn" :disabled="i === tops.length - 1" :aria-label="`Move ${c.name} down`" @click="move(c, 1)">↓</button>
            <button type="button" class="link" @click="openEdit(c)">Edit</button>
            <button type="button" class="link quiet" @click="toggleArchive(c)">{{ c.archived ? 'Unarchive' : 'Archive' }}</button>
            <ConfirmDelete :name="c.name" @confirm="askDelete(c)" />
          </span>
        </div>

        <ul v-if="kind === 'expense' && open.has(c.id)" class="subs">
          <li v-for="(s, j) in kids(c.id)" :key="s.id" class="sub" :class="{ archived: s.archived }">
            <span class="name">
              <span>{{ s.name }}<span v-if="s.group" class="b-muted"> · {{ s.group }}</span></span>
              <span class="b-muted">{{ used(s.id) }}<template v-if="s.archived"> · Archived</template></span>
            </span>
            <span class="tools">
              <button type="button" class="icon-btn" :disabled="j === 0" :aria-label="`Move ${s.name} up`" @click="move(s, -1)">↑</button>
              <button type="button" class="icon-btn" :disabled="j === kids(c.id).length - 1" :aria-label="`Move ${s.name} down`" @click="move(s, 1)">↓</button>
              <button type="button" class="link" @click="openEdit(s)">Edit</button>
              <button type="button" class="link quiet" @click="toggleArchive(s)">{{ s.archived ? 'Unarchive' : 'Archive' }}</button>
              <ConfirmDelete :name="s.name" @confirm="askDelete(s)" />
            </span>
          </li>
          <li><button type="button" class="link add-sub" @click="openEdit(undefined, c)">+ Subcategory in {{ c.name }}</button></li>
        </ul>
      </li>
    </ul>

    <Modal :open="editOpen" :title="editing ? `Edit ${editing.name}` : parentForNew ? `New subcategory in ${parentForNew.name}` : kind === 'income' ? 'New income source' : 'New category'" @close="editOpen = false">
      <form v-validate class="b-form" @submit.prevent="saveEdit">
        <label class="field">
          <span class="field-head">Name</span>
          <input v-model="form.name" class="input" required autocomplete="off" data-keys="text" data-error="Give it a name" v-check="nameTaken ? 'There’s already one with this name here' : ''">
        </label>
        <label v-if="isSub" class="field">
          <span class="field-head">Heading in the picker <span class="optional">Optional</span></span>
          <input v-model="form.group" class="input" :list="`groups-${editing?.id ?? 'new'}`" autocomplete="off" placeholder="e.g. Drinks" data-keys="text">
          <datalist :id="`groups-${editing?.id ?? 'new'}`"><option v-for="g in groupOptions" :key="g" :value="g" /></datalist>
        </label>
        <div class="field">
          <span class="field-head">Icon</span>
          <div class="icons">
            <button v-for="ic in ICONS" :key="ic" type="button" class="icon-pick" :aria-pressed="form.icon === ic" :aria-label="`Icon ${ic}`" @click="form.icon = ic">{{ ic }}</button>
            <input v-model="form.icon" class="input own-icon" maxlength="4" aria-label="Or type any emoji">
          </div>
        </div>
        <div v-if="!isSub" class="field">
          <span class="field-head">Colour</span>
          <div class="colors" role="radiogroup" aria-label="Colour">
            <label v-for="s in COLOR_SLOTS" :key="s.value" :class="[`slot-${s.value}`, { active: form.color === s.value }]" :title="s.label">
              <input v-model="form.color" type="radio" name="cat-color" :value="s.value" :aria-label="s.label"><span class="dot" />
            </label>
          </div>
        </div>
        <div class="actions">
          <button type="submit" class="btn">{{ editing ? 'Save changes' : 'Add' }}</button>
          <button type="button" class="btn btn-quiet" @click="editOpen = false">Cancel</button>
        </div>
      </form>
    </Modal>

    <Modal :open="moveOpen" :title="`Move transactions out of ${moving?.name ?? ''}`" @close="moveOpen = false">
      <div class="b-form">
        <p>
          <strong>{{ moving?.name }}</strong> still has transactions, so it can’t simply be deleted. Choose where they should go, or
          <button type="button" class="link" @click="moving && toggleArchive(moving); moveOpen = false">archive it instead</button> to keep everything as it is.
        </p>
        <div class="row">
          <label class="field">
            <span class="field-head">Move to</span>
            <AppSelect v-model="target.cat" aria-label="Move to category" :options="moveCatOptions" placeholder="Choose a category" searchable />
          </label>
          <label v-if="moving?.kind === 'expense'" class="field">
            <span class="field-head">Subcategory</span>
            <AppSelect v-model="target.sub" aria-label="Move to subcategory" :options="moveSubOptions" searchable />
          </label>
        </div>
        <p v-if="target.cat" class="b-muted">Its transactions, bills and budgets will point to {{ nameOf(target.cat) }}<template v-if="target.sub"> › {{ nameOf(target.sub) }}</template>. Budgets set on {{ moving?.name }} itself are removed.</p>
        <div class="actions">
          <button type="button" class="btn" :disabled="!canMove" @click="moveAndDelete">Move and delete</button>
          <button type="button" class="btn btn-quiet" @click="moveOpen = false">Cancel</button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.bar {
  justify-content: space-between;
  margin-bottom: 1rem;
}

.bar .segmented label {
  padding-inline: 0.8rem;
  white-space: nowrap;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.cats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cat {
  padding: 0.6rem 0.9rem;
  border-left: 4px solid var(--slot);
}

.archived {
  opacity: 0.6;
}

.cat-row,
.sub {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.expand {
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  color: var(--ink-2);
  background: none;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}

.expand:hover {
  background: var(--surface-2);
}

.expand svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  transition: transform var(--dur-fast);
}

.expand[aria-expanded='true'] svg {
  transform: rotate(90deg);
}

.icon {
  font-size: 1.25rem;
}

.name {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.tools {
  display: flex;
  align-items: center;
  gap: 0.35rem 0.6rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.icon-btn {
  min-width: 2rem;
  min-height: 2rem;
  font: inherit;
  color: var(--ink-2);
  background: none;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}

.icon-btn:hover:not(:disabled) {
  background: var(--surface-2);
  color: var(--ink);
}

.icon-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.icon-btn[aria-pressed='true'] {
  color: var(--budget-warn);
}

.quiet {
  color: var(--ink-2);
}

.subs {
  margin: 0.5rem 0 0.25rem 2.6rem;
  border-top: 1px solid var(--line);
}

.sub {
  padding: 0.35rem 0;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 60%, transparent);
  font-size: var(--text-sm);
}

.add-sub {
  margin-top: 0.5rem;
  font-size: var(--text-sm);
}

.icons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.icon-pick {
  width: 2.4rem;
  height: 2.4rem;
  font-size: 1.15rem;
  background: var(--surface-2);
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
}

.icon-pick[aria-pressed='true'] {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.own-icon {
  width: 4.5rem;
  text-align: center;
}

.colors {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.colors label {
  width: 2.4rem;
  height: 2.4rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  cursor: pointer;
}

.colors input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.colors .dot {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  background: var(--slot);
}

.colors label.active {
  box-shadow: 0 0 0 2px var(--ink);
}

.colors label:has(input:focus-visible) {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
}

@media (max-width: 640px) {
  .cat-row,
  .sub {
    flex-wrap: wrap;
  }

  .tools {
    width: 100%;
  }
}
</style>
