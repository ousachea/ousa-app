<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { CsvColumn } from '~/utils/transfer'
import type { MenuEntry } from '~/composables/useContextMenu'

// My contacts in the Phone checker (CHECKLIST.md #62, #63): name, phone, email and notes, saved like
// the other trackers (this device, and your account when signed in). Each number shows its network.
// Add, edit, delete (to the Recycle Bin), search, select several to copy, export or delete together.
export interface Contact {
  id: string
  name: string
  phone: string
  email: string
  notes: string
  createdAt: string
}

const emit = defineEmits<{ check: [phone: string] }>()
const { play } = useSound()
// With the example on, a few made-up contacts stand in for yours (your own stay untouched)
const DEMO = (): Omit<Contact, 'id'>[] => [
  { name: 'Sokha Chan', phone: '012 345 678', email: 'sokha@example.com', notes: 'Landlord, call after 5 pm', createdAt: new Date().toISOString() },
  { name: 'Dara Pich', phone: '097 123 4567', email: '', notes: '', createdAt: new Date().toISOString() },
  { name: 'Phnom Penh office', phone: '023 225 333', email: 'office@example.com', notes: 'Weekdays 8–5', createdAt: new Date().toISOString() }
]
const store = useCollection<Contact>('contacts', undefined, { app: '/phone', label: c => c.name || c.phone, demo: DEMO })
const { items, ready, sync, add, addMany, update, replace, remove, restore } = store

// ---------- Search and selection ----------
const query = ref('')
const digits = (s: string) => s.replace(/\D/g, '').replace(/^(855|0)+/, '')
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  const qd = digits(q)
  // "012…" or "+855 12…" is the start of a number; other digits can be anywhere in it
  const fromStart = /^(\+?855|0)/.test(q.replace(/\s/g, ''))
  const numberMatches = (phone: string) => qd.length >= 2 && (fromStart ? digits(phone).startsWith(qd) : digits(phone).includes(qd))
  return [...items.value]
    .filter(c => !q || [c.name, c.email, c.notes].some(f => f.toLowerCase().includes(q)) || numberMatches(c.phone))
    .sort((a, b) => (a.name || a.phone).localeCompare(b.name || b.phone))
})
const selected = ref(new Set<string>())
const selectedList = computed(() => shown.value.filter(c => selected.value.has(c.id)))
const allChecked = computed(() => shown.value.length > 0 && selectedList.value.length === shown.value.length)
function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}
function toggleAll() {
  selected.value = allChecked.value ? new Set() : new Set(shown.value.map(c => c.id))
}
watch(items, (list) => {
  const ids = new Set(list.map(c => c.id))
  selected.value = new Set([...selected.value].filter(id => ids.has(id)))
})

const checkOf = (c: Pick<Contact, 'phone'>) => checkCambodiaPhone(c.phone)
const initials = (c: Contact) => (c.name || c.phone).split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
const shownNumber = (c: Contact) => {
  const r = checkOf(c)
  return r.valid ? r.international : c.phone
}

// ---------- Add / edit (popup) ----------
const editing = ref<Contact | null>()
const form = reactive({ name: '', phone: '', email: '', notes: '' })
const formCheck = computed(() => (form.phone.trim() ? checkCambodiaPhone(form.phone) : undefined))

function openAdd(prefill: Partial<typeof form> = {}) {
  Object.assign(form, { name: '', phone: '', email: '', notes: '' }, prefill)
  editing.value = null
  play('open')
}
function openEdit(c: Contact) {
  Object.assign(form, { name: c.name, phone: c.phone, email: c.email, notes: c.notes })
  editing.value = c
  play('open')
}
defineExpose({ addMany, items, openAdd, remove })

function save() {
  const record = { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), notes: form.notes.trim() }
  if (editing.value) {
    const before = update(editing.value.id, record)
    toastSaved(before && (() => replace(before)))
  } else {
    const created = add({ ...record, createdAt: new Date().toISOString() })
    toast.success(`${created.name || created.phone} saved`, { action: { label: 'Undo', onClick: () => remove(created.id, { undoAdd: true }) } })
  }
  play('success')
  editing.value = undefined
}

function del(c: Contact) {
  const removed = remove(c.id)
  play('delete')
  toastDeleted(c.name || c.phone, () => removed && restore(removed))
}

function delSelected() {
  const list = selectedList.value
  const removed = list.map(c => remove(c.id)).filter((c): c is Contact => !!c)
  selected.value = new Set()
  play('delete')
  toast(`${removed.length} ${removed.length === 1 ? 'contact' : 'contacts'} deleted`, {
    description: 'Moved to the Recycle Bin.',
    action: { label: 'Undo', onClick: () => removed.forEach(restore) }
  })
}

// ---------- Export and copy (#63) ----------
const transferOpen = ref(false)
const CONTACT_COLUMNS: CsvColumn<Contact>[] = [
  { header: 'Name', get: c => c.name },
  { header: 'Phone', get: c => shownNumber(c) },
  { header: 'Network', get: (c) => {
    const r = checkOf(c)
    return r.valid ? r.operator?.name ?? r.region ?? 'Landline' : 'Invalid'
  } },
  { header: 'Email', get: c => c.email },
  { header: 'Notes', get: c => c.notes }
]
function contactFrom(name: string, phone: string, email: string, notes: string): Omit<Contact, 'id'> | undefined {
  if (!phone.trim() && !name.trim()) return undefined
  return { name: name.trim(), phone: phone.trim(), email: email.trim(), notes: notes.trim(), createdAt: new Date().toISOString() }
}
const contactFromRow = (r: Record<string, string>) => contactFrom(cellOf(r, 'name', 'full name', 'display name'), cellOf(r, 'phone', 'number', 'mobile', 'phone 1 - value', 'telephone'), cellOf(r, 'email', 'e-mail', 'e-mail 1 - value'), cellOf(r, 'notes', 'note'))
const contactFromJSON = (r: Record<string, unknown>) => contactFrom(String(r.name ?? ''), String(r.phone ?? ''), String(r.email ?? ''), String(r.notes ?? ''))
const contactKey = (c: Omit<Contact, 'id'>) => digits(c.phone) || c.name.toLowerCase()

async function copyContacts(list: Contact[]) {
  const text = list.map(c => [c.name, shownNumber(c), c.email].filter(Boolean).join(' · ')).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    play('copy')
    toast.success(`${list.length} ${list.length === 1 ? 'contact' : 'contacts'} copied`, { description: 'One per line: name · number · email.' })
  } catch {
    play('error')
    toast.error('Couldn’t copy', { description: 'Your browser blocked the clipboard.' })
  }
}

function exportSelected(format: 'csv' | 'json') {
  const list = selectedList.value
  if (format === 'csv') downloadFile(dated('contacts-selected', 'csv'), toCSV(list, CONTACT_COLUMNS), 'text/csv;charset=utf-8')
  else downloadFile(dated('contacts-selected', 'json'), toCollectionJSON('contacts', list), 'application/json')
  logActivity('exported', '/phone', `${list.length} contacts as ${format.toUpperCase()}`)
  play('copy')
  toast.success(`${list.length} ${list.length === 1 ? 'contact' : 'contacts'} exported`)
}

// ---------- Menus ----------
const menuFor = useRowMenu()
const contactMenu = (c: Contact): MenuEntry[] => [
  { label: 'Check this number', icon: 'open', run: () => emit('check', c.phone) },
  { label: 'Edit', icon: 'edit', run: () => openEdit(c) },
  { label: 'Copy', icon: 'copy', run: () => copyContacts([c]) },
  { label: selected.value.has(c.id) ? 'Unselect' : 'Select', icon: 'star', run: () => toggle(c.id) },
  '-',
  { label: 'Delete', icon: 'delete', danger: true, run: () => del(c) }
]
</script>

<template>
  <div class="saved">
    <div class="saved-head">
      <ClientOnly><DataSource :sync="sync" /></ClientOnly>
      <div class="saved-actions">
        <button type="button" class="btn btn-quiet btn-sm" @click="transferOpen = true">Import / Export</button>
        <button type="button" class="btn btn-sm" @click="openAdd()">+ Add contact</button>
      </div>
    </div>

    <ClientOnly>
      <div v-if="ready && items.length" class="panel list-panel">
        <div class="tools">
          <label class="check-all">
            <input type="checkbox" :checked="allChecked" :indeterminate="selectedList.length > 0 && !allChecked" aria-label="Select all" @change="toggleAll">
          </label>
          <input v-model="query" class="input search" type="search" placeholder="Search name, number, email or notes" aria-label="Search my contacts">
        </div>
        <Transition name="slide-down">
          <div v-if="selectedList.length" class="bulk" role="toolbar" aria-label="Selected contacts">
            <strong>{{ selectedList.length }} selected</strong>
            <button type="button" class="btn btn-quiet btn-sm" @click="copyContacts(selectedList)">Copy</button>
            <button type="button" class="btn btn-quiet btn-sm" @click="exportSelected('csv')">CSV</button>
            <button type="button" class="btn btn-quiet btn-sm" @click="exportSelected('json')">JSON</button>
            <button type="button" class="btn btn-quiet btn-sm danger-text" @click="delSelected">Delete</button>
          </div>
        </Transition>

        <TransitionGroup v-if="shown.length" tag="ul" name="list" class="rows">
          <li v-for="c in shown" :key="c.id" :data-item-id="c.id" class="row" :class="{ checked: selected.has(c.id) }" v-bind="menuFor(() => contactMenu(c), c.name || c.phone)" v-swipe-delete="() => del(c)">
            <input type="checkbox" class="row-check" :checked="selected.has(c.id)" :aria-label="`Select ${c.name || c.phone}`" @change="toggle(c.id)">
            <span class="avatar" :style="{ '--op': checkOf(c).valid ? checkOf(c).operator?.color ?? 'var(--ink-3)' : 'var(--red)' }" aria-hidden="true">{{ initials(c) || '?' }}</span>
            <button type="button" class="who" :title="`Check ${shownNumber(c)}`" @click="emit('check', c.phone)">
              <span class="who-name">{{ c.name || 'No name' }}</span>
              <span class="who-number">{{ shownNumber(c) }}<template v-if="c.email"> · {{ c.email }}</template></span>
              <span v-if="c.notes" class="who-notes">{{ c.notes }}</span>
            </button>
            <span v-if="checkOf(c).valid" class="net-tag" :style="{ '--op': checkOf(c).operator?.color ?? 'var(--ink-3)' }">{{ checkOf(c).operator?.name ?? checkOf(c).region }}</span>
            <span v-else class="net-tag bad">{{ checkOf(c).match ? 'Wrong length' : 'Invalid' }}</span>
            <span class="row-actions">
              <button type="button" class="icon-btn" :aria-label="`Edit ${c.name || c.phone}`" title="Edit" @click="openEdit(c)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>
              </button>
              <ConfirmDelete :name="c.name || c.phone" @confirm="del(c)" />
            </span>
          </li>
        </TransitionGroup>
        <p v-else class="none">No contacts match “{{ query }}”.</p>
      </div>
      <div v-else-if="ready" class="panel">
        <EmptyState title="No saved contacts yet" icon="phone" action="+ Add contact" @action="openAdd()">
          Keep the numbers you check often, with an email and notes. Each one shows its network, and they sync with your account when you’re signed in.
        </EmptyState>
      </div>
      <SkeletonList v-else :count="3" label="Loading your contacts" />
      <template #fallback><SkeletonList :count="3" label="Loading your contacts" /></template>
    </ClientOnly>

    <Modal :open="editing !== undefined" :title="editing ? `Edit ${editing.name || editing.phone}` : 'Add a contact'" @close="editing = undefined">
      <form v-validate class="form" @submit.prevent="save">
        <label class="field">
          <span class="field-head">Name</span>
          <input v-model="form.name" class="input" autocomplete="off" placeholder="Sokha Chan" required data-error="Give the contact a name">
        </label>
        <label class="field">
          <span class="field-head">Phone</span>
          <input v-model="form.phone" class="input" type="tel" inputmode="tel" placeholder="012 345 678" required data-error="Enter a phone number">
          <small v-if="formCheck" class="hint" :class="{ bad: !formCheck.valid }">
            {{ formCheck.valid ? `${formCheck.operator?.name ?? formCheck.region ?? 'Landline'} · ${formCheck.international}` : formCheck.reason ?? 'That isn’t a Cambodian number; it’ll be saved as typed.' }}
          </small>
        </label>
        <label class="field">
          <span class="field-head">Email <span class="optional">Optional</span></span>
          <input v-model="form.email" class="input" type="email" autocomplete="off" placeholder="sokha@example.com">
        </label>
        <label class="field">
          <span class="field-head">Notes <span class="optional">Optional</span></span>
          <textarea v-model="form.notes" class="input" rows="2" placeholder="Landlord, call after 5 pm…" />
        </label>
        <div class="form-actions">
          <button type="submit" class="btn">{{ editing ? 'Save changes' : 'Save contact' }}</button>
          <button type="button" class="btn btn-quiet" @click="editing = undefined">Cancel</button>
        </div>
      </form>
    </Modal>

    <TransferDialog
      :open="transferOpen"
      title="Contacts"
      collection="contacts"
      app="/phone"
      :items="items"
      :columns="CONTACT_COLUMNS"
      :from-row="contactFromRow"
      :from-json="contactFromJSON"
      :same-as="contactKey"
      :add-many="addMany"
      :remove="remove"
      @close="transferOpen = false"
    />
  </div>
</template>

<style scoped>
.saved {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.saved-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.saved-actions {
  display: flex;
  gap: 0.5rem;
}

.list-panel {
  padding: 0.75rem;
}

.tools {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.check-all {
  display: grid;
  place-items: center;
  padding-left: 0.4rem;
}

input[type='checkbox'] {
  width: 1.1rem;
  height: 1.1rem;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.search {
  flex: 1;
}

.bulk {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.6rem;
  padding: 0.5rem 0.6rem;
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
  border-radius: 12px;
}

.bulk strong {
  margin-right: auto;
  font-size: var(--text-sm);
}

.danger-text:hover:not(:disabled) {
  color: var(--bad-ink);
}

.rows {
  position: relative;
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.55rem 0.4rem;
  border-radius: 12px;
  background: var(--surface);
}

.row + .row {
  border-top: 1px solid var(--line);
}

.row.checked {
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
}

.avatar {
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--ink);
  background: color-mix(in srgb, var(--op) 14%, var(--surface));
  border: 2px solid var(--op);
  border-radius: 50%;
}

.who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
  font: inherit;
  text-align: left;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

.who-name {
  font-weight: 600;
}

.who-number,
.who-notes {
  font-size: var(--text-sm);
  color: var(--ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.who-notes {
  color: var(--ink-3);
}

.net-tag {
  flex: none;
  padding: 0.1rem 0.5rem;
  font-size: var(--text-xs);
  font-weight: 700;
  background: color-mix(in srgb, var(--op) 14%, var(--surface));
  border-left: 3px solid var(--op);
  border-radius: 4px 999px 999px 4px;
}

.net-tag.bad {
  color: var(--bad-ink);
  --op: var(--red);
}

.row-actions {
  flex: none;
  display: flex;
}

.none {
  margin: 1rem 0;
  text-align: center;
  color: var(--ink-2);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hint {
  font-size: var(--text-sm);
  color: var(--good-ink);
}

.hint.bad {
  color: var(--warn-ink);
}

.form-actions {
  display: flex;
  gap: 0.5rem;
}

@media (max-width: 520px) {
  .row {
    flex-wrap: wrap;
  }

  .who {
    flex-basis: calc(100% - 5.5rem);
  }

  .net-tag {
    margin-left: 3.85rem;
  }

  .row-actions {
    margin-left: auto;
  }
}
</style>
