<script setup lang="ts">
// Time picker in the app's own style, replacing <input type="time">. Works with 24-hour "HH:MM" strings.
// Pick an hour, then a minute (which closes it). Keyboard: Up/Down move within a column, Left/Right
// switch columns, Enter picks, Esc closes.
const props = withDefaults(defineProps<{ ariaLabel?: string, step?: number }>(), { ariaLabel: undefined, step: 5 })
const model = defineModel<string>({ default: '' })

const uid = useId()
const trigger = ref<HTMLButtonElement>()
const panel = ref<HTMLDivElement>()
const { open, placement, show, hide } = useAnchoredPopover(trigger, panel)
const { play } = useSound()

const pad = (n: number) => String(n).padStart(2, '0')
const valid = computed(() => /^([01]\d|2[0-3]):[0-5]\d$/.test(model.value))
const hour = computed(() => (valid.value ? Number(model.value.slice(0, 2)) : -1))
const minute = computed(() => (valid.value ? Number(model.value.slice(3, 5)) : -1))

const HOURS = Array.from({ length: 24 }, (_, h) => h)
// Every `step` minutes, plus the current minute when it's off the step, so it still shows as picked
const minutes = computed(() => {
  const list = Array.from({ length: Math.ceil(60 / props.step) }, (_, i) => i * props.step)
  if (minute.value >= 0 && !list.includes(minute.value)) list.push(minute.value)
  return list.sort((a, b) => a - b)
})

function setHour(h: number) {
  model.value = `${pad(h)}:${pad(Math.max(0, minute.value))}`
  play('select')
}
function setMinute(m: number) {
  model.value = `${pad(Math.max(0, hour.value))}:${pad(m)}`
  play('select')
  close()
}
function now() {
  const d = new Date()
  model.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  play('select')
  close()
}

function openPicker() {
  show()
  play('open')
  // The picked hour and minute scroll to the middle of their columns
  nextTick(() => {
    for (const el of panel.value?.querySelectorAll<HTMLElement>('.selected') ?? []) {
      const col = el.parentElement!
      col.scrollTop = el.offsetTop - col.clientHeight / 2 + el.offsetHeight / 2
    }
    panel.value?.querySelector<HTMLElement>('.hours .selected, .hours button')?.focus({ preventScroll: true })
  })
}
function close() {
  hide({ refocus: true })
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    // Inside a popup, Esc closes only the picker
    e.preventDefault()
    e.stopPropagation()
    close()
    return
  }
  const el = e.target as HTMLElement
  if (!el.dataset.cell) return
  const col = el.parentElement!
  const sibling = e.key === 'ArrowDown' ? el.nextElementSibling : e.key === 'ArrowUp' ? el.previousElementSibling : undefined
  const other = e.key === 'ArrowRight' || e.key === 'ArrowLeft'
    ? (col.classList.contains('hours') ? panel.value?.querySelector('.mins') : panel.value?.querySelector('.hours'))
    : undefined
  const target = (sibling ?? other?.querySelector('.selected') ?? other?.firstElementChild) as HTMLElement | null | undefined
  if (!target) return
  e.preventDefault()
  target.focus()
  target.scrollIntoView({ block: 'nearest' })
}
</script>

<template>
  <div class="time-picker">
    <button
      ref="trigger"
      type="button"
      class="input trigger"
      :class="{ open, empty: !valid }"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="`${uid}-panel`"
      :aria-label="`${props.ariaLabel ?? 'Time'}: ${valid ? model : 'Pick a time'}`"
      @click="open ? close() : openPicker()"
    >
      <AppIcon class="icon" name="clock" />
      <span class="value">{{ valid ? model : 'Pick a time' }}</span>
    </button>

    <div
      :id="`${uid}-panel`"
      ref="panel"
      popover="manual"
      class="clock"
      :class="[`from-${placement}`, { 'is-open': open }]"
      role="dialog"
      :aria-label="props.ariaLabel ?? 'Choose a time'"
      @keydown="onKey"
    >
      <div class="heads" aria-hidden="true">
        <span>Hour</span>
        <span>Minute</span>
      </div>
      <div class="cols">
        <div class="col hours" role="group" aria-label="Hour">
          <button
            v-for="h in HOURS"
            :key="h"
            type="button"
            class="cell"
            data-cell
            :class="{ selected: h === hour }"
            :aria-pressed="h === hour"
            @click="setHour(h)"
          >
            {{ pad(h) }}
          </button>
        </div>
        <div class="col mins" role="group" aria-label="Minute">
          <button
            v-for="m in minutes"
            :key="m"
            type="button"
            class="cell"
            data-cell
            :class="{ selected: m === minute }"
            :aria-pressed="m === minute"
            @click="setMinute(m)"
          >
            {{ pad(m) }}
          </button>
        </div>
      </div>
      <footer class="foot">
        <button type="button" class="link" @click="now">Now</button>
        <button type="button" class="link" @click="close">Done</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.time-picker {
  position: relative;
  min-width: 0;
}

.trigger {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  text-align: left;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}

.trigger.open {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
}

.icon {
  flex: none;
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty .value {
  color: var(--ink-3);
}

.clock {
  position: fixed;
  inset: auto;
  margin: 0;
  width: 12.5rem;
  padding: 0.6rem;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  box-shadow: 0 22px 48px -14px rgb(var(--shadow) / 0.38), 0 2px 6px rgb(var(--shadow) / 0.08);
}

.clock.is-open {
  animation: clock-in 0.18s cubic-bezier(0.2, 0, 0, 1);
}

.clock.from-above.is-open {
  animation-name: clock-in-above;
}

.heads,
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.heads span {
  padding: 0.2rem 0 0.4rem;
  font-size: var(--text-2xs);
  font-weight: 700;
  text-align: center;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 2px;
  height: 13.5rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.cell {
  flex: none;
  padding: 0.5rem 0;
  font: inherit;
  font-size: var(--text-base);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--dur-fast), color var(--dur-fast);
}

.cell:hover {
  background: var(--surface-2);
}

.cell:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.cell.selected,
.cell.selected:hover {
  color: var(--on-accent, #fff);
  background: var(--accent);
}

.foot {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
  padding-top: 0.55rem;
  border-top: 1px solid var(--line);
}

.link {
  padding: 0.3rem 0.5rem;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.link:hover {
  color: var(--ink);
  background: var(--surface-2);
}

@keyframes clock-in {
  from { opacity: 0; translate: 0 -4px; scale: 0.98; }
}

@keyframes clock-in-above {
  from { opacity: 0; translate: 0 4px; scale: 0.98; }
}

@media (prefers-reduced-motion: reduce) {
  .clock.is-open { animation: none; }
}
</style>
