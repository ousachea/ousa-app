<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Currency, PaymentMethod, Widget } from '~/utils/budget/types'
import { WIDGETS } from '~/utils/budget/defaults'
import { formatDay, today } from '~/utils/budget/dates'

// Budget settings. They're a synced record of their own, so a phone and a computer agree on the
// currency, rate and payment methods. Whole-app backup lives in the gear's Import & export.
const store = useBudget()
const { settings, updateSettings, rate, go } = store
const { play } = useSound()
const s = computed(() => settings.value)

const currency = computed({ get: () => s.value.primaryCurrency, set: (v: Currency) => updateSettings({ primaryCurrency: v }) })
const rateMode = computed({ get: () => s.value.rateMode, set: (v: 'live' | 'fixed') => updateSettings({ rateMode: v }) })
const weekStart = computed({ get: () => s.value.weekStart, set: (v: 0 | 1) => updateSettings({ weekStart: v }) })

const fixedRate = ref<number | null>(s.value.fixedRate)
watch(() => s.value.fixedRate, v => (fixedRate.value = v))
function saveRate() {
  const v = Number(fixedRate.value)
  if (!(v > 0)) return
  updateSettings({ fixedRate: v, fixedRateDate: today() })
  play('success')
  toast.success('Exchange rate saved', { description: `${v.toLocaleString('en-US')} ៛ per $1, from ${formatDay(today())}` })
}

// Alerts: the early warning percentage(s), and an optional extra warning well past the limit
const alertsText = ref(s.value.alerts.join(', '))
watch(() => s.value.alerts, v => (alertsText.value = v.join(', ')))
function saveAlerts() {
  const list = [...new Set(alertsText.value.split(/[,\s]+/).map(Number).filter(n => n > 0 && n < 100))].sort((a, b) => a - b)
  updateSettings({ alerts: list.length ? list : [80] })
  play('success')
}
const overAlert = computed({ get: () => s.value.overAlert, set: (v: number) => updateSettings({ overAlert: v }) })

function toggleWidget(w: Widget) {
  updateSettings({ widgets: { ...s.value.widgets, [w]: !s.value.widgets[w] } })
  play('select')
}

// ---------- Payment methods ----------
const newMethod = ref('')
function addMethod() {
  const name = newMethod.value.trim()
  if (!name) return
  if (s.value.methods.some(m => m.name.toLowerCase() === name.toLowerCase() && !m.archived)) {
    toast(`${name} is already there`)
    return
  }
  const id = `m-${crypto.randomUUID().slice(0, 8)}`
  updateSettings({ methods: [...s.value.methods, { id, name }] })
  newMethod.value = ''
  play('success')
}
function renameMethod(m: PaymentMethod, name: string) {
  const n = name.trim()
  if (!n || n === m.name) return
  updateSettings({ methods: s.value.methods.map(x => (x.id === m.id ? { ...x, name: n } : x)) })
}
// Methods are archived, never deleted, so old transactions keep their names
function toggleMethod(m: PaymentMethod) {
  updateSettings({ methods: s.value.methods.map(x => (x.id === m.id ? { ...x, archived: !x.archived } : x)) })
  play(m.archived ? 'toggle-on' : 'toggle-off')
}

const settingsOpen = useAppSettingsOpen()
const rateLabel = computed(() => {
  const r = rate.value
  if (!r.rate) return 'Loading today’s rate…'
  return `${r.rate.toLocaleString('en-US')} ៛ per $1 · ${r.source === 'fixed' ? `your rate from ${formatDay(r.date!)}` : r.source === 'live' ? 'today’s market rate' : r.source === 'saved' ? 'last rate saved here' : 'typical rate (couldn’t load today’s)'}`
})
</script>

<template>
  <div class="settings">
    <div class="b-head"><h2>Settings</h2></div>

    <section class="panel b-panel">
      <h3>Currency</h3>
      <SettingChoice v-model="currency" title="Show totals in" description="Each transaction keeps the currency it was entered in; totals convert into this one." :options="[{ value: 'USD', label: 'US dollars ($)' }, { value: 'KHR', label: 'Cambodian riel (៛)' }]" />
      <SettingChoice v-model="rateMode" title="Exchange rate for totals" :options="[{ value: 'live', label: 'Today’s market rate' }, { value: 'fixed', label: 'My own rate' }]" />
      <div v-if="rateMode === 'fixed'" class="rate-row">
        <label class="field">
          <span class="field-head">Riel per $1</span>
          <input v-model.number="fixedRate" class="input" type="number" inputmode="numeric" min="1" step="1" aria-label="Riel per dollar" data-keys="rate">
        </label>
        <button type="button" class="btn btn-sm" @click="saveRate">Save rate</button>
      </div>
      <p class="b-muted">Using {{ rateLabel }}.</p>
    </section>

    <section class="panel b-panel">
      <h3>Calendar</h3>
      <SettingChoice v-model="weekStart" title="Weeks start on" :options="[{ value: 1, label: 'Monday' }, { value: 0, label: 'Sunday' }]" />
      <p class="b-muted">Days follow this device’s time zone, so a coffee at 6 am in Phnom Penh is logged today, not yesterday.</p>
    </section>

    <section class="panel b-panel">
      <h3>Budget alerts</h3>
      <div class="rate-row">
        <label class="field">
          <span class="field-head">Warn at (% of a budget)</span>
          <input v-model="alertsText" class="input" inputmode="numeric" aria-label="Warning percentages" placeholder="80" @change="saveAlerts">
        </label>
        <button type="button" class="btn btn-sm" @click="saveAlerts">Save</button>
      </div>
      <p class="b-muted">Separate several with commas, like 50, 80. Reaching 100% always shows “Limit reached”.</p>
      <SettingChoice v-model="overAlert" title="Call it “over budget” at" :options="[{ value: 0, label: 'Just past 100%' }, { value: 10, label: '110%' }, { value: 25, label: '125%' }]" />
    </section>

    <section class="panel b-panel">
      <h3>Payment methods</h3>
      <TransitionGroup tag="ul" name="list" class="methods">
        <li v-for="m in s.methods" :key="m.id" :class="{ archived: m.archived }">
          <input class="input" :value="m.name" :aria-label="`Rename ${m.name}`" data-keys="text" @change="renameMethod(m, ($event.target as HTMLInputElement).value)">
          <button type="button" class="link" @click="toggleMethod(m)">{{ m.archived ? 'Bring back' : 'Hide' }}</button>
        </li>
      </TransitionGroup>
      <form class="rate-row" @submit.prevent="addMethod">
        <input v-model="newMethod" class="input" placeholder="ABA, Wing, ACLEDA…" aria-label="New payment method" data-keys="text">
        <button type="submit" class="btn btn-sm">Add</button>
      </form>
    </section>

    <section class="panel b-panel">
      <h3>Dashboard</h3>
      <div class="widgets">
        <label v-for="w in WIDGETS" :key="w.value" class="check"><input type="checkbox" :checked="s.widgets[w.value]" @change="toggleWidget(w.value)"> {{ w.label }}</label>
      </div>
    </section>

    <section class="panel b-panel">
      <h3>Your data</h3>
      <p class="b-muted">
        Signed in, your budget syncs to your account and stays the same on your phone and computer. Changes made offline wait on this device and go out when you’re back online.
      </p>
      <div class="b-row">
        <button type="button" class="btn btn-quiet btn-sm" @click="go('transactions')">Export or import transactions (CSV)</button>
        <button type="button" class="btn btn-quiet btn-sm" @click="settingsOpen = true">Back up or restore everything (JSON)</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings {
  max-width: 46rem;
}

.settings .b-panel h3 {
  margin-bottom: 0.5rem;
}

.rate-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.6rem;
  margin: 0.5rem 0;
}

.rate-row .field,
.rate-row > .input {
  flex: 1 1 12rem;
}

.methods {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.methods li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.methods .input {
  flex: 1;
}

.methods .archived {
  opacity: 0.55;
}

.widgets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: 0.5rem;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.25rem;
}
</style>
