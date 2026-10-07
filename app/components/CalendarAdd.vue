<script setup lang="ts">
// "Add to calendar" for a countdown: open it in Google Calendar, or download an .ics file that
// Apple Calendar, Outlook and most phones open directly. A date with no time becomes an all-day event;
// with a time it's a one-hour event at that time, in whatever time zone the calendar is set to.
const props = defineProps<{ title: string, date: string, time?: string, details?: string, label?: string }>()

const trigger = ref<HTMLButtonElement>()
const menu = ref<HTMLDivElement>()
const { open, placement, show, hide } = useAnchoredPopover(trigger, menu)
const { play } = useSound()

const pad = (n: number) => String(n).padStart(2, '0')
const compact = (d: Date, withTime: boolean) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${withTime ? `T${pad(d.getHours())}${pad(d.getMinutes())}00` : ''}`

// Start and end in calendar format: all-day events end the next day (exclusive), timed ones an hour later
const range = computed(() => {
  const timed = !!props.time
  const start = new Date(`${props.date}T${props.time || '00:00'}`)
  const end = new Date(start)
  if (timed) end.setHours(end.getHours() + 1)
  else end.setDate(end.getDate() + 1)
  return { start: compact(start, timed), end: compact(end, timed), timed }
})

const googleUrl = computed(() => {
  const url = new URL('https://calendar.google.com/calendar/render')
  url.searchParams.set('action', 'TEMPLATE')
  url.searchParams.set('text', props.title)
  url.searchParams.set('dates', `${range.value.start}/${range.value.end}`)
  if (props.details) url.searchParams.set('details', props.details)
  return url.toString()
})

// Text in .ics files escapes commas, semicolons and backslashes, and folds newlines
const icsText = (s: string) => s.replace(/[\\,;]/g, m => `\\${m}`).replace(/\n/g, '\\n')

function downloadIcs() {
  const { start, end, timed } = range.value
  const stamp = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ousa’s Apps//Countdown//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@ousa-apps`,
    `DTSTAMP:${stamp}`,
    timed ? `DTSTART:${start}` : `DTSTART;VALUE=DATE:${start}`,
    timed ? `DTEND:${end}` : `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${icsText(props.title)}`,
    ...(props.details ? [`DESCRIPTION:${icsText(props.details)}`] : []),
    // A reminder the day before
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(props.title)}`,
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ]
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }))
  a.download = `${props.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'event'}.ics`
  a.click()
  URL.revokeObjectURL(a.href)
  play('copy')
  hide()
}

function toggle() {
  if (open.value) return hide()
  show()
  play('open')
  nextTick(() => menu.value?.querySelector<HTMLElement>('a, button')?.focus())
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    hide({ refocus: true })
  }
}
</script>

<template>
  <span class="calendar-add">
    <button ref="trigger" type="button" class="trigger" :aria-expanded="open" aria-haspopup="menu" @click="toggle">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4M12 13v4M10 15h4" /></svg>
      {{ label ?? 'Add to calendar' }}
    </button>
    <div ref="menu" popover="manual" class="menu" :class="[`from-${placement}`, { 'is-open': open }]" role="menu" @keydown="onKey">
      <a :href="googleUrl" target="_blank" rel="noopener" role="menuitem" @click="hide()">
        <span class="icon google" aria-hidden="true">G</span>
        <span>Google Calendar<small>Opens in a new tab</small></span>
      </a>
      <button type="button" role="menuitem" @click="downloadIcs">
        <span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14" /></svg></span>
        <span>Apple, Outlook or phone<small>Downloads an .ics file</small></span>
      </button>
    </div>
  </span>
</template>

<style scoped>
.calendar-add {
  display: inline-flex;
}

.trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0;
  font: inherit;
  font-size: 0.85rem;
  color: inherit;
  background: none;
  border: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.trigger svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.menu {
  position: fixed;
  inset: auto;
  margin: 0;
  width: 16rem;
  padding: 0.35rem;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 18px 40px -12px rgb(var(--shadow) / 0.35), 0 2px 6px rgb(var(--shadow) / 0.08);
}

.menu.is-open {
  animation: menu-in 0.16s cubic-bezier(0.2, 0, 0, 1);
}

.menu a,
.menu button {
  width: 100%;
  padding: 0.55rem 0.6rem;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  text-align: left;
  color: var(--ink);
  text-decoration: none;
  background: none;
  border: 0;
  border-radius: 9px;
  cursor: pointer;
}

.menu a:hover,
.menu button:hover,
.menu a:focus-visible,
.menu button:focus-visible {
  background: var(--surface-2);
  outline: none;
}

.menu small {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ink-3);
}

.icon {
  flex: none;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  font-weight: 800;
  color: var(--ink-2);
  background: var(--surface-2);
  border-radius: 9px;
}

.icon.google {
  color: #fff;
  background: #4285f4;
}

.icon svg {
  width: 1.05rem;
  height: 1.05rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@keyframes menu-in {
  from { opacity: 0; translate: 0 -4px; scale: 0.98; }
}

@media (prefers-reduced-motion: reduce) {
  .menu.is-open { animation: none; }
}
</style>
