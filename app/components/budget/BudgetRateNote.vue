<script setup lang="ts">
import type { Total } from '~/utils/budget/calc'
import { isMixed } from '~/utils/budget/calc'
import { formatDay } from '~/utils/budget/dates'

// Says how a total that mixes dollars and riel was added up: what was entered in the other
// currency, and the rate and date used. Nothing is combined silently.
const props = defineProps<{ totals: Total[] }>()
const { rate, settings } = useBudget()

const mixed = computed(() => props.totals.some(isMixed) || (props.totals.some(t => t.value === undefined)))
const other = computed(() => (settings.value.primaryCurrency === 'USD' ? 'KHR' : 'USD'))
const source = computed(() => {
  const r = rate.value
  if (r.source === 'fixed') return `your fixed rate from ${formatDay(r.date!, { day: 'numeric', month: 'short', year: 'numeric' })}`
  if (r.source === 'live') return `today’s market rate (${formatDay(r.date!, { day: 'numeric', month: 'short' })})`
  if (r.source === 'saved') return 'the last market rate saved on this device'
  if (r.source === 'fallback') return 'a typical rate, because today’s couldn’t be loaded'
  return ''
})
</script>

<template>
  <p v-if="mixed" class="rate-note" :class="{ warn: rate.source === 'fallback' }">
    <template v-if="rate.rate">
      Totals in {{ settings.primaryCurrency }}. Amounts in {{ other }} are converted at {{ rate.rate.toLocaleString('en-US') }} ៛ per $1, {{ source }}.
    </template>
    <template v-else>Waiting for an exchange rate to add up dollars and riel together.</template>
  </p>
</template>

<style scoped>
.rate-note {
  margin: 0.5rem 0 0;
  font-size: var(--text-xs);
  color: var(--ink-3);
}

.rate-note.warn {
  color: var(--warn-ink);
}
</style>
