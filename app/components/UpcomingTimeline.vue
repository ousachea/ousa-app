<script setup lang="ts">
import type { UpcomingKind, UpcomingMark } from '~/utils/calendar'

// Calendar's next 30 days on one track: your dates, renewals (with their price) and public holidays,
// each kind in its own colour. Shown on both tabs, so either one answers "what's coming up?"
const props = defineProps<{ marks: UpcomingMark[], empty?: string }>()

const KINDS: Record<UpcomingKind, string> = { date: 'Your dates', renewal: 'Renewals', holiday: 'Holidays' }

// Labels that would touch go up a lane. Each label's width is estimated from its text and placed on the
// track as drawn (it changes with the window and the phone layout), so long holiday names never overlap.
const track = ref<HTMLElement>()
const trackWidth = ref(800)
const phone = ref(false)
let observer: ResizeObserver | undefined
onMounted(() => {
  const measure = () => {
    trackWidth.value = track.value?.clientWidth || 800
    phone.value = window.innerWidth <= 560
  }
  measure()
  observer = new ResizeObserver(measure)
  if (track.value) observer.observe(track.value)
})
onBeforeUnmount(() => observer?.disconnect())

const labelWidth = (m: UpcomingMark) => {
  // About 7px a character for the bold name and 6px for the price at this size, plus padding;
  // phones show the name only, cut at 5.5rem
  const w = 16 + m.name.length * 7 + (m.detail && !phone.value ? (m.detail.length + 1) * 6 : 0)
  return phone.value ? Math.min(w, 88) : w
}
const isEnd = (m: UpcomingMark) => m.day > UPCOMING_DAYS - 7

const placed = computed(() => {
  const laneEnds: number[] = [] // the right edge (px) of the last label in each lane
  return props.marks.map((m) => {
    const x = (m.day / UPCOMING_DAYS) * trackWidth.value
    const w = labelWidth(m)
    // Near the end a label hangs to the left of its dot, so it stays on the card
    const from = isEnd(m) ? x - w : x
    let lane = laneEnds.findIndex(end => from > end + 6)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = from + w
    return { ...m, lane }
  })
})
const lanes = computed(() => Math.max(1, ...placed.value.map(m => m.lane + 1)))
const kinds = computed(() => (Object.keys(KINDS) as UpcomingKind[]).filter(k => props.marks.some(m => m.kind === k)))

const weekTicks = [0, 7, 14, 21, 28]
const tickLabel = (d: number) => {
  if (d === 0) return 'Today'
  const date = new Date()
  date.setDate(date.getDate() + d)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
const whenOf = (day: number) => (day === 0 ? 'today' : day === 1 ? 'tomorrow' : `in ${day} days`)
</script>

<template>
  <section class="panel timeline" aria-label="Coming up in the next 30 days">
    <div class="timeline-head">
      <h3>Next 30 days</h3>
      <ul v-if="kinds.length > 1" class="legend" aria-label="Key">
        <li v-for="k in kinds" :key="k" :data-kind="k">{{ KINDS[k] }}</li>
      </ul>
    </div>
    <div ref="track" class="track" :style="{ '--lanes': lanes }">
      <span v-for="d in weekTicks" :key="d" class="tick" :style="{ left: `${(d / UPCOMING_DAYS) * 100}%` }">
        <span>{{ tickLabel(d) }}</span>
      </span>
      <span
        v-for="m in placed"
        :key="m.id"
        class="mark"
        :data-kind="m.kind"
        :class="{ end: isEnd(m) }"
        :style="{ left: `${(m.day / UPCOMING_DAYS) * 100}%`, '--lane': m.lane }"
        :title="`${m.name}${m.detail ? `: ${m.detail}` : ''}, ${whenOf(m.day)}`"
      >
        <span class="mark-label"><b>{{ m.name }}</b><span v-if="m.detail" class="mark-detail">{{ m.detail }}</span></span>
      </span>
    </div>
    <p v-if="!marks.length" class="quiet">{{ empty ?? 'Nothing in the next 30 days.' }}</p>
  </section>
</template>

<style scoped>
.timeline {
  padding: 1.1rem 1.4rem 2.4rem; /* room for the date labels under the track */
}

/* Each kind's colour: your dates in Calendar's purple, renewals in their indigo, holidays in red */
[data-kind='date'] { --kind: var(--purple); }
[data-kind='renewal'] { --kind: var(--indigo); }
[data-kind='holiday'] { --kind: var(--red); }

.timeline-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem 1rem;
}

.timeline-head h3 {
  font-size: 0.95rem;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--text-xs);
  color: var(--ink-2);
}

.legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.legend li::before {
  content: '';
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: var(--kind);
}

.track {
  position: relative;
  margin: 0.9rem 0.5rem 0 0.25rem;
  height: calc(var(--lanes) * 2.6rem + 1rem);
  border-bottom: 2px solid var(--line);
}

.tick {
  position: absolute;
  bottom: -0.35rem;
  width: 2px;
  height: 0.7rem;
  background: var(--line);
}

.tick span {
  position: absolute;
  top: 1rem;
  left: 0;
  font-size: 0.72rem;
  color: var(--ink-3);
  white-space: nowrap;
  transform: translateX(-10%);
}

.mark {
  position: absolute;
  bottom: -0.45rem;
  width: 0.9rem;
  height: 0.9rem;
  margin-left: -0.45rem;
  border-radius: 50%;
  background: var(--kind);
  box-shadow: 0 0 0 3px var(--surface);
}

/* A stem from the dot up to its label, longer for higher lanes */
.mark::before {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 100%;
  width: 1px;
  height: calc(0.6rem + var(--lane) * 2.6rem);
  background: color-mix(in srgb, var(--kind) 50%, transparent);
}

.mark-label {
  position: absolute;
  left: 0;
  bottom: calc(1.4rem + var(--lane) * 2.6rem);
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
  color: var(--ink-2);
  background: color-mix(in srgb, var(--kind) 9%, var(--surface-2));
  border-radius: 6px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.mark-label b {
  color: var(--ink);
}

/* The price after the name (a CSS space, so it's there however the template is laid out) */
.mark-detail::before {
  content: ' ';
}

.mark.end .mark-label {
  left: auto;
  right: 0;
}

.quiet {
  margin: 1.5rem 0 0;
  font-size: 0.875rem;
  color: var(--ink-3);
}

/* Phones: names only, kept short, so neighbouring labels don't run into each other.
   Prices are in the list right below. */
@media (max-width: 560px) {
  .mark-detail {
    display: none;
  }

  .mark-label {
    max-width: 5.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
