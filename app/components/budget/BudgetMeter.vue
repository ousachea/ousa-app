<script setup lang="ts">
import { LEVELS, type BudgetLevel } from '~/utils/budget/calc'

// A budget's progress: a thin bar plus the level in words, so it never depends on colour alone
const props = defineProps<{ share: number | undefined, level: BudgetLevel, label: string, pace?: number }>()
const pct = computed(() => (props.share === undefined ? undefined : Math.round(props.share * 100)))
// Where the month is heading at this pace, as a share of the limit
const markAt = computed(() => (props.pace !== undefined ? Math.min(100, props.pace * 100) : undefined))
</script>

<template>
  <div class="meter" :class="`is-${level}`">
    <div
      class="track"
      role="meter"
      :aria-label="label"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.min(pct ?? 0, 100)"
      :aria-valuetext="pct === undefined ? 'Waiting for the exchange rate' : `${pct}% used, ${LEVELS[level].word.toLowerCase()}`"
    >
      <span class="fill" :style="{ width: `${Math.min(100, pct ?? 0)}%` }" />
      <span v-if="markAt !== undefined" class="pace" :style="{ left: `${markAt}%` }" title="Where this month is heading at this pace" />
    </div>
    <span class="badge" :class="LEVELS[level].badge">{{ LEVELS[level].word }}</span>
    <span class="pct">{{ pct === undefined ? '…' : `${pct}%` }}</span>
  </div>
</template>

<style scoped>
.meter {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 0.6rem;
}

.track {
  position: relative;
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line);
}

.fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
  background: var(--budget-ok);
  transition: width var(--dur-slow) var(--ease-out);
}

.is-warn .fill,
.is-reached .fill {
  background: var(--budget-warn);
}

.is-over .fill {
  background: var(--budget-over);
}

/* Projected end of month: a short tick on the track */
.pace {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  margin-left: -1px;
  border-radius: 1px;
  background: var(--ink-2);
}

.pct {
  min-width: 3ch;
  font-size: var(--text-sm);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
