<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { PhoneResult } from '~/utils/cambodiaPhone'
import type { RawContact } from '~/utils/contactImport'

const { play } = useSound()

const input = ref('')
const result = computed(() => checkCambodiaPhone(input.value))
const valid = computed(() => (result.value.valid ? result.value : undefined))

// White text on dark network colours, dark text on light ones (Cellcard's orange fails white-text contrast)
const simInk = computed(() => {
  const color = valid.value?.operator?.color
  return color && contrastRatio(color, '#ffffff') < 3 ? '#1b1f2a' : '#ffffff'
})
// A known prefix while the number is still incomplete, e.g. just "96"
const partial = computed(() => {
  const r = result.value
  return !r.valid && r.match && r.match.have < r.match.expected ? r.match : undefined
})

// A quiet tick the moment a typed number becomes valid
watch(() => result.value.valid, (isValid, wasValid) => {
  if (isValid && !wasValid) play('check')
})

const formats = computed(() => valid.value
  ? [
      { label: 'Local', value: valid.value.national },
      { label: 'International', value: valid.value.international },
      { label: 'E.164', value: valid.value.e164 }
    ]
  : [])

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success('Copied', { description: value })
    play('copy')
  } catch {
    toast.error('Could not copy')
    play('error')
  }
}

// ---------- Contacts: check a whole address book at once ----------
// Kept in memory only: never saved, synced or uploaded
interface CheckedContact { id: number, name: string, raw: string, result: PhoneResult, network: string }

const { available: googleReady, importFromGoogle } = useGoogleContacts()
const contacts = ref<CheckedContact[]>([])
const contactSource = ref('')
const importing = ref<'' | 'google' | 'file' | 'picker'>('')
const fileInput = ref<HTMLInputElement>()
const contactQuery = ref('')
const networkFilter = ref('All')
const showCount = ref(100)

// The Contact Picker API exists on Android Chrome; feature-checked after mount so SSR matches
const canPick = ref(false)
onMounted(() => (canPick.value = 'contacts' in navigator && 'ContactsManager' in window))

// A number written with another country's code (+1…, 0066…) isn't ours to check
function isForeign(raw: string) {
  const t = raw.trim()
  const digits = t.replace(/\D/g, '').replace(/^00/, '')
  return (t.startsWith('+') || t.startsWith('00')) && !digits.startsWith('855')
}

const networkOf = (r: PhoneResult) => (r.valid ? r.operator?.name ?? 'Landline' : 'Invalid')

function loadContacts(list: RawContact[], source: string, { quiet = false } = {}) {
  const seen = new Set<string>()
  const out: CheckedContact[] = []
  let foreign = 0
  for (const c of list) {
    for (const raw of c.numbers) {
      if (isForeign(raw)) {
        foreign++
        continue
      }
      const result = checkCambodiaPhone(raw)
      const key = `${c.name}|${result.valid ? result.e164 : raw.replace(/\D/g, '')}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ id: out.length, name: c.name.trim() || 'No name', raw, result, network: networkOf(result) })
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  contacts.value = out
  contactSource.value = source
  networkFilter.value = 'All'
  contactQuery.value = ''
  showCount.value = 100
  if (quiet) return
  if (!out.length) {
    toast(`No Cambodian numbers in ${source}`, { description: foreign ? `${foreign} numbers from other countries were skipped.` : undefined })
    return
  }
  play('success')
  toast.success(`${out.length} Cambodian ${out.length === 1 ? 'number' : 'numbers'} checked`, {
    description: foreign ? `From ${source}. ${foreign} from other countries skipped.` : `From ${source}.`
  })
}

// ---------- Demo (the app icon switches it on) ----------
// A number to check plus a small address book with every network, a landline, a short number
// and a foreign one, so each part of the page has something to show
const DEMO_CONTACTS: RawContact[] = [
  { name: 'Sokha Chan', numbers: ['012 345 678', '+855 96 777 8888'] },
  { name: 'Dara Pich', numbers: ['097 123 4567'] },
  { name: 'Sreymom Ly', numbers: ['088 812 3456'] },
  { name: 'Vibol Keo', numbers: ['015 999 888'] },
  { name: 'Chenda Ouk', numbers: ['071 234 5678'] },
  { name: 'Rithy Heng', numbers: ['010 23 45'] },
  { name: 'Phnom Penh office', numbers: ['023 225 333'] },
  { name: 'Bopha Sun', numbers: ['081 456 789'] },
  { name: 'Alex (USA)', numbers: ['+1 415 555 0100'] }
]
const { active: demoOn } = useDemo()
let savedInput = ''
let savedContacts: { list: CheckedContact[], source: string } | undefined
watch(demoOn, (on) => {
  if (on) {
    savedInput = input.value
    savedContacts = { list: contacts.value, source: contactSource.value }
    input.value = '096 777 8888'
    loadContacts(DEMO_CONTACTS, 'example contacts', { quiet: true })
  } else {
    input.value = savedInput
    contacts.value = savedContacts?.list ?? []
    contactSource.value = savedContacts?.source ?? ''
  }
})

async function fromGoogle() {
  importing.value = 'google'
  try {
    loadContacts(await importFromGoogle(), 'Google Contacts')
  } catch (e) {
    toast.error('Couldn’t read Google Contacts', { description: e instanceof Error ? e.message : undefined })
    play('error')
  } finally {
    importing.value = ''
  }
}

async function fromFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  importing.value = 'file'
  try {
    loadContacts(parseContactFile(file.name, await file.text()), file.name)
  } catch (err) {
    toast.error('Couldn’t read that file', { description: err instanceof Error ? err.message : undefined })
    play('error')
  } finally {
    importing.value = ''
  }
}

async function fromPicker() {
  importing.value = 'picker'
  try {
    const picked = await (navigator as unknown as { contacts: { select: (p: string[], o: { multiple: boolean }) => Promise<{ name?: string[], tel?: string[] }[]> } })
      .contacts.select(['name', 'tel'], { multiple: true })
    if (picked.length) loadContacts(picked.map(p => ({ name: p.name?.[0] ?? '', numbers: p.tel ?? [] })), 'this phone')
  } catch {
    toast.error('Couldn’t open your contacts')
  } finally {
    importing.value = ''
  }
}

function clearContacts() {
  // In the demo, clearing the sample contacts means leaving the demo
  if (demoOn.value) {
    demoOn.value = false
    return
  }
  contacts.value = []
  contactSource.value = ''
  play('delete')
  toast('Contacts cleared from this page')
}

// One chip per network, in the reference order, then landlines and invalid numbers
const networks = computed(() => {
  const counts = new Map<string, number>()
  for (const c of contacts.value) counts.set(c.network, (counts.get(c.network) ?? 0) + 1)
  const order = [...OPERATORS.map(o => o.name), 'Landline', 'Invalid']
  return [
    { name: 'All', count: contacts.value.length, color: undefined as string | undefined },
    ...order.filter(n => counts.has(n)).map(n => ({ name: n, count: counts.get(n)!, color: OPERATORS.find(o => o.name === n)?.color }))
  ]
})

const filteredContacts = computed(() => {
  const q = contactQuery.value.trim().toLowerCase()
  const qDigits = q.replace(/\D/g, '').replace(/^0+/, '')
  return contacts.value.filter(c =>
    (networkFilter.value === 'All' || c.network === networkFilter.value)
    && (!q || c.name.toLowerCase().includes(q) || (qDigits && c.raw.replace(/\D/g, '').includes(qDigits))))
})

const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()

function checkContact(c: CheckedContact) {
  input.value = c.raw
  play('select')
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}
</script>

<template>
  <ToolPage>
    <div class="workspace">
    <div class="check">
    <Step :n="1" title="Type a number" hint="The first 2 digits are enough to see the network. The 0 is optional.">
    <label class="number input">
      <span class="cc" aria-hidden="true">🇰🇭 +855</span>
      <input
        v-model="input"
        type="tel"
        inputmode="tel"
        autocomplete="off"
        placeholder="012 345 678"
        aria-label="Phone number"
        aria-describedby="phone-result"
        autofocus
      >
    </label>
    </Step>

    <Step :n="2" title="Check the result and copy" class="result-step">
    <div id="phone-result" aria-live="polite">
      <section v-if="valid" class="panel result">
        <div class="verdict ok">
          <span class="dot" />
          Valid {{ valid.type === 'mobile' ? 'mobile' : 'landline' }} number
        </div>

        <!-- A SIM card in the network's colour: cut corner, contact chip, the number printed on it -->
        <div class="sim" :style="{ '--op': valid.operator?.color ?? 'var(--blue)', '--sim-ink': simInk }">
          <div class="sim-top">
            <span class="chip" aria-hidden="true"><i /><i /><i /></span>
            <span class="sim-kind">{{ valid.type === 'mobile' ? 'Mobile' : 'Landline' }}</span>
          </div>
          <strong class="sim-name">{{ valid.operator?.name ?? valid.region }}</strong>
          <span class="sim-number">{{ valid.international }}</span>
          <span class="sim-note">{{ valid.type === 'mobile' ? 'Network based on the prefix' : 'Province based on the area code' }}</span>
        </div>

        <dl class="formats">
          <div v-for="f in formats" :key="f.label">
            <dt>{{ f.label }}</dt>
            <dd>{{ f.value }}</dd>
            <button type="button" class="btn btn-quiet btn-sm" :aria-label="`Copy ${f.label} format`" @click="copy(f.value)">Copy</button>
          </div>
        </dl>

        <div class="links">
          <a class="btn btn-sm" :href="`tel:${valid.e164}`">Call</a>
          <template v-if="valid.type === 'mobile'">
            <a class="btn btn-quiet btn-sm" :href="`https://wa.me/${valid.e164.slice(1)}`" target="_blank" rel="noopener">WhatsApp</a>
            <a class="btn btn-quiet btn-sm" :href="`https://t.me/${valid.e164}`" target="_blank" rel="noopener">Telegram</a>
          </template>
        </div>
      </section>

      <section v-else-if="partial" class="panel result partial">
        <div class="owner" :style="{ '--op': partial.operator?.color ?? 'var(--blue)' }">
          <strong>{{ partial.operator?.name ?? partial.region }}</strong>
          <span>
            0{{ partial.prefix }} is a {{ partial.type === 'mobile' ? `${partial.operator?.name} mobile prefix` : `landline area code for ${partial.region}` }}
          </span>
        </div>

        <div class="slots" :aria-label="`${partial.have} of ${partial.expected} digits after the prefix`">
          <span class="slot prefix">0{{ partial.prefix }}</span>
          <span
            v-for="n in partial.expected"
            :key="n"
            class="slot"
            :class="{ filled: n <= partial.have }"
          />
        </div>
        <p class="progress">{{ result.valid ? '' : result.reason }}</p>
      </section>

      <p v-else-if="input.trim() && !result.valid" class="verdict bad">
        <span class="dot" />
        {{ result.reason }}
      </p>

      <p v-else class="waiting">The network and every format of the number show up here.</p>
    </div>
    </Step>
    </div>

    <Step title="Check your contacts" hint="See which network each number is on, and catch numbers that are missing a digit." class="contacts-step">
      <template v-if="contacts.length" #aside>
        <button type="button" class="btn btn-quiet btn-sm" @click="clearContacts">Clear</button>
      </template>

      <div v-if="!contacts.length" class="panel import">
        <div class="sources">
          <button v-if="googleReady" type="button" class="btn source google" :disabled="!!importing" @click="fromGoogle">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" /></svg>
            {{ importing === 'google' ? 'Reading contacts…' : 'Import from Google' }}
          </button>
          <button type="button" class="btn source" :class="{ 'btn-quiet': googleReady }" :disabled="!!importing" @click="fileInput?.click()">
            {{ importing === 'file' ? 'Reading file…' : 'Import a contacts file' }}
          </button>
          <button v-if="canPick" type="button" class="btn btn-quiet source" :disabled="!!importing" @click="fromPicker">Pick from this phone</button>
          <input ref="fileInput" type="file" accept=".csv,.vcf,text/csv,text/vcard" hidden @change="fromFile">
        </div>
        <p class="how">
          In <a href="https://contacts.google.com" target="_blank" rel="noopener">Google Contacts</a>, choose Export, then <b>Google CSV</b>. A <b>.vcf</b> file from your phone works too.
        </p>
        <p class="private">Contacts stay on this page. They’re never saved or uploaded.</p>
      </div>

      <div v-else class="panel book">
        <p class="book-source">{{ contacts.length }} Cambodian {{ contacts.length === 1 ? 'number' : 'numbers' }} from {{ contactSource }}</p>

        <div class="nets" role="group" aria-label="Filter by network">
          <button
            v-for="n in networks"
            :key="n.name"
            type="button"
            class="net"
            :class="{ on: networkFilter === n.name, invalid: n.name === 'Invalid' }"
            :style="n.color ? { '--op': n.color } : undefined"
            :aria-pressed="networkFilter === n.name"
            @click="networkFilter = n.name; showCount = 100"
          >
            <span v-if="n.color" class="net-dot" aria-hidden="true" />
            {{ n.name }} <b>{{ n.count }}</b>
          </button>
        </div>

        <input v-model="contactQuery" class="input search" type="search" placeholder="Search by name or number" aria-label="Search contacts">

        <ul v-if="filteredContacts.length" class="people">
          <li v-for="c in filteredContacts.slice(0, showCount)" :key="c.id">
            <button type="button" class="person" @click="checkContact(c)">
              <span class="avatar" :style="{ '--op': c.result.valid ? c.result.operator?.color ?? 'var(--ink-3)' : 'var(--red)' }" aria-hidden="true">{{ initials(c.name) || '?' }}</span>
              <span class="who">
                <span class="who-name">{{ c.name }}</span>
                <span class="who-number">{{ c.result.valid ? c.result.international : c.raw }}</span>
              </span>
              <span v-if="c.result.valid" class="net-tag" :style="{ '--op': c.result.operator?.color ?? 'var(--ink-3)' }">
                {{ c.result.operator?.name ?? c.result.region }}
              </span>
              <span v-else class="net-tag bad" :title="c.result.reason">{{ c.result.match ? 'Wrong length' : 'Invalid' }}</span>
            </button>
          </li>
        </ul>
        <p v-else class="none">No contacts match.</p>
        <button v-if="filteredContacts.length > showCount" type="button" class="btn btn-quiet btn-sm more" @click="showCount += 200">
          Show {{ Math.min(200, filteredContacts.length - showCount) }} more
        </button>
      </div>
    </Step>

    <details class="panel reference">
      <summary>Mobile prefixes for every network</summary>
      <ul class="ops">
        <li v-for="op in OPERATORS" :key="op.name" :style="{ '--op': op.color }">
          <strong>{{ op.name }}</strong>
          <span class="prefixes">
            <span v-for="(len, prefix) in op.prefixes" :key="prefix" :title="`${len} digits after the prefix`">0{{ prefix }}</span>
          </span>
        </li>
      </ul>
      <p class="note">
        People can keep their number when they switch networks, so the network shown is a best guess from the prefix.
      </p>
    </details>
    </div>
  </ToolPage>
</template>

<style scoped>
/* One narrow column, like a phone screen: dial, see the SIM, reference tucked below.
   On wide screens the checker stays phone-sized on the left and the contacts fill the rest. */
.workspace {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  max-width: 520px;
  margin: 0 auto;
}

@media (min-width: 1100px) {
  .workspace {
    max-width: none;
    grid-template-columns: minmax(380px, 520px) minmax(0, 1fr);
    grid-template-areas: 'check contacts' 'reference contacts';
    grid-template-rows: auto 1fr;
    gap: 1.5rem 2.5rem;
    align-items: start;
  }

  .check { grid-area: check; }
  .contacts-step { grid-area: contacts; }
  .reference { grid-area: reference; }

  /* A long address book reads across in columns instead of one tall list */
  .people {
    columns: 22rem;
    column-gap: 2rem;
  }

  .people li {
    break-inside: avoid;
  }
}

.number {
  display: flex;
  align-items: center;
  padding: 0;
  overflow: hidden;
  border-radius: 16px;
}

/* Red is this tool's colour, but a red ring around an input reads as an error, so focus stays neutral */
.number:focus-within {
  border-color: var(--ink);
  box-shadow: 0 0 0 3px rgb(var(--shadow) / 0.12);
}

.cc {
  align-self: stretch;
  display: flex;
  align-items: center;
  padding: 0 1rem;
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface-2);
  border-right: 1px solid var(--line);
  white-space: nowrap;
}

.number input {
  flex: 1;
  min-width: 0;
  padding: 1rem 1.1rem;
  font: inherit;
  font-size: clamp(1.4rem, 5vw, 1.75rem);
  font-weight: 600;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
  background: transparent;
  border: 0;
  outline: none;
}

.number input::placeholder {
  color: var(--ink-3);
  font-weight: 400;
}

.result-step {
  margin-top: 2rem;
}

.waiting {
  margin: 0;
  padding: 1.5rem;
  text-align: center;
  color: var(--ink-3);
  border: 2px dashed var(--line);
  border-radius: 20px;
}

.result {
  padding: 1.25rem;
  animation: settle 0.2s ease-out;
}

/* SIM card: rounded rectangle with the classic cut corner */
.sim {
  position: relative;
  aspect-ratio: 1.6;
  max-width: 340px;
  margin: 1.1rem auto 1.4rem;
  padding: 1.1rem 1.25rem;
  display: flex;
  flex-direction: column;
  color: var(--sim-ink);
  background:
    radial-gradient(circle at 85% 0%, rgb(255 255 255 / 0.28), transparent 55%),
    linear-gradient(135deg, var(--op), color-mix(in srgb, var(--op) 70%, #000));
  border-radius: 16px;
  clip-path: polygon(0 0, calc(100% - 2.2rem) 0, 100% 2.2rem, 100% 100%, 0 100%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.15);
}

.sim-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

/* Gold contact pad with its etched lines */
.chip {
  width: 2.6rem;
  height: 2rem;
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  gap: 2px;
  padding: 4px;
  background: linear-gradient(135deg, #f5d97b, #c9a43e);
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.2);
}

.chip i {
  border-top: 1px solid rgb(0 0 0 / 0.25);
}

.sim-kind {
  margin-right: 1.4rem;
  font-size: 0.75rem;
  font-weight: 700;
  opacity: 0.85;
}

.sim-name {
  margin-top: auto;
  font-size: 1.7rem;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.sim-number {
  margin-top: 0.2rem;
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;

}

.sim-note {
  margin-top: 0.15rem;
  font-size: 0.75rem;
  opacity: 0.8;
}

.partial .owner {
  margin-top: 0;
}

.slots {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.slot {
  width: 1.1rem;
  height: 1.6rem;
  border-radius: 5px;
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1.5px var(--line);
  transition: background-color 0.15s, box-shadow 0.15s;
}

.slot.filled {
  background: var(--ink);
  box-shadow: none;
}

.slot.prefix {
  width: auto;
  height: 1.6rem;
  padding: 0 0.5rem;
  margin-right: 0.35rem;
  display: grid;
  place-items: center;
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--bg);
  background: var(--ink);
  box-shadow: none;
}

.progress {
  margin: 0.75rem 0 0;
  font-size: 0.925rem;
  color: var(--ink-2);
}

.verdict {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
  font-weight: 600;
}

p.verdict {
  padding: 0.9rem 1.1rem;
  color: var(--bad-ink);
  background: color-mix(in srgb, var(--red) 9%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--red) 30%, transparent);
  border-radius: 14px;
  font-weight: 500;
}

.dot {
  flex: none;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
}

.ok .dot { background: var(--green); box-shadow: 0 0 0 4px color-mix(in srgb, var(--green) 20%, transparent); }
.bad .dot { background: var(--red); box-shadow: 0 0 0 4px color-mix(in srgb, var(--red) 20%, transparent); }

.owner {
  margin: 1.1rem 0 1.25rem;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  border-left: 5px solid var(--op);
  background: color-mix(in srgb, var(--op) 9%, var(--surface));
  border-radius: 4px 12px 12px 4px;
}

.owner strong {
  font-size: 1.6rem;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.owner span {
  font-size: 0.875rem;
  color: var(--ink-2);
}

.formats {
  margin: 0;
}

.formats div {
  display: grid;
  grid-template-columns: 7.5rem 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0;
  border-top: 1px solid var(--line);
}

dt {
  font-size: 0.875rem;
  color: var(--ink-2);
}

dd {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.links {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.reference {
  padding: 0;
  overflow: hidden;
}

.reference summary {
  padding: 1rem 1.25rem;
  font-weight: 700;
  cursor: pointer;
  list-style: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.reference summary::-webkit-details-marker {
  display: none;
}

/* A plus that turns into a minus when open */
.reference summary::after {
  content: '+';
  font-size: 1.3rem;
  font-weight: 400;
  color: var(--ink-3);
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.reference[open] summary::after {
  transform: rotate(45deg);
}

.reference[open] summary {
  border-bottom: 1px solid var(--line);
}

.reference .ops,
.reference .note {
  margin-left: 1.25rem;
  margin-right: 1.25rem;
}

.reference .note {
  margin-bottom: 1.25rem;
}

h2 {
  font-size: 1.25rem;
  letter-spacing: -0.015em;
}

.ops {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ops li {
  display: grid;
  grid-template-columns: 6.5rem 1fr;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.7rem 0.9rem;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-left: 5px solid var(--op);
  border-radius: 4px 12px 12px 4px;
}

.prefixes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.6rem;
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
}

.note {
  margin: 1rem 0 0;
  font-size: 0.875rem;
  color: var(--ink-3);
}

/* ---------- Contacts ---------- */
.import {
  padding: 1.25rem;
}

.sources {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.source {
  flex: 1 1 12rem;
  justify-content: center;
}

.google {
  gap: 0.6rem;
  color: var(--ink);
  background: var(--surface);
  box-shadow: 0 0 0 1px var(--line), 0 1px 2px rgb(var(--shadow) / 0.12);
}

.google:hover:not(:disabled) {
  background: var(--surface-2);
}

.google svg {
  width: 1.15rem;
  height: 1.15rem;
}

.how {
  margin: 0.9rem 0 0;
  font-size: 0.875rem;
  color: var(--ink-2);
  text-wrap: pretty;
}

.how a {
  color: inherit;
}

.private {
  margin: 0.9rem 0 0;
  padding-top: 0.75rem;
  font-size: 0.8rem;
  color: var(--ink-3);
  border-top: 1px solid var(--line);
}

.book {
  padding: 1rem 1rem 0.5rem;
}

.book-source {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  color: var(--ink-2);
}

.nets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.net {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2rem;
  padding: 0.25rem 0.7rem;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s, scale 0.15s;
}

.net:active {
  scale: 0.96;
}

.net b {
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
}

.net.on {
  color: var(--bg);
  background: var(--ink);
  border-color: var(--ink);
}

.net.on b {
  color: inherit;
  opacity: 0.7;
}

.net.invalid:not(.on) {
  color: var(--bad-ink);
}

.net-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: var(--op);
}

.search {
  width: 100%;
  margin-top: 0.75rem;
}

.people {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
}

.people li + li {
  border-top: 1px solid var(--line);
}

.person {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.4rem;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.person:hover {
  background: var(--surface-2);
}

.avatar {
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--ink);
  background: color-mix(in srgb, var(--op) 18%, var(--surface));
  border: 2px solid var(--op);
  border-radius: 50%;
}

.who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.who-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.who-number {
  font-size: 0.875rem;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.net-tag {
  flex: none;
  padding: 0.15rem 0.55rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--ink);
  background: color-mix(in srgb, var(--op) 14%, var(--surface));
  border-left: 3px solid var(--op);
  border-radius: 3px 999px 999px 3px;
}

.net-tag.bad {
  --op: var(--red);
  color: var(--bad-ink);
}

.none {
  margin: 0.75rem 0;
  color: var(--ink-3);
  text-align: center;
}

.more {
  margin: 0.5rem 0 0.5rem 0.4rem;
}

@keyframes settle {
  from { opacity: 0; transform: translateY(4px); }
}

@media (max-width: 900px) {
  .workspace { grid-template-columns: 1fr; }
}

@media (max-width: 480px) {
  .formats div { grid-template-columns: 1fr auto; }
  dt { grid-column: 1 / -1; margin-bottom: -0.5rem; }
  .ops li { grid-template-columns: 1fr; gap: 0.25rem; }
}

@media (prefers-reduced-motion: reduce) {
  .result { animation: none; }
}
</style>
