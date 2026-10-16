<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { CvContent } from '~/data/cv'
import type { CvField } from '~/components/CvEditor.vue'
import type { CvIconName } from '~/components/CvIcon.vue'

// Ousa's CV as a landing page: a gradient hero with floating cards, then one centred section after
// another, each with a pill label and a heading with one word in the accent colour. The words come
// from Firestore's public/cv (useCvContent), starting from data/cv.ts; the owner edits them in place.
const { content: cv, isOwner, saving, load, watchOwner, save, reset } = useCvContent()
await load()
watchOwner()

const mailto = (subject: string) => `mailto:${cv.value.profile.email}?subject=${encodeURIComponent(subject)}`
const tel = computed(() => `tel:${cv.value.profile.phone.replace(/\s/g, '')}`)
const host = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '')
const initials = (name: string) => name.split(/\s+/).map(w => w[0]).join('').slice(0, 2)
// The five numbers by position: years, projects, clients, countries, on-time delivery
const stat = (i: number) => cv.value.stats[i]?.value ?? ''

// Next opening is always next month, counted in Phnom Penh time so the server and the browser agree
function monthAfterThis() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: 'numeric' }).formatToParts(new Date())
  const year = Number(parts.find(p => p.type === 'year')!.value)
  const month = Number(parts.find(p => p.type === 'month')!.value) // 1–12, so it's already next month's index
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
const nextOpening = useState('cv-next-opening', monthAfterThis)
const thisYear = useState('cv-year', () => new Date().getFullYear())

const { play } = useSound()
// The browser's print dialog saves a PDF; the print styles below leave out the app around the CV
function saveAsPdf() {
  play('open')
  window.print()
}

// The email pill copies the address; the button beside it writes an email
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function copyEmail() {
  try {
    await navigator.clipboard.writeText(cv.value.profile.email)
    copied.value = true
    play('select')
    toast.success('Email address copied', { description: cv.value.profile.email })
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = false), 1800)
  } catch {
    window.location.href = `mailto:${cv.value.profile.email}`
  }
}

// ---------- Nav ----------
// The page's own bar: sections to jump to, with a highlight that slides to the one you're reading
const NAV = [
  { id: 'about', label: 'About' },
  { id: 'services', label: 'Services' },
  { id: 'work', label: 'Work' },
  { id: 'experience', label: 'Experience' },
  { id: 'skills', label: 'Skills' },
  { id: 'contact', label: 'Contact' }
]
const activeId = ref<string>()
const scrolled = ref(false)
const menuOpen = ref(false)
const linksEl = ref<HTMLElement>()
const marker = reactive({ x: 0, w: 0, on: false })

function placeMarker() {
  const link = linksEl.value?.querySelector<HTMLElement>(`[data-id="${activeId.value}"]`)
  marker.on = !!link
  if (link) {
    marker.x = link.offsetLeft
    marker.w = link.offsetWidth
  }
}
watch(activeId, () => nextTick(placeMarker))

function go(id: string) {
  menuOpen.value = false
  activeId.value = id
}

let spy: IntersectionObserver | undefined
const onScroll = () => (scrolled.value = window.scrollY > 24)
onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', placeMarker, { passive: true })
  // A section counts as the one you're reading while it crosses a band just above the middle
  spy = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) activeId.value = e.target.id
  }, { rootMargin: '-35% 0px -60% 0px' })
  NAV.forEach(n => document.getElementById(n.id) && spy!.observe(document.getElementById(n.id)!))
})
onBeforeUnmount(() => {
  spy?.disconnect()
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', placeMarker)
})

// Services: tabs pick a card, and the row slides to put it in the middle
const service = ref(1)
function pickService(i: number) {
  if (i === service.value) return
  service.value = i
  play('select')
}

// Skills: one group at a time
const skillGroup = ref(0)
function pickSkills(i: number) {
  if (i === skillGroup.value) return
  skillGroup.value = i
  play('select')
}

// ---------- Editing (owner only) ----------
// Signed in as the owner, Edit shows tools on every part of the page. Each save goes live at once,
// with Undo; the built-in content in data/cv.ts can be brought back with Reset.
const editing = ref(false)
const confirmingReset = ref(false)
// Text on the page turns editable in place (CvText)
provide('cv-editing', editing)

type Item = Record<string, unknown>
type ListKey = 'services' | 'work' | 'jobs' | 'education' | 'skills' | 'testimonials' | 'articles'

const F = {
  profile: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'headline', label: 'Headline', type: 'textarea', hint: 'The big line in the hero; your photo and first name follow it.' },
    { key: 'role', label: 'Role', type: 'text' },
    { key: 'tagline', label: 'Tagline', type: 'textarea' },
    { key: 'availability', label: 'Availability', type: 'text', hint: '“next opening” and the coming month are added after it.' },
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'timezone', label: 'Timezone', type: 'text' },
    { key: 'email', label: 'Email', type: 'text', required: true },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'handle', label: 'Handle', type: 'text' },
    { key: 'focus', label: 'Focus areas', type: 'lines', item: 'focus area', placeholder: 'Project Management' }
  ],
  stats: [
    { key: 'stats', label: 'Numbers', type: 'pairs', pair: ['value', 'label'], pairLabels: ['8+', 'Years experience'], item: 'number', hint: 'The hero cards use the first five, in this order: years, projects, clients, countries, on-time delivery.' }
  ],
  clients: [{ key: 'clients', label: 'Clients', type: 'lines', item: 'client', placeholder: 'Client name' }],
  about: [
    { key: 'about', label: 'About me', type: 'paragraphs', item: 'paragraph', placeholder: 'A paragraph about you' },
    { key: 'name', label: 'Currently building', type: 'text' },
    { key: 'stack', label: 'Built with', type: 'text' },
    { key: 'links', label: 'Links', type: 'lines', item: 'link', placeholder: 'https://' }
  ],
  certified: [{ key: 'certified', label: 'Certified with', type: 'lines', item: 'certification', placeholder: 'PMP®' }],
  toolbox: [
    { key: 'toolbox', label: 'Tools & platforms', type: 'lines', item: 'tool', placeholder: 'Jira' },
    { key: 'languages', label: 'Languages', type: 'pairs', pair: ['name', 'level'], pairLabels: ['Language', 'Level'], item: 'language' }
  ]
} satisfies Record<string, CvField[]>

const LISTS: Record<ListKey, { noun: string, icon: CvIconName, fields: CvField[], blank: () => Item }> = {
  services: {
    noun: 'service',
    icon: 'sparkle',
    fields: [
      { key: 'icon', label: 'Icon', type: 'icon' },
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'text', label: 'Description', type: 'textarea' }
    ],
    blank: () => ({ icon: 'monitor', title: '', text: '' })
  },
  work: {
    noun: 'project',
    icon: 'star',
    fields: [
      { key: 'title', label: 'Project', type: 'text', required: true },
      { key: 'tags', label: 'Tags', type: 'text', placeholder: 'Web Design · Development' },
      { key: 'text', label: 'Description', type: 'textarea' },
      { key: 'url', label: 'Link (optional)', type: 'url', placeholder: 'https://' },
      { key: 'facts', label: 'Facts', type: 'pairs', pair: ['value', 'label'], pairLabels: ['Fast', 'Load times'], item: 'fact', hint: 'Up to three look best.' }
    ],
    blank: () => ({ title: '', tags: 'Web Design · Development', text: '', url: '', facts: [] })
  },
  jobs: {
    noun: 'job',
    icon: 'briefcase',
    fields: [
      { key: 'role', label: 'Role', type: 'text', required: true },
      { key: 'org', label: 'Company', type: 'text', required: true },
      { key: 'years', label: 'Years', type: 'text', placeholder: '2024 – Present' },
      { key: 'points', label: 'What you did', type: 'lines', item: 'point', placeholder: 'Led the rollout of…' }
    ],
    blank: () => ({ role: '', org: '', years: '', points: [] })
  },
  education: {
    noun: 'qualification',
    icon: 'cap',
    fields: [
      { key: 'title', label: 'Qualification', type: 'text', required: true },
      { key: 'org', label: 'Where', type: 'text' },
      { key: 'years', label: 'When', type: 'text' }
    ],
    blank: () => ({ title: '', org: '', years: '' })
  },
  skills: {
    noun: 'skill group',
    icon: 'palette',
    fields: [
      { key: 'icon', label: 'Icon', type: 'icon' },
      { key: 'name', label: 'Group', type: 'text', required: true },
      { key: 'items', label: 'Skills', type: 'pairs', pair: ['name', 'level'], numeric: true, pairLabels: ['Skill', 'Level'], item: 'skill' }
    ],
    blank: () => ({ icon: 'palette', name: '', items: [] })
  },
  testimonials: {
    noun: 'testimonial',
    icon: 'quote',
    fields: [
      { key: 'quote', label: 'Quote', type: 'textarea', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'role', label: 'Role · Company', type: 'text' }
    ],
    blank: () => ({ quote: '', name: '', role: '' })
  },
  articles: {
    noun: 'article',
    icon: 'pen',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'kind', label: 'Kind', type: 'text', placeholder: 'Case study' },
      { key: 'minutes', label: 'Minutes to read', type: 'number' },
      { key: 'text', label: 'Summary', type: 'textarea' },
      { key: 'url', label: 'Link (optional)', type: 'url', placeholder: 'https://' }
    ],
    blank: () => ({ title: '', kind: '', minutes: 5, text: '', url: '' })
  }
}

const editor = reactive({
  open: false,
  title: '',
  fields: [] as CvField[],
  value: null as Item | null,
  icon: 'edit' as CvIconName,
  deletable: false,
  onSave: (_: Item) => {},
  onDelete: () => {}
})

function openEditor(o: { title: string, icon: CvIconName, fields: CvField[], value: Item, onSave: (v: Item) => void, onDelete?: () => void }) {
  // A plain copy: the value can wrap live (reactive) content, which structuredClone can't copy
  Object.assign(editor, { deletable: !!o.onDelete, onDelete: () => {}, ...o, value: JSON.parse(JSON.stringify(o.value)) as Item, open: true })
  play('open')
}

async function editorSave(v: Item) {
  await editor.onSave(v)
  editor.open = false
}

// The parts edited as a whole
function editProfile() {
  openEditor({ title: 'Edit profile', icon: 'users', fields: F.profile, value: cv.value.profile, onSave: v => save(d => (d.profile = { ...d.profile, ...v } as CvContent['profile']), 'Profile saved') })
}
function editStats() {
  openEditor({ title: 'Edit numbers', icon: 'bolt', fields: F.stats, value: { stats: cv.value.stats }, onSave: v => save(d => (d.stats = v.stats as CvContent['stats']), 'Numbers saved') })
}
function editClients() {
  openEditor({ title: 'Edit clients', icon: 'star', fields: F.clients, value: { clients: cv.value.clients }, onSave: v => save(d => (d.clients = v.clients as string[]), 'Clients saved') })
}
function editAbout() {
  const b = cv.value.building
  openEditor({
    title: 'Edit about',
    icon: 'wave',
    fields: F.about,
    value: { about: cv.value.about, name: b.name, stack: b.stack, links: b.links },
    onSave: v => save((d) => {
      d.about = v.about as string[]
      d.building = { name: v.name as string, stack: v.stack as string, links: v.links as string[] }
    }, 'About saved')
  })
}
function editCertified() {
  openEditor({ title: 'Edit certifications', icon: 'cap', fields: F.certified, value: { certified: cv.value.certified }, onSave: v => save(d => (d.certified = v.certified as string[]), 'Certifications saved') })
}
function editToolbox() {
  openEditor({
    title: 'Edit tools & languages',
    icon: 'code',
    fields: F.toolbox,
    value: { toolbox: cv.value.toolbox, languages: cv.value.languages },
    onSave: v => save((d) => {
      d.toolbox = v.toolbox as string[]
      d.languages = v.languages as CvContent['languages']
    }, 'Tools & languages saved')
  })
}

// Items in a list: edit, add, move, delete
const listOf = (d: CvContent, key: ListKey) => d[key] as unknown as Item[]
const Noun = (key: ListKey) => LISTS[key].noun[0]!.toUpperCase() + LISTS[key].noun.slice(1)

function editItem(key: ListKey, i: number) {
  const l = LISTS[key]
  openEditor({
    title: `Edit ${l.noun}`,
    icon: l.icon,
    fields: l.fields,
    value: listOf(cv.value, key)[i]!,
    onSave: v => save(d => (listOf(d, key)[i] = v), `${Noun(key)} saved`),
    onDelete: () => removeItem(key, i)
  })
}

function addItem(key: ListKey) {
  const l = LISTS[key]
  openEditor({
    title: `Add ${l.noun}`,
    icon: l.icon,
    fields: l.fields,
    value: l.blank(),
    onSave: v => save((d) => {
      listOf(d, key).push(v)
      if (key === 'skills') skillGroup.value = d.skills.length - 1
      if (key === 'services') service.value = d.services.length - 1
    }, `${Noun(key)} added`)
  })
}

async function removeItem(key: ListKey, i: number) {
  editor.open = false
  await save(d => listOf(d, key).splice(i, 1), `${Noun(key)} deleted`)
  skillGroup.value = Math.min(skillGroup.value, Math.max(0, cv.value.skills.length - 1))
  service.value = Math.min(service.value, Math.max(0, cv.value.services.length - 1))
}

function moveItem(key: ListKey, i: number, by: -1 | 1) {
  const j = i + by
  if (j < 0 || j >= listOf(cv.value, key).length) return
  save((d) => {
    const list = listOf(d, key)
    ;[list[i], list[j]] = [list[j]!, list[i]!]
  }, 'Order changed')
  if (key === 'services' && service.value === i) service.value = j
  if (key === 'skills' && skillGroup.value === i) skillGroup.value = j
}

async function resetAll() {
  if (!confirmingReset.value) {
    confirmingReset.value = true
    setTimeout(() => (confirmingReset.value = false), 4000)
    return
  }
  confirmingReset.value = false
  await reset()
}

// Not signed in as the owner: a quiet way in from the footer
const signingIn = ref(false)
async function ownerSignIn() {
  signingIn.value = true
  try {
    await useVault().signIn()
  } catch (e) {
    toast.error('Couldn’t sign in', { description: (e as Error).message })
  } finally {
    signingIn.value = false
  }
}
watch(isOwner, (owner) => {
  if (!owner) editing.value = false
})

// ---------- Motion ----------
// The page is server-rendered fully visible; motion is layered on after mount, and only where it
// won't flash: things already on screen keep the CSS entrance, things further down wait out of sight
// and rise in as they're scrolled to. Reduced motion (system or Settings) and lite effects skip it.
const cvEl = ref<HTMLElement>()
const still = () => {
  const root = document.documentElement
  return root.dataset.motion === 'reduced' || root.dataset.effects === 'lite' || matchMedia('(prefers-reduced-motion: reduce)').matches
}

// The hero's numbers count up from zero as the page opens: "50+" runs 0 → 50 and keeps its "+"
const counted = ref<string[]>(cv.value.stats.map(s => s.value))
const shown = (i: number) => counted.value[i] ?? stat(i)
// Edited numbers show as they are
watch(() => cv.value.stats, s => (counted.value = s.map(x => x.value)), { deep: true })
function countUp() {
  const STATS = cv.value.stats
  const parts = STATS.map(s => s.value.match(/^(\d+)(.*)$/))
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min((now - start) / 1400, 1)
    const eased = 1 - Math.pow(1 - t, 3)
    counted.value = STATS.map((s, i) => (parts[i] ? `${Math.round(Number(parts[i]![1]) * eased)}${parts[i]![2]}` : s.value))
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

let observer: IntersectionObserver | undefined
onMounted(() => {
  const root = cvEl.value
  if (!root || still() || !('IntersectionObserver' in window)) return
  countUp()
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      observer?.unobserve(e.target)
      e.target.classList.remove('pending')
      // Once in, cards drop the reveal's delay so hover and tilt answer at once
      setTimeout(() => e.target.classList.add('settled'), 1100)
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 })
  for (const el of root.querySelectorAll<HTMLElement>('[data-reveal]')) {
    if (el.getBoundingClientRect().top > window.innerHeight) {
      el.classList.add('pending')
      observer.observe(el)
    } else {
      el.classList.add('settled')
    }
  }
})
onBeforeUnmount(() => observer?.disconnect())

// ---------- Mouse ----------
// With a mouse (not touch, and not with motion turned down): cards tilt towards the pointer with a
// spotlight under it, buttons lean towards it, the hero's cards drift in layers, and a ring follows
// the pointer, growing over anything you can click.
let calm = true
let tilted: HTMLElement | null = null
let pulled: HTMLElement | null = null

function release(el: HTMLElement | null, ...props: string[]) {
  props.forEach(p => el?.style.removeProperty(p))
}

function onPointer(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || calm) return
  // Editing: the ring still follows, but nothing tilts or leans away from where you're typing
  if (editing.value) return moveRing(e, e.target as HTMLElement)
  const target = e.target as HTMLElement

  // Tilt and spotlight
  const card = target.closest<HTMLElement>('.glow')
  if (card !== tilted) {
    release(tilted, '--rx', '--ry')
    tilted = card
  }
  if (card) {
    const box = card.getBoundingClientRect()
    const x = (e.clientX - box.left) / box.width
    const y = (e.clientY - box.top) / box.height
    card.style.setProperty('--mx', `${e.clientX - box.left}px`)
    card.style.setProperty('--my', `${e.clientY - box.top}px`)
    card.style.setProperty('--rx', `${((0.5 - y) * 7).toFixed(2)}deg`)
    card.style.setProperty('--ry', `${((x - 0.5) * 7).toFixed(2)}deg`)
  }

  // Magnetic buttons lean a little way towards the pointer
  const magnet = target.closest<HTMLElement>('.magnetic')
  if (magnet !== pulled) {
    release(pulled, '--gx', '--gy')
    pulled = magnet
  }
  if (magnet) {
    const box = magnet.getBoundingClientRect()
    magnet.style.setProperty('--gx', `${((e.clientX - box.left - box.width / 2) * 0.25).toFixed(1)}px`)
    magnet.style.setProperty('--gy', `${((e.clientY - box.top - box.height / 2) * 0.35).toFixed(1)}px`)
  }

  moveRing(e, target)
}

function onLeave() {
  release(tilted, '--rx', '--ry')
  release(pulled, '--gx', '--gy')
  tilted = pulled = null
  ringOn.value = false
}

// The hero: its cards and light drift with the pointer, nearer layers further
function onHero(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || calm || editing.value) return
  const hero = e.currentTarget as HTMLElement
  const box = hero.getBoundingClientRect()
  hero.style.setProperty('--px', (((e.clientX - box.left) / box.width - 0.5) * 2).toFixed(3))
  hero.style.setProperty('--py', (((e.clientY - box.top) / box.height - 0.5) * 2).toFixed(3))
  hero.style.setProperty('--hx', `${e.clientX - box.left}px`)
  hero.style.setProperty('--hy', `${e.clientY - box.top}px`)
}

function resetHero(e: PointerEvent) {
  release(e.currentTarget as HTMLElement, '--px', '--py')
}

// The ring trails the pointer a little, eased each frame, and rests when it catches up
const ringEl = ref<HTMLElement>()
const ringOn = ref(false)
const ringBig = ref(false)
let goal = { x: 0, y: 0 }
let at = { x: 0, y: 0 }
let ringFrame = 0

function moveRing(e: PointerEvent, target: HTMLElement) {
  goal = { x: e.clientX, y: e.clientY }
  if (!ringOn.value) at = { ...goal }
  ringOn.value = true
  ringBig.value = !!target.closest('a, button, [role="tab"], .glow, .service')
  if (!ringFrame) ringFrame = requestAnimationFrame(stepRing)
}

function stepRing() {
  at.x += (goal.x - at.x) * 0.22
  at.y += (goal.y - at.y) * 0.22
  if (ringEl.value) ringEl.value.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`
  ringFrame = Math.abs(goal.x - at.x) + Math.abs(goal.y - at.y) > 0.2 ? requestAnimationFrame(stepRing) : 0
}

onMounted(() => {
  calm = still() || !matchMedia('(hover: hover) and (pointer: fine)').matches
})
onBeforeUnmount(() => cancelAnimationFrame(ringFrame))
</script>

<template>
  <ToolPage header="none" :site-bar="false" width="100%">
    <div ref="cvEl" class="cv" :class="{ editing }" @pointermove="onPointer" @pointerleave="onLeave">
      <!-- How far down the page you are -->
      <span class="progress" aria-hidden="true" />
      <!-- ========== The page's own nav ========== -->
      <nav class="cv-nav" :class="{ scrolled, open: menuOpen }" aria-label="CV sections">
        <a href="#top" class="nav-brand" @click="go('')">
          <img :src="cv.profile.photo" alt="" width="480" height="480">
          <span>{{ cv.profile.name }}</span>
        </a>
        <ul ref="linksEl" class="nav-links">
          <span class="nav-marker" :class="{ on: marker.on }" :style="{ '--x': `${marker.x}px`, '--w': `${marker.w}px` }" aria-hidden="true" />
          <li v-for="n in NAV" :key="n.id">
            <a :href="`#${n.id}`" :data-id="n.id" :class="{ active: activeId === n.id }" :aria-current="activeId === n.id ? 'location' : undefined" @click="go(n.id)">{{ n.label }}</a>
          </li>
        </ul>
        <div class="nav-end">
          <NuxtLink to="/" class="nav-apps" title="Back to all of Ousa’s Apps">
            <AppLogo class="nav-apps-logo" /><span>Apps</span>
          </NuxtLink>
          <button v-if="isOwner" type="button" class="nav-edit" :class="{ on: editing }" :aria-pressed="editing" @click="editing = !editing">
            <CvIcon :name="editing ? 'check' : 'edit'" />{{ editing ? 'Done' : 'Edit' }}
          </button>
          <a :href="mailto('Project enquiry')" class="nav-hire magnetic">
            <span class="live" aria-hidden="true" />Hire me
          </a>
          <button type="button" class="nav-toggle" :aria-expanded="menuOpen" aria-controls="cv-nav-sheet" :aria-label="menuOpen ? 'Close menu' : 'Open menu'" @click="menuOpen = !menuOpen">
            <span /><span />
          </button>
        </div>
        <Transition name="nav-drop">
          <div v-if="menuOpen" id="cv-nav-sheet" class="nav-sheet">
            <a v-for="n in NAV" :key="n.id" :href="`#${n.id}`" :class="{ active: activeId === n.id }" @click="go(n.id)">{{ n.label }}<CvIcon name="arrow-right" /></a>
            <button type="button" class="nav-sheet-pdf" @click="menuOpen = false; saveAsPdf()">Save as PDF<CvIcon name="download" /></button>
          </div>
        </Transition>
      </nav>

      <!-- The ring that follows a mouse pointer -->
      <span ref="ringEl" class="ring" :class="{ on: ringOn, big: ringBig }" aria-hidden="true" />

      <!-- ========== Editing: a bar along the bottom while the owner edits ========== -->
      <Transition name="edit-bar">
        <div v-if="editing" class="edit-bar" role="region" aria-label="Editing your CV">
          <span class="edit-bar-dot" :class="{ busy: saving }" aria-hidden="true" />
          <span class="edit-bar-text"><strong>{{ saving ? 'Saving…' : 'Editing your CV' }}</strong><span>Each change goes live when you save it.</span></span>
          <button type="button" class="edit-bar-btn quiet" :class="{ confirm: confirmingReset }" @click="resetAll">
            <CvIcon name="reset" />{{ confirmingReset ? 'Click again to reset' : 'Reset to original' }}
          </button>
          <button type="button" class="edit-bar-btn" @click="editing = false"><CvIcon name="check" />Done</button>
        </div>
      </Transition>
      <CvEditor
        :open="editor.open"
        :title="editor.title"
        :fields="editor.fields"
        :value="editor.value"
        :icon="editor.icon"
        :deletable="editor.deletable"
        :saving="saving"
        @close="editor.open = false"
        @save="editorSave"
        @delete="editor.onDelete()"
      />
      <!-- ========== Hero: the gradient panel with floating cards along its foot ========== -->
      <section id="top" class="hero" aria-labelledby="cv-title" @pointermove="onHero" @pointerleave="resetHero">
        <span class="hero-spot" aria-hidden="true" />
        <span class="hero-rays" aria-hidden="true" />
        <div v-if="editing" class="edit-row on-dark hero-edit">
          <button type="button" class="edit-chip" @click="editProfile"><CvIcon name="edit" />Edit profile</button>
          <button type="button" class="edit-chip" @click="editStats"><CvIcon name="edit" />Edit numbers</button>
        </div>
        <p class="pill on-dark rise" style="--d: 0">
          <span class="live" aria-hidden="true" /><CvText path="profile.availability" placeholder="Availability" /> · next opening {{ nextOpening }}
        </p>
        <h1 id="cv-title" class="hero-title rise" style="--d: 1">
          <CvText path="profile.headline" placeholder="Headline" />
          <span class="hero-me"><img :src="cv.profile.photo" alt="" width="480" height="480"><span class="hero-me-name">{{ cv.profile.name.split(' ')[0] }}</span></span>
        </h1>
        <p class="hero-sub rise" style="--d: 2"><CvText path="profile.role" placeholder="Role" /> · <CvText path="profile.location" placeholder="Location" /></p>

        <!-- Like a sign-up box: my address, and a button that writes to it -->
        <div class="hero-cta rise" style="--d: 3">
          <button type="button" class="hero-email" :class="{ copied }" :aria-label="`Copy ${cv.profile.email}`" @click="copyEmail">
            <span class="hero-email-text">{{ cv.profile.email }}</span>
            <span class="copy-icon" aria-hidden="true">
              <svg v-if="copied" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              <svg v-else viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2.5" /><path d="M5 15V7a2 2 0 0 1 2-2h8" /></svg>
            </span>
          </button>
          <a :href="mailto('Project enquiry')" class="hero-btn magnetic">
            <span class="hero-btn-dot" aria-hidden="true"><CvIcon name="arrow-right" /></span>
            Get in touch
          </a>
        </div>
        <div class="hero-links rise" style="--d: 4">
          <a href="#work">View my work</a>
          <span aria-hidden="true">·</span>
          <button type="button" @click="saveAsPdf">Save as PDF</button>
        </div>

        <div class="hero-cards" aria-label="At a glance">
          <!-- Left: experience -->
          <div class="float-card side left">
            <div class="fc-row">
              <span class="fc-icon" aria-hidden="true"><CvIcon name="bolt" /></span>
              <span class="fc-strong"><CvText path="stats.1.value" :display="shown(1)" placeholder="50+" /> projects</span>
              <span class="fc-tag good">Delivered</span>
            </div>
            <div class="fc-panel">
              <span class="fc-label">Experience</span>
              <span class="fc-big"><CvText path="stats.0.value" :display="shown(0)" placeholder="8+" /> <small>years</small></span>
              <span class="fc-foot"><span class="fc-meta"><CvIcon name="users" /><CvText path="stats.2.value" :display="shown(2)" placeholder="30+" /> clients</span><span class="fc-meta"><CvIcon name="globe" /><CvText path="stats.3.value" :display="shown(3)" placeholder="12+" /> countries</span></span>
            </div>
          </div>

          <!-- Middle: me -->
          <div class="float-card middle rise" style="--d: 4">
            <div class="fc-head">
              <img :src="cv.profile.photo" :alt="cv.profile.name" width="480" height="480" class="fc-avatar" fetchpriority="high">
              <span>
                <span class="fc-label">Profile</span>
                <CvText tag="strong" path="profile.name" placeholder="Name" />
              </span>
            </div>
            <CvText tag="p" class="fc-role" path="profile.tagline" placeholder="Tagline" />
            <ul class="fc-focus">
              <CvText v-for="(f, k) in cv.profile.focus" :key="k" tag="li" :path="`profile.focus.${k}`" placeholder="Focus" />
            </ul>
          </div>

          <!-- Right: delivery -->
          <div class="float-card side right">
            <div class="fc-row person">
              <span class="fc-mini-avatar" aria-hidden="true"><img :src="cv.profile.photo" alt="" width="480" height="480"></span>
              <span><span class="fc-label">Project lead</span><span class="fc-strong">{{ cv.profile.name }}</span></span>
            </div>
            <div class="fc-panel">
              <span class="fc-label">On-time delivery</span>
              <CvText tag="span" class="fc-big" path="stats.4.value" :display="shown(4)" placeholder="95%" />
              <span class="fc-foot"><span>Since 2017</span><span class="fc-tag good">On track</span></span>
            </div>
          </div>
        </div>
      </section>

      <!-- ========== Trusted by ========== -->
      <section class="section trusted" aria-labelledby="cv-clients">
        <h2 id="cv-clients" class="title small" data-reveal>Trusted by more than <em>{{ stat(2) }}</em> clients</h2>
        <div v-if="editing" class="edit-row"><button type="button" class="edit-chip" @click="editClients"><CvIcon name="edit" />Edit clients</button></div>
        <!-- Two copies end to end scroll past forever; the second is only there for the loop -->
        <div class="marquee" data-reveal>
          <ul class="logos">
            <li v-for="(c, k) in cv.clients" :key="k" class="logo-pill"><span class="logo-dot" aria-hidden="true">{{ c[0] }}</span><CvText :path="`clients.${k}`" placeholder="Client" /></li>
          </ul>
          <ul class="logos copy" aria-hidden="true">
            <li v-for="c in cv.clients" :key="c" class="logo-pill"><span class="logo-dot">{{ c[0] }}</span>{{ c }}</li>
          </ul>
        </div>
      </section>

      <!-- ========== About ========== -->
      <section id="about" class="section lined" aria-labelledby="cv-about">
        <p class="pill" data-reveal><span class="pill-icon" aria-hidden="true"><CvIcon name="wave" /></span>About me</p>
        <h2 id="cv-about" class="title" data-reveal>Hello again. I lead products from <em>discovery</em> to delivery</h2>
        <div v-if="editing" class="edit-row"><button type="button" class="edit-chip" @click="editAbout"><CvIcon name="edit" />Edit about</button></div>
        <div class="about">
          <div class="about-text" data-reveal>
            <CvText v-for="(p, k) in cv.about" :key="k" tag="p" :path="`about.${k}`" placeholder="Paragraph" />
          </div>
          <aside class="glass building glow" data-reveal style="--i: 1">
            <p class="fc-label">Currently building</p>
            <p class="building-name"><span class="fc-icon" aria-hidden="true"><CvIcon name="bolt" /></span><CvText path="building.name" placeholder="Project" /></p>
            <CvText tag="p" class="muted" path="building.stack" placeholder="Built with" />
            <a v-for="l in cv.building.links" :key="l" :href="l" target="_blank" rel="noopener" class="link-row">
              {{ host(l) }}<CvIcon name="arrow-up-right" class="link-arrow" /><span class="sr-only"> (opens in a new tab)</span>
            </a>
          </aside>
        </div>
      </section>

      <!-- ========== Services: tabs and a sliding row of cards ========== -->
      <section id="services" class="section lined" aria-labelledby="cv-services">
        <p class="pill" data-reveal><span class="pill-icon" aria-hidden="true"><CvIcon name="sparkle" /></span>What I do</p>
        <h2 id="cv-services" class="title" data-reveal>Projects delivered with clarity and a <em>personal touch</em></h2>
        <p class="lede" data-reveal>Need a digital project steered from idea to launch? I keep teams aligned, scope tight and stakeholders informed. Let’s chat.</p>

        <div v-if="editing" class="edit-row">
          <button type="button" class="edit-chip" @click="addItem('services')"><CvIcon name="plus" />Add service</button>
        </div>
        <div class="tabs" role="tablist" aria-label="Services" data-reveal>
          <button
            v-for="(s, i) in cv.services"
            :key="i"
            type="button"
            role="tab"
            :aria-selected="service === i"
            :class="{ active: service === i }"
            @click="pickService(i)"
          >
            <CvIcon :name="s.icon" />{{ s.title }}
          </button>
        </div>

        <div class="carousel" data-reveal>
          <ul class="carousel-track" :style="{ '--active': service }">
            <li
              v-for="(s, i) in cv.services"
              :key="i"
              class="service"
              :class="{ active: service === i }"
              @click="pickService(i)"
            >
              <CvTools v-if="editing && service === i" :label="s.title || 'service'" :first="i === 0" :last="i === cv.services.length - 1" @edit="editItem('services', i)" @earlier="moveItem('services', i, -1)" @later="moveItem('services', i, 1)" @remove="removeItem('services', i)" />
              <span class="service-icon" aria-hidden="true"><CvIcon :name="s.icon" /></span>
              <template v-if="service === i">
                <CvText tag="h3" :path="`services.${i}.title`" placeholder="Service" />
                <CvText tag="p" :path="`services.${i}.text`" placeholder="Description" />
              </template>
              <template v-else>
                <h3>{{ s.title }}</h3>
                <p>{{ s.text }}</p>
              </template>
              <span class="service-foot">
                <span class="fc-meta"><CvIcon name="check" />{{ stat(1) }} projects</span>
                <a :href="mailto(s.title)" class="service-btn magnetic" :tabindex="service === i ? 0 : -1" @click.stop>Let’s talk</a>
              </span>
            </li>
          </ul>
        </div>
      </section>

      <!-- ========== Selected work ========== -->
      <section id="work" class="section lined" aria-labelledby="cv-work">
        <p class="pill" data-reveal><span class="pill-icon" aria-hidden="true"><CvIcon name="star" /></span>Selected work</p>
        <h2 id="cv-work" class="title" data-reveal>A taste of what I <em>can do</em></h2>
        <p class="lede" data-reveal>Digital products delivered for global organisations, hotels and architects.</p>
        <ul class="work">
          <li v-for="(w, i) in cv.work" :key="i" class="glass work-card glow" :class="{ lifted: i === 1 }" data-reveal :style="{ '--i': i }">
            <CvTools v-if="editing" :label="w.title || 'project'" :first="i === 0" :last="i === cv.work.length - 1" @edit="editItem('work', i)" @earlier="moveItem('work', i, -1)" @later="moveItem('work', i, 1)" @remove="removeItem('work', i)" />
            <div class="work-head">
              <span class="work-logo" aria-hidden="true">{{ initials(w.title) }}</span>
              <span>
                <a v-if="w.url && !editing" :href="w.url" target="_blank" rel="noopener" class="work-link"><strong>{{ w.title }}</strong><CvIcon name="arrow-up-right" /><span class="sr-only"> (opens in a new tab)</span></a>
                <CvText v-else tag="strong" :path="`work.${i}.title`" placeholder="Project" />
                <CvText class="fc-label" :path="`work.${i}.tags`" placeholder="Tags" />
              </span>
              <span class="fc-tag">Featured</span>
            </div>
            <CvText tag="p" class="work-text" :path="`work.${i}.text`" placeholder="Description" />
            <dl class="work-facts">
              <div v-for="(f, k) in w.facts" :key="k">
                <CvText tag="dt" :path="`work.${i}.facts.${k}.label`" placeholder="Label" />
                <CvText tag="dd" :path="`work.${i}.facts.${k}.value`" placeholder="Value" />
              </div>
            </dl>
            <span class="work-bar"><CvIcon name="check" />Delivered end to end</span>
          </li>
          <li v-if="editing" class="add-tile">
            <button type="button" @click="addItem('work')"><CvIcon name="plus" />Add project</button>
          </li>
        </ul>
      </section>

      <!-- ========== Experience ========== -->
      <section id="experience" class="section lined" aria-labelledby="cv-experience">
        <p class="pill" data-reveal><span class="pill-icon" aria-hidden="true"><CvIcon name="briefcase" /></span>Experience</p>
        <h2 id="cv-experience" class="title" data-reveal>{{ stat(0) }} years of shipping, <em>always</em> on time</h2>
        <p class="lede" data-reveal>From mobile banking to NGO platforms and hotel websites, owning the full lifecycle from stakeholder alignment to go-live.</p>
        <ol class="timeline">
          <li v-for="(j, i) in cv.jobs" :key="i" class="glass job glow" data-reveal :style="{ '--i': Math.min(i, 3) }">
            <CvTools v-if="editing" vertical :label="j.role || 'job'" :first="i === 0" :last="i === cv.jobs.length - 1" @edit="editItem('jobs', i)" @earlier="moveItem('jobs', i, -1)" @later="moveItem('jobs', i, 1)" @remove="removeItem('jobs', i)" />
            <span class="job-logo" aria-hidden="true">{{ initials(j.org) }}</span>
            <div class="job-body">
              <div class="job-head">
                <CvText tag="h3" :path="`jobs.${i}.role`" placeholder="Role" />
                <CvText class="fc-tag" :class="{ good: j.years.includes('Present') }" :path="`jobs.${i}.years`" placeholder="Years" />
              </div>
              <p class="muted"><CvText :path="`jobs.${i}.org`" placeholder="Company" /> · Phnom Penh, Cambodia</p>
              <ul class="points">
                <CvText v-for="(p, k) in j.points" :key="k" tag="li" :path="`jobs.${i}.points.${k}`" placeholder="What you did" />
              </ul>
            </div>
          </li>
          <li v-if="editing" class="add-tile">
            <button type="button" @click="addItem('jobs')"><CvIcon name="plus" />Add job</button>
          </li>
        </ol>
      </section>

      <!-- ========== Skills: copy on the left, cards on the right ========== -->
      <section id="skills" class="section split" aria-labelledby="cv-skills">
        <div class="split-text">
          <p class="pill" data-reveal><span class="pill-icon" aria-hidden="true"><CvIcon name="palette" /></span>Skills</p>
          <h2 id="cv-skills" class="title left" data-reveal>Areas of <em>expertise</em></h2>
          <p class="lede left" data-reveal>Project management first, backed by design and technical know-how, with the tools teams already use.</p>
          <div v-if="editing" class="edit-row left"><button type="button" class="edit-chip" @click="editToolbox"><CvIcon name="edit" />Edit tools &amp; languages</button></div>
          <ul class="feature-chips" data-reveal aria-label="Tools and platforms">
            <li v-for="(t, k) in cv.toolbox" :key="k"><span class="chip-dot" aria-hidden="true" /><CvText :path="`toolbox.${k}`" placeholder="Tool" /></li>
          </ul>
          <dl class="languages" data-reveal>
            <div v-for="(l, k) in cv.languages" :key="k">
              <CvText tag="dt" :path="`languages.${k}.name`" placeholder="Language" />
              <CvText tag="dd" :path="`languages.${k}.level`" placeholder="Level" />
            </div>
          </dl>
        </div>
        <div class="split-cards" data-reveal>
          <div class="glass skills-card glow">
            <div v-if="editing" class="edit-row left skills-edit">
              <button v-if="cv.skills[skillGroup]" type="button" class="edit-chip" @click="editItem('skills', skillGroup)"><CvIcon name="edit" />Edit group</button>
              <button type="button" class="edit-chip" @click="addItem('skills')"><CvIcon name="plus" />Add group</button>
              <button v-if="cv.skills[skillGroup]" type="button" class="edit-chip" :disabled="skillGroup === 0" @click="moveItem('skills', skillGroup, -1)"><CvIcon name="arrow-left" />Move</button>
              <button v-if="cv.skills[skillGroup]" type="button" class="edit-chip" :disabled="skillGroup === cv.skills.length - 1" @click="moveItem('skills', skillGroup, 1)">Move<CvIcon name="arrow-right" /></button>
            </div>
            <div class="tabs small" role="tablist" aria-label="Skill groups">
              <button
                v-for="(g, i) in cv.skills"
                :key="i"
                type="button"
                role="tab"
                :aria-selected="skillGroup === i"
                :class="{ active: skillGroup === i }"
                @click="pickSkills(i)"
              >
                <CvIcon :name="g.icon" />{{ g.name }}
              </button>
            </div>
            <Transition name="fade-swap" mode="out-in">
              <ul :key="skillGroup" class="bars">
                <li v-for="(it, n) in cv.skills[skillGroup]?.items ?? []" :key="n" :style="{ '--n': n }">
                  <span class="bar-label"><CvText :path="`skills.${skillGroup}.items.${n}.name`" placeholder="Skill" /><span class="bar-value"><CvText numeric :path="`skills.${skillGroup}.items.${n}.level`" placeholder="0" />%</span></span>
                  <span class="bar" role="meter" :aria-valuenow="it.level" aria-valuemin="0" aria-valuemax="100" :aria-label="it.name"><i :style="{ '--w': `${it.level}%` }" /></span>
                </li>
              </ul>
            </Transition>
          </div>
          <div class="glass toast-card">
            <span class="fc-icon" aria-hidden="true"><CvIcon name="check" /></span>
            <span><strong>Google UX Design certified</strong><span class="fc-label">and Webflow Expert (95%)</span></span>
          </div>
        </div>
      </section>

      <!-- ========== Education ========== -->
      <section class="section lined" aria-labelledby="cv-education">
        <p class="pill" data-reveal><span class="pill-icon" aria-hidden="true"><CvIcon name="cap" /></span>Education</p>
        <h2 id="cv-education" class="title" data-reveal>Always <em>learning</em></h2>
        <ul class="edu">
          <li v-for="(e, i) in cv.education" :key="i" class="glass edu-card glow" data-reveal :style="{ '--i': i % 3 }">
            <CvTools v-if="editing" :label="e.title || 'qualification'" :first="i === 0" :last="i === cv.education.length - 1" @edit="editItem('education', i)" @earlier="moveItem('education', i, -1)" @later="moveItem('education', i, 1)" @remove="removeItem('education', i)" />
            <CvText class="fc-tag" :path="`education.${i}.years`" placeholder="When" />
            <CvText tag="h3" :path="`education.${i}.title`" placeholder="Qualification" />
            <CvText tag="p" class="muted" :path="`education.${i}.org`" placeholder="Where" />
          </li>
          <li v-if="editing" class="add-tile">
            <button type="button" @click="addItem('education')"><CvIcon name="plus" />Add qualification</button>
          </li>
        </ul>
        <div v-if="editing" class="edit-row"><button type="button" class="edit-chip" @click="editCertified"><CvIcon name="edit" />Edit certifications</button></div>
        <ul class="certified" data-reveal aria-label="Certified with">
          <li v-for="(c, k) in cv.certified" :key="k" class="logo-pill"><span class="logo-dot" aria-hidden="true"><CvIcon name="check" /></span><CvText :path="`certified.${k}`" placeholder="Certification" /></li>
        </ul>
      </section>

      <!-- ========== Testimonials ========== -->
      <section class="section lined" aria-labelledby="cv-testimonials">
        <p class="pill" data-reveal><span class="pill-icon" aria-hidden="true"><CvIcon name="quote" /></span>Testimonials</p>
        <h2 id="cv-testimonials" class="title" data-reveal>What <em>clients</em> say</h2>
        <ul class="quotes">
          <li v-for="(t, i) in cv.testimonials" :key="i" class="glass quote glow" data-reveal :style="{ '--i': i % 3 }">
            <CvTools v-if="editing" :label="t.name || 'testimonial'" :first="i === 0" :last="i === cv.testimonials.length - 1" @edit="editItem('testimonials', i)" @earlier="moveItem('testimonials', i, -1)" @later="moveItem('testimonials', i, 1)" @remove="removeItem('testimonials', i)" />
            <blockquote>“<CvText :path="`testimonials.${i}.quote`" placeholder="Quote" />”</blockquote>
            <p class="by">
              <span class="by-avatar" aria-hidden="true">{{ initials(t.name) }}</span>
              <span><CvText tag="strong" :path="`testimonials.${i}.name`" placeholder="Name" /><CvText class="fc-label" :path="`testimonials.${i}.role`" placeholder="Role · Company" /></span>
            </p>
          </li>
          <li v-if="editing" class="add-tile">
            <button type="button" @click="addItem('testimonials')"><CvIcon name="plus" />Add testimonial</button>
          </li>
        </ul>
      </section>

      <!-- ========== Articles ========== -->
      <section class="section lined" aria-labelledby="cv-articles">
        <p class="pill" data-reveal><span class="pill-icon" aria-hidden="true"><CvIcon name="pen" /></span>Articles</p>
        <h2 id="cv-articles" class="title" data-reveal>Lessons learned along my <em>design journey</em></h2>
        <p class="lede" data-reveal>Thoughts on UX, product management, and building digital products.</p>
        <ul class="articles">
          <li v-for="(a, i) in cv.articles" :key="i" class="glass article glow" data-reveal :style="{ '--i': i }">
            <CvTools v-if="editing" :label="a.title || 'article'" :first="i === 0" :last="i === cv.articles.length - 1" @edit="editItem('articles', i)" @earlier="moveItem('articles', i, -1)" @later="moveItem('articles', i, 1)" @remove="removeItem('articles', i)" />
            <span class="fc-tag"><CvText :path="`articles.${i}.kind`" placeholder="Kind" /> · <CvText numeric :path="`articles.${i}.minutes`" placeholder="5" /> min read</span>
            <CvText tag="h3" :path="`articles.${i}.title`" placeholder="Title" />
            <CvText tag="p" class="muted" :path="`articles.${i}.text`" placeholder="Summary" />
            <a v-if="a.url" :href="a.url" target="_blank" rel="noopener" class="read-link">Read article<CvIcon name="arrow-up-right" /><span class="sr-only"> (opens in a new tab)</span></a>
          </li>
          <li v-if="editing" class="add-tile">
            <button type="button" @click="addItem('articles')"><CvIcon name="plus" />Add article</button>
          </li>
        </ul>
      </section>

      <!-- ========== Call to action: the gradient band ========== -->
      <section id="contact" class="cta" aria-labelledby="cv-contact" data-reveal>
        <span class="hero-rays" aria-hidden="true" />
        <p class="pill on-dark"><span class="live" aria-hidden="true" /><CvText path="profile.availability" placeholder="Availability" /> · next opening {{ nextOpening }}</p>
        <h2 id="cv-contact" class="hero-title">Let’s build something great together</h2>
        <p class="hero-sub">Have a project in mind? Send me a message and I’ll get back to you within 24 hours.</p>
        <div class="hero-cta">
          <button type="button" class="hero-email" :class="{ copied }" :aria-label="`Copy ${cv.profile.email}`" @click="copyEmail">
            <span class="hero-email-text">{{ cv.profile.email }}</span>
            <span class="copy-icon" aria-hidden="true">
              <svg v-if="copied" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              <svg v-else viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2.5" /><path d="M5 15V7a2 2 0 0 1 2-2h8" /></svg>
            </span>
          </button>
          <a :href="mailto('Booking a call')" class="hero-btn magnetic">
            <span class="hero-btn-dot" aria-hidden="true"><CvIcon name="arrow-right" /></span>
            Book a call
          </a>
        </div>
      </section>

      <!-- ========== Footer ========== -->
      <footer class="foot">
        <div class="foot-about">
          <p class="muted">Full-time project manager delivering digital products for banks, NGOs and hospitality, from Phnom Penh.</p>
          <p class="foot-brand"><img :src="cv.profile.photo" alt="" width="480" height="480">{{ cv.profile.name }}</p>
        </div>
        <nav class="foot-col" aria-label="On this page">
          <p class="foot-head">On this page</p>
          <a href="#about">About</a>
          <a href="#work">Selected work</a>
          <a href="#experience">Experience</a>
          <a href="#skills">Skills</a>
          <a href="#contact">Contact</a>
        </nav>
        <div class="foot-col">
          <p class="foot-head">Contact</p>
          <a :href="`mailto:${cv.profile.email}`">{{ cv.profile.email }}</a>
          <a :href="tel">{{ cv.profile.phone }}</a>
          <span class="muted">{{ cv.profile.location }} · {{ cv.profile.timezone }}</span>
        </div>
        <div class="foot-col">
          <p class="foot-head">Résumé</p>
          <button type="button" class="foot-btn" @click="saveAsPdf">Save as PDF</button>
          <span class="muted">{{ cv.profile.handle }}</span>
          <ClientOnly>
            <button v-if="!isOwner" type="button" class="foot-btn owner" :disabled="signingIn" @click="ownerSignIn"><CvIcon name="lock" />{{ signingIn ? 'Signing in…' : 'Owner sign-in' }}</button>
          </ClientOnly>
        </div>
        <p class="foot-bottom"><span>{{ cv.profile.name }}</span><span>© {{ thisYear }} All rights reserved</span></p>
      </footer>
    </div>
  </ToolPage>
</template>

<style scoped>
/* ---------- Page tokens: the app's purple, and frosted cards that work in both themes ---------- */
.cv {
  --gap: clamp(4rem, 9vw, 7rem);
  --violet: #7c3aed;
  --violet-soft: color-mix(in srgb, #7c3aed 12%, var(--surface));
  --hero: linear-gradient(180deg, #8f5cf7 0%, #7c3aed 45%, #5b21b6 100%);
  --glass: color-mix(in srgb, var(--surface) 82%, transparent);
  --glass-line: color-mix(in srgb, var(--line) 70%, #fff);
  --float: 0 24px 48px -24px rgb(var(--shadow) / 0.35), 0 2px 6px rgb(var(--shadow) / 0.06);
  display: flex;
  flex-direction: column;
  gap: var(--gap);
  width: 100%;
  padding-bottom: 1rem;
}

/* Full width: the hero, the client strip and the closing band run edge to edge of the page; the
   reading sections keep a comfortable measure in the middle */
.section,
.foot {
  width: 100%;
  max-width: 1200px;
  margin-inline: auto;
}

.section.trusted {
  max-width: none;
}

[id] {
  scroll-margin-top: 6rem;
}

:global(html:has(.cv)) {
  scroll-behavior: smooth;
}

:root[data-theme='dark'] .cv {
  --glass-line: color-mix(in srgb, var(--line) 85%, #fff 8%);
}

ul,
ol,
dl {
  margin: 0;
  padding: 0;
  list-style: none;
}

p {
  margin: 0;
}

h3 {
  margin: 0;
  font-size: 1.05rem;
  letter-spacing: -0.01em;
}

.muted {
  color: var(--ink-2);
}

/* ---------- Shared pieces: pill labels, headings with one purple word, frosted cards ---------- */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 auto 1rem;
  padding: 0.3rem 0.85rem 0.3rem 0.35rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-2);
  background: var(--glass);
  border: 1px solid var(--glass-line);
  border-radius: 999px;
  box-shadow: 0 2px 8px rgb(var(--shadow) / 0.06);
}

.pill-icon {
  width: 1.4rem;
  height: 1.4rem;
  display: grid;
  place-items: center;
  font-size: 0.75rem;
  background: var(--violet-soft);
  border-radius: 50%;
}

.pill.on-dark {
  padding-left: 0.75rem;
  color: #fff;
  background: rgb(255 255 255 / 0.14);
  border-color: rgb(255 255 255 / 0.25);
  box-shadow: none;
  backdrop-filter: blur(8px);
}

.title {
  max-width: 44rem;
  margin: 0 auto;
  font-size: clamp(1.8rem, 4.2vw, 2.9rem);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.12;
  text-align: center;
  text-wrap: balance;
}

.title.small {
  font-size: clamp(1.4rem, 3vw, 2rem);
}

.title em {
  font-style: normal;
  background: linear-gradient(90deg, #9b5cf5, #6d28d9);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

:root[data-theme='dark'] .title em {
  background-image: linear-gradient(90deg, #c4a6ff, #9b5cf5);
}

.title.left,
.lede.left {
  margin-left: 0;
  text-align: left;
}

.lede {
  max-width: 36rem;
  margin: 1rem auto 0;
  text-align: center;
  color: var(--ink-2);
  text-wrap: pretty;
}

.section {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Faint drafting lines behind a section, fading out at the edges */
.section.lined::before {
  content: '';
  position: absolute;
  z-index: -1;
  /* Within the page's width, so the lines never push it into scrolling sideways */
  inset: -2rem 0;
  background-image:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 72px 72px;
  background-position: center;
  opacity: 0.35;
  mask-image: radial-gradient(ellipse 60% 55% at 50% 45%, #000, transparent 75%);
  pointer-events: none;
}

.glass {
  position: relative;
  background: var(--glass);
  border: 1px solid var(--glass-line);
  border-radius: 22px;
  box-shadow: var(--float);
  backdrop-filter: blur(12px);
}

.fc-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--ink-3);
}

.fc-tag {
  flex: none;
  width: fit-content;
  padding: 0.15rem 0.55rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--violet);
  background: var(--violet-soft);
  border-radius: 999px;
}

.fc-tag.good {
  color: var(--good-ink);
  background: color-mix(in srgb, var(--green) 14%, var(--surface));
}

:root[data-theme='dark'] .fc-tag:not(.good) {
  color: #c4a6ff;
}

.fc-icon {
  width: 1.9rem;
  height: 1.9rem;
  flex: none;
  display: grid;
  place-items: center;
  font-size: 0.9rem;
  color: #fff;
  background: var(--hero);
  border-radius: 50%;
}

/* ---------- Icon tiles: the app icons' sticker look (gradient, gloss, black plastic rim) ---------- */
.pill-icon,
.fc-icon,
.service-icon,
.logo-dot {
  color: #fff;
  background: var(--hero);
  box-shadow:
    0 0 0 1.5px var(--plastic),
    inset 0 -2px 0 rgb(0 0 0 / 0.18),
    inset 0 2px 4px rgb(255 255 255 / 0.3);
}

.pill-icon {
  font-size: 0.8rem;
  border-radius: 7px;
}

.fc-icon {
  font-size: 1rem;
  border-radius: 10px;
}

.logo-dot .cv-icon {
  font-size: 0.85rem;
}

.service-icon {
  font-size: 1.35rem;
  border-radius: 14px;
  box-shadow:
    0 0 0 2.5px var(--plastic),
    inset 0 -4px 0 rgb(0 0 0 / 0.18),
    inset 0 4px 6px rgb(255 255 255 / 0.3);
}

/* On the purple card, the tile turns white with a purple icon */
.service.active .service-icon {
  color: var(--violet);
  background: #fff;
}

.fc-meta {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.fc-meta .cv-icon {
  font-size: 0.95rem;
  color: #9b5cf5;
}

.work-bar .cv-icon {
  font-size: 1rem;
}

.nav-sheet a .cv-icon,
.nav-sheet-pdf .cv-icon {
  font-size: 1.1rem;
  color: var(--ink-3);
}

/* ---------- Hero and the call-to-action band ---------- */
.hero,
.cta {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: clamp(2.5rem, 6vw, 4.5rem) clamp(1rem, 4vw, 3rem) 0;
  overflow: clip;
  text-align: center;
  color: #fff;
  background: var(--hero);
  border-radius: 32px;
  box-shadow: 0 30px 60px -30px color-mix(in srgb, #7c3aed 70%, transparent);
}

/* A drafting grid and soft light from the top */
.hero::before,
.cta::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 0;
  background-image:
    linear-gradient(rgb(255 255 255 / 0.09) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 0.09) 1px, transparent 1px);
  background-size: 64px 64px;
  background-position: center top;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 30%, #000, transparent 80%);
}

.hero-rays {
  position: absolute;
  z-index: -1;
  inset: -30% -10% auto;
  height: 90%;
  background:
    radial-gradient(ellipse 40% 60% at 30% 0%, rgb(255 255 255 / 0.35), transparent 70%),
    radial-gradient(ellipse 30% 50% at 70% 0%, rgb(255 255 255 / 0.25), transparent 70%);
  filter: blur(10px);
  animation: cv-rays 12s ease-in-out infinite alternate;
  pointer-events: none;
}

@keyframes cv-rays {
  to {
    transform: translateX(6%) scale(1.08);
    opacity: 0.75;
  }
}

.hero .pill,
.cta .pill {
  margin-bottom: 1.5rem;
}

.hero-title {
  max-width: 50rem;
  margin: 0;
  font-size: clamp(2rem, 5.4vw, 3.6rem);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1.12;
  text-wrap: balance;
}

/* "with [photo] Ousa": the photo sits in the sentence like a logo */
.hero-me {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
  white-space: nowrap;
}

.hero-me img {
  width: 1.05em;
  height: 1.05em;
  object-fit: cover;
  border-radius: 50%;
  box-shadow: 0 0 0 0.08em rgb(255 255 255 / 0.85), 0 6px 16px rgb(0 0 0 / 0.25);
}

.hero-sub {
  max-width: 36rem;
  margin-top: 1rem;
  font-size: 1.05rem;
  color: rgb(255 255 255 / 0.82);
}

/* The sign-up-style pill: my address on glass, and a dark button */
.hero-cta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: min(100%, 30rem);
  margin-top: 2rem;
  padding: 0.35rem 0.35rem 0.35rem 1.25rem;
  background: rgb(255 255 255 / 0.16);
  border: 1px solid rgb(255 255 255 / 0.3);
  border-radius: 999px;
  backdrop-filter: blur(10px);
}

.hero-email {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  font-size: 0.95rem;
  color: rgb(255 255 255 / 0.9);
  text-decoration: none;
}

.hero-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 1.1rem 0.35rem 0.35rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  text-decoration: none;
  background: #14121c;
  border-radius: 999px;
  box-shadow: 0 6px 16px rgb(0 0 0 / 0.25);
  transition: transform 0.15s, background-color 0.15s;
}

.hero-btn:hover {
  background: #000;
}

.hero-btn:active {
  transform: scale(0.96);
}

.hero-btn-dot {
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  background: rgb(255 255 255 / 0.14);
  border-radius: 50%;
}

.hero-btn-dot svg {
  font-size: 1rem;
  transition: transform 0.2s;
}

.hero-btn:hover .hero-btn-dot svg {
  transform: translateX(2px);
}

.hero-links {
  display: flex;
  gap: 0.6rem;
  margin-top: 1rem;
  font-size: 0.9rem;
  color: rgb(255 255 255 / 0.75);
}

.hero-links a,
.hero-links button {
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: #fff;
  text-decoration: underline;
  text-decoration-color: rgb(255 255 255 / 0.4);
  text-underline-offset: 3px;
  background: none;
  border: 0;
  cursor: pointer;
}

/* Three cards along the hero's foot, cut off by its bottom edge */
.hero-cards {
  display: grid;
  grid-template-columns: 1fr 1.1fr 1fr;
  align-items: end;
  gap: 1.25rem;
  width: 100%;
  max-width: 62rem;
  margin-top: 3rem;
  margin-bottom: -2.5rem;
  color: var(--ink);
  text-align: left;
}

.float-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1rem 3.25rem;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  border: 1px solid rgb(255 255 255 / 0.6);
  border-radius: 22px 22px 0 0;
  box-shadow: 0 -10px 40px -10px rgb(30 0 80 / 0.35);
  backdrop-filter: blur(14px);
}

.float-card.middle {
  padding: 1.25rem 1.25rem 3.5rem;
}

.fc-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem;
  background: var(--surface-2);
  border-radius: 14px;
}

.fc-strong {
  flex: 1;
  font-size: 0.9rem;
  font-weight: 700;
}

.fc-row.person > span:last-child {
  display: flex;
  flex-direction: column;
}

.fc-mini-avatar img {
  display: block;
  width: 2rem;
  height: 2rem;
  object-fit: cover;
  border-radius: 50%;
}

.fc-panel {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.85rem;
  background: linear-gradient(180deg, var(--violet-soft), var(--surface));
  border: 1px solid var(--glass-line);
  border-radius: 16px;
}

.fc-big {
  font-size: 1.9rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.fc-big small {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-3);
}

.fc-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.35rem;
  font-size: 0.75rem;
  color: var(--ink-2);
}

.fc-head {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.fc-head strong {
  font-size: 1.1rem;
}

.fc-avatar {
  width: 4.5rem;
  height: 4.5rem;
  object-fit: cover;
  border-radius: 20px;
  box-shadow: 0 0 0 3px var(--surface), 0 0 0 5px #9b5cf5;
}

.fc-role {
  font-size: 0.9rem;
  color: var(--ink-2);
}

.fc-focus {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.fc-focus li {
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--surface-2);
  border-radius: 999px;
}

/* ---------- Trusted by: logo pills sliding past ---------- */
.trusted {
  gap: 1.75rem;
  margin-top: -1rem;
}

.marquee {
  display: flex;
  gap: 0.75rem;
  width: 100%;
  /* The strip has to clip sideways for the loop; room above and below keeps the pills' hover lift
     and shadow inside it, and the negative margin gives that room back to the layout */
  padding-block: 0.75rem 1.5rem;
  margin-block: -0.75rem -1.5rem;
  overflow: hidden;
  overflow: clip;
  mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent);
}

.logos {
  flex: none;
  display: flex;
  gap: 0.75rem;
  animation: cv-marquee 50s linear infinite;
}

.marquee:hover .logos {
  animation-play-state: paused;
}

@keyframes cv-marquee {
  to {
    transform: translateX(calc(-100% - 0.75rem));
  }
}

.logo-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1rem 0.55rem 0.55rem;
  font-weight: 700;
  white-space: nowrap;
  background: var(--glass);
  border: 1px solid var(--glass-line);
  border-radius: 14px;
  box-shadow: 0 4px 14px rgb(var(--shadow) / 0.06);
}

.logo-dot {
  width: 1.6rem;
  height: 1.6rem;
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  color: #fff;
  background: var(--hero);
  border-radius: 8px;
}

/* ---------- About ---------- */
.about {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 2rem;
  align-items: center;
  width: 100%;
  margin-top: 2.5rem;
}

.about-text {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  font-size: 1.1rem;
  line-height: 1.65;
  color: var(--ink-2);
}

.building {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 1.35rem;
}

.building-name {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.15rem;
  font-weight: 700;
}

.link-row {
  display: flex;
  justify-content: space-between;
  padding: 0.6rem 0.8rem;
  font-weight: 600;
  color: var(--ink);
  text-decoration: none;
  background: var(--surface-2);
  border-radius: 12px;
  transition: background-color 0.15s;
}

.link-row:hover {
  background: var(--violet-soft);
}

/* ---------- Tabs (the segmented plugin slides the highlight between them) ---------- */
.tabs {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 2rem;
  padding: 0.3rem;
  background: var(--glass);
  border: 1px solid var(--glass-line);
  border-radius: 999px;
  box-shadow: 0 2px 10px rgb(var(--shadow) / 0.06);
}

.tabs button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-2);
  background: none;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.2s;
}

.tabs button.active {
  color: #fff;
  background: var(--violet);
  box-shadow: 0 4px 12px -4px color-mix(in srgb, var(--violet) 80%, transparent);
}

.tabs.small {
  margin: 0 0 1.25rem;
}

/* ---------- Services: a row of cards that slides to centre the chosen one ---------- */
.carousel {
  width: 100%;
  /* Clips sideways for the sliding row; the padding leaves room for the chosen card's glow below */
  margin: 0.5rem 0 -2rem;
  padding: 2.5rem 0 4.5rem;
  overflow: hidden;
  /* clip, not just hidden: a hidden box can still be scrolled, and clicking into text on a card
     would scroll the row to show the cursor, jumping the cards sideways */
  overflow: clip;
  mask-image: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent);
}

.carousel-track {
  --card: min(22rem, 78vw);
  --gap: 1.5rem;
  display: flex;
  gap: var(--gap);
  transform: translateX(calc(50% - var(--card) / 2 - var(--active) * (var(--card) + var(--gap))));
  transition: transform 0.6s var(--ease-out);
}

.service {
  /* Its edit tools sit on its own top edge, not the sliding row's */
  position: relative;
  flex: none;
  width: var(--card);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1.5rem;
  background: var(--glass);
  border: 1px solid var(--glass-line);
  border-radius: 24px;
  box-shadow: var(--float);
  opacity: 0.55;
  transform: scale(0.92);
  cursor: pointer;
  transition: transform 0.5s var(--ease-out), opacity 0.4s, background 0.4s, color 0.4s;
}

.service.active {
  color: #fff;
  background: var(--hero);
  border-color: rgb(255 255 255 / 0.3);
  opacity: 1;
  transform: none;
  cursor: default;
  box-shadow: 0 30px 50px -24px color-mix(in srgb, #7c3aed 80%, transparent);
}

.service-icon {
  width: 2.75rem;
  height: 2.75rem;
  display: grid;
  place-items: center;
  margin-bottom: 0.5rem;
}

.service h3 {
  font-size: 1.35rem;
}

.service p {
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--ink-2);
}

.service.active p {
  color: rgb(255 255 255 / 0.85);
}

.service-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.75rem;
  padding: 0.5rem 0.5rem 0.5rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 600;
  background: var(--surface-2);
  border-radius: 14px;
}

.service.active .service-foot {
  color: var(--ink);
  background: var(--surface);
}

.service-btn {
  padding: 0.35rem 0.8rem;
  color: #fff;
  text-decoration: none;
  background: var(--violet);
  border-radius: 10px;
}

/* ---------- Selected work ---------- */
.work {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  align-items: start;
  width: 100%;
  margin-top: 3rem;
}

.work-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.35rem;
}

.work-card.lifted {
  margin-top: -1.5rem;
}

.work-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.work-head > span:nth-child(2) {
  flex: 1;
  min-width: 0;
}

.work-logo {
  width: 2.6rem;
  height: 2.6rem;
  flex: none;
  display: grid;
  place-items: center;
  font-size: 0.85rem;
  font-weight: 800;
  color: #fff;
  background: var(--hero);
  border-radius: 50%;
}

.work-text {
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--ink-2);
}

.work-facts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.work-facts div {
  display: flex;
  flex-direction: column-reverse;
  padding: 0.6rem 0.7rem;
  background: var(--surface-2);
  border: 1px solid var(--glass-line);
  border-radius: 12px;
}

.work-facts dd {
  margin: 0;
  font-weight: 800;
}

.work-facts dt {
  font-size: 0.7rem;
  color: var(--ink-3);
}

.work-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.85rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
  background: var(--hero);
  border-radius: 12px;
}

/* ---------- Experience ---------- */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 50rem;
  margin-top: 3rem;
}

.job {
  display: flex;
  gap: 1rem;
  padding: 1.25rem;
}

.job-logo {
  width: 2.75rem;
  height: 2.75rem;
  flex: none;
  display: grid;
  place-items: center;
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--violet);
  background: var(--violet-soft);
  border-radius: 14px;
}

:root[data-theme='dark'] .job-logo {
  color: #c4a6ff;
}

.job-body {
  flex: 1;
  min-width: 0;
}

.job-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.points {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-top: 0.6rem;
  font-size: 0.92rem;
  color: var(--ink-2);
}

.points li {
  position: relative;
  padding-left: 1rem;
}

.points li::before {
  content: '';
  position: absolute;
  top: 0.6em;
  left: 0.15rem;
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 50%;
  background: #9b5cf5;
}

/* ---------- Skills: copy and chips on the left, cards on the right ---------- */
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
}

.split-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.split-text .pill {
  margin-left: 0;
}

.feature-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.75rem;
}

.feature-chips li {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.75rem 0.4rem 0.45rem;
  font-size: 0.82rem;
  font-weight: 600;
  background: var(--glass);
  border: 1px solid var(--glass-line);
  border-radius: 10px;
}

.chip-dot {
  width: 1.15rem;
  height: 1.15rem;
  background: var(--hero);
  border-radius: 6px;
}

.languages {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.languages div {
  display: flex;
  flex-direction: column;
  padding: 0.6rem 1rem;
  background: var(--glass);
  border: 1px solid var(--glass-line);
  border-radius: 14px;
}

.languages dt {
  font-weight: 700;
}

.languages dd {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ink-2);
}

.split-cards {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1rem;
}

.skills-card {
  padding: 1.35rem;
}

.toast-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  align-self: flex-start;
  margin: -2rem 0 0 -1.5rem;
  padding: 0.75rem 1.1rem 0.75rem 0.75rem;
  border-radius: 16px;
}

.toast-card > span:last-child {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
}

.bars {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.bar-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  font-weight: 600;
}

.bar-value {
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
}

.bar {
  display: block;
  height: 8px;
  margin-top: 0.35rem;
  overflow: hidden;
  background: var(--surface-2);
  border-radius: 999px;
}

/* Each bar fills from empty when its group shows */
.bar i {
  display: block;
  width: var(--w);
  height: 100%;
  background: linear-gradient(90deg, #b06cf7, #6d28d9);
  border-radius: inherit;
  animation: cv-fill 0.9s var(--ease-out) both;
  animation-delay: calc(0.1s + var(--n, 0) * 50ms);
}

@keyframes cv-fill {
  from {
    width: 0;
  }
}

.fade-swap-enter-active,
.fade-swap-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.fade-swap-enter-from,
.fade-swap-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

/* ---------- Education ---------- */
.edu {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  width: 100%;
  margin-top: 3rem;
}

.edu-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 1.25rem;
}

.certified {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
  margin-top: 1.75rem;
}

/* ---------- Testimonials and articles ---------- */
.quotes,
.articles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
  width: 100%;
  margin-top: 3rem;
}

.quote {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.35rem;
}

.quote blockquote {
  flex: 1;
  margin: 0;
  line-height: 1.6;
}

.by {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.by > span:last-child {
  display: flex;
  flex-direction: column;
}

.by-avatar {
  width: 2.4rem;
  height: 2.4rem;
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  font-weight: 700;
  color: #fff;
  background: var(--hero);
  border-radius: 50%;
}

.article {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 1.35rem;
}

/* ---------- Call to action ---------- */
.cta {
  padding-bottom: clamp(2.5rem, 6vw, 4.5rem);
}

/* ---------- Footer ---------- */
.foot {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1fr 1fr;
  gap: 2rem;
  padding: 0 clamp(0rem, 2vw, 1.5rem);
}

.foot-about {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1.5rem;
  font-size: 0.9rem;
}

.foot-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.foot-brand img {
  width: 2.75rem;
  height: 2.75rem;
  object-fit: cover;
  border-radius: 50%;
  box-shadow: 0 0 0 3px var(--surface), 0 0 0 5px #9b5cf5;
}

.foot-col {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  font-size: 0.9rem;
}

.foot-head {
  margin-bottom: 0.25rem;
  font-weight: 700;
}

.foot-col a,
.foot-btn {
  width: fit-content;
  padding: 0;
  font: inherit;
  color: var(--ink-2);
  text-decoration: none;
  background: none;
  border: 0;
  cursor: pointer;
  overflow-wrap: anywhere;
}

.foot-col a:hover,
.foot-btn:hover {
  color: var(--ink);
}

.foot-bottom {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  font-size: 0.8rem;
  color: var(--ink-3);
  background: var(--glass);
  border: 1px solid var(--glass-line);
  border-radius: 14px;
}

/* ---------- Motion ---------- */

/* The hero's parts rise in one after another */
@keyframes cv-rise {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
}

.hero {
  animation: cv-rise 0.7s var(--ease-out) both;
}

.rise {
  animation: cv-rise 0.8s var(--ease-out) both;
  animation-delay: calc(0.15s + var(--d, 0) * 0.09s);
}

/* The side cards rise in after the middle one, then bob gently, out of step with each other */
.float-card.left {
  animation: cv-rise 0.8s var(--ease-out) 0.6s both, cv-bob 6s ease-in-out 1.4s infinite;
}

.float-card.right {
  animation: cv-rise 0.8s var(--ease-out) 0.7s both, cv-bob 6s ease-in-out 2.4s infinite;
}

@keyframes cv-bob {
  50% {
    transform: translateY(-8px);
  }
}

/* The availability dot breathes */
.live {
  position: relative;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #4ade80;
}

.live::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #4ade80;
  animation: cv-ping 2s ease-out infinite;
}

@keyframes cv-ping {
  from {
    opacity: 0.7;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(3);
  }
}

/* Scrolled to: things below the fold wait out of sight, then rise in (script adds .pending) */
[data-reveal] {
  transition:
    opacity 0.7s var(--ease-out),
    transform 0.7s var(--ease-out);
  transition-delay: calc(var(--i, 0) * 90ms);
}

.pending {
  opacity: 0;
  transform: translateY(28px);
}

/* Skill bars wait empty until their card arrives */
.pending .bar i {
  animation-play-state: paused;
}

/* Cards lift, and a soft purple spotlight follows the pointer across them */
.glow {
  isolation: isolate;
  transition:
    opacity 0.7s var(--ease-out),
    transform 0.7s var(--ease-out),
    border-color 0.25s,
    box-shadow 0.25s,
    translate 0.25s var(--ease-out);
  /* The reveal keeps its stagger; hover reacts at once */
  transition-delay: calc(var(--i, 0) * 90ms), calc(var(--i, 0) * 90ms), 0s, 0s, 0s;
}

.glow::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(320px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, #9b5cf5 16%, transparent), transparent 70%);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}

@media (hover: hover) {
  .glow:hover {
    translate: 0 -4px;
    border-color: color-mix(in srgb, #9b5cf5 45%, var(--glass-line));
    box-shadow: 0 30px 50px -26px color-mix(in srgb, #7c3aed 60%, transparent);
  }

  .glow:hover::before {
    opacity: 1;
  }

  .service:not(.active):hover {
    opacity: 0.8;
  }
}

/* ---------- The page's own nav: a frosted bar that sticks to the top ---------- */
.cv-nav {
  position: sticky;
  z-index: 150;
  top: 0.75rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  /* Sits close above the hero instead of a whole section gap away */
  margin-bottom: calc(1rem - var(--gap));
  padding: 0.45rem 0.45rem 0.45rem 0.55rem;
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  border: 1px solid var(--glass-line);
  border-radius: 999px;
  box-shadow: 0 2px 10px rgb(var(--shadow) / 0.05);
  backdrop-filter: blur(16px) saturate(1.4);
  transition: box-shadow 0.3s, background-color 0.3s, border-color 0.3s;
  animation: cv-rise 0.6s var(--ease-out) both;
}

.cv-nav.scrolled {
  background: color-mix(in srgb, var(--surface) 86%, transparent);
  box-shadow: 0 14px 36px -16px rgb(var(--shadow) / 0.35);
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding-right: 0.5rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ink);
  text-decoration: none;
  white-space: nowrap;
}

.nav-brand img {
  width: 2.25rem;
  height: 2.25rem;
  object-fit: cover;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 3.5px #9b5cf5;
  transition: transform 0.4s cubic-bezier(0.3, 1.6, 0.5, 1);
}

.nav-brand:hover img {
  transform: rotate(-10deg) scale(1.08);
}

.nav-links {
  position: relative;
  display: flex;
  gap: 0.15rem;
  margin: 0 auto;
}

.nav-links a {
  position: relative;
  z-index: 1;
  display: block;
  padding: 0.5rem 0.85rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink-2);
  text-decoration: none;
  border-radius: 999px;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: var(--ink);
}

.nav-links a.active {
  color: var(--violet);
}

:root[data-theme='dark'] .nav-links a.active {
  color: #d4bfff;
}

/* One highlight slides under whichever section you're reading */
.nav-marker {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--w);
  height: 100%;
  background: var(--violet-soft);
  border-radius: 999px;
  opacity: 0;
  translate: var(--x) 0;
  transition: translate 0.45s var(--ease-out), width 0.45s var(--ease-out), opacity 0.3s;
}

.nav-marker.on {
  opacity: 1;
}

.nav-end {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.nav-apps {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0.8rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink-2);
  text-decoration: none;
  border-radius: 999px;
  transition: background-color 0.2s, color 0.2s;
}

.nav-apps:hover {
  color: var(--ink);
  background: var(--surface-2);
}

.nav-apps-logo {
  width: 1.1rem;
  height: 1.1rem;
}

.nav-hire {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.1rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: #fff;
  text-decoration: none;
  background: var(--hero);
  border-radius: 999px;
  box-shadow: 0 8px 20px -8px color-mix(in srgb, #7c3aed 80%, transparent);
  translate: var(--gx, 0px) var(--gy, 0px);
  transition: translate 0.35s var(--ease-out), transform 0.15s, box-shadow 0.2s;
}

.nav-hire:hover {
  box-shadow: 0 12px 26px -8px color-mix(in srgb, #7c3aed 90%, transparent);
}

.nav-hire:active {
  transform: scale(0.96);
}

/* Phones: a menu button that turns into a cross */
.nav-toggle {
  display: none;
  position: relative;
  width: 2.6rem;
  height: 2.6rem;
  padding: 0;
  background: var(--surface-2);
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}

.nav-toggle span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 1rem;
  height: 2px;
  margin-left: -0.5rem;
  background: var(--ink);
  border-radius: 2px;
  transition: transform 0.3s var(--ease-out);
}

.nav-toggle span:first-child {
  transform: translateY(-3.5px);
}

.nav-toggle span:last-child {
  transform: translateY(3.5px);
}

.open .nav-toggle span:first-child {
  transform: rotate(45deg);
}

.open .nav-toggle span:last-child {
  transform: rotate(-45deg);
}

.nav-sheet {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  border: 1px solid var(--glass-line);
  border-radius: 22px;
  box-shadow: 0 24px 48px -20px rgb(var(--shadow) / 0.45);
  backdrop-filter: blur(16px);
}

.nav-sheet a,
.nav-sheet-pdf {
  display: flex;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  font: inherit;
  font-weight: 600;
  color: var(--ink);
  text-decoration: none;
  text-align: left;
  background: none;
  border: 0;
  border-radius: 14px;
  cursor: pointer;
}

.nav-sheet a.active {
  color: var(--violet);
  background: var(--violet-soft);
}

.nav-sheet-pdf {
  margin-top: 0.25rem;
  color: var(--ink-2);
  border-top: 1px solid var(--line);
  border-radius: 0 0 14px 14px;
}

.nav-drop-enter-active,
.nav-drop-leave-active {
  transition: opacity 0.2s, transform 0.25s var(--ease-out);
}

.nav-drop-enter-from,
.nav-drop-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

/* ---------- Editing (owner only) ---------- */
.nav-edit {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.9rem;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ink);
  background: var(--surface-2);
  border: 1px solid var(--glass-line);
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.nav-edit.on {
  color: #fff;
  background: #14121c;
  border-color: transparent;
}

/* Small pill buttons that sit by whatever they edit */
.edit-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.4rem;
  margin-top: 1rem;
}

.edit-row.left {
  justify-content: flex-start;
}

.edit-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.8rem;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--violet);
  background: var(--violet-soft);
  border: 1px dashed color-mix(in srgb, #7c3aed 45%, transparent);
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.15s, transform 0.15s;
  animation: cv-pop-icon 0.3s cubic-bezier(0.3, 1.5, 0.6, 1);
}

.edit-chip:hover:not(:disabled) {
  background: color-mix(in srgb, #7c3aed 20%, var(--surface));
}

.edit-chip:active:not(:disabled) {
  transform: scale(0.96);
}

.edit-chip:disabled {
  opacity: 0.4;
  cursor: default;
}

:root[data-theme='dark'] .edit-chip {
  color: #d4bfff;
}

/* On the purple hero: white glass */
.hero-edit {
  position: absolute;
  z-index: 2;
  top: 1rem;
  right: 1rem;
  margin: 0;
}

.on-dark .edit-chip {
  color: #fff;
  background: rgb(255 255 255 / 0.16);
  border-color: rgb(255 255 255 / 0.5);
}

.skills-edit {
  margin: 0 0 1rem;
}

/* An empty card with a dashed edge to add another item */
.add-tile {
  display: flex;
  min-height: 8rem;
}

.add-tile button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font: inherit;
  font-weight: 700;
  color: var(--violet);
  background: color-mix(in srgb, var(--violet-soft) 60%, transparent);
  border: 2px dashed color-mix(in srgb, #7c3aed 40%, transparent);
  border-radius: 22px;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}

.add-tile button:hover {
  background: var(--violet-soft);
  border-color: #7c3aed;
}

:root[data-theme='dark'] .add-tile button {
  color: #d4bfff;
}

.timeline .add-tile {
  min-height: 4.5rem;
}

/* Room above each item for its tools, which sit on the item's top edge */
.editing .timeline {
  gap: 1.75rem;
}

.editing .work,
.editing .edu,
.editing .quotes,
.editing .articles {
  row-gap: 2rem;
}

/* While editing, cards hold still so their tools are easy to hit */
.editing .glow.settled:hover {
  transform: none;
}

.editing .float-card.left,
.editing .float-card.right {
  animation: none;
}

.editing .marquee {
  mask-image: none;
}

.editing .logos {
  flex-wrap: wrap;
  flex-shrink: 1;
  justify-content: center;
  animation: none;
}

.editing .logos.copy {
  display: none;
}

/* Editable text keeps the line it sits in */
.editing .fc-tag .cv-text,
.editing .bar-value .cv-text {
  outline-offset: 1px;
}

/* The bar along the bottom while editing */
.edit-bar {
  position: fixed;
  z-index: 160;
  left: 50%;
  bottom: max(1rem, env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: max-content;
  max-width: calc(100vw - 2rem);
  padding: 0.5rem 0.5rem 0.5rem 1rem;
  color: #fff;
  background: #14121c;
  border-radius: 999px;
  box-shadow: 0 20px 40px -12px rgb(0 0 0 / 0.5);
  translate: -50% 0;
}

.edit-bar-dot {
  width: 0.6rem;
  height: 0.6rem;
  flex: none;
  border-radius: 50%;
  background: #4ade80;
}

.edit-bar-dot.busy {
  background: #fbbf24;
  animation: cv-ping-dot 0.8s ease-in-out infinite alternate;
}

@keyframes cv-ping-dot {
  to {
    opacity: 0.4;
  }
}

.edit-bar-text {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  line-height: 1.25;
}

.edit-bar-text span {
  font-size: 0.75rem;
  color: rgb(255 255 255 / 0.65);
}

.edit-bar-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.95rem;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  color: #14121c;
  background: #fff;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.edit-bar-btn.quiet {
  color: #fff;
  background: rgb(255 255 255 / 0.12);
}

.edit-bar-btn.quiet.confirm {
  background: var(--red);
}

.edit-bar-enter-active,
.edit-bar-leave-active {
  transition: opacity 0.25s, translate 0.35s var(--ease-out);
}

.edit-bar-enter-from,
.edit-bar-leave-to {
  opacity: 0;
  translate: -50% 1.5rem;
}

.foot-btn.owner {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--ink-3);
}

/* Links added to projects and articles */
.work-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: inherit;
  text-decoration: none;
}

.work-link:hover {
  color: var(--violet);
}

.read-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: auto;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--violet);
  text-decoration: none;
}

:root[data-theme='dark'] .read-link,
:root[data-theme='dark'] .work-link:hover {
  color: #d4bfff;
}

@media (max-width: 720px) {
  .edit-bar-text span {
    display: none;
  }

  .edit-bar {
    gap: 0.5rem;
  }

  .hero-edit {
    position: static;
    margin-bottom: 1rem;
  }
}

/* ---------- Mouse and micro-interactions ---------- */

/* A thin purple bar at the very top fills as you scroll down the page */
.progress {
  display: none;
}

@supports (animation-timeline: scroll()) {
  .progress {
    position: fixed;
    z-index: 200;
    inset: 0 0 auto;
    display: block;
    height: 3px;
    background: linear-gradient(90deg, #b06cf7, #7c3aed, #5b21b6);
    transform-origin: left;
    animation: cv-progress linear both;
    animation-timeline: scroll(root);
    pointer-events: none;
  }
}

@keyframes cv-progress {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

/* The ring that trails a mouse pointer; it swells over anything clickable, and stays put on a click */
.ring {
  position: fixed;
  z-index: 300;
  top: 0;
  left: 0;
  width: 34px;
  height: 34px;
  margin: -17px 0 0 -17px;
  border: 1.5px solid color-mix(in srgb, #9b5cf5 75%, transparent);
  border-radius: 50%;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.25s,
    width 0.3s var(--ease-out),
    height 0.3s var(--ease-out),
    margin 0.3s var(--ease-out),
    background-color 0.3s;
}

.ring.on {
  opacity: 1;
}

.ring.big {
  width: 58px;
  height: 58px;
  margin: -29px 0 0 -29px;
  background: color-mix(in srgb, #9b5cf5 10%, transparent);
  border-color: color-mix(in srgb, #9b5cf5 45%, transparent);
}

@media (hover: none), (pointer: coarse) {
  .ring {
    display: none;
  }
}

/* Hero: a soft light follows the pointer, and the layers drift with it (nearer cards further) */
.hero-spot {
  position: absolute;
  z-index: -1;
  inset: 0;
  background: radial-gradient(420px circle at var(--hx, 50%) var(--hy, 0%), rgb(255 255 255 / 0.2), transparent 65%);
  opacity: 0;
  transition: opacity 0.5s;
  pointer-events: none;
}

.hero:hover .hero-spot {
  opacity: 1;
}

.hero-title {
  translate: calc(var(--px, 0) * -6px) calc(var(--py, 0) * -4px);
  transition: translate 0.8s var(--ease-out);
}

.hero-rays {
  translate: calc(var(--px, 0) * 40px) calc(var(--py, 0) * 20px);
  transition: translate 1s var(--ease-out);
}

.float-card {
  translate: calc(var(--px, 0) * var(--depth, 0) * 1px) calc(var(--py, 0) * var(--depth, 0) * 0.6px);
  transition: translate 0.6s var(--ease-out);
}

.float-card.left {
  --depth: -14;
}

.float-card.middle {
  --depth: 6;
}

.float-card.right {
  --depth: 18;
}

/* Your photo in the headline turns to say hello */
.hero-me img {
  transition: transform 0.4s cubic-bezier(0.3, 1.6, 0.5, 1);
}

.hero-me:hover img {
  transform: rotate(-12deg) scale(1.15);
}

/* Cards tilt towards the pointer once they've arrived (script sets --rx and --ry) */
@media (hover: hover) {
  .glow.settled {
    transition:
      transform 0.25s var(--ease-out),
      translate 0.25s var(--ease-out),
      border-color 0.25s,
      box-shadow 0.25s,
      opacity 0.4s;
    transition-delay: 0s;
  }

  .glow.settled:hover {
    transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
  }
}

/* Magnetic buttons lean towards the pointer (script sets --gx and --gy) */
.hero-btn.magnetic,
.service-btn.magnetic {
  translate: var(--gx, 0px) var(--gy, 0px);
  transition:
    translate 0.35s var(--ease-out),
    transform 0.15s,
    background-color 0.15s;
}

/* The dark button: a sheen crosses it on hover */
.hero-btn {
  position: relative;
  overflow: hidden;
}

.hero-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, transparent 30%, rgb(255 255 255 / 0.22) 50%, transparent 70%);
  transform: translateX(-120%);
  transition: transform 0.7s var(--ease-out);
  pointer-events: none;
}

.hero-btn:hover::after {
  transform: translateX(120%);
}

.service-btn {
  display: inline-block;
}

/* The email pill copies the address: a copy icon that flips to a tick */
.hero-email {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0;
  font: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

.hero-email-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.copy-icon {
  flex: none;
  width: 1.6rem;
  height: 1.6rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.12);
  transition: background-color 0.2s, transform 0.2s;
}

.copy-icon svg {
  width: 0.9rem;
  height: 0.9rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.hero-email:hover .copy-icon {
  background: rgb(255 255 255 / 0.25);
  transform: scale(1.1);
}

.hero-email.copied .copy-icon {
  background: #4ade80;
  color: #14121c;
  animation: cv-pop-icon 0.4s cubic-bezier(0.3, 1.6, 0.5, 1);
}

@keyframes cv-pop-icon {
  from {
    transform: scale(0.5);
  }
}

/* The purple words in headings shimmer slowly */
.title em {
  background-image: linear-gradient(90deg, #9b5cf5, #6d28d9, #b06cf7, #9b5cf5);
  background-size: 300% 100%;
  animation: cv-em 8s ease-in-out infinite alternate;
}

:root[data-theme='dark'] .title em {
  background-image: linear-gradient(90deg, #c4a6ff, #9b5cf5, #e0ccff, #c4a6ff);
}

@keyframes cv-em {
  to {
    background-position: 100% 0;
  }
}

/* Pill labels: the icon gives a little wiggle on hover */
.pill-icon {
  transition: transform 0.4s cubic-bezier(0.3, 1.6, 0.5, 1);
}

.pill:hover .pill-icon {
  transform: rotate(-14deg) scale(1.15);
}

/* Tabs: the chosen tab's icon pops */
.tabs button > .cv-icon {
  font-size: 1rem;
}

.tabs button.active > .cv-icon {
  animation: cv-pop-icon 0.45s cubic-bezier(0.3, 1.6, 0.5, 1);
}

/* The chosen service's icon floats */
.service.active .service-icon {
  animation: cv-bob 3.5s ease-in-out infinite;
}

/* Client pills rise a touch, and their badge turns */
.logo-pill {
  transition: translate 0.25s var(--ease-out), border-color 0.25s;
}

.logo-dot {
  transition: rotate 0.4s cubic-bezier(0.3, 1.6, 0.5, 1);
}

.logo-pill:hover {
  translate: 0 -3px;
  border-color: color-mix(in srgb, #9b5cf5 45%, var(--glass-line));
}

.logo-pill:hover .logo-dot {
  rotate: -12deg;
}

/* Job badges, fact tiles, links and chips answer the pointer too */
.job-logo {
  transition: rotate 0.4s cubic-bezier(0.3, 1.6, 0.5, 1), scale 0.4s cubic-bezier(0.3, 1.6, 0.5, 1);
}

.job:hover .job-logo {
  rotate: -8deg;
  scale: 1.08;
}

.work-facts div {
  transition: translate 0.2s var(--ease-out), background-color 0.2s;
}

.work-facts div:hover {
  translate: 0 -2px;
  background: var(--violet-soft);
}

.link-arrow {
  transition: transform 0.2s var(--ease-out);
}

.link-row:hover .link-arrow {
  transform: translate(2px, -2px);
}

.chip-dot {
  transition: rotate 0.4s cubic-bezier(0.3, 1.6, 0.5, 1);
}

.feature-chips li:hover .chip-dot {
  rotate: 90deg;
}

/* Footer links: an underline draws in from the left */
.foot-col a,
.foot-btn {
  background-image: linear-gradient(currentColor, currentColor);
  background-size: 0% 1px;
  background-position: 0 100%;
  background-repeat: no-repeat;
  transition: background-size 0.3s var(--ease-out), color 0.2s;
}

.foot-col a:hover,
.foot-btn:hover {
  background-size: 100% 1px;
}

/* ---------- Narrower screens ---------- */
@media (max-width: 960px) {
  .nav-links,
  .nav-apps span {
    display: none;
  }

  .nav-end {
    margin-left: auto;
  }

  .nav-toggle {
    display: block;
  }

  .about,
  .split {
    grid-template-columns: 1fr;
  }

  .work,
  .edu,
  .quotes,
  .articles {
    grid-template-columns: repeat(2, 1fr);
  }

  .work-card.lifted {
    margin-top: 0;
  }

  .foot {
    grid-template-columns: 1fr 1fr;
  }

  .foot-about {
    grid-column: 1 / -1;
  }
}

@media (max-width: 720px) {
  .hero,
  .cta {
    border-radius: 24px;
  }

  .nav-brand span {
    display: none;
  }

  .nav-apps {
    display: none;
  }

  /* Phones keep only the middle card, full width */
  .hero-cards {
    grid-template-columns: 1fr;
  }

  .float-card.side {
    display: none;
  }

  .work,
  .edu,
  .quotes,
  .articles {
    grid-template-columns: 1fr;
  }

  .toast-card {
    margin: -1.5rem 0 0 0.5rem;
  }

  .job {
    flex-direction: column;
    gap: 0.75rem;
  }

  .job-head {
    flex-direction: column;
    gap: 0.4rem;
  }

  .hero-btn {
    padding-right: 0.85rem;
  }

  .foot {
    grid-template-columns: 1fr;
  }

  .foot-bottom {
    flex-direction: column;
    gap: 0.25rem;
  }
}

/* The quiet versions: reduced motion (system or Settings) and lite effects keep everything still
   (the script also skips the reveals and count-up there) */
@media (prefers-reduced-motion: reduce) {
  .marquee {
    mask-image: none;
  }

  .logos {
    flex-wrap: wrap;
    flex-shrink: 1;
    justify-content: center;
    animation: none;
  }

  .logos.copy,
  .hero-rays,
  .live::after,
  .ring {
    display: none;
  }

  .carousel-track,
  .service {
    transition: none;
  }
}

:root[data-motion='reduced'] .marquee,
:root[data-effects='lite'] .marquee {
  mask-image: none;
}

:root[data-motion='reduced'] .logos,
:root[data-effects='lite'] .logos {
  flex-wrap: wrap;
  flex-shrink: 1;
  justify-content: center;
  animation: none;
}

:root[data-motion='reduced'] .logos.copy,
:root[data-effects='lite'] .logos.copy,
:root[data-motion='reduced'] .hero-rays,
:root[data-effects='lite'] .hero-rays,
:root[data-motion='reduced'] .live::after,
:root[data-motion='reduced'] .ring,
:root[data-effects='lite'] .ring {
  display: none;
}

/* ---------- Save as PDF: just the CV, without the app around it ---------- */
@media print {
  :global(.site-bar),
  :global(.fab),
  .cv-nav,
  .edit-bar,
  .edit-row,
  .add-tile,
  .foot-btn.owner,
  .ring,
  .progress,
  .hero-spot,
  .hero-cta,
  .hero-links,
  .tabs,
  .foot-btn {
    display: none !important;
  }

  :global(body),
  :global(.tool) {
    background: #fff !important;
  }

  :global(.tool) {
    padding: 0 !important;
  }

  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }

  .cv {
    gap: 2rem;
  }

  .pending {
    opacity: 1 !important;
    transform: none !important;
  }

  .hero,
  .cta,
  .service,
  .work-bar,
  .logo-dot,
  .by-avatar,
  .work-logo,
  .chip-dot,
  .fc-icon {
    box-shadow: none;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .hero-cards {
    margin-bottom: 1.5rem;
  }

  .float-card {
    border-radius: 22px;
  }

  .glass,
  .service {
    box-shadow: none;
    backdrop-filter: none;
    break-inside: avoid;
  }

  /* Every service, side by side, instead of the sliding row */
  .carousel {
    mask-image: none;
    overflow: visible;
  }

  .carousel-track {
    flex-wrap: wrap;
    transform: none;
  }

  .service {
    width: calc(50% - var(--gap) / 2);
    opacity: 1;
    transform: none;
  }

  .marquee {
    mask-image: none;
  }

  .logos {
    flex-wrap: wrap;
    flex-shrink: 1;
    animation: none;
  }

  .logos.copy,
  .hero-rays {
    display: none !important;
  }
}
</style>
