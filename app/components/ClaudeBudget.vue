<script setup lang="ts">
// Claude usage: what this period cost against a monthly budget, on a dial (components/gauge). The budget is
// remembered on this device and scaled to the period shown, so 30 days of a $100 budget is $100 and 7 days
// is $23. With no budget yet, it offers to set one.
const props = defineProps<{ spent: number, days: number, estimated?: boolean }>()
const { play } = useSound()
const budget = useRemembered<number>('claude-budget', 0, v => typeof v === 'number' && v >= 0)

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: n < 10 ? 2 : 0, maximumFractionDigits: n < 10 ? 2 : 0 })
const allowed = computed(() => (budget.value * props.days) / 30)
const share = computed(() => (allowed.value ? props.spent / allowed.value : 0))
// Spending at this rate for a whole month
const pace = computed(() => (props.spent / props.days) * 30)
const tone = computed(() => (share.value >= 1 ? 'over' : share.value >= 0.8 ? 'near' : 'fine'))
// A thin band inside the dial: fine up to 80%, then the last stretch before the budget runs out
const ZONES = [
  { to: 0.8, color: 'var(--green)' },
  { to: 1, color: 'var(--orange)' }
]

const editing = ref(false)
const draft = ref('')
function edit() {
  draft.value = budget.value ? String(budget.value) : ''
  editing.value = true
}
function save() {
  const n = Number(draft.value.replace(/[$,\s]/g, ''))
  if (!Number.isFinite(n) || n < 0) return
  budget.value = Math.round(n * 100) / 100
  editing.value = false
  play(n ? 'success' : 'toggle-off')
}
</script>

<template>
  <section class="panel claude-budget" :class="`tone-${tone}`" aria-label="Budget">
    <template v-if="budget && !editing">
      <div class="dial">
        <Gauge :value="Math.min(share, 1)" :min="0" :max="1" :start-angle="90" :end-angle="270" :radius="200" :padding="26" fit="content" transition :initial-value="0" role="img" :aria-label="`${Math.round(share * 100)}% of the budget for ${days} days`">
          <GaugeTrack :width="26" color="var(--ink)" :opacity="0.08" />
          <GaugeZones :zones="ZONES" :width="6" :offset="-26" :gap="1.5" end-cap="round" :opacity="0.7" />
          <GaugeArc :width="26" color="var(--meter)" />
          <!-- The arc stops at the end of the budget; the number doesn't -->
          <GaugeValue v-if="share <= 1" :y="-58" :font-size="64" weight="bold" color="var(--ink)" :format="v => `${Math.round(v * 100)}%`" />
          <GaugeText v-else :y="-58" :font-size="64" weight="bold" color="var(--red)">{{ Math.round(share * 100) }}%</GaugeText>
        </Gauge>
      </div>
      <div class="text">
        <span class="k">Budget</span>
        <b>{{ usd(spent) }} <span class="of">of {{ usd(allowed) }}</span></b>
        <small v-if="tone === 'over'" class="warn">Over by {{ usd(spent - allowed) }} for these {{ days }} days.</small>
        <small v-else>{{ usd(allowed - spent) }} left for these {{ days }} days{{ estimated ? ', at API prices' : '' }}.</small>
        <small>At this rate, {{ usd(pace) }} a month against {{ usd(budget) }}.</small>
        <button type="button" class="link" @click="edit">Change budget</button>
      </div>
    </template>
    <form v-else class="set" @submit.prevent="save">
      <div class="text">
        <span class="k">Budget</span>
        <small>Set a monthly budget to see how this period compares. It stays on this device.</small>
      </div>
      <label class="amount">
        <span class="sr-only">Monthly budget in US dollars</span>
        <span class="cur" aria-hidden="true">$</span>
        <input v-model="draft" class="input" inputmode="decimal" placeholder="100" autocomplete="off">
        <span class="per">a month</span>
      </label>
      <button type="submit" class="btn btn-sm">Save</button>
      <button v-if="editing" type="button" class="btn btn-quiet btn-sm" @click="editing = false">Cancel</button>
    </form>
  </section>
</template>

<style scoped>
.claude-budget {
  --meter: var(--green);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.75rem;
  padding: 1.1rem 1.25rem;
}

.tone-near { --meter: var(--orange); }
.tone-over { --meter: var(--red); }

.dial {
  flex: none;
  width: min(100%, 13rem);
}

.text {
  flex: 1 1 14rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
}

.k {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-3);
}

b {
  font-size: var(--text-xl);
  font-variant-numeric: tabular-nums;
}

.of {
  font-size: var(--text-md);
  font-weight: 500;
  color: var(--ink-2);
}

small {
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.warn {
  color: var(--red);
  font-weight: 600;
}

.link {
  margin-top: 0.35rem;
}

.set {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.amount {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.amount .input {
  width: 7rem;
  font-variant-numeric: tabular-nums;
}

.cur,
.per {
  color: var(--ink-2);
}
</style>
