<script setup lang="ts">
import { toast } from 'vue-sonner'

// Claude usage: two views of how much Claude you use.
// - API: your organization's spend and tokens from Anthropic's Usage and Cost Admin API
//   (server/api/claude/report.get.ts). Needs an Admin API key, kept only in this browser.
// - Claude Code: tokens, sessions and an estimated cost from Claude Code's logs on this computer
//   (server/api/claude/code.get.ts). Only when the app runs on that computer.
const route = useRoute()
const router = useRouter()
const { play } = useSound()

type Tab = 'api' | 'code'
const TABS: { value: Tab, label: string }[] = [
  { value: 'api', label: 'API spend' },
  { value: 'code', label: 'Claude Code' }
]
// The tab lives in the address (?tab=code), so it survives reloads and works with Back
const tab = computed<Tab>(() => (route.query.tab === 'code' ? 'code' : 'api'))
function selectTab(value: Tab) {
  if (value === tab.value) return
  viewTransition(() => router.replace({ query: value === 'code' ? { tab: 'code' } : {} }))
  play('select')
}

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' }
]
const days = useRemembered<number>('claude-range', 30, v => RANGES.some(r => r.value === v))

// ---------- Numbers ----------
// Cents only for small amounts; whole dollars from $10
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: n < 10 ? 2 : 0, maximumFractionDigits: n < 10 ? 2 : 0 })
const compact = (n: number) => Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: n < 1e6 ? 0 : 1 }).format(n)
const pctOf = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '–')
// Model ids as people say them: claude-opus-5-5 → Opus 5.5
const modelName = (id: string) => {
  const m = id.match(/^claude-([a-z]+)-(\d+)(?:-(\d+))?/)
  return m ? `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1)} ${m[2]}${m[3] && m[3].length <= 2 ? `.${m[3]}` : ''}` : id
}

// ---------- API spend ----------
// The Admin API key stays in this browser, under a key of its own that backups and exports never include
const KEY_STORE = 'ousa-secret:claude-admin-key'
const adminKey = ref('')
const keyDraft = ref('')
onMounted(() => {
  try {
    adminKey.value = localStorage.getItem(KEY_STORE) ?? ''
  } catch {}
})
function saveKey() {
  const key = keyDraft.value.trim()
  if (!/^sk-ant-admin/.test(key)) {
    toast.error('That doesn’t look like an Admin API key', { description: 'Admin keys start with sk-ant-admin. A regular API key can’t read usage.' })
    play('error')
    return
  }
  try {
    localStorage.setItem(KEY_STORE, key)
  } catch {}
  adminKey.value = key
  keyDraft.value = ''
  play('success')
}
function forgetKey() {
  try {
    localStorage.removeItem(KEY_STORE)
  } catch {}
  adminKey.value = ''
  api.value = undefined
  play('delete')
  toast('Admin key removed from this device')
}

interface UsageResult { model: string | null, uncached_input_tokens: number, cache_read_input_tokens: number, cache_creation: { ephemeral_1h_input_tokens: number, ephemeral_5m_input_tokens: number }, output_tokens: number }
interface CostResult { amount: string, model: string | null, cost_type: string | null, description: string | null }
interface Report<R> { data: { starting_at: string, results: R[] }[] }

const api = ref<{ usage: Report<UsageResult>, cost: Report<CostResult> }>()
const apiState = ref<'idle' | 'loading' | 'error'>('idle')
const apiError = ref('')

async function loadApi() {
  if (!adminKey.value) return
  apiState.value = 'loading'
  try {
    const headers = { 'x-admin-key': adminKey.value }
    const [usage, cost] = await Promise.all([
      $fetch<Report<UsageResult>>('/api/claude/report', { query: { kind: 'usage', days: days.value }, headers }),
      $fetch<Report<CostResult>>('/api/claude/report', { query: { kind: 'cost', days: days.value }, headers })
    ])
    api.value = { usage, cost }
    apiState.value = 'idle'
  } catch (e) {
    apiError.value = (e as { data?: { message?: string } }).data?.message ?? 'Couldn’t load the usage report. Check your connection and try again.'
    apiState.value = 'error'
  }
}
watch([adminKey, days, tab], () => {
  if (tab.value === 'api') loadApi()
})
onMounted(() => {
  if (tab.value === 'api') loadApi()
})

// Cost amounts are in cents, as decimal strings
const cents = (r: CostResult) => Number(r.amount) / 100
const usageTokens = (r: UsageResult) => r.uncached_input_tokens + r.cache_read_input_tokens + r.cache_creation.ephemeral_1h_input_tokens + r.cache_creation.ephemeral_5m_input_tokens + r.output_tokens

const apiView = computed(() => {
  if (!api.value) return undefined
  const daily = api.value.cost.data.map(b => ({ day: b.starting_at.slice(0, 10), value: b.results.reduce((s, r) => s + cents(r), 0) }))
  const spent = daily.reduce((s, d) => s + d.value, 0)
  let tokens = 0
  let cacheRead = 0
  let input = 0
  let output = 0
  const models = new Map<string, { cost: number, tokens: number }>()
  const row = (name: string) => models.get(name) ?? models.set(name, { cost: 0, tokens: 0 }).get(name)!
  for (const b of api.value.usage.data) {
    for (const r of b.results) {
      const t = usageTokens(r)
      tokens += t
      cacheRead += r.cache_read_input_tokens
      input += r.uncached_input_tokens + r.cache_read_input_tokens + r.cache_creation.ephemeral_1h_input_tokens + r.cache_creation.ephemeral_5m_input_tokens
      output += r.output_tokens
      row(r.model ?? 'Other').tokens += t
    }
  }
  // Costs without a model are tools and the like (web search, code execution)
  for (const b of api.value.cost.data) for (const r of b.results) row(r.model ?? 'Tools and other').cost += cents(r)
  const busiest = daily.reduce((a, d) => (d.value > (a?.value ?? -1) ? d : a), undefined as { day: string, value: number } | undefined)
  return {
    daily,
    spent,
    tokens,
    output,
    cacheShare: pctOf(cacheRead, input),
    busiest,
    models: [...models].map(([model, v]) => ({ model, ...v })).filter(m => m.cost || m.tokens).sort((a, b) => b.cost - a.cost || b.tokens - a.tokens)
  }
})

// ---------- Claude Code ----------
interface CodeTotals { tokens: number, input: number, output: number, cacheRead: number, cacheWrite: number, cost: number, unpriced: number, messages: number }
type CodeReport = { available: false } | {
  available: true
  total: CodeTotals & { sessions: number, projects: number }
  daily: (CodeTotals & { day: string })[]
  models: (CodeTotals & { model: string })[]
  projects: (CodeTotals & { project: string, sessions: number })[]
}
const code = ref<CodeReport>()
const codeState = ref<'idle' | 'loading' | 'error' | 'remote'>('idle')
async function loadCode() {
  codeState.value = 'loading'
  try {
    code.value = await $fetch<CodeReport>('/api/claude/code', { query: { days: days.value } })
    codeState.value = 'idle'
  } catch (e) {
    codeState.value = (e as { statusCode?: number, status?: number }).statusCode === 403 || (e as { status?: number }).status === 403 ? 'remote' : 'error'
  }
}
watch([days, tab], () => {
  if (tab.value === 'code') loadCode()
})
onMounted(() => {
  if (tab.value === 'code') loadCode()
})
const codeView = computed(() => (code.value?.available ? code.value : undefined))
const maxOf = <T>(list: T[], get: (t: T) => number) => Math.max(...list.map(get), 0)

function refresh() {
  play('retry')
  if (tab.value === 'api') loadApi()
  else loadCode()
}
</script>

<template>
  <ToolPage header="bar">
    <template #actions>
      <button type="button" class="btn btn-quiet btn-sm" :disabled="apiState === 'loading' || codeState === 'loading'" @click="refresh">Refresh</button>
    </template>

    <div class="toolbar">
      <div class="tabs" role="tablist" aria-label="Which usage">
        <button v-for="t in TABS" :key="t.value" type="button" role="tab" class="tab" :aria-selected="tab === t.value" @click="selectTab(t.value)">{{ t.label }}</button>
      </div>
      <div class="segmented range" role="radiogroup" aria-label="Period">
        <label v-for="r in RANGES" :key="r.value" :class="{ active: days === r.value }">
          <input v-model="days" type="radio" name="range" :value="r.value">{{ r.label }}
        </label>
      </div>
    </div>

    <ClientOnly>
      <!-- ---------- API spend ---------- -->
      <template v-if="tab === 'api'">
        <section v-if="!adminKey" class="panel setup">
          <h2>Connect your Anthropic organization</h2>
          <p>Your API spend comes from Anthropic’s Usage and Cost reports, which need an <strong>Admin API key</strong> (it starts with <code>sk-ant-admin</code>). A regular API key can’t read them, and Admin keys only exist for organizations, not individual accounts.</p>
          <ol>
            <li>In the Claude Console, open <a href="https://platform.claude.com/settings/admin-keys" target="_blank" rel="noopener">Settings → Admin keys</a> and create one.</li>
            <li>Paste it here.</li>
          </ol>
          <form class="key-form" @submit.prevent="saveKey">
            <input v-model="keyDraft" class="input" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-admin01-…" aria-label="Admin API key">
            <button type="submit" class="btn">Connect</button>
          </form>
          <p class="fine">Kept only in this browser, never in your account or backups. It’s sent with each request straight on to Anthropic, only to read these two reports.</p>
        </section>

        <template v-else>
          <p v-if="apiState === 'error'" class="panel problem" role="alert">
            {{ apiError }}
            <span class="problem-actions"><button type="button" class="link" @click="loadApi">Try again</button><button type="button" class="link" @click="forgetKey">Use another key</button></span>
          </p>
          <div v-else-if="!apiView" class="panel loading" aria-busy="true">Loading your usage report…</div>

          <template v-if="apiView">
            <ClaudeBudget :spent="apiView.spent" :days="days" />
            <div class="stats">
              <div class="panel stat"><span class="k">Spent</span><b>{{ usd(apiView.spent) }}</b><small>last {{ days }} days</small></div>
              <div class="panel stat"><span class="k">Tokens</span><b>{{ compact(apiView.tokens) }}</b><small>{{ compact(apiView.output) }} written by Claude</small></div>
              <div class="panel stat"><span class="k">From the cache</span><b>{{ apiView.cacheShare }}</b><small>of input tokens, at a fraction of the price</small></div>
              <div class="panel stat"><span class="k">Busiest day</span><b>{{ apiView.busiest && apiView.busiest.value ? usd(apiView.busiest.value) : '–' }}</b><small>{{ apiView.busiest && apiView.busiest.value ? new Date(`${apiView.busiest.day}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'nothing yet' }}</small></div>
            </div>

            <section class="panel chart">
              <h3>Spent each day <span class="unit">US dollars, UTC days</span></h3>
              <UsageBars :days="apiView.daily" :format="usd" label="Dollars spent each day" />
            </section>

            <section class="panel breakdown">
              <h3>By model</h3>
              <table>
                <thead><tr><th scope="col">Model</th><th scope="col" class="num">Spent</th><th scope="col" class="num">Tokens</th></tr></thead>
                <tbody>
                  <tr v-for="m in apiView.models" :key="m.model">
                    <th scope="row">
                      {{ modelName(m.model) }}
                      <span class="share" aria-hidden="true"><span :style="{ width: `${(m.cost / (maxOf(apiView.models, x => x.cost) || 1)) * 100}%` }" /></span>
                    </th>
                    <td class="num">{{ usd(m.cost) }}</td>
                    <td class="num">{{ m.tokens ? compact(m.tokens) : '–' }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-if="!apiView.models.length" class="fine">No usage in this period.</p>
            </section>
            <p class="fine foot">From Anthropic’s Usage and Cost reports for your whole organization, usually up to date within five minutes. Priority Tier isn’t included in the dollars. <button type="button" class="link" @click="forgetKey">Remove the Admin key</button></p>
          </template>
        </template>
      </template>

      <!-- ---------- Claude Code ---------- -->
      <template v-else>
        <section v-if="codeState === 'remote' || (code && !code.available)" class="panel setup">
          <h2>Claude Code usage is read from your computer</h2>
          <p>Claude Code keeps a log of every session on the computer it runs on (in <code>~/.claude</code>). This tab reads it when the app runs on that same computer: start it there with <code>npm run dev</code> and open it at <code>localhost</code>.</p>
          <p class="fine">For your privacy, the logs are never uploaded, and only that computer itself can read them through the app.</p>
        </section>
        <p v-else-if="codeState === 'error'" class="panel problem" role="alert">Couldn’t read Claude Code’s logs. <button type="button" class="link" @click="loadCode">Try again</button></p>
        <div v-else-if="!codeView" class="panel loading" aria-busy="true">Reading Claude Code’s logs… the first time takes a few seconds.</div>

        <template v-if="codeView">
          <ClaudeBudget :spent="codeView.total.cost" :days="days" estimated />
          <div class="stats">
            <div class="panel stat"><span class="k">At API prices</span><b>{{ usd(codeView.total.cost) }}</b><small>estimated, last {{ days }} days</small></div>
            <div class="panel stat"><span class="k">Tokens</span><b>{{ compact(codeView.total.tokens) }}</b><small>{{ pctOf(codeView.total.cacheRead, codeView.total.tokens) }} read from the cache</small></div>
            <div class="panel stat"><span class="k">Sessions</span><b>{{ codeView.total.sessions }}</b><small>in {{ codeView.total.projects }} {{ codeView.total.projects === 1 ? 'project' : 'projects' }}</small></div>
            <div class="panel stat"><span class="k">Replies</span><b>{{ compact(codeView.total.messages) }}</b><small>{{ compact(codeView.total.output) }} tokens written</small></div>
          </div>

          <section class="panel chart">
            <h3>Each day <span class="unit">estimated, at API prices</span></h3>
            <UsageBars :days="codeView.daily.map(d => ({ day: d.day, value: d.cost }))" :format="usd" label="Estimated cost each day" />
          </section>

          <div class="split">
            <section class="panel breakdown">
              <h3>By project</h3>
              <table>
                <thead><tr><th scope="col">Project</th><th scope="col" class="num">Sessions</th><th scope="col" class="num">Est. cost</th></tr></thead>
                <tbody>
                  <tr v-for="p in codeView.projects" :key="p.project">
                    <th scope="row">
                      {{ p.project }}
                      <span class="share" aria-hidden="true"><span :style="{ width: `${(p.cost / (maxOf(codeView.projects, x => x.cost) || 1)) * 100}%` }" /></span>
                    </th>
                    <td class="num">{{ p.sessions }}</td>
                    <td class="num">{{ usd(p.cost) }}</td>
                  </tr>
                </tbody>
              </table>
            </section>
            <section class="panel breakdown">
              <h3>By model</h3>
              <table>
                <thead><tr><th scope="col">Model</th><th scope="col" class="num">Tokens</th><th scope="col" class="num">Est. cost</th></tr></thead>
                <tbody>
                  <tr v-for="m in codeView.models" :key="m.model">
                    <th scope="row">
                      {{ modelName(m.model) }}
                      <span class="share" aria-hidden="true"><span :style="{ width: `${(m.tokens / (maxOf(codeView.models, x => x.tokens) || 1)) * 100}%` }" /></span>
                    </th>
                    <td class="num">{{ compact(m.tokens) }}</td>
                    <td class="num">{{ m.unpriced === m.messages ? '–' : usd(m.cost) }}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>
          <p class="fine foot">From Claude Code’s logs on this computer. Costs are what these tokens would cost on the API at list prices; on a Claude subscription you aren’t charged per token.</p>
        </template>
      </template>
      <template #fallback><div class="panel loading" aria-busy="true">Loading…</div></template>
    </ClientOnly>
  </ToolPage>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  margin-bottom: 1.25rem;
}

.tabs {
  display: flex;
  gap: 0.25rem;
  padding: 4px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 14px;
}

.tab {
  min-height: 2.4rem;
  padding: 0 1rem;
  font: inherit;
  font-weight: 600;
  color: var(--ink-2);
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}

.tab[aria-selected='true'] {
  color: var(--ink);
  background: var(--surface);
  box-shadow: 0 1px 3px rgb(var(--shadow) / 0.15);
}

.range {
  width: auto;
  white-space: nowrap;
}

.setup {
  max-width: 44rem;
  padding: 1.4rem 1.5rem;
}

.setup h2 {
  margin: 0 0 0.5rem;
  font-size: 1.2rem;
}

.setup p,
.setup ol {
  margin: 0 0 0.75rem;
  color: var(--ink-2);
  line-height: 1.55;
}

.setup ol {
  padding-left: 1.2rem;
}

.key-form {
  display: flex;
  gap: 0.5rem;
  margin: 1rem 0 0.75rem;
}

.key-form .input {
  flex: 1;
  min-width: 0;
}

.fine {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.foot {
  margin-top: 1rem;
}

.problem,
.loading {
  padding: 1rem 1.25rem;
  color: var(--ink-2);
}

.problem-actions {
  display: inline-flex;
  gap: 0.9rem;
  margin-left: 0.6rem;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: 0.75rem;
}

.stat {
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.stat .k {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.stat b {
  font-size: 1.8rem;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.stat small {
  color: var(--ink-2);
}

.chart,
.breakdown {
  margin-top: 0.75rem;
  padding: 1.1rem 1.25rem 0.9rem;
}

h3 {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.6rem;
  margin: 0 0 0.9rem;
  font-size: 0.95rem;
}

.unit {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--ink-3);
}

.split {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
  gap: 0 0.75rem;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.925rem;
}

th,
td {
  padding: 0.5rem 0;
  text-align: left;
  border-top: 1px solid var(--line);
}

thead th {
  padding-top: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--ink-3);
  border-top: 0;
}

tbody th {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.num {
  padding-left: 1rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Its share of the biggest, as a thin bar under the name (the numbers beside it say the same) */
.share {
  display: block;
  height: 4px;
  margin-top: 0.35rem;
  background: var(--surface-2);
  border-radius: 999px;
  overflow: hidden;
}

.share span {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: inherit;
}

code {
  font-size: 0.9em;
}

@media (max-width: 640px) {
  .key-form {
    flex-direction: column;
  }
}
</style>
