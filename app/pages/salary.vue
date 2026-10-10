<script setup>
/* ------------------------------------------------------------------ *
 * Salary raise + tax calculator: what a raise is worth after
 * Cambodian Tax on Salary, overtime and deductions.
 * ------------------------------------------------------------------ */

const STORE_KEY = 'ousa-app:salary'

const sfx = useSound()
/** Section switches speak their resulting state, not the act of clicking. */
const sfxSection = nowOn => sfx.play(nowOn ? 'toggle-on' : 'toggle-off')

// A slider fires input dozens of times a second; one tick every 110ms is plenty
let lastSnap = 0
function snapSound() {
  const now = performance.now()
  if (now - lastSnap < 110) return
  lastSnap = now
  sfx.play('snap', { volume: 0.4 })
}

function pickCurrency(next) {
  if (currency.value === next) return
  switchCurrency(next)
  sfx.play('select')
}

/* --- inputs ------------------------------------------------------- */
const currency = ref('USD') // 'USD' | 'KHR'
const period = ref('month') // 'month' | 'year' — how salary is entered
const salary = ref(350) // in `currency`, per `period`
const raisePct = ref(7)

const taxMode = ref('brackets') // 'flat' | 'brackets' | 'payslip'
const flatRate = ref(10)
const payslipTax = ref(0) // exact amount deducted, per month, in `currency`
const payslipMarginal = ref(10) // rate applied to the raise on top of that anchor
const brackets = ref([]) // [{ upTo: number|null, rate: number }] monthly, in `currency`
const presetName = ref('Cambodia — Tax on Salary')

/* Overtime & benefits. OT is derived from the base salary, so a raise lifts
   the overtime rate too — that knock-on is most of why OT belongs here. */
const otMode = ref('rate') // 'rate' = hourly × multiplier | 'amount' = flat price each
const otHours = ref(0) // OT hours per month, or OT count in 'amount' mode
const otMultiplier = ref(1.5) // × the base hourly rate ('rate' mode)
const otUnitAmount = ref(20) // paid per OT, in `currency` ('amount' mode)
const otUnit = ref('night') // what one OT is: night | shift | day | hour
const hoursPerMonth = ref(208) // 48h week × 52/12, the Cambodian standard
const allowanceAmount = ref(0) // flat monthly benefit (transport, phone …)
const extrasTaxable = ref(true) // do OT + allowances form part of taxable pay?

const khrPerUsd = ref(4100)
const dependents = ref(0)
const dependentRelief = ref(0) // per dependent, per month, in `currency`
const preTaxDeduction = ref(0) // per month (pension / NSSF style)
const postTaxDeduction = ref(0) // per month (loan, insurance …)

const projectionYears = ref(5)

/* Which optional sections are switched on. Turning one off collapses it and
   removes it from the maths, while keeping its values for when it comes back. */
const sections = ref({ overtime: true, increase: true, tax: true, deductions: true, projection: true })

/* --- Cambodia Tax on Salary (monthly, KHR) ------------------------ *
 * Sub-Decree No. 196, in force since 2023. Thresholds are editable
 * below so they can be updated if the law changes.
 * ------------------------------------------------------------------ */
const KH_BRACKETS_KHR = [
  { upTo: 1_500_000, rate: 0 },
  { upTo: 2_000_000, rate: 5 },
  { upTo: 8_500_000, rate: 10 },
  { upTo: 12_500_000, rate: 15 },
  { upTo: null, rate: 20 }
]
const KH_RELIEF_KHR = 150_000 // per minor child / dependent spouse, per month

const roundThreshold = value => (currency.value === 'USD' ? Math.round(value) : Math.round(value / 1000) * 1000)

function loadCambodiaPreset() {
  const divisor = currency.value === 'USD' ? (khrPerUsd.value || 4100) : 1
  brackets.value = KH_BRACKETS_KHR.map(b => ({
    upTo: b.upTo === null ? null : roundThreshold(b.upTo / divisor),
    rate: b.rate
  }))
  dependentRelief.value = currency.value === 'USD'
    ? Math.round((KH_RELIEF_KHR / divisor) * 100) / 100
    : KH_RELIEF_KHR
  presetName.value = 'Cambodia — Tax on Salary'
}

function loadFlatPreset() {
  brackets.value = [{ upTo: null, rate: 10 }]
  dependentRelief.value = 0
  presetName.value = 'Custom'
}

/* --- bracket helpers ---------------------------------------------- */
const orderedBrackets = computed(() => {
  const finite = brackets.value.filter(b => b.upTo !== null && Number.isFinite(b.upTo))
    .sort((a, b) => a.upTo - b.upTo)
  const open = brackets.value.filter(b => b.upTo === null || !Number.isFinite(b.upTo))
  return [...finite, ...(open.length ? [open[open.length - 1]] : [{ upTo: null, rate: 0 }])]
})

function addBracket() {
  const finite = brackets.value.filter(b => b.upTo !== null)
  const last = finite[finite.length - 1]
  const next = last ? Math.round(last.upTo * 2) : 1000
  const openIndex = brackets.value.findIndex(b => b.upTo === null)
  const row = { upTo: next, rate: last ? Math.min(last.rate + 5, 100) : 5 }
  if (openIndex === -1) brackets.value.push(row)
  else brackets.value.splice(openIndex, 0, row)
  presetName.value = 'Custom'
}

function removeBracket(index) {
  if (brackets.value.length <= 1) return
  brackets.value.splice(index, 1)
  if (!brackets.value.some(b => b.upTo === null)) {
    brackets.value[brackets.value.length - 1].upTo = null
  }
  presetName.value = 'Custom'
}

/* --- core maths --------------------------------------------------- */
function progressiveTax(taxable) {
  let tax = 0
  let floor = 0
  for (const band of orderedBrackets.value) {
    const ceiling = band.upTo === null ? Infinity : band.upTo
    if (taxable > floor) tax += (Math.min(taxable, ceiling) - floor) * ((band.rate || 0) / 100)
    floor = ceiling
    if (taxable <= ceiling) break
  }
  return tax
}

/** Rate of the bracket a given taxable amount falls in, ignoring tax mode. */
function bandRate(taxable) {
  if (taxable <= 0) return orderedBrackets.value[0]?.rate || 0
  let floor = 0
  for (const band of orderedBrackets.value) {
    const ceiling = band.upTo === null ? Infinity : band.upTo
    if (taxable > floor && taxable <= ceiling) return band.rate || 0
    floor = ceiling
  }
  return orderedBrackets.value[orderedBrackets.value.length - 1]?.rate || 0
}

function marginalRate(taxable) {
  if (!sections.value.tax) return 0
  if (taxMode.value === 'flat') return flatRate.value || 0
  if (taxMode.value === 'payslip') return payslipMarginal.value || 0
  return bandRate(taxable)
}

/** Splits a monthly base salary into base + overtime + allowance. */
function grossFor(monthlyBase) {
  const base = Math.max(0, monthlyBase || 0)
  const hourly = (hoursPerMonth.value || 0) > 0 ? base / hoursPerMonth.value : 0
  if (!sections.value.overtime) return { base, hourly, ot: 0, allowance: 0, total: base }
  const count = Math.max(0, otHours.value || 0)
  // A flat price per OT is exactly that — flat. It does not move with the
  // base salary, so unlike rate-based OT a raise never lifts it.
  const ot = otMode.value === 'amount'
    ? count * Math.max(0, otUnitAmount.value || 0)
    : count * hourly * Math.max(0, otMultiplier.value || 0)
  const allowance = Math.max(0, allowanceAmount.value || 0)
  return { base, hourly, ot, allowance, total: base + ot + allowance }
}

/** Full monthly breakdown for a given monthly *base* salary. */
function breakdown(monthlyBase) {
  const { base, hourly, ot, allowance, total } = grossFor(monthlyBase)
  const on = sections.value
  const preTax = on.deductions ? Math.max(0, preTaxDeduction.value || 0) : 0
  const relief = on.deductions ? Math.max(0, (dependents.value || 0) * (dependentRelief.value || 0)) : 0

  // Exempt extras still reach take-home, they just never enter the tax base.
  const taxedPay = extrasTaxable.value ? total : base
  const taxable = Math.max(0, taxedPay - preTax - relief)

  let tax = 0
  if (!on.tax) {
    tax = 0
  } else if (taxMode.value === 'flat') {
    tax = taxable * ((flatRate.value || 0) / 100)
  } else if (taxMode.value === 'brackets') {
    tax = progressiveTax(taxable)
  } else if (taxMode.value === 'payslip') {
    // Anchor on the amount actually deducted, then tax only the change in
    // gross at the marginal rate — which is how a raise is really taxed.
    const anchor = Math.max(0, payslipTax.value || 0)
    const baseline = grossFor(monthlyNow.value).total
    tax = Math.max(0, anchor + (total - baseline) * ((payslipMarginal.value || 0) / 100))
  }

  const postTax = on.deductions ? Math.max(0, postTaxDeduction.value || 0) : 0
  const net = total - preTax - tax - postTax

  return {
    base,
    hourly,
    ot,
    allowance,
    gross: total,
    preTax,
    relief,
    taxable,
    tax,
    postTax,
    net,
    effRate: total > 0 ? (tax / total) * 100 : 0,
    marginal: marginalRate(taxable)
  }
}

const monthlyNow = computed(() => (period.value === 'year' ? (salary.value || 0) / 12 : (salary.value || 0)))
const activeRaise = computed(() => (sections.value.increase ? (raisePct.value || 0) : 0))
const monthlyNext = computed(() => monthlyNow.value * (1 + activeRaise.value / 100))

const before = computed(() => breakdown(monthlyNow.value))
const after = computed(() => breakdown(monthlyNext.value))

/* Rates solved backwards from the amount on the payslip. */
const payslipOnGross = computed(() => (before.value.gross > 0 ? ((payslipTax.value || 0) / before.value.gross) * 100 : 0))
const payslipOnTaxable = computed(() => (before.value.taxable > 0 ? ((payslipTax.value || 0) / before.value.taxable) * 100 : 0))
/* Each mode solves the other's number: a flat OT price implies a multiple of
   your base hourly, and a multiplier implies a price per OT hour. */
const otUnitPrice = computed(() => (otMode.value === 'amount'
  ? Math.max(0, otUnitAmount.value || 0)
  : before.value.hourly * Math.max(0, otMultiplier.value || 0)))
const otImpliedMultiple = computed(() => (before.value.hourly > 0 ? otUnitPrice.value / before.value.hourly : 0))

const suggestedMarginal = computed(() => bandRate(before.value.taxable))
const bracketWouldPredict = computed(() => progressiveTax(before.value.taxable))

const grossGain = computed(() => after.value.gross - before.value.gross)
const netGain = computed(() => after.value.net - before.value.net)
const taxGain = computed(() => after.value.tax - before.value.tax)
const keepRate = computed(() => (grossGain.value > 0 ? (netGain.value / grossGain.value) * 100 : null))

/* Target salary and the raise % drive each other. The field keeps its own
   draft string while focused, so the value recomputed from raisePct never
   rewrites the input under the cursor mid-keystroke. */
const targetSalary = computed(() => (period.value === 'year' ? monthlyNext.value * 12 : monthlyNext.value))

const targetDraft = ref('')
const targetFocused = ref(false)

const snapMoney = value => (currency.value === 'USD' ? Math.round(value * 100) / 100 : Math.round(value))

watch(targetSalary, (value) => {
  if (!targetFocused.value) targetDraft.value = String(snapMoney(value))
}, { immediate: true })

/** Typing a target salary solves the percentage backwards, live. */
function applyTarget(raw) {
  targetDraft.value = raw
  const base = salary.value || 0
  const value = Number(raw)
  if (raw === '' || !Number.isFinite(value) || base <= 0) return
  // 3dp keeps the solved target within a cent of what was typed; 1dp would
  // visibly miss (a 11.4% solve lands ~20c away from a 11.417% one).
  raisePct.value = Math.round((value / base - 1) * 100000) / 1000
}

function blurTarget() {
  targetFocused.value = false
  targetDraft.value = String(snapMoney(targetSalary.value))
}

const projection = computed(() => {
  const rows = []
  for (let year = 1; year <= (projectionYears.value || 1); year++) {
    const gross = monthlyNow.value * Math.pow(1 + (raisePct.value || 0) / 100, year)
    const row = breakdown(gross)
    rows.push({ year, ...row, netLift: row.net - before.value.net })
  }
  return rows
})

const projectionPeak = computed(() => Math.max(1, ...projection.value.map(r => r.gross)))

/* Stacked composition bars (net / tax / deductions) for before + after. */
function shares(b) {
  const total = Math.max(b.gross, 1)
  return {
    net: (Math.max(0, b.net) / total) * 100,
    tax: (b.tax / total) * 100,
    ded: ((b.preTax + b.postTax) / total) * 100
  }
}

/* --- formatting --------------------------------------------------- */
const symbol = computed(() => (currency.value === 'USD' ? '$' : '៛'))

function money(value, opts = {}) {
  const negative = value < 0
  const abs = Math.abs(value || 0)
  const dp = opts.dp ?? (currency.value === 'USD' ? 2 : 0)
  const body = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp
  }).format(abs)
  const text = currency.value === 'USD' ? `$${body}` : `${body}៛`
  return `${negative ? '−' : ''}${text}`
}

function signedMoney(value) {
  return `${value >= 0 ? '+' : '−'}${money(Math.abs(value))}`
}

const pct = value => `${(Math.round((value || 0) * 10) / 10).toFixed(1)}%`
const mult = value => `${(Math.round((value || 0) * 100) / 100).toFixed(2)}×`

const RAISE_CHIPS = [0, 3, 5, 7, 10, 15, 20, 30]
const OT_UNITS = ['night', 'shift', 'day', 'hour']
const otUnitPlural = computed(() => `${otUnit.value}s`)
/** A flat OT price expressed as hours of base pay — the honest comparison. */
const otHoursOfPay = computed(() => (before.value.hourly > 0 ? otUnitPrice.value / before.value.hourly : 0))

/* --- persistence -------------------------------------------------- */
const KEYS = {
  currency, period, salary, raisePct, taxMode, flatRate, brackets, presetName,
  payslipTax, payslipMarginal, khrPerUsd, dependents, dependentRelief,
  preTaxDeduction, postTaxDeduction, projectionYears,
  otMode, otHours, otMultiplier, otUnitAmount, otUnit, hoursPerMonth, allowanceAmount,
  extrasTaxable, sections
}

let hydrated = false

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      for (const [key, target] of Object.entries(KEYS)) {
        if (saved[key] !== undefined && saved[key] !== null) target.value = saved[key]
      }
    }
  } catch {
    /* corrupted or unavailable storage — fall through to defaults */
  }
  if (!Array.isArray(brackets.value) || !brackets.value.length) loadCambodiaPreset()
  hydrated = true
})

watch(
  () => Object.fromEntries(Object.entries(KEYS).map(([k, r]) => [k, r.value])),
  (state) => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state))
    } catch {
      /* storage full or blocked — calculator still works in-memory */
    }
  },
  { deep: true }
)

/* Switching currency rescales the money-denominated inputs so the
   numbers stay meaningful instead of becoming nonsense. */
function switchCurrency(next) {
  if (next === currency.value) return
  const rate = khrPerUsd.value || 4100
  const factor = next === 'KHR' ? rate : 1 / rate
  const scale = (r) => {
    r.value = Math.round((r.value || 0) * factor * 100) / 100
  }
  scale(salary)
  scale(preTaxDeduction)
  scale(postTaxDeduction)
  scale(payslipTax)
  scale(allowanceAmount)
  scale(otUnitAmount)
  currency.value = next
  if (presetName.value.startsWith('Cambodia')) loadCambodiaPreset()
  else {
    scale(dependentRelief)
    brackets.value = brackets.value.map(b => ({
      ...b,
      upTo: b.upTo === null ? null : Math.round(b.upTo * factor)
    }))
  }
}

</script>

<template>
  <ToolPage header="bar">
    <template #actions>
      <div class="segmented currency" role="radiogroup" aria-label="Currency">
        <label v-for="c in ['USD', 'KHR']" :key="c" :class="{ active: currency === c }">
          <input type="radio" name="salary-currency" :checked="currency === c" @change="pickCurrency(c)">
          {{ c === 'USD' ? '$ USD' : '៛ KHR' }}
        </label>
      </div>
    </template>

    <ClientOnly>
      <div class="workspace">
        <!-- ===== Inputs: one step per part of the payslip ===== -->
        <div class="inputs">
          <Step :n="1" title="Your salary now" :hint="`${money(monthlyNow)} a month · ${money(monthlyNow * 12)} a year, before tax.`">
            <div class="panel pad">
              <div class="row">
                <label class="field grow">
                  <span class="field-head">Gross salary</span>
                  <span class="money input">
                    <span class="unit" aria-hidden="true">{{ symbol }}</span>
                    <input v-model.number="salary" type="number" min="0" step="any" inputmode="decimal" aria-label="Gross salary">
                  </span>
                </label>
                <div class="segmented period" role="radiogroup" aria-label="Salary is per">
                  <label v-for="p in ['month', 'year']" :key="p" :class="{ active: period === p }">
                    <input type="radio" name="salary-period" :checked="period === p" @change="period = p; sfx.play('select')">
                    per {{ p }}
                  </label>
                </div>
              </div>
            </div>
          </Step>

          <Step :n="2" title="Overtime & benefits" :class="{ off: !sections.overtime }">
            <template #aside>
              <button type="button" role="switch" class="switch" :aria-checked="sections.overtime" aria-label="Include overtime and benefits" @click="sections.overtime = !sections.overtime; sfxSection(sections.overtime)"><span class="knob" /></button>
            </template>
            <div v-if="sections.overtime" class="panel pad stack">
              <div class="segmented" role="radiogroup" aria-label="How overtime is paid">
                <label :class="{ active: otMode === 'rate' }">
                  <input type="radio" name="ot-mode" :checked="otMode === 'rate'" @change="otMode = 'rate'; sfx.play('select')">
                  Hourly × multiplier
                </label>
                <label :class="{ active: otMode === 'amount' }">
                  <input type="radio" name="ot-mode" :checked="otMode === 'amount'" @change="otMode = 'amount'; sfx.play('select')">
                  Fixed amount each
                </label>
              </div>

              <div class="grid2">
                <label class="field">
                  <span class="field-head">{{ otMode === 'amount' ? `${otUnitPlural} worked a month` : 'Overtime hours a month' }}</span>
                  <input v-model.number="otHours" class="input" type="number" min="0" step="0.5" inputmode="decimal">
                </label>
                <label v-if="otMode === 'amount'" class="field">
                  <span class="field-head">Paid per {{ otUnit }}</span>
                  <span class="money input">
                    <span class="unit" aria-hidden="true">{{ symbol }}</span>
                    <input v-model.number="otUnitAmount" type="number" min="0" step="any" inputmode="decimal" :aria-label="`Paid per ${otUnit}`">
                  </span>
                </label>
                <label v-else class="field">
                  <span class="field-head">Overtime rate</span>
                  <span class="money input">
                    <input v-model.number="otMultiplier" type="number" min="0" step="0.1" inputmode="decimal" aria-label="Overtime multiplier">
                    <span class="unit" aria-hidden="true">×</span>
                  </span>
                </label>
              </div>

              <div class="chips">
                <template v-if="otMode === 'amount'">
                  <button v-for="unit in OT_UNITS" :key="unit" type="button" class="btn btn-quiet btn-sm" :aria-pressed="otUnit === unit" @click="otUnit = unit; sfx.play('select')">per {{ unit }}</button>
                </template>
                <template v-else>
                  <button type="button" class="btn btn-quiet btn-sm" :aria-pressed="Number(otMultiplier) === 1.5" @click="otMultiplier = 1.5; sfx.play('select')">1.5× normal</button>
                  <button type="button" class="btn btn-quiet btn-sm" :aria-pressed="Number(otMultiplier) === 2" @click="otMultiplier = 2; sfx.play('select')">2× night or holiday</button>
                </template>
              </div>

              <div class="grid2">
                <label class="field">
                  <span class="field-head">Normal hours a month</span>
                  <input v-model.number="hoursPerMonth" class="input" type="number" min="1" step="1">
                </label>
                <label class="field">
                  <span class="field-head">Other monthly benefit</span>
                  <span class="money input">
                    <span class="unit" aria-hidden="true">{{ symbol }}</span>
                    <input v-model.number="allowanceAmount" type="number" min="0" step="any" inputmode="decimal" aria-label="Other monthly benefit">
                  </span>
                </label>
              </div>

              <div class="segmented" role="radiogroup" aria-label="Is overtime taxed?">
                <label :class="{ active: extrasTaxable }">
                  <input type="radio" name="ot-tax" :checked="extrasTaxable" @change="extrasTaxable = true; sfx.play('select')">
                  Taxed
                </label>
                <label :class="{ active: !extrasTaxable }">
                  <input type="radio" name="ot-tax" :checked="!extrasTaxable" @change="extrasTaxable = false; sfx.play('select')">
                  Not taxed
                </label>
              </div>

              <dl class="worked">
                <div><dt>Normal hourly pay</dt><dd>{{ money(before.hourly) }}</dd></div>
                <div>
                  <dt>{{ otMode === 'amount' ? `One ${otUnit} is worth` : 'Per overtime hour' }}</dt>
                  <dd>{{ otMode === 'amount' ? `${(Math.round(otHoursOfPay * 10) / 10).toFixed(1)} h of pay` : money(otUnitPrice) }}</dd>
                </div>
                <div><dt>Overtime pay now</dt><dd>{{ money(before.ot) }}</dd></div>
                <div><dt>After the raise</dt><dd>{{ money(after.ot) }}</dd></div>
              </dl>
              <p class="note">
                <template v-if="otMode === 'amount'">
                  A fixed amount doesn’t grow with your salary, so the raise doesn’t change your overtime pay.
                  At {{ money(otUnitAmount) }} each, one {{ otUnit }} is {{ mult(otImpliedMultiple) }} your normal hourly pay.
                </template>
                <template v-else>
                  Overtime is based on your salary, so the raise adds {{ signedMoney(after.ot - before.ot) }} a month to it.
                  Cambodian law pays overtime at 1.5×, and 2× at night, on rest days and holidays.
                </template>
              </p>
            </div>
          </Step>

          <Step :n="3" title="The raise" :class="{ off: !sections.increase }">
            <template #aside>
              <button type="button" role="switch" class="switch" :aria-checked="sections.increase" aria-label="Include a raise" @click="sections.increase = !sections.increase; sfxSection(sections.increase)"><span class="knob" /></button>
            </template>
            <div v-if="sections.increase" class="panel pad stack">
              <div class="chips">
                <button v-for="chip in RAISE_CHIPS" :key="chip" type="button" class="btn btn-quiet btn-sm" :aria-pressed="Number(raisePct) === chip" @click="raisePct = chip; sfx.play('select')">{{ chip }}%</button>
              </div>
              <label class="field">
                <span class="field-head">Raise <output>{{ pct(raisePct) }}</output></span>
                <input v-model.number="raisePct" type="range" min="0" max="50" step="0.5" aria-label="Raise percentage" @input="snapSound">
              </label>
              <div class="grid2">
                <label class="field">
                  <span class="field-head">Exact percentage</span>
                  <span class="money input">
                    <input v-model.number="raisePct" type="number" min="-100" step="0.1" inputmode="decimal" aria-label="Raise percentage">
                    <span class="unit" aria-hidden="true">%</span>
                  </span>
                </label>
                <label class="field">
                  <span class="field-head">Or new salary per {{ period }}</span>
                  <span class="money input">
                    <span class="unit" aria-hidden="true">{{ symbol }}</span>
                    <input
                      :value="targetDraft"
                      type="number"
                      min="0"
                      step="any"
                      inputmode="decimal"
                      :aria-label="`New salary per ${period}`"
                      @focus="targetFocused = true"
                      @input="applyTarget($event.target.value)"
                      @blur="blurTarget"
                    >
                  </span>
                </label>
              </div>
            </div>
          </Step>

          <Step :n="4" title="Tax" :class="{ off: !sections.tax }">
            <template #aside>
              <button type="button" role="switch" class="switch" :aria-checked="sections.tax" aria-label="Include tax" @click="sections.tax = !sections.tax; sfxSection(sections.tax)"><span class="knob" /></button>
            </template>
            <div v-if="sections.tax" class="panel pad stack">
              <div class="segmented" role="radiogroup" aria-label="How to work out tax">
                <label v-for="m in [['brackets', 'Tax bands'], ['flat', 'Flat rate'], ['payslip', 'From my payslip']]" :key="m[0]" :class="{ active: taxMode === m[0] }">
                  <input type="radio" name="tax-mode" :checked="taxMode === m[0]" @change="taxMode = m[0]; sfx.play('select')">
                  {{ m[1] }}
                </label>
              </div>

              <label v-if="taxMode === 'flat'" class="field">
                <span class="field-head">Flat tax rate</span>
                <span class="money input">
                  <input v-model.number="flatRate" type="number" min="0" max="100" step="0.5" aria-label="Flat tax rate">
                  <span class="unit" aria-hidden="true">%</span>
                </span>
              </label>

              <template v-else-if="taxMode === 'brackets'">
                <p class="note">{{ presetName }}<template v-if="currency === 'USD'">, converted at {{ khrPerUsd.toLocaleString('en-US') }} ៛ to the dollar</template>.</p>
                <table class="bands">
                  <thead>
                    <tr>
                      <th>Monthly taxable pay up to</th>
                      <th class="num">Rate</th>
                      <th><span class="visually-hidden">Remove</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(band, index) in brackets" :key="index">
                      <td>
                        <span v-if="band.upTo === null" class="open-band">and above</span>
                        <label v-else class="money input slim">
                          <span class="unit" aria-hidden="true">{{ symbol }}</span>
                          <input v-model.number="band.upTo" type="number" min="0" step="any" aria-label="Band upper limit" @change="presetName = 'Custom'">
                        </label>
                      </td>
                      <td class="num">
                        <label class="money input slim rate">
                          <input v-model.number="band.rate" type="number" min="0" max="100" step="0.5" aria-label="Band rate" @change="presetName = 'Custom'">
                          <span class="unit" aria-hidden="true">%</span>
                        </label>
                      </td>
                      <td class="shrink">
                        <button type="button" class="link danger" :aria-label="`Remove band ${index + 1}`" @click="removeBracket(index); sfx.play('delete')">Remove</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div class="chips">
                  <button type="button" class="btn btn-quiet btn-sm" @click="addBracket(); sfx.play('select')">+ Add band</button>
                  <button type="button" class="btn btn-quiet btn-sm" @click="loadCambodiaPreset(); sfx.play('success')">Use Cambodia’s bands</button>
                  <button type="button" class="btn btn-quiet btn-sm" @click="loadFlatPreset(); sfx.play('success')">One band only</button>
                </div>
                <label v-if="currency === 'USD'" class="field">
                  <span class="field-head">Riel per dollar for the bands</span>
                  <input v-model.number="khrPerUsd" class="input" type="number" min="1" step="10">
                </label>
              </template>

              <template v-else-if="taxMode === 'payslip'">
                <label class="field">
                  <span class="field-head">Tax on your last payslip, per month</span>
                  <span class="money input">
                    <span class="unit" aria-hidden="true">{{ symbol }}</span>
                    <input v-model.number="payslipTax" type="number" min="0" step="any" inputmode="decimal" aria-label="Tax on your last payslip">
                  </span>
                </label>
                <p class="note">That’s {{ pct(payslipOnGross) }} of your gross and {{ pct(payslipOnTaxable) }} of your taxable pay.</p>
                <label class="field">
                  <span class="field-head">Tax on the extra from the raise</span>
                  <span class="money input">
                    <input v-model.number="payslipMarginal" type="number" min="0" max="100" step="0.5" aria-label="Tax rate on the raise">
                    <span class="unit" aria-hidden="true">%</span>
                  </span>
                </label>
                <div class="chips">
                  <button type="button" class="btn btn-quiet btn-sm" @click="payslipMarginal = suggestedMarginal; sfx.play('success')">Use your band · {{ pct(suggestedMarginal) }}</button>
                  <button type="button" class="btn btn-quiet btn-sm" @click="payslipMarginal = payslipOnTaxable; sfx.play('success')">Same as now · {{ pct(payslipOnTaxable) }}</button>
                </div>
                <p class="note">
                  Your payslip pins today’s tax exactly; only the {{ money(grossGain) }} raise is taxed on top.
                  <template v-if="payslipTax > 0">
                    The tax bands would have said {{ money(bracketWouldPredict) }}{{ Math.abs(bracketWouldPredict - payslipTax) < 0.5 ? ', a match.' : `, ${signedMoney(bracketWouldPredict - payslipTax)} from your payslip.` }}
                  </template>
                </p>
              </template>
            </div>
          </Step>

          <Step :n="5" title="Relief & deductions" hint="Per month." :class="{ off: !sections.deductions }">
            <template #aside>
              <button type="button" role="switch" class="switch" :aria-checked="sections.deductions" aria-label="Include relief and deductions" @click="sections.deductions = !sections.deductions; sfxSection(sections.deductions)"><span class="knob" /></button>
            </template>
            <div v-if="sections.deductions" class="panel pad stack">
              <div class="grid2">
                <label class="field">
                  <span class="field-head">Children or dependent spouse</span>
                  <input v-model.number="dependents" class="input" type="number" min="0" step="1">
                </label>
                <label class="field">
                  <span class="field-head">Relief for each</span>
                  <span class="money input">
                    <span class="unit" aria-hidden="true">{{ symbol }}</span>
                    <input v-model.number="dependentRelief" type="number" min="0" step="any" aria-label="Relief for each dependent">
                  </span>
                </label>
                <label class="field">
                  <span class="field-head">Taken before tax</span>
                  <span class="money input">
                    <span class="unit" aria-hidden="true">{{ symbol }}</span>
                    <input v-model.number="preTaxDeduction" type="number" min="0" step="any" aria-label="Taken before tax">
                  </span>
                </label>
                <label class="field">
                  <span class="field-head">Taken after tax</span>
                  <span class="money input">
                    <span class="unit" aria-hidden="true">{{ symbol }}</span>
                    <input v-model.number="postTaxDeduction" type="number" min="0" step="any" aria-label="Taken after tax">
                  </span>
                </label>
              </div>
              <p class="note">Pension or NSSF comes off before tax, so you pay less tax. Loans and insurance only lower what you take home.</p>
            </div>
          </Step>
        </div>

        <!-- ===== Results ===== -->
        <aside v-sticky-fit class="results">
          <!-- How much of the raise survives tax -->
          <section class="panel keep">
            <div
              class="ring"
              role="img"
              :aria-label="keepRate === null ? 'No raise yet' : `You keep ${Math.round(keepRate)}% of the raise`"
              :style="{ '--sweep': `${Math.max(0, Math.min(100, keepRate ?? 0))}%` }"
            >
              <span><strong>{{ keepRate === null ? '—' : `${Math.round(keepRate)}%` }}</strong>of the raise is yours</span>
            </div>
            <dl class="lift">
              <div><dt>Raise before tax</dt><dd>{{ signedMoney(grossGain) }}</dd></div>
              <div><dt>Extra tax</dt><dd class="down">{{ signedMoney(-taxGain) }}</dd></div>
              <div class="total"><dt>In your pocket</dt><dd class="up">{{ signedMoney(netGain) }}<small> a month</small></dd></div>
            </dl>
          </section>

          <!-- Pay statement: now vs after -->
          <section class="panel slip" aria-label="Pay statement">
            <header class="slip-head">
              <h2>Pay statement</h2>
              <span>Monthly · {{ currency }}</span>
            </header>
            <table>
              <thead>
                <tr><th><span class="visually-hidden">Item</span></th><th>Now</th><th>After</th></tr>
              </thead>
              <tbody>
                <tr><th>{{ before.ot > 0 || before.allowance > 0 ? 'Base salary' : 'Gross' }}</th><td>{{ money(before.base) }}</td><td>{{ money(after.base) }}</td></tr>
                <tr v-if="before.ot > 0 || after.ot > 0"><th>Overtime</th><td>{{ money(before.ot) }}</td><td>{{ money(after.ot) }}</td></tr>
                <tr v-if="before.allowance > 0"><th>Benefit</th><td>{{ money(before.allowance) }}</td><td>{{ money(after.allowance) }}</td></tr>
                <tr v-if="before.ot > 0 || before.allowance > 0" class="strong"><th>Gross</th><td>{{ money(before.gross) }}</td><td>{{ money(after.gross) }}</td></tr>
                <tr v-if="before.preTax > 0" class="minor"><th>Before-tax deduction</th><td>{{ money(-before.preTax) }}</td><td>{{ money(-after.preTax) }}</td></tr>
                <tr v-if="before.relief > 0" class="minor"><th>Dependent relief</th><td>{{ money(-before.relief) }}</td><td>{{ money(-after.relief) }}</td></tr>
                <tr class="minor"><th>Taxable</th><td>{{ money(before.taxable) }}</td><td>{{ money(after.taxable) }}</td></tr>
                <tr class="tax"><th>Tax</th><td>{{ money(-before.tax) }}</td><td>{{ money(-after.tax) }}</td></tr>
                <tr v-if="before.postTax > 0" class="minor"><th>After-tax deduction</th><td>{{ money(-before.postTax) }}</td><td>{{ money(-after.postTax) }}</td></tr>
              </tbody>
              <tfoot>
                <tr><th>Take-home</th><td>{{ money(before.net) }}</td><td>{{ money(after.net) }}</td></tr>
              </tfoot>
            </table>

            <!-- Where each dollar of gross goes -->
            <div class="bars">
              <div v-for="row in [{ k: 'Now', b: before }, { k: 'After', b: after }]" :key="row.k" class="bar-row">
                <span>{{ row.k }}</span>
                <div class="bar" role="img" :aria-label="`${row.k}: ${Math.round(shares(row.b).net)}% take-home, ${Math.round(shares(row.b).tax)}% tax`">
                  <i class="b-net" :style="{ width: shares(row.b).net + '%' }" />
                  <i class="b-tax" :style="{ width: shares(row.b).tax + '%' }" />
                  <i class="b-ded" :style="{ width: shares(row.b).ded + '%' }" />
                </div>
              </div>
              <div class="bar-key">
                <span><i class="b-net" />Take-home</span>
                <span><i class="b-tax" />Tax</span>
                <span><i class="b-ded" />Deductions</span>
              </div>
            </div>

            <dl class="slip-foot">
              <div><dt>Tax rate overall</dt><dd>{{ pct(before.effRate) }} → {{ pct(after.effRate) }}</dd></div>
              <div><dt>Tax band you’re in</dt><dd>{{ pct(after.marginal) }}</dd></div>
              <div><dt>Take-home a year</dt><dd>{{ money(after.net * 12) }}</dd></div>
            </dl>
          </section>
        </aside>
      </div>

      <!-- ===== Projection ===== -->
      <Step title="If you get this raise every year" class="projection" :class="{ off: !sections.projection }">
        <template #aside>
          <button type="button" role="switch" class="switch" :aria-checked="sections.projection" aria-label="Show yearly projection" @click="sections.projection = !sections.projection; sfxSection(sections.projection)"><span class="knob" /></button>
        </template>
        <div v-if="sections.projection" class="panel pad">
          <label class="field years">
            <span class="field-head">Years ahead <output>{{ projectionYears }}</output></span>
            <input v-model.number="projectionYears" type="range" min="1" max="10" step="1" aria-label="Years ahead" @input="snapSound">
          </label>
          <div class="table-scroll">
            <table class="proj">
              <thead>
                <tr>
                  <th>Year</th>
                  <th class="num">Gross / month</th>
                  <th class="num">Tax / month</th>
                  <th class="num">Take-home / month</th>
                  <th class="num">Take-home / year</th>
                  <th class="num">More than today</th>
                  <th class="growth"><span class="visually-hidden">Growth</span></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Today</td>
                  <td class="num">{{ money(before.gross) }}</td>
                  <td class="num">{{ money(before.tax) }}</td>
                  <td class="num">{{ money(before.net) }}</td>
                  <td class="num">{{ money(before.net * 12) }}</td>
                  <td class="num muted">—</td>
                  <td class="growth"><span class="track"><i :style="{ width: (before.gross / projectionPeak) * 100 + '%' }" /></span></td>
                </tr>
                <tr v-for="row in projection" :key="row.year">
                  <td>Year {{ row.year }}</td>
                  <td class="num">{{ money(row.gross) }}</td>
                  <td class="num">{{ money(row.tax) }}</td>
                  <td class="num">{{ money(row.net) }}</td>
                  <td class="num">{{ money(row.net * 12) }}</td>
                  <td class="num" :class="row.netLift >= 0 ? 'up' : 'down'">{{ signedMoney(row.netLift) }}</td>
                  <td class="growth"><span class="track"><i :style="{ width: (row.gross / projectionPeak) * 100 + '%' }" /></span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="note">
            A {{ pct(raisePct) }} raise every year, taxed with the rules above. Tax bands are kept as they are today, so treat long horizons as a rough guide.
            <template v-if="presetName.startsWith('Cambodia')">
              Cambodia’s bands follow Sub-Decree 196: the first 1,500,000 ៛ a month is tax-free, rising to 20%. Check them against the latest Prakas.
            </template>
          </p>
        </div>
      </Step>
    </ClientOnly>
  </ToolPage>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
}

.inputs {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  min-width: 0;
}

.pad {
  padding: 1.1rem;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.row {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.grow {
  flex: 1 1 14rem;
}

.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.segmented label {
  white-space: nowrap;
}

.currency label,
.period label {
  padding-inline: 0.85rem;
}

.period {
  min-height: 2.75rem;
}

/* A switched-off step keeps its heading but fades back */
.off :deep(.step-text) {
  opacity: 0.5;
}

.money {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.money input {
  flex: 1;
  min-width: 0;
  font: inherit;
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
  color: inherit;
  background: none;
  border: 0;
  outline: none;
}

.money.slim {
  min-height: 2.3rem;
  padding: 0.3rem 0.6rem;
}

.money.slim input {
  font-size: 1rem; /* 16px or more, so phones don't zoom in when it's tapped */
}

.money.rate {
  margin-left: 0.5rem;
}

.unit {
  color: var(--ink-2);
  font-weight: 600;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chips .btn[aria-pressed='true'] {
  color: var(--on-accent);
  background: var(--accent);
  box-shadow: none;
}

.note {
  max-width: 75ch;
  margin: 0;
  font-size: 0.875rem;
  color: var(--ink-2);
  text-wrap: pretty;
}

/* Worked-out numbers: a quiet tinted box so they never look like inputs */
.worked {
  margin: 0;
  padding: 0.8rem 0.9rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem 1rem;
  background: var(--surface-2);
  border-radius: 12px;
}

.worked div {
  display: flex;
  flex-direction: column;
}

.worked dt {
  font-size: 0.8rem;
  color: var(--ink-2);
}

.worked dd {
  margin: 0;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* Settings-style switch, in each optional step's heading */
.switch {
  flex: none;
  position: relative;
  width: 3rem;
  height: 1.75rem;
  padding: 0;
  background: var(--line);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.switch[aria-checked='true'] {
  background: var(--accent);
}

.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 1.375rem;
  height: 1.375rem;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgb(var(--shadow) / 0.25);
  transition: transform 0.25s cubic-bezier(0.3, 1.4, 0.6, 1);
}

.switch[aria-checked='true'] .knob {
  transform: translateX(1.25rem);
}

/* ---------- Tax bands ---------- */
.bands {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.bands th:nth-child(2) { width: 7.5rem; }
.bands th:nth-child(3) { width: 5rem; }

.bands input {
  width: 100%;
}

.bands th {
  padding-bottom: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  text-align: left;
  color: var(--ink-2);
  border-bottom: 1px solid var(--line);
}

.bands td {
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--line);
}

.bands .num {
  text-align: right;
}

.bands .shrink {
  padding-left: 0.75rem;
  text-align: right;
  white-space: nowrap;
}

.open-band {
  color: var(--ink-2);
}


.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* ---------- Results ---------- */
.results {
  position: sticky;
  top: 5.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.keep {
  padding: 1.4rem;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 1.5rem;
  color: #fff;
  background: var(--accent);
  border: 0;
}

/* The share of the raise you keep, as a ring */
.ring {
  width: 9rem;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: conic-gradient(#7ee2a8 0 var(--sweep), rgb(255 255 255 / 0.18) var(--sweep) 100%);
  transition: background 0.4s;
}

.ring span {
  width: calc(100% - 1.5rem);
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  text-align: center;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.25;
  background: var(--accent);
  border-radius: 50%;
}

.ring strong {
  font-size: 2rem;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.lift {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.lift div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
}

.lift dt {
  font-size: 0.875rem;
  opacity: 0.85;
}

.lift dd {
  margin: 0;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.lift .total {
  padding-top: 0.5rem;
  border-top: 1px solid rgb(255 255 255 / 0.25);
}

.lift .total dd {
  font-size: 1.35rem;
}

.lift small {
  font-size: 0.75rem;
  font-weight: 500;
  opacity: 0.92;
}

.lift .up { color: #a6f0c6; }
.lift .down { color: #ffd2cd; }

.slip {
  padding: 1.25rem;
}

.slip-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.75rem;
}

.slip-head h2 {
  font-size: 1.1rem;
}

.slip-head span {
  font-size: 0.8rem;
  color: var(--ink-2);
}

.slip table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.slip th,
.slip td {
  padding: 0.4rem 0;
  font-size: 0.925rem;
}

.slip thead th {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ink-2);
  text-align: right;
  border-bottom: 1px solid var(--line);
}

.slip tbody th {
  font-weight: 500;
  text-align: left;
}

.slip td {
  text-align: right;
  padding-left: 1rem;
}

.slip .minor {
  color: var(--ink-2);
}

.slip .strong {
  font-weight: 700;
}

.slip .tax {
  color: var(--bad-ink);
}

.slip tfoot th,
.slip tfoot td {
  padding-top: 0.6rem;
  font-size: 1.1rem;
  font-weight: 800;
  text-align: right;
  border-top: 2px solid var(--ink);
}

.slip tfoot th {
  text-align: left;
}

.bars {
  margin-top: 1.1rem;
}

.bar-row {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.4rem;
  font-size: 0.8rem;
  color: var(--ink-2);
}

/* 2px gaps between segments so neighbouring colours never blur together */
.bar {
  display: flex;
  gap: 2px;
  height: 0.6rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-2);
}

.bar i {
  height: 100%;
  transition: width 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.b-net { background: var(--green); }
.b-tax { background: var(--red); }
.b-ded { background: var(--ink-3); }

.bar-key {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--ink-2);
}

.bar-key span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.bar-key i {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 3px;
}

.slip-foot {
  margin: 1rem 0 0;
  padding-top: 0.75rem;
  border-top: 1px solid var(--line);
}

.slip-foot div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.25rem 0;
  font-size: 0.875rem;
}

.slip-foot dt {
  color: var(--ink-2);
}

.slip-foot dd {
  margin: 0;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* ---------- Projection ---------- */
.projection {
  margin-top: 2.5rem;
}

.years {
  max-width: 22rem;
  margin-bottom: 0.75rem;
}

.table-scroll {
  position: relative; /* keeps the screen-reader-only header inside the scroll box */
  overflow-x: auto;
}

.proj {
  width: 100%;
  min-width: 42rem;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.proj th {
  padding: 0 0.75rem 0.5rem 0;
  font-size: 0.8rem;
  font-weight: 600;
  text-align: left;
  color: var(--ink-2);
  border-bottom: 1px solid var(--line);
}

.proj td {
  padding: 0.6rem 0.75rem 0.6rem 0;
  border-bottom: 1px solid var(--line);
}

.proj .num {
  text-align: right;
}

/* Phones: drop the yearly total and the growth bar so the table fits without scrolling sideways */
@media (max-width: 560px) {
  .proj {
    min-width: 0;
    font-size: 0.85rem;
  }

  .proj th:nth-child(5),
  .proj td:nth-child(5),
  .proj .growth {
    display: none;
  }

  .proj th,
  .proj td {
    padding-right: 0.5rem;
  }
}

.proj .growth {
  width: 18%;
  padding-right: 0;
}

.track {
  display: block;
  height: 0.4rem;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}

.track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.up { color: var(--good-ink); }
.down { color: var(--bad-ink); }
.muted { color: var(--ink-3); }

.projection .note {
  margin-top: 1rem;
}

@media (max-width: 1000px) {
  .workspace { grid-template-columns: minmax(0, 1fr); }
  .results { position: static; }
}

@media (max-width: 560px) {
  .grid2 { grid-template-columns: minmax(0, 1fr); }
  .inputs .segmented label { white-space: normal; line-height: 1.25; }
  .keep { grid-template-columns: minmax(0, 1fr); justify-items: center; }
  .lift { width: 100%; }
  .worked { grid-template-columns: minmax(0, 1fr); }
}

/* "per month" stays on one line */
.segmented.period label {
  white-space: nowrap;
}
</style>
