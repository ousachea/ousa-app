<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Direction } from '~/utils/exchange'
import type { Cached } from '~/utils/cache'

const { play } = useSound()
const online = useOnline()

type Mode = 'check' | 'track'
const MODES: { value: Mode, label: string }[] = [
  { value: 'check', label: 'Check a rate' },
  { value: 'track', label: 'Track an exchange' }
]
const DIRECTIONS: { value: Direction, label: string }[] = [
  { value: 'usd-khr', label: 'Dollars to riel' },
  { value: 'khr-usd', label: 'Riel to dollars' }
]

const mode = ref<Mode>('check')
const direction = ref<Direction>('usd-khr')
const amount = ref<number | null>(100)
const rate = ref<number | null>(4000) // the rate you're offered, or the one you got before

// Market rate: live from the server, or the visitor's own (e.g. the NBC official rate)
const { data: live, status, error, refresh } = await useFetch<{ rate: number, updatedAt: string, source: string }>('/api/rate', { server: false })
const useOwnRate = ref(false)
const ownRate = ref<number | null>(null)
// Offline or when the service is down: the last rate this device saw, clearly labelled
const cachedRate = ref<Cached<{ rate: number, updatedAt: string, source: string }>>()
onMounted(() => (cachedRate.value = readCached('rate')))
watch(live, (d) => {
  if (d?.rate) writeCached('rate', d)
})
const usingCached = computed(() => !useOwnRate.value && !live.value?.rate && !!cachedRate.value)
const market = computed(() => (useOwnRate.value ? ownRate.value : live.value?.rate ?? cachedRate.value?.data.rate) ?? null)

watch(useOwnRate, (on) => {
  if (on && !ownRate.value && live.value) ownRate.value = Math.round(live.value.rate)
})

// Quick-pick amounts in the currency you're handing over; the field below takes any amount
const PRESETS = { USD: [10, 50, 100, 500], KHR: [10_000, 50_000, 100_000, 400_000] } as const

// Fill the rate field with today's market rate, fetching a fresh one first
async function useTodaysRate() {
  if (!useOwnRate.value) await refresh()
  if (market.value) {
    rate.value = Math.round(market.value)
    play('success')
    toast.success(`Using today’s rate: ${Math.round(market.value).toLocaleString('en-US')} ៛`)
  } else {
    play('error')
    toast.error('Couldn’t get today’s rate', { description: 'Check your connection and try again.' })
  }
}

function setAmount(value: number) {
  amount.value = value
  play('select')
}

const from = computed(() => fromCurrency(direction.value))
const to = computed(() => toCurrency(direction.value))

const valid = computed(() => !!(amount.value && amount.value > 0 && rate.value && rate.value > 0 && market.value && market.value > 0))

const result = computed(() => {
  if (!valid.value) return undefined
  return mode.value === 'check'
    ? checkOffer(amount.value!, direction.value, rate.value!, market.value!)
    : trackExchange(amount.value!, direction.value, rate.value!, market.value!)
})

// Currency the result is counted in: what you receive (check), or what you started with (track)
const resultCurrency = computed(() => (mode.value === 'check' ? to.value : from.value))
const otherCurrency = computed(() => (resultCurrency.value === 'KHR' ? 'USD' : 'KHR'))

// Which way the rate needs to move for you; used in the hint under the rate field
const betterRate = computed(() => {
  const higher = mode.value === 'check' ? direction.value === 'usd-khr' : direction.value === 'khr-usd'
  return higher ? 'higher' : 'lower'
})

const receiptTime = computed(() => new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))

const updated = computed(() => live.value
  ? new Date(live.value.updatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '')

// One sound per verdict change, not per keystroke
watch(() => result.value?.verdict, (v, old) => {
  if (!v || v === old) return
  play(v === 'gain' ? 'success' : v === 'loss' ? 'warning' : 'info')
})

function selectMode(value: Mode) {
  if (mode.value === value) return
  mode.value = value
  play('select')
}

function selectDirection(value: Direction) {
  if (direction.value === value) return
  // Keep it the same money: convert the amount into the currency you'll now hand over
  if (amount.value && market.value) {
    const converted = convert(amount.value, direction.value, market.value)
    amount.value = fromCurrency(value) === 'KHR' ? Math.round(converted / 100) * 100 : Math.round(converted * 100) / 100
  }
  direction.value = value
  play('select')
}

// Pull down on a phone for a fresh rate (CHECKLIST.md #26)
usePullToRefresh(() => reloadRate())

async function reloadRate() {
  await refresh()
  play(error.value ? 'error' : 'retry')
  if (error.value) toast.error('Couldn’t refresh the rate')
  else if (live.value) toast(`1 USD = ${Math.round(live.value.rate).toLocaleString('en-US')} ៛`, { description: 'Market rate refreshed' })
}
</script>

<template>
  <ToolPage>
    <div class="tabs" role="tablist" aria-label="What do you want to do?">
      <button
        v-for="m in MODES"
        :key="m.value"
        type="button"
        role="tab"
        class="tab"
        :aria-selected="mode === m.value"
        @click="selectMode(m.value)"
      >
        {{ m.label }}
      </button>
    </div>

    <div class="workspace">
      <div class="inputs">
        <Step :n="1" :title="mode === 'check' ? 'What are you exchanging?' : 'What did you exchange?'">
          <div class="panel group">
            <div class="segmented" role="radiogroup" aria-label="Direction">
              <label v-for="d in DIRECTIONS" :key="d.value" :class="{ active: direction === d.value }">
                <input type="radio" name="direction" :value="d.value" :checked="direction === d.value" @change="selectDirection(d.value)">
                {{ d.label }}
              </label>
            </div>
            <div class="presets" role="group" aria-label="Quick amounts">
              <button
                v-for="value in PRESETS[from]"
                :key="value"
                type="button"
                class="btn btn-quiet btn-sm"
                :aria-pressed="amount === value"
                @click="setAmount(value)"
              >
                {{ formatMoney(value, from) }}
              </button>
            </div>
            <label class="field">
              <span class="field-head">{{ mode === 'check' ? 'Amount you’ll hand over' : 'Amount you handed over' }} <span class="optional">or type any amount</span></span>
              <span class="money input">
                <span class="unit" aria-hidden="true">{{ from === 'USD' ? '$' : '៛' }}</span>
                <input v-model.number="amount" type="number" inputmode="decimal" min="0" :step="from === 'USD' ? 0.01 : 100" :aria-label="`Amount in ${from}`">
              </span>
            </label>
            <p v-if="amount && amount > 0 && market" class="preview-line">
              ≈ {{ formatMoney(convert(amount, direction, market), to) }} at today’s rate
            </p>
          </div>
        </Step>

        <Step
          :n="2"
          :title="mode === 'check' ? 'Rate you’re offered' : 'Rate you got'"
          :hint="`Riel for 1 dollar. A ${betterRate} rate is better for you.`"
          class="gap"
        >
          <div class="panel group">
            <label class="field">
              <span class="field-head">1 USD =</span>
              <span class="money input">
                <input v-model.number="rate" type="number" inputmode="decimal" min="0" step="1" aria-label="Exchange rate in riel per dollar">
                <span class="unit" aria-hidden="true">៛</span>
              </span>
            </label>
            <button type="button" class="btn btn-quiet btn-sm todays" :disabled="status === 'pending' || status === 'idle'" @click="useTodaysRate">
              Use today’s rate{{ market ? ` (${Math.round(market).toLocaleString('en-US')} ៛)` : '' }}
            </button>
          </div>
        </Step>

        <section class="panel market" aria-label="Market rate">
          <div class="market-head">
            <div>
              <span class="label">Market rate</span>
              <strong v-if="market">1 USD = {{ Math.round(market).toLocaleString('en-US') }} ៛</strong>
              <!-- "idle" is what the server renders, since the rate is only fetched in the browser -->
              <span v-else-if="status === 'pending' || status === 'idle'" class="skeleton rate-skeleton" aria-label="Loading the market rate" />
              <strong v-else>Not available</strong>
            </div>
            <button v-if="!useOwnRate" type="button" class="btn btn-quiet btn-sm" :disabled="status === 'pending' || status === 'idle'" @click="reloadRate">Refresh</button>
          </div>
          <p v-if="!useOwnRate && live" class="note">Mid-market rate from {{ live.source }}, updated {{ updated }}. Money changers usually quote a little either side of it.</p>
          <p v-else-if="usingCached && cachedRate" class="note">
            {{ online ? 'Couldn’t reach the rate service just now' : 'You’re offline' }}, so this is the last rate seen on this device, from {{ cachedWhen(cachedRate.at) }}.
            <button type="button" class="link" @click="reloadRate">Try again</button>
          </p>
          <p v-else-if="!useOwnRate && error" class="note bad">Couldn’t load the market rate. Check your connection, or use your own rate below.</p>
          <label class="check">
            <input v-model="useOwnRate" type="checkbox">
            Use my own market rate (for example the National Bank of Cambodia’s official rate)
          </label>
          <label v-if="useOwnRate" class="field">
            <span class="field-head">1 USD =</span>
            <span class="money input">
              <input v-model.number="ownRate" type="number" inputmode="decimal" min="0" step="1" aria-label="Your market rate in riel per dollar">
              <span class="unit" aria-hidden="true">៛</span>
            </span>
          </label>
        </section>
      </div>

      <Step :n="3" :title="mode === 'check' ? 'Do you gain or lose?' : 'Gain or loss if you convert back today'" v-sticky-fit class="result-step">
        <!-- Printed like a money changer's receipt: header, dashed rules, a bold total, a torn edge -->
        <div v-if="result" class="result receipt" :data-verdict="result.verdict" aria-live="polite">
          <header class="receipt-head">
            <span>{{ mode === 'check' ? 'Rate check' : 'Exchange check' }}</span>
            <span>{{ receiptTime }}</span>
          </header>
          <p class="rate-line">1 USD = {{ rate!.toLocaleString('en-US') }} ៛ <span>· market {{ Math.round(market!).toLocaleString('en-US') }} ៛</span></p>
          <p class="verdict">
            <template v-if="result.verdict === 'fair'">About the same as the market</template>
            <template v-else>
              You {{ result.verdict === 'gain' ? 'gain' : 'lose' }}
              <strong>{{ formatMoney(Math.abs(result.diff), resultCurrency) }}</strong>
            </template>
          </p>
          <p class="sub">
            {{ result.verdict === 'fair' ? 'Within 0.1% of the market rate.' : `About ${formatMoney(Math.abs(result.diffOther), otherCurrency)}, or ${Math.abs(result.percent * 100).toFixed(2)}%` }}
          </p>

          <dl class="lines">
            <template v-if="mode === 'check'">
              <div><dt>You get at {{ rate!.toLocaleString('en-US') }} ៛</dt><dd>{{ formatMoney(result.receive, resultCurrency) }}</dd></div>
              <div><dt>At the market rate you’d get</dt><dd>{{ formatMoney(result.benchmark, resultCurrency) }}</dd></div>
            </template>
            <template v-else>
              <div><dt>You started with</dt><dd>{{ formatMoney(result.benchmark, resultCurrency) }}</dd></div>
              <div><dt>You received at {{ rate!.toLocaleString('en-US') }} ៛</dt><dd>{{ formatMoney(convert(amount!, direction, rate!), to) }}</dd></div>
              <div><dt>Converted back at today’s rate</dt><dd>{{ formatMoney(result.receive, resultCurrency) }}</dd></div>
            </template>
            <div class="total"><dt>Difference</dt><dd>{{ formatMoney(result.diff, resultCurrency, { signed: true }) }}</dd></div>
          </dl>

          <p v-if="mode === 'track'" class="note">
            Uses the mid-market rate. A money changer’s rate will be slightly worse, so the real result is a little lower.
          </p>
        </div>
        <p v-else class="panel waiting">
          {{ market ? 'Enter an amount and a rate to see whether you gain or lose.' : 'Waiting for the market rate…' }}
        </p>
      </Step>
    </div>
  </ToolPage>
</template>

<style scoped>
.tabs {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
  width: fit-content;
  margin: -0.5rem auto 2.25rem;
  padding: 4px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 14px;
}

.tab {
  padding: 0.55rem 1.1rem;
  font: inherit;
  font-weight: 600;
  color: var(--ink-2);
  background: transparent;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.tab:hover { color: var(--ink); }

.tab[aria-selected='true'] {
  color: var(--ink);
  background: var(--surface);
  box-shadow: 0 1px 2px rgb(var(--shadow) / 0.12), 0 0 0 1px var(--line);
}

/* A calculator: one narrow column, amount → rate → market → the receipt prints out underneath.
   On wide screens the receipt sits beside the inputs and stays in view while you change them. */
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr); /* never wider than the screen */
  gap: 2rem;
  max-width: 560px;
  margin: 0 auto;
}

@media (min-width: 1000px) {
  .workspace {
    max-width: 1280px;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: 2.5rem;
    align-items: start;
  }

  .result-step {
    position: sticky;
    top: 5.5rem; /* clear of the menu button */
  }
}

.gap { margin-top: 2rem; }

.group {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.money {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.9rem;
}

.money input {
  flex: 1;
  min-width: 0;
  padding: 0.75rem 0;
  font: inherit;
  font-size: 1.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
  background: transparent;
  border: 0;
  outline: none;
}

.presets {
  /* Even columns, so four amounts sit in one row instead of three and one */
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(4.25rem, 1fr));
  gap: 0.4rem;
}

.presets .btn[aria-pressed='true'] {
  color: var(--on-accent, #fff);
  background: var(--accent-btn, var(--accent));
  box-shadow: none;
}

.optional {
  font-weight: 400;
  color: var(--ink-3);
}

.preview-line {
  margin: -0.25rem 0 0;
  font-size: 0.9rem;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.todays {
  align-self: flex-start;
}

.unit {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--ink-3);
}

.market {
  margin-top: 2rem;
  padding: 1.1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.market-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.market-head > div {
  display: flex;
  flex-direction: column;
}

.rate-skeleton {
  width: 11rem;
  height: 1.6rem;
  margin-top: 0.2rem;
}

.label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-2);
}

.market-head strong {
  font-size: 1.15rem;
  font-variant-numeric: tabular-nums;
}

.note {
  margin: 0;
  font-size: 0.85rem;
  color: var(--ink-3);
}

.note.bad { color: var(--bad-ink); }

.check {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  font-size: 0.9rem;
  cursor: pointer;
}

.check input {
  flex: none;
  width: 1.05rem;
  height: 1.05rem;
  margin: 0.15rem 0 0;
  accent-color: var(--accent);
}

.result-step {
  position: static;
}

/* Receipt paper: slightly warm, a zig-zag torn bottom edge, dashed rules */
.receipt {
  --paper: color-mix(in srgb, var(--surface) 94%, #f3e9d2);
  position: relative;
  padding: 1.5rem 1.75rem 2.25rem;
  background: var(--paper);
  border-radius: 14px 14px 0 0;
  filter: drop-shadow(0 1px 1px rgb(var(--shadow) / 0.12)) drop-shadow(0 10px 18px rgb(var(--shadow) / 0.12));
  -webkit-mask: radial-gradient(circle 9px at 50% 100%, transparent 98%, #000) 50% 100% / 18px 100% repeat-x;
  mask: radial-gradient(circle 9px at 50% 100%, transparent 98%, #000) 50% 100% / 18px 100% repeat-x;
}

.receipt-head {
  display: flex;
  justify-content: space-between;
  padding-bottom: 0.6rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-3);
  border-bottom: 1px dashed var(--ink-3);
}

.rate-line {
  margin: 0.8rem 0 1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.rate-line span {
  font-weight: 400;
  color: var(--ink-3);
}

.verdict {
  margin: 0;
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.verdict strong {
  font-variant-numeric: tabular-nums;
}

[data-verdict='gain'] .verdict strong { color: var(--good-ink); }
[data-verdict='loss'] .verdict strong { color: var(--bad-ink); }

.sub {
  margin: 0.35rem 0 0;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.lines {
  margin: 1.5rem 0 0;
}

.lines div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 0;
  border-top: 1px dashed color-mix(in srgb, var(--ink-3) 60%, transparent);
}

/* The total line, double-ruled like a till receipt */
.lines .total {
  margin-top: 0.25rem;
  border-top: 3px double var(--ink-3);
  font-size: 1.1rem;
}

dt { color: var(--ink-2); }

dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.lines .total dd {
  font-weight: 800;
}

[data-verdict='gain'] .total dd { color: var(--good-ink); }
[data-verdict='loss'] .total dd { color: var(--bad-ink); }

.result .note {
  margin-top: 1rem;
}

.waiting {
  margin: 0;
  padding: 2rem 1.5rem;
  text-align: center;
  color: var(--ink-3);
}

@media (max-width: 900px) {
  .workspace { grid-template-columns: minmax(0, 1fr); }
  .result-step { position: static; }
}
</style>
