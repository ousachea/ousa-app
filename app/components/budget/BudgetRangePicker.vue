<script setup lang="ts">
import { addMonths, formatRange, monthRange, today, weekRange, type DateRange } from '~/utils/budget/dates'

// Which period to look at: a calendar month (default, with arrows), this week, today, or any dates
export type RangeMode = 'month' | 'week' | 'day' | 'custom'
const props = defineProps<{ weekStart: 0 | 1, modes?: RangeMode[] }>()
const range = defineModel<DateRange>({ required: true })
const mode = defineModel<RangeMode>('mode', { default: 'month' })
const { play } = useSound()
// Switching period or month cross-fades the figures below
const pickedMode = smoothRef(mode)

const MODES = computed(() => (props.modes ?? ['month', 'week', 'day', 'custom']).map(value => ({
  value, label: { month: 'Month', week: 'This week', day: 'Today', custom: 'Custom' }[value]
})))

watch(mode, (m) => {
  if (m === 'month') range.value = monthRange(range.value.from > today() ? today() : range.value.from)
  else if (m === 'week') range.value = weekRange(today(), props.weekStart)
  else if (m === 'day') range.value = { from: today(), to: today() }
})

const isThisMonth = computed(() => range.value.from === monthRange(today()).from)
function shift(by: number) {
  const next = monthRange(addMonths(range.value.from, by))
  if (next.from > today()) return
  viewTransition(() => (range.value = next))
  play('select')
}

const from = computed({ get: () => range.value.from, set: v => (range.value = { from: v, to: v > range.value.to ? v : range.value.to }) })
const to = computed({ get: () => range.value.to, set: v => (range.value = { from: v < range.value.from ? v : range.value.from, to: v }) })
</script>

<template>
  <div class="range-picker">
    <div class="segmented modes" role="radiogroup" aria-label="Period">
      <label v-for="m in MODES" :key="m.value" :class="{ active: mode === m.value }">
        <input v-model="pickedMode" type="radio" :value="m.value">{{ m.label }}
      </label>
    </div>
    <div v-if="mode === 'month'" class="month">
      <button type="button" class="btn btn-quiet btn-sm arrow" aria-label="Previous month" @click="shift(-1)">
        <AppIcon name="chevron-left" />
      </button>
      <strong aria-live="polite">{{ formatRange(range) }}</strong>
      <button type="button" class="btn btn-quiet btn-sm arrow" aria-label="Next month" :disabled="isThisMonth" @click="shift(1)">
        <AppIcon name="chevron-right" />
      </button>
    </div>
    <div v-else-if="mode === 'custom'" class="custom">
      <DatePicker v-model="from" aria-label="From" />
      <span aria-hidden="true">–</span>
      <DatePicker v-model="to" aria-label="To" />
    </div>
    <strong v-else class="label">{{ formatRange(range) }}</strong>
  </div>
</template>

<style scoped>
.range-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
}

.modes label {
  padding-inline: 0.7rem;
  white-space: nowrap;
}

.month,
.custom {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.month strong {
  min-width: 9.5rem;
  text-align: center;
}

.arrow {
  min-width: 2.5rem;
  padding-inline: 0.5rem;
}

.arrow svg {
  width: 1.1rem;
  height: 1.1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (max-width: 480px) {
  .modes {
    width: 100%;
  }
}
</style>
