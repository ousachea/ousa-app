<script setup>
/* ------------------------------------------------------------------ *
 * Salary raise + tax calculator: what a raise is worth after
 * Cambodian Tax on Salary, overtime and deductions.
 * ------------------------------------------------------------------ */

const STORE_KEY = 'ousa-app:salary'

const sfx = useSound()

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

const khrPerUsd = ref(4100) // the National Bank's rate on the 15th is the one payroll uses
const residency = ref('resident') // 'resident' (here 183+ days in 12 months) | 'non' (flat 20%)
const spouseAtHome = ref(false) // a spouse with no taxable income counts as a dependent
const dependents = ref(0) // children who qualify: under 14, or under 25 in full-time study
const dependentRelief = ref(0) // per dependent, per month, in `currency` (custom bands only)
const nssfOn = ref(true) // employees under the Labour Law pay 2% into the NSSF pension
const fringe = ref(0) // non-cash benefits a month, at market value (housing, car, school fees…)
const preTaxDeduction = ref(0) // per month, only if a payslip lowers taxable pay for it
const postTaxDeduction = ref(0) // per month (loan, insurance …)

const projectionYears = ref(5)

/* Which optional sections are switched on. Turning one off collapses it and
   removes it from the maths, while keeping its values for when it comes back. */
const sections = ref({ overtime: true, increase: true, tax: true, deductions: true, projection: true })

/* --- Cambodia Tax on Salary (monthly, KHR) ------------------------ *
 * Sub-Decree No. 196, in force since 2023. Thresholds are editable
 * below so they can be updated if the law changes.
 * ------------------------------------------------------------------ */
// The bands and relief themselves are in utils/khSalaryTax.ts. With Cambodia's bands the tax is worked
// out in riel, exactly as payroll does; the band table below only shows them in your currency.
const KH_RELIEF_KHR = KH_DEPENDENT_RELIEF

const roundThreshold = value => (currency.value === 'USD' ? Math.round(value) : Math.round(value / 1000) * 1000)

function loadCambodiaPreset() {
  const divisor = currency.value === 'USD' ? (khrPerUsd.value || 4100) : 1
  brackets.value = KH_TOS_BRACKETS.map(b => ({
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
  if (nonResident.value) return KH_NON_RESIDENT_RATE
  if (khRules.value) return khBracket(taxable * toKhr.value).rate
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

/** Riel in one unit of the currency being shown */
const toKhr = computed(() => (currency.value === 'USD' ? (khrPerUsd.value || 4100) : 1))
/** Cambodia's own rules: its bands, worked out in riel, with residency and family relief */
const khRules = computed(() => sections.value.tax && taxMode.value === 'brackets' && presetName.value.startsWith('Cambodia'))
const nonResident = computed(() => khRules.value && residency.value === 'non')
const dependentCount = computed(() => Math.max(0, dependents.value || 0) + (spouseAtHome.value ? 1 : 0))

/** Full monthly breakdown for a given monthly *base* salary. */
function breakdown(monthlyBase) {
  const { base, hourly, ot, allowance, total } = grossFor(monthlyBase)
  const on = sections.value
  const rate = toKhr.value
  const preTax = on.deductions ? Math.max(0, preTaxDeduction.value || 0) : 0
  // Family relief is for residents only; with Cambodia's bands it's exactly 150,000 ៛ each
  const perDependent = khRules.value ? KH_RELIEF_KHR / rate : (dependentRelief.value || 0)
  const relief = on.deductions && !nonResident.value ? Math.max(0, dependentCount.value * perDependent) : 0

  // Exempt extras still reach take-home, they just never enter the tax base.
  const taxedPay = extrasTaxable.value ? total : base
  const taxable = nonResident.value ? taxedPay : Math.max(0, taxedPay - preTax - relief)

  let tax = 0
  if (!on.tax) {
    tax = 0
  } else if (nonResident.value) {
    // Non-residents: a flat, final 20% on Cambodian salary, no tax-free part
    tax = Math.round((taxable * rate * KH_NON_RESIDENT_RATE) / 100) / rate
  } else if (khRules.value) {
    tax = khResidentTax(taxable * rate) / rate
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

  // NSSF pension: 2% of the wage held between 600,000 and 1,500,000 ៛. It doesn't lower taxable pay
  const fund = on.deductions && nssfOn.value ? khNssf(total * rate) : undefined
  const nssf = fund ? fund.employee / rate : 0
  const nssfEmployer = fund ? fund.employer / rate : 0
  const postTax = on.deductions ? Math.max(0, postTaxDeduction.value || 0) : 0
  const net = total - preTax - tax - nssf - postTax

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
    nssf,
    nssfEmployer,
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

/* Today's tax in whole riel, step by step, for "How your tax is worked out" */
const working = computed(() => {
  const r = toKhr.value
  const b = before.value
  const taxedPay = Math.round((extrasTaxable.value ? b.gross : b.base) * r)
  const taxable = Math.round(b.taxable * r)
  return {
    taxedPay,
    relief: Math.round(b.relief * r),
    preTax: nonResident.value ? 0 : Math.round(b.preTax * r),
    taxable,
    band: khBracket(taxable),
    tax: Math.round(b.tax * r),
    nssf: Math.round(b.nssf * r),
    nssfWage: khNssf(b.gross * r).wage,
    postTax: Math.round(b.postTax * r),
    untaxed: extrasTaxable.value ? 0 : Math.round((b.gross - b.base) * r),
    net: Math.round(b.net * r)
  }
})
const riel = value => `${value < 0 ? '−' : ''}${Math.abs(Math.round(value || 0)).toLocaleString('en-US')} ៛`

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
  if (!targetFocused.value) targetDraft.value = groupDigits(String(snapMoney(value)))
}, { immediate: true })

/** Typing a target salary solves the percentage backwards, live. */
function applyTarget(raw) {
  targetDraft.value = raw
  const base = salary.value || 0
  // Commas are fine while typing ("1,300"); shown grouped again once you leave the field
  const value = parseGrouped(raw)
  if (value === null || !Number.isFinite(value) || base <= 0) return
  // 3dp keeps the solved target within a cent of what was typed; 1dp would
  // visibly miss (a 11.4% solve lands ~20c away from a 11.417% one).
  raisePct.value = Math.round((value / base - 1) * 100000) / 1000
}

function blurTarget() {
  targetFocused.value = false
  targetDraft.value = groupDigits(String(snapMoney(targetSalary.value)))
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

/* --- How tax is worked out, as one choice (under More options) ------ */
const TAX_METHODS = [
  { value: 'cambodia', label: 'Cambodia’s rules' },
  { value: 'bands', label: 'Your own tax bands' },
  { value: 'flat', label: 'A flat rate' },
  { value: 'payslip', label: 'From your payslip' },
  { value: 'none', label: 'No tax' }
]
const taxMethod = computed({
  get() {
    if (!sections.value.tax) return 'none'
    if (taxMode.value === 'brackets') return presetName.value.startsWith('Cambodia') ? 'cambodia' : 'bands'
    return taxMode.value
  },
  set(m) {
    sections.value = { ...sections.value, tax: m !== 'none' }
    if (m === 'none') return
    if (m === 'cambodia') {
      taxMode.value = 'brackets'
      loadCambodiaPreset()
    } else if (m === 'bands') {
      taxMode.value = 'brackets'
      presetName.value = 'Custom'
    } else {
      taxMode.value = m
    }
    sfx.play('select')
  }
})
/** The method as it reads mid-sentence: "You're using a flat rate" */
const TAX_METHOD_TEXT = { cambodia: 'Cambodia’s rules', bands: 'your own tax bands', flat: 'a flat rate', payslip: 'your payslip’s tax', none: 'no tax' }
const taxMethodLabel = computed(() => TAX_METHOD_TEXT[taxMethod.value])

/* --- The extras folded under step 1, and what the pay statement lists */
const hasExtras = computed(() => (otHours.value || 0) > 0 || (allowanceAmount.value || 0) > 0 || (fringe.value || 0) > 0)
const showAfter = computed(() => (raisePct.value || 0) !== 0)

/* The same split as a donut: take-home, tax, then NSSF and deductions round one ring */
const flowView = useRemembered('salary-flow-view', 'bars', v => v === 'bars' || v === 'pie')
const pieActive = ref(undefined)
const pieParts = computed(() => {
  const b = before.value
  const ded = b.nssf + b.preTax + b.postTax
  const parts = [
    { label: 'You take home', amount: Math.max(0, b.net), color: 'var(--green)' },
    { label: 'Tax', amount: Math.max(0, b.tax), color: 'var(--red)' }
  ]
  if (ded > 0) parts.push({ label: 'NSSF and deductions', amount: ded, color: 'var(--orange)' })
  const total = parts.reduce((t, p) => t + p.amount, 0) || 1
  return parts.map(p => ({ ...p, value: p.amount, share: (p.amount / total) * 100 }))
})
const pieTotal = computed(() => pieParts.value.reduce((t, p) => t + p.value, 0))

/** An amount in the other currency: riel when you're paid in dollars, dollars when in riel */
function otherMoney(value) {
  const rate = khrPerUsd.value || 4100
  const sign = value < 0 ? '−' : ''
  const abs = Math.abs(value || 0)
  if (currency.value === 'USD') return `${sign}${Math.round(abs * rate).toLocaleString('en-US')} ៛`
  return `${sign}$${(abs / rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/* --- The sentence at the top: each blank is one of these choices ---- */
const PERIODS = [{ value: 'month', label: 'month' }, { value: 'year', label: 'year' }]
const CURRENCIES = [{ value: 'USD', label: 'dollars' }, { value: 'KHR', label: 'riel' }]
const RESIDENCIES = [{ value: 'resident', label: 'live in Cambodia' }, { value: 'non', label: 'live abroad' }]
const SPOUSE = [{ value: 'home', label: 'stays at home' }, { value: 'works', label: 'works, or I’m single' }]
const NSSF_CHOICES = [{ value: 'pay', label: 'pay' }, { value: 'no', label: 'don’t pay' }]
const currencyChoice = computed({ get: () => currency.value, set: v => pickCurrency(v) })
const spouseChoice = computed({ get: () => (spouseAtHome.value ? 'home' : 'works'), set: (v) => { spouseAtHome.value = v === 'home' } })
const nssfChoice = computed({ get: () => (nssfOn.value ? 'pay' : 'no'), set: (v) => { nssfOn.value = v === 'pay' } })

const optionsOpen = ref(false)
const TABS = [{ value: 'payslip', label: 'Payslip' }, { value: 'tax', label: 'How tax works' }, { value: 'years', label: 'Years ahead' }]
const tab = useRemembered('salary-tab', 'payslip', v => TABS.some(t => t.value === v))

/* Where the pay goes: salary at full width, then tax and deductions as the slices taken off its end,
   leaving take-home. Widths are shares of the gross */
const flow = computed(() => {
  const b = before.value
  const gross = Math.max(b.gross, 0.000001)
  // Shares of the salary, kept within 0–100% so no bar can run outside its track, even when
  // deductions are more than the pay
  const share = v => Math.min(100, Math.max(0, (v / gross) * 100))
  const tax = share(b.tax)
  const ded = Math.min(100 - tax, share(b.nssf + b.preTax + b.postTax))
  const rows = [
    { label: 'Your salary', amount: b.gross, from: 0, width: 100, kind: 'gross' },
    { label: 'Tax', amount: -b.tax, from: 100 - tax, width: tax, kind: 'tax' }
  ]
  if (ded > 0) rows.push({ label: 'NSSF and deductions', amount: -(b.nssf + b.preTax + b.postTax), from: 100 - tax - ded, width: ded, kind: 'ded' })
  rows.push({ label: 'You take home', amount: b.net, from: 0, width: share(b.net), kind: 'net' })
  return rows
})
const slipLines = computed(() => {
  const b = before.value
  const a = after.value
  const lines = [{ label: b.ot > 0 || b.allowance > 0 ? 'Base salary' : 'Salary', now: b.base, after: a.base }]
  if (b.ot > 0 || a.ot > 0) lines.push({ label: 'Overtime', now: b.ot, after: a.ot })
  if (b.allowance > 0) lines.push({ label: 'Cash allowance', now: b.allowance, after: a.allowance })
  if (b.ot > 0 || b.allowance > 0) lines.push({ label: 'Gross', now: b.gross, after: a.gross, kind: 'strong' })
  if (b.preTax > 0) lines.push({ label: 'Deducted before tax', now: -b.preTax, after: -a.preTax, kind: 'minor' })
  if (b.relief > 0) lines.push({ label: 'Family relief (lowers taxable pay, not taken from you)', now: -b.relief, after: -a.relief, kind: 'minor' })
  if (b.relief > 0 || b.preTax > 0) lines.push({ label: 'Taxable pay', now: b.taxable, after: a.taxable, kind: 'minor' })
  lines.push({ label: 'Tax', now: -b.tax, after: -a.tax, kind: 'tax' })
  if (b.nssf > 0 || a.nssf > 0) lines.push({ label: 'NSSF pension', now: -b.nssf, after: -a.nssf, kind: 'minor' })
  if (b.postTax > 0) lines.push({ label: 'Taken after tax', now: -b.postTax, after: -a.postTax, kind: 'minor' })
  return lines
})

/* --- Get started: a few questions that set the calculator up ------- */
const setupDone = ref(false) // once answered or skipped, the welcome panel steps aside
const setupOpen = ref(false)
const setup = ref({ currency: 'USD', salary: null, period: 'month', residency: 'resident', spouseAtHome: false, children: '', nssfOn: true })

function openSetup() {
  setup.value = {
    currency: currency.value,
    // Blank rather than 0, so typing (or the phone keypad) never lands next to a leftover zero
    salary: salary.value || null,
    period: period.value,
    residency: residency.value,
    spouseAtHome: spouseAtHome.value,
    children: dependents.value || '',
    nssfOn: nssfOn.value
  }
  setupOpen.value = true
  sfx.play('open')
}

function applySetup() {
  const a = setup.value
  // Switching currency rescales the other amounts; the salary typed here is already in the new one
  if (a.currency !== currency.value) switchCurrency(a.currency)
  salary.value = Math.max(0, Number(a.salary) || 0)
  period.value = a.period
  residency.value = a.residency
  spouseAtHome.value = a.spouseAtHome
  dependents.value = Math.max(0, Math.floor(Number(a.children) || 0))
  nssfOn.value = a.nssfOn
  // The answers are about Cambodia's rules, so they're what the calculator uses
  taxMode.value = 'brackets'
  loadCambodiaPreset()
  sections.value = { ...sections.value, tax: true, deductions: true }
  setupDone.value = true
  setupOpen.value = false
  sfx.play('success')
  nextTick(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    document.querySelector('.results')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  })
}

/* --- persistence -------------------------------------------------- */
const KEYS = {
  currency, period, salary, raisePct, taxMode, flatRate, brackets, presetName,
  payslipTax, payslipMarginal, khrPerUsd, residency, spouseAtHome, dependents, dependentRelief, nssfOn, fringe,
  preTaxDeduction, postTaxDeduction, projectionYears,
  otMode, otHours, otMultiplier, otUnitAmount, otUnit, hoursPerMonth, allowanceAmount,
  extrasTaxable, sections, setupDone
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
  sections.value = { ...sections.value, overtime: true, deductions: true, increase: true }
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
  scale(fringe)
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
    <template #settings>
      <SettingChoice :model-value="currency" title="Currency" description="Switching converts the amounts you’ve entered." :options="[{ value: 'USD', label: 'Dollars' }, { value: 'KHR', label: 'Riel' }]" @update:model-value="pickCurrency" />
      <SettingChoice v-model="period" title="Enter salary per" :options="[{ value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }]" />
      <label class="setting-field">
        <span class="title">Working hours a month</span>
        <span class="desc">For the hourly rate and overtime. 208 is the Cambodian standard (48 hours a week).</span>
        <input v-model.number="hoursPerMonth" class="input" type="number" min="1" step="1">
      </label>
      <label class="setting-field">
        <span class="title">Riel per dollar</span>
        <input v-model.number="khrPerUsd" class="input" type="number" min="1000" step="10">
      </label>
    </template>

    <ClientOnly>
      <div class="salary">
        <!-- ===== 1. Your pay, as a sentence, with the answer right under it ===== -->
        <section class="hero" aria-labelledby="hero-answer">
          <div class="hero-top">
            <span class="eyebrow">Your pay</span>
            <button type="button" class="hero-btn" @click="openSetup">{{ setupDone ? 'Guide me' : 'Get started' }}</button>
          </div>

          <!-- The blanks sit in spans, not labels: a click inside a label reopens a dropdown -->
          <p class="sentence">
            I earn
            <span class="blank money-blank">
              <span class="unit" aria-hidden="true">{{ symbol }}</span>
              <GroupedNumberInput v-model="salary" min="0" placeholder="0" aria-label="Salary before tax" />
            </span>
            a <AppSelect v-model="period" :options="PERIODS" aria-label="Salary is per" class="pick" />
            before tax, paid in <AppSelect v-model="currencyChoice" :options="CURRENCIES" aria-label="Paid in" class="pick" />.
          </p>
          <p class="sentence">
            I <AppSelect v-model="residency" :options="RESIDENCIES" aria-label="Where you live" class="pick" /><template v-if="khRules && residency === 'resident'">,
              my spouse <AppSelect v-model="spouseChoice" :options="SPOUSE" aria-label="Your spouse" class="pick" />
              and I claim
              <span class="blank count-blank">
                <input v-model.number="dependents" type="number" min="0" step="1" inputmode="numeric" placeholder="0" aria-label="Children you claim for">
              </span>
              {{ (dependents || 0) === 1 ? 'child' : 'children' }}</template>.
            I <AppSelect v-model="nssfChoice" :options="NSSF_CHOICES" aria-label="NSSF pension" class="pick" /> into the NSSF pension.
          </p>

          <p v-if="monthlyNow > 0" class="equiv">
            That’s {{ otherMoney(monthlyNow) }} a month before tax, at {{ (khrPerUsd || 4100).toLocaleString('en-US') }} ៛ to the dollar.
          </p>

          <div class="answer">
            <span id="hero-answer" class="answer-label">You take home</span>
            <span class="answer-pay">{{ money(before.net) }}</span>
            <span class="answer-per">a month · {{ money(before.net * 12) }} a year</span>
            <span class="answer-equiv">{{ otherMoney(before.net) }} a month · {{ otherMoney(before.net * 12) }} a year</span>
          </div>

          <div class="hero-foot">
            <button type="button" class="hero-link" @click="optionsOpen = true">
              <AppIcon name="sliders-horizontal" />Overtime, benefits &amp; tax options<span v-if="hasExtras || taxMethod !== 'cambodia'" class="dot" title="In use" />
            </button>
            <span class="hero-hint">{{ khRules && residency === 'resident' ? 'Living here, or here more than 182 days in 12 months. Children count until 14, or 25 in full-time study.' : khRules ? 'Here 182 days or fewer in any 12 months: a non-resident, taxed a flat 20% with no family relief.' : `Using ${taxMethodLabel}.` }}</span>
          </div>
        </section>

        <!-- ===== 2. Where the money goes ===== -->
        <section class="card flow" aria-labelledby="flow-title">
          <div class="flow-head">
            <h2 id="flow-title">Where your pay goes</h2>
            <div v-if="before.gross > 0" class="segmented view-switch" role="radiogroup" aria-label="Show as">
              <label v-for="v in [['bars', 'Bars'], ['pie', 'Pie']]" :key="v[0]" :class="{ active: flowView === v[0] }">
                <input v-model="flowView" type="radio" name="flow-view" :value="v[0]">{{ v[1] }}
              </label>
            </div>
          </div>
          <p v-if="before.gross <= 0" class="note">Enter your salary above to see where it goes.</p>
          <div v-else-if="flowView === 'pie'" class="pie">
            <div class="pie-chart" role="img" :aria-label="pieParts.map(p => `${p.label}: ${Math.round(p.share)}%`).join(', ')">
              <Gauge :value="pieTotal" :min="0" :max="pieTotal" :start-angle="180" :end-angle="540" :radius="200" :padding="34" transition :initial-value="0">
                <GaugeStack :parts="pieParts" :width="64" :gap="1.2" :active="pieActive" interactive @hover="i => (pieActive = i)" />
              </Gauge>
              <span class="pie-center" aria-hidden="true">
                <strong>{{ Math.round(pieParts[0].share) }}%</strong>
                <small>you keep</small>
              </span>
            </div>
            <ul class="pie-key">
              <li v-for="(p, i) in pieParts" :key="p.label" :class="{ active: pieActive === i }" @pointerenter="pieActive = i" @pointerleave="pieActive = undefined">
                <i :style="{ background: p.color }" aria-hidden="true" />
                <span class="pie-label">{{ p.label }}</span>
                <span class="pie-share">{{ Math.round(p.share) }}%</span>
                <strong>{{ money(p.amount) }}<small>{{ otherMoney(p.amount) }}</small></strong>
              </li>
              <li class="pie-total"><span class="pie-label">Your salary</span><strong>{{ money(before.gross) }}<small>{{ otherMoney(before.gross) }}</small></strong></li>
            </ul>
          </div>
          <ul v-else class="flow-rows">
            <li v-for="row in flow" :key="row.label" :class="row.kind">
              <span class="flow-label">{{ row.label }}</span>
              <span class="flow-track" aria-hidden="true"><i :style="{ left: `${row.from}%`, width: `${row.width}%` }" /></span>
              <span class="flow-amount">{{ money(row.amount) }}<small>{{ otherMoney(row.amount) }}</small></span>
            </li>
          </ul>
          <p v-if="before.gross > 0" class="note">Tax takes {{ pct(before.effRate) }} of your pay; your top band is {{ pct(before.marginal) }}<template v-if="before.relief > 0">, after {{ money(before.relief) }} of family relief</template>.</p>
        </section>

        <!-- ===== 3. A raise ===== -->
        <section class="card raise" aria-labelledby="raise-title">
          <h2 id="raise-title">What if I get a raise?</h2>
          <div class="raise-picks" role="group" aria-label="Raise">
            <button v-for="chip in RAISE_CHIPS" :key="chip" type="button" class="raise-chip" :aria-pressed="Number(raisePct) === chip" @click="raisePct = chip; sfx.play('select')">{{ chip ? `${chip}%` : 'None' }}</button>
          </div>
          <div class="raise-inputs">
            <label class="field">
              <span class="field-head">Exact raise</span>
              <span class="money input">
                <input v-model.number="raisePct" data-keys="percent" type="number" min="-100" step="0.1" inputmode="decimal" aria-label="Raise percentage">
                <span class="unit" aria-hidden="true">%</span>
              </span>
            </label>
            <label class="field">
              <span class="field-head">Or your new salary a {{ period }}</span>
              <span class="money input">
                <span class="unit" aria-hidden="true">{{ symbol }}</span>
                <input :value="targetDraft" type="text" inputmode="decimal" autocomplete="off" :aria-label="`New salary per ${period}`" @focus="targetFocused = true" @input="applyTarget($event.target.value)" @blur="blurTarget">
              </span>
            </label>
          </div>
          <div v-if="showAfter" class="raise-result">
            <p class="raise-big"><strong :class="netGain >= 0 ? 'up' : 'down'">{{ signedMoney(netGain) }}</strong> a month in your pocket</p>
            <div class="keep-bar" role="img" :aria-label="`You keep ${Math.round(keepRate ?? 0)}% of the raise`"><i :style="{ width: `${Math.max(0, Math.min(100, keepRate ?? 0))}%` }" /></div>
            <p class="note">You keep {{ Math.round(keepRate ?? 0) }}% of a {{ money(grossGain) }} raise; {{ money(grossGain - netGain) }} goes to tax<template v-if="after.nssf !== before.nssf"> and NSSF</template>. Take-home becomes {{ money(after.net) }} a month.</p>
          </div>
          <p v-else class="note">Pick a raise to see how much of it you’d really keep.</p>
        </section>

        <!-- ===== 4. The detail, one tab at a time ===== -->
        <section class="card details" aria-label="Details">
          <div class="segmented tabs" role="radiogroup" aria-label="Show">
            <label v-for="t in TABS" :key="t.value" :class="{ active: tab === t.value }">
              <input v-model="tab" type="radio" name="salary-tab" :value="t.value">{{ t.label }}
            </label>
          </div>

          <!-- Payslip -->
          <div v-if="tab === 'payslip'" class="tab-body">
            <table class="slip">
              <thead>
                <tr><th><span class="visually-hidden">Item</span></th><th>{{ showAfter ? 'Now' : 'A month' }}</th><th v-if="showAfter">After<span class="wide-only"> the raise</span></th></tr>
              </thead>
              <tbody>
                <tr v-for="line in slipLines" :key="line.label" :class="line.kind">
                  <th>{{ line.label }}</th>
                  <td>{{ money(line.now) }}</td>
                  <td v-if="showAfter">{{ money(line.after) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr><th>Take-home</th><td>{{ money(before.net) }}</td><td v-if="showAfter">{{ money(after.net) }}</td></tr>
              </tfoot>
            </table>
            <dl class="slip-foot">
              <div v-if="before.nssfEmployer > 0"><dt>Your employer also pays NSSF</dt><dd>{{ money(before.nssfEmployer) }}</dd></div>
              <div v-if="fringe > 0"><dt>Tax on non-cash benefits, usually paid by your employer</dt><dd>{{ money(fringe * KH_FRINGE_RATE / 100) }}</dd></div>
            </dl>
          </div>

          <!-- How the tax works -->
          <div v-else-if="tab === 'tax'" class="tab-body working">
            <template v-if="khRules">
              <p class="note">Today’s pay, in riel, the way payroll works it out<template v-if="currency === 'USD'"> at {{ khrPerUsd.toLocaleString('en-US') }} ៛ to the dollar</template>.</p>
          <ol class="steps">
            <li><span>Pay that’s taxed</span><output>{{ riel(working.taxedPay) }}</output></li>
            <li v-if="!nonResident">
              <span>Family relief: {{ dependentCount }} × {{ riel(KH_DEPENDENT_RELIEF) }}</span>
              <output>{{ riel(-working.relief) }}</output>
            </li>
            <li v-if="working.preTax"><span>Taken before tax</span><output>{{ riel(-working.preTax) }}</output></li>
            <li class="sum"><span>Taxable salary</span><output>{{ riel(working.taxable) }}</output></li>
            <li v-if="nonResident">
              <span>Tax: {{ riel(working.taxable) }} × {{ KH_NON_RESIDENT_RATE }}%, flat for non-residents</span>
              <output>{{ riel(-working.tax) }}</output>
            </li>
            <li v-else>
              <span>Tax: {{ riel(working.taxable) }} × {{ working.band.rate }}% − {{ riel(working.band.quick) }} quick deduction</span>
              <output>{{ riel(-working.tax) }}</output>
            </li>
            <li v-if="working.nssf"><span>NSSF pension: {{ KH_NSSF_EMPLOYEE_RATE }}% of {{ riel(working.nssfWage) }}</span><output>{{ riel(-working.nssf) }}</output></li>
            <li v-if="working.postTax"><span>Taken after tax</span><output>{{ riel(-working.postTax) }}</output></li>
            <li v-if="working.untaxed"><span>Overtime and allowance, not taxed</span><output>{{ riel(working.untaxed) }}</output></li>
            <li class="sum"><span>Take-home</span><output>{{ riel(working.net) }}<small v-if="currency === 'USD'"> · {{ money(before.net) }}</small></output></li>
          </ol>
          <details class="bands-ref">
            <summary>Cambodia’s monthly bands for residents</summary>
            <table>
              <thead><tr><th>Taxable salary a month</th><th class="num">Rate</th><th class="num">Quick deduction</th></tr></thead>
              <tbody>
                <tr v-for="(b, i) in KH_TOS_BRACKETS" :key="i" :class="{ here: !nonResident && b === working.band }">
                  <td>{{ i === 0 ? `Up to ${riel(b.upTo)}` : b.upTo === null ? `Over ${riel(KH_TOS_BRACKETS[i - 1].upTo)}` : `${riel(KH_TOS_BRACKETS[i - 1].upTo + 1)} to ${riel(b.upTo)}` }}</td>
                  <td class="num">{{ b.rate }}%</td>
                  <td class="num">{{ riel(b.quick) }}</td>
                </tr>
              </tbody>
            </table>
          </details>
          <p class="note">
            There’s no yearly return for salary in Cambodia: your employer works this out, takes it from your pay and pays it to the General Department of Taxation by the 20th of the next month (the 25th when filed online).
            Your employer also pays {{ KH_NSSF_EMPLOYER_RATE }}% into the NSSF for you, up to {{ riel(KH_NSSF_CEILING * KH_NSSF_EMPLOYER_RATE / 100) }} a month.
            A rough guide, not tax advice: check your payslip with your employer.
          </p>
            </template>
            <p v-else class="note">You’re using {{ taxMethodLabel }}, so there’s no Cambodian working to show. Choose Cambodia’s rules under Overtime, benefits &amp; tax options to see it.</p>
          </div>

          <!-- The years ahead -->
          <div v-else class="tab-body projection">
            <template v-if="showAfter">
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
            </template>
            <p v-else class="note">Pick a raise above to see what it adds up to over the years.</p>
          </div>
        </section>
      </div>

      <!-- ===== Extras and options, in one popup ===== -->
      <Modal :open="optionsOpen" title="Overtime, benefits & tax options" wide @close="optionsOpen = false">
        <div class="options">
          <section class="stack">
            <h3>Overtime, allowances and benefits</h3>
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
                  <input v-model.number="otHours" data-keys="hours" class="input" type="number" min="0" step="0.5" inputmode="decimal">
                </label>
                <label v-if="otMode === 'amount'" class="field">
                  <span class="field-head">Paid per {{ otUnit }}</span>
                  <span class="money input">
                    <span class="unit" aria-hidden="true">{{ symbol }}</span>
                    <GroupedNumberInput v-model="otUnitAmount" min="0" :aria-label="`Paid per ${otUnit}`" />
                  </span>
                </label>
                <label v-else class="field">
                  <span class="field-head">Overtime rate</span>
                  <span class="money input">
                    <input v-model.number="otMultiplier" data-keys="multiplier" type="number" min="0" step="0.1" inputmode="decimal" aria-label="Overtime multiplier">
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
                  <span class="field-head">Cash allowance a month</span>
                  <span class="money input">
                    <span class="unit" aria-hidden="true">{{ symbol }}</span>
                    <GroupedNumberInput v-model="allowanceAmount" min="0" aria-label="Cash allowance a month" />
                  </span>
                </label>
                <label class="field">
                  <span class="field-head">Non-cash benefits a month</span>
                  <span class="money input">
                    <span class="unit" aria-hidden="true">{{ symbol }}</span>
                    <GroupedNumberInput v-model="fringe" min="0" aria-label="Non-cash benefits a month" />
                  </span>
                </label>
              </div>

              <div class="segmented" role="radiogroup" aria-label="Are overtime and the allowance taxed?">
                <label :class="{ active: extrasTaxable }">
                  <input type="radio" name="ot-tax" :checked="extrasTaxable" @change="extrasTaxable = true; sfx.play('select')">
                  Taxed
                </label>
                <label :class="{ active: !extrasTaxable }">
                  <input type="radio" name="ot-tax" :checked="!extrasTaxable" @change="extrasTaxable = false; sfx.play('select')">
                  Not taxed
                </label>
              </div>
              <p class="note">
                In Cambodia, overtime, bonuses, commissions and regular cash allowances are all taxed with your salary.
                Only money paid back for work costs, work uniforms and work-travel allowances are tax-free: leave those out, or choose Not taxed.
              </p>
              <p v-if="fringe > 0" class="note">
                Non-cash benefits, such as housing, a company car you also use privately, utilities or school fees, are taxed apart at a flat {{ KH_FRINGE_RATE }}% of their value:
                {{ money(fringe * KH_FRINGE_RATE / 100) }} a month here. Your employer usually pays it, so it isn’t taken from your take-home.
              </p>

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
          </section>
          <section class="stack">
            <h3>Tax and deductions</h3>
              <!-- A div, not a label: a click inside a label is passed on to the dropdown's button and reopens it -->
              <div class="field">
                <span class="field-head">How tax is worked out</span>
                <AppSelect v-model="taxMethod" :options="TAX_METHODS" aria-label="How tax is worked out" />
              </div>

              <label v-if="taxMethod === 'flat'" class="field">
                <span class="field-head">Flat tax rate</span>
                <span class="money input">
                  <input v-model.number="flatRate" type="number" min="0" max="100" step="0.5" inputmode="decimal" aria-label="Flat tax rate">
                  <span class="unit" aria-hidden="true">%</span>
                </span>
              </label>

              <template v-else-if="taxMethod === 'cambodia' || taxMethod === 'bands'">
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
                  <span class="field-head">Riel per dollar</span>
                  <input v-model.number="khrPerUsd" class="input" type="number" min="1" step="10" inputmode="numeric">
                  <span class="note">Payroll uses the National Bank of Cambodia’s rate on the 15th of the month.</span>
                </label>
              </template>

              <template v-else-if="taxMethod === 'payslip'">
                <label class="field">
                  <span class="field-head">Tax on your last payslip, per month</span>
                  <span class="money input">
                    <span class="unit" aria-hidden="true">{{ symbol }}</span>
                    <GroupedNumberInput v-model="payslipTax" min="0" aria-label="Tax on your last payslip" />
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

              <div class="grid2">
                <label class="field">
                  <span class="field-head">Other deduction before tax</span>
                  <span class="money input">
                    <span class="unit" aria-hidden="true">{{ symbol }}</span>
                    <GroupedNumberInput v-model="preTaxDeduction" min="0" aria-label="Other deduction before tax" />
                  </span>
                </label>
                <label class="field">
                  <span class="field-head">Taken after tax</span>
                  <span class="money input">
                    <span class="unit" aria-hidden="true">{{ symbol }}</span>
                    <GroupedNumberInput v-model="postTaxDeduction" min="0" aria-label="Taken after tax" />
                  </span>
                </label>
              </div>
              <p class="note">Before tax is only for something your payslip takes off taxable pay. Loans and insurance go after tax: they only lower what you take home.</p>
          </section>
          <div class="options-done">
            <button type="button" class="btn" @click="optionsOpen = false">Done</button>
          </div>
        </div>
      </Modal>

      <Modal :open="setupOpen" title="Get started" @close="setupOpen = false">
        <form v-validate class="setup" @submit.prevent="applySetup">
          <div class="field">
            <span class="field-head">1. How are you paid?</span>
            <div class="segmented" role="radiogroup" aria-label="Currency">
              <label v-for="c in [['USD', 'In dollars'], ['KHR', 'In riel']]" :key="c[0]" :class="{ active: setup.currency === c[0] }">
                <input v-model="setup.currency" type="radio" name="setup-currency" :value="c[0]">{{ c[1] }}
              </label>
            </div>
          </div>
          <div class="field">
            <span class="field-head">2. Your salary before tax</span>
            <div class="row">
              <span class="money input grow">
                <span class="unit" aria-hidden="true">{{ setup.currency === 'USD' ? '$' : '៛' }}</span>
                <GroupedNumberInput v-model="setup.salary" min="1" required aria-label="Salary before tax" data-error="Enter your salary" enterkeyhint="next" />
              </span>
              <div class="segmented period" role="radiogroup" aria-label="Salary is per">
                <label v-for="p in ['month', 'year']" :key="p" :class="{ active: setup.period === p }">
                  <input v-model="setup.period" type="radio" name="setup-period" :value="p">per {{ p }}
                </label>
              </div>
            </div>
            <span class="note">Include regular cash allowances, bonuses and commissions: they’re taxed too.</span>
          </div>
          <div class="field">
            <span class="field-head">3. How long are you in Cambodia?</span>
            <div class="segmented" role="radiogroup" aria-label="Tax residency">
              <label v-for="r in [['resident', 'I live here'], ['non', '182 days or fewer']]" :key="r[0]" :class="{ active: setup.residency === r[0] }">
                <input v-model="setup.residency" type="radio" name="setup-residency" :value="r[0]">{{ r[1] }}
              </label>
            </div>
            <span class="note">{{ setup.residency === 'resident' ? 'Living here, or here more than 182 days in any 12 months: you’re a resident, taxed from 0% to 20%.' : 'A non-resident pays a flat 20% on Cambodian salary, with no family relief.' }}</span>
          </div>
          <template v-if="setup.residency === 'resident'">
            <label class="check-row">
              <input v-model="setup.spouseAtHome" type="checkbox">
              <span><strong>4. My spouse stays at home</strong><small>No taxable income of their own</small></span>
            </label>
            <label class="field">
              <span class="field-head">5. Children you claim for</span>
              <input v-model.number="setup.children" class="input" type="number" min="0" step="1" inputmode="numeric" placeholder="0">
              <span class="note">Under 14, or under 25 in full-time study. If you both work, only one of you claims them.</span>
            </label>
          </template>
          <label class="check-row">
            <input v-model="setup.nssfOn" type="checkbox">
            <span><strong>{{ setup.residency === 'resident' ? '6.' : '4.' }} I pay into the NSSF pension</strong><small>Most employees do: 2% of pay, at most 30,000 ៛ a month</small></span>
          </label>
          <div class="setup-actions">
            <button type="submit" class="btn">See my take-home</button>
            <button type="button" class="btn btn-quiet" @click="setupOpen = false">Cancel</button>
          </div>
        </form>
      </Modal>
    </ClientOnly>
  </ToolPage>
</template>


<style scoped>

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

.period label {
  padding-inline: 0.85rem;
}

.period {
  min-height: 2.75rem;
}

/* A switched-off step keeps its heading but fades back */

.money {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.money input {
  flex: 1;
  min-width: 0;
  font: inherit;
  font-size: var(--text-title);
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
  font-size: var(--text-md); /* 16px or more, so phones don't zoom in when it's tapped */
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
  font-size: var(--text-sm);
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
  border-radius: var(--radius);
}

.worked div {
  display: flex;
  flex-direction: column;
}

.worked dt {
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.worked dd {
  margin: 0;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
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
  font-size: var(--text-sm);
  font-weight: 600;
  text-align: left;
  color: var(--ink-2);
  border-bottom: 1px solid var(--border);
}

.bands td {
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--border);
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

/* The ring (components/gauge) underneath, the words in its middle */

table.slip {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.slip th,
.slip td {
  padding: 0.4rem 0;
  font-size: var(--text-base);
}

.slip thead th {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--ink-2);
  text-align: right;
  border-bottom: 1px solid var(--border);
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
  font-size: var(--text-title);
  font-weight: 800;
  text-align: right;
  border-top: 2px solid var(--ink);
}

.slip tfoot th {
  text-align: left;
}

/* 2px gaps between segments so neighbouring colours never blur together */

.slip-foot {
  margin: 1rem 0 0;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
}

.slip-foot div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.25rem 0;
  font-size: var(--text-sm);
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
  font-size: var(--text-sm);
  font-weight: 600;
  text-align: left;
  color: var(--ink-2);
  border-bottom: 1px solid var(--border);
}

.proj td {
  padding: 0.6rem 0.75rem 0.6rem 0;
  border-bottom: 1px solid var(--border);
}

.proj .num {
  text-align: right;
}

/* Phones: drop the yearly total and the growth bar so the table fits without scrolling sideways */
@media (max-width: 640px) {
  .proj {
    min-width: 0;
    font-size: var(--text-sm);
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
  border-radius: var(--radius-pill);
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

@media (max-width: 640px) {
  .grid2 { grid-template-columns: minmax(0, 1fr); }
  
  
  
  .worked { grid-template-columns: minmax(0, 1fr); }
}

/* "per month" stays on one line */
.segmented.period label {
  white-space: nowrap;
}

/* A tick box with a title and a line under it */
.check-row {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  min-height: 2.75rem;
  padding-top: 0.35rem;
  cursor: pointer;
}

.check-row input {
  margin-top: 0.2rem;
}

.check-row span {
  display: grid;
  gap: 0.1rem;
}

.check-row small {
  font-size: var(--text-sm);
  color: var(--ink-2);
}

/* How the tax is worked out: one line per step, the amounts lined up on the right */
.steps {
  display: grid;
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
  counter-reset: step;
}

.steps li {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  padding: 0.55rem 0;
  border-top: 1px solid var(--border);
}

.steps li:first-child {
  border-top: 0;
}

.steps li.sum {
  font-weight: 700;
  border-top-width: 2px;
}

.steps li span {
  min-width: 0;
  color: var(--ink-2);
}

.steps li.sum span {
  color: var(--ink);
}

.steps output {
  flex: none;
  font-weight: 650;
  text-align: right;
}

.steps output small {
  font-weight: 500;
  color: var(--ink-2);
}

.bands-ref {
  margin-bottom: 1rem;
}

.bands-ref summary {
  padding-block: 0.65rem;
  font-weight: 650;
  cursor: pointer;
}

.bands-ref table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.bands-ref th,
.bands-ref td {
  padding: 0.45rem 0.5rem;
  text-align: left;
  border-top: 1px solid var(--border);
}

.bands-ref .num {
  text-align: right;
}

.bands-ref tr.here td {
  font-weight: 700;
  background: color-mix(in oklab, var(--accent) 12%, transparent);
}

/* Get started */

.setup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.setup {
  display: grid;
  gap: 1.1rem;
}

.setup .row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.setup .grow {
  flex: 1 1 10rem;
}

/* ---------- The answer: take-home first ---------- */
/* A chevron that turns when the section opens */

details[open] > summary::after {
  rotate: 225deg;
  top: 1.4rem;
}


/* =========================================================
   Layout: one column, top to bottom like a story
   ========================================================= */
.salary {
  display: grid;
  /* minmax(0, …): a long figure or wide table can't stretch the cards past the screen */
  grid-template-columns: minmax(0, 1fr);
  gap: 1.25rem;
  max-width: 54rem;
  margin-inline: auto;
}

.card {
  padding: 1.4rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-2xl);
}

.card h2 {
  margin-bottom: 1rem;
  font-size: var(--text-lg);
}

/* ---------- 1. The hero: your pay as a sentence, and the answer ---------- */
.hero {
  container-type: inline-size;
  --hero-ink: #fff;
  --blank-bg: rgb(255 255 255 / 0.14);
  --blank-line: rgb(255 255 255 / 0.5);
  display: grid;
  gap: 1rem;
  padding: clamp(1.25rem, 1rem + 2vw, 2.25rem);
  color: var(--hero-ink);
  background:
    radial-gradient(120% 140% at 100% 0%, color-mix(in oklab, var(--accent) 70%, #fff) 0%, transparent 55%),
    var(--accent);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-md);
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.eyebrow {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.8;
}

.hero-btn,
.hero-link {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.75rem;
  padding: 0 1rem;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 650;
  color: var(--hero-ink);
  background: var(--blank-bg);
  border: 1px solid rgb(255 255 255 / 0.25);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background-color var(--dur-fast), scale 0.1s;
}

.hero-btn:hover,
.hero-link:hover {
  background: rgb(255 255 255 / 0.24);
}

.hero-btn:active,
.hero-link:active {
  scale: 0.97;
}

/* The sentence: big, plain words with fill-in blanks */
.sentence {
  margin: 0;
  max-width: 40ch;
  font-size: clamp(1.25rem, 1.05rem + 1vw, 1.75rem);
  font-weight: 600;
  line-height: 1.9;
  text-wrap: pretty;
  hyphens: manual;
}

.blank {
  display: inline-flex;
  align-items: baseline;
  gap: 0.15em;
  padding: 0.05em 0.35em;
  line-height: 1.3;
  vertical-align: baseline;
  background: var(--blank-bg);
  border-bottom: 2px solid var(--blank-line);
  border-radius: 0.35em 0.35em 0 0;
}

.blank:focus-within {
  border-bottom-color: #fff;
  background: rgb(255 255 255 / 0.22);
}

.blank input {
  width: 5.5ch;
  min-width: 0;
  padding: 0;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  outline: none;
  min-inline-size: 2ch;
}

/* Where the browser can, each blank is as wide as what's typed in it */
@supports (field-sizing: content) {
  .blank input {
    width: auto;
    field-sizing: content;
  }
}

.blank input::placeholder {
  color: rgb(255 255 255 / 0.55);
}

.money-blank input {
  min-inline-size: 4ch;
}

.count-blank input {
  width: 2ch;
  text-align: center;
}

.blank .unit {
  font-weight: 500;
  opacity: 0.75;
}

/* Dropdowns inside the sentence look like the other blanks */
.pick {
  display: inline-block;
  max-width: 100%;
  vertical-align: baseline;
}

.pick :deep(.value) {
  white-space: normal;
  text-align: left;
}

.pick :deep(.trigger) {
  display: inline-flex;
  width: auto;
  max-width: 100%;
  min-height: 0;
  padding: 0.05em 0.35em;
  font: inherit;
  line-height: 1.3;
  color: inherit;
  background: var(--blank-bg);
  border: 0;
  border-bottom: 2px solid var(--blank-line);
  border-radius: 0.35em 0.35em 0 0;
  box-shadow: none;
}

.pick :deep(.trigger:hover),
.pick :deep(.trigger.open) {
  background: rgb(255 255 255 / 0.22);
  border-bottom-color: #fff;
}

.pick :deep(.trigger svg) {
  width: 0.7em;
  height: 0.7em;
  opacity: 0.75;
}

/* The answer */
.answer {
  display: grid;
  gap: 0.1rem;
  margin-top: 0.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid rgb(255 255 255 / 0.25);
}

.answer-label {
  font-size: var(--text-sm);
  font-weight: 650;
  opacity: 0.85;
}

.answer-pay {
  font-size: clamp(1.75rem, 13cqi, 4.5rem);
  overflow-wrap: anywhere;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.answer-per {
  font-size: var(--text-md);
  opacity: 0.85;
}

.hero-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
}

.hero-link .dot {
  width: 0.5rem;
  height: 0.5rem;
  background: #7ee2a8;
  border-radius: 50%;
}

.hero-hint {
  font-size: var(--text-sm);
  opacity: 0.8;
}

/* ---------- 2. Where your pay goes: a waterfall ---------- */
.flow-rows {
  display: grid;
  gap: 0.7rem;
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
}

.flow-rows li {
  display: grid;
  grid-template-columns: 10rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
}

.flow-label {
  font-weight: 600;
}

.flow-amount {
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.flow-track {
  position: relative;
  height: 1.6rem;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
}

.flow-track i {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: var(--radius-sm);
  transition: left var(--dur-slow) var(--ease-in-out), width var(--dur-slow) var(--ease-in-out);
}

.gross .flow-track i { background: var(--ink-3); }
.tax .flow-track i { background: var(--red); }
.ded .flow-track i { background: var(--orange); }
.net .flow-track i { background: var(--green); }

.tax .flow-amount { color: var(--bad-ink); }
.net .flow-label,
.net .flow-amount { color: var(--good-ink); }

.flow-rows li.net {
  padding-top: 0.7rem;
  border-top: 2px solid var(--border);
}

/* ---------- 3. A raise ---------- */
.raise-picks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.raise-chip {
  min-width: 3.5rem;
  min-height: 2.75rem;
  padding: 0 0.9rem;
  font: inherit;
  font-weight: 650;
  color: var(--ink);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background-color var(--dur-fast), color var(--dur-fast), scale 0.1s;
}

.raise-chip:hover {
  background: var(--line);
}

.raise-chip:active {
  scale: 0.97;
}

.raise-chip[aria-pressed='true'] {
  color: var(--on-accent, #fff);
  background: var(--accent-btn, var(--accent));
  border-color: transparent;
}

.raise-inputs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.raise-result {
  display: grid;
  gap: 0.6rem;
  margin-top: 1.25rem;
  padding: 1.1rem 1.2rem;
  background: color-mix(in oklab, var(--green) 9%, var(--surface));
  border-radius: var(--radius-lg);
}

.raise-big {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 600;
}

.raise-big strong {
  font-size: var(--text-2xl);
  font-variant-numeric: tabular-nums;
}

.keep-bar {
  height: 0.6rem;
  overflow: hidden;
  background: color-mix(in oklab, var(--red) 25%, var(--surface));
  border-radius: var(--radius-pill);
}

.keep-bar i {
  display: block;
  height: 100%;
  background: var(--green);
  border-radius: inherit;
  transition: width var(--dur-slow) var(--ease-in-out);
}

/* ---------- 4. The detail, in tabs ---------- */
.details .tabs {
  margin-bottom: 1.25rem;
}

.tab-body {
  display: grid;
  gap: 1rem;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
}

/* ---------- The options popup ---------- */
.options {
  display: grid;
  gap: 1.75rem;
}

.options h3 {
  margin: 0;
  font-size: var(--text-title);
}

.options-done {
  display: flex;
  justify-content: flex-end;
}

/* ---------- Phones ---------- */
@media (max-width: 640px) {
  .flow-rows li {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.35rem 1rem;
  }

  .flow-track {
    grid-column: 1 / -1;
    grid-row: 2;
    height: 1rem;
  }

  .raise-inputs {
    grid-template-columns: minmax(0, 1fr);
  }

  .details .tabs label {
    white-space: normal;
    line-height: 1.2;
  }
}

/* Small phones: the payslip fits, even comparing two nine-digit riel figures */
@media (max-width: 480px) {
  .card {
    padding: 1.1rem 0.9rem;
  }

  table.slip th,
  table.slip td {
    font-size: var(--text-xs);
  }

  table.slip td {
    padding-left: 0.5rem;
    white-space: nowrap;
  }

  table.slip tfoot th,
  table.slip tfoot td {
    font-size: var(--text-sm);
  }

  .wide-only {
    display: none;
  }
}

/* ---------- Number fields ---------- */
/* No browser up/down arrows: they're tiny to hit, nudge by 1, and clutter the field */
input[type='number'] {
  appearance: textfield;
  -moz-appearance: textfield;
}

input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Figures line up, digit for digit, in every field */
.money input,
.blank input,
.salary input {
  font-variant-numeric: tabular-nums;
}

/* The raise fields: bigger figures, the unit quietly to one side */
.raise-inputs .money {
  min-height: 3.25rem;
  border-radius: var(--radius-lg);
}

.raise-inputs .money input {
  font-size: var(--text-lg);
  font-weight: 650;
}

.raise-inputs .money .unit {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--ink-3);
}

/* The same pay in the other currency */
.equiv {
  margin: -0.25rem 0 0;
  font-size: var(--text-sm);
  opacity: 0.85;
  font-variant-numeric: tabular-nums;
}

.answer-equiv {
  margin-top: 0.15rem;
  font-size: var(--text-lg);
  font-weight: 650;
  opacity: 0.9;
  font-variant-numeric: tabular-nums;
}

/* ---------- Where your pay goes: Bars or Pie ---------- */
.flow-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem 1rem;
  margin-bottom: 1rem;
}

.flow-head h2 {
  margin: 0;
}

.view-switch label {
  min-width: 4.5rem;
}

.pie {
  display: grid;
  grid-template-columns: minmax(0, 15rem) minmax(0, 1fr);
  align-items: center;
  gap: 1.5rem 2rem;
  margin-bottom: 1rem;
}

.pie-chart {
  position: relative;
  width: 100%;
  max-width: 15rem;
  justify-self: center;
}

.pie-center {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
  pointer-events: none;
}

.pie-center strong {
  font-size: var(--text-2xl);
  font-weight: 800;
  line-height: 1;
  color: var(--good-ink);
  font-variant-numeric: tabular-nums;
}

.pie-center small {
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.pie-key {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pie-key li {
  display: grid;
  grid-template-columns: 0.8rem minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 2.75rem;
  padding: 0 0.6rem;
  border-radius: var(--radius-sm);
  transition: background-color var(--dur-fast);
}

.pie-key li.active {
  background: var(--surface-2);
}

.pie-key i {
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 3px;
}

.pie-label {
  font-weight: 600;
}

.pie-share {
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.pie-key strong {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.pie-key .pie-total {
  grid-template-columns: minmax(0, 1fr) auto;
  margin-top: 0.25rem;
  padding-top: 0.5rem;
  border-top: 2px solid var(--border);
  border-radius: 0;
}

@media (max-width: 640px) {
  .pie {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Each amount with the other currency under it */
.flow-amount,
.pie-key strong {
  display: grid;
  justify-items: end;
  line-height: 1.25;
}

.flow-amount small,
.pie-key strong small {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--ink-2);
}

.flow-amount {
  min-width: 7rem;
}
</style>
