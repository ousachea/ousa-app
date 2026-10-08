<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { ParsedBackup } from '~/utils/backup'

// Settings → Your data: export everything to one file, and restore it with a preview first (CHECKLIST.md #17)
const { play } = useSound()
const LAST_KEY = 'ousa-app:last-backup'

// ---------- Export ----------
const counts = ref<Record<string, number>>({})
const chosen = ref(new Set(BACKUP_SECTIONS.map(s => s.name)))
const withSettings = ref(true)
const lastBackup = ref<string>()

function refreshCounts() {
  counts.value = Object.fromEntries(BACKUP_SECTIONS.map(s => [s.name, readCollection(s.name).length]))
}
onMounted(() => {
  refreshCounts()
  try {
    lastBackup.value = localStorage.getItem(LAST_KEY) ?? undefined
  } catch {}
})

function toggleSection(name: string) {
  const next = new Set(chosen.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  chosen.value = next
}

const exportTotal = computed(() => [...chosen.value].reduce((n, s) => n + (counts.value[s] ?? 0), 0))

function exportBackup() {
  const backup = makeBackup([...chosen.value], withSettings.value)
  downloadFile(dated('ousa-apps-backup', 'json'), JSON.stringify(backup, null, 2), 'application/json')
  const now = new Date().toISOString()
  lastBackup.value = now
  try {
    localStorage.setItem(LAST_KEY, now)
  } catch {}
  logActivity('exported', '/settings', `Backup of ${exportTotal.value} items`)
  play('copy')
  toast.success('Backup downloaded', { description: 'Keep it somewhere safe, like your cloud drive.' })
}

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

// ---------- Import with a preview ----------
const fileInput = ref<HTMLInputElement>()
const parsed = ref<ParsedBackup>()
const fileName = ref('')
const included = ref(new Set<string>())
const mode = ref<'merge' | 'replace'>('merge')
const restoreSettingsToo = ref(true)
const confirmReplace = ref(false)
const restoring = ref(false)

async function pickFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const result = parseBackup(await readTextFile(file))
    if (!result.plans.length) throw new Error('That backup doesn’t have anything this app can restore.')
    parsed.value = result
    fileName.value = file.name
    included.value = new Set(result.plans.filter(p => p.records.length || p.onlyHere).map(p => p.section.name))
    mode.value = 'merge'
    restoreSettingsToo.value = !!result.settings
    play('open')
  } catch (err) {
    play('error')
    toast.error('Couldn’t read that backup', { description: err instanceof Error ? err.message : 'Try a different file.' })
  }
}

function toggleIncluded(name: string) {
  const next = new Set(included.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  included.value = next
}

const plansIn = computed(() => parsed.value?.plans.filter(p => included.value.has(p.section.name)) ?? [])
const summary = computed(() => {
  let added = 0
  let changed = 0
  let removed = 0
  for (const p of plansIn.value) {
    added += p.added
    changed += p.changed
    if (mode.value === 'replace') removed += p.onlyHere
  }
  return { added, changed, removed }
})
const nothingToDo = computed(() => !plansIn.value.length && !(restoreSettingsToo.value && parsed.value?.settings))

function startRestore() {
  if (mode.value === 'replace' && summary.value.removed) confirmReplace.value = true
  else restore()
}

async function restore() {
  if (!parsed.value || restoring.value) return
  confirmReplace.value = false
  restoring.value = true
  const { added, changed, removed } = summary.value
  let cloudOk = true
  for (const p of plansIn.value) {
    try {
      if (mode.value === 'replace') await replaceCollection(p.section.name, p.section.app, p.records)
      else await writeToCollection(p.section.name, p.records)
    } catch {
      // Already on this device; the account catches up next time that app opens
      cloudOk = false
    }
    logActivity('imported', p.section.app, `${p.section.label} from a backup`)
  }
  const settingsRestored = restoreSettingsToo.value && parsed.value.settings
  if (settingsRestored) restoreSettings(parsed.value.settings!)
  restoring.value = false
  parsed.value = undefined
  refreshCounts()
  play('success')
  toast.success('Backup restored', {
    description: [
      `${added} added, ${changed} updated${removed ? `, ${removed} moved to the Recycle Bin` : ''}.`,
      cloudOk ? '' : 'Saved on this device; your account will catch up next time you open each app.'
    ].filter(Boolean).join(' '),
    action: settingsRestored ? { label: 'Reload to apply settings', onClick: () => location.reload() } : undefined,
    duration: 8000
  })
}

const exportedOn = computed(() => parsed.value?.exportedAt
  ? new Date(parsed.value.exportedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : undefined)
</script>

<template>
  <div class="data">
    <!-- Export -->
    <section class="panel block" aria-labelledby="export-title">
      <h3 id="export-title">Export everything</h3>
      <p class="note">One file with everything you’ve saved. Your password vault isn’t included; it’s encrypted and syncs on its own.</p>
      <ul class="sections">
        <li v-for="s in BACKUP_SECTIONS" :key="s.name">
          <label class="check">
            <input type="checkbox" :checked="chosen.has(s.name)" @change="toggleSection(s.name)">
            <span>{{ s.label }}</span>
            <span class="count">{{ counts[s.name] ?? 0 }}</span>
          </label>
        </li>
        <li>
          <label class="check">
            <input v-model="withSettings" type="checkbox">
            <span>Settings</span>
            <span class="count">theme, sound, preferences</span>
          </label>
        </li>
      </ul>
      <div class="actions">
        <button type="button" class="btn" :disabled="!chosen.size && !withSettings" @click="exportBackup">Export backup</button>
        <span class="note">{{ lastBackup ? `Last backup ${ago(lastBackup)}` : 'No backup made on this device yet' }}</span>
      </div>
    </section>

    <!-- Import -->
    <section class="panel block" aria-labelledby="import-title">
      <h3 id="import-title">Restore from a backup</h3>
      <p class="note">Pick a backup file. You’ll see exactly what changes before anything is touched.</p>
      <div class="actions">
        <button type="button" class="btn btn-quiet" @click="fileInput?.click()">Choose backup file…</button>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="pickFile">
      </div>

      <div v-if="parsed" class="preview" role="region" aria-label="What the backup would change">
        <p class="from"><strong>{{ fileName }}</strong><template v-if="exportedOn"> · made {{ exportedOn }}</template></p>

        <div class="segmented mode" role="radiogroup" aria-label="How to restore">
          <label :class="{ active: mode === 'merge' }"><input v-model="mode" type="radio" value="merge">Merge</label>
          <label :class="{ active: mode === 'replace' }"><input v-model="mode" type="radio" value="replace">Replace</label>
        </div>
        <p class="note">
          <template v-if="mode === 'merge'">Adds what’s new and updates what changed. Nothing on this device is removed.</template>
          <template v-else>Each app ends up exactly like the backup. Anything not in it goes to the Recycle Bin, so you can still get it back.</template>
        </p>

        <ul class="plans">
          <li v-for="p in parsed.plans" :key="p.section.name" :class="{ off: !included.has(p.section.name) }">
            <label class="check">
              <input type="checkbox" :checked="included.has(p.section.name)" @change="toggleIncluded(p.section.name)">
              <span>{{ p.section.label }}</span>
            </label>
            <span class="diff">
              <span v-if="p.added" class="badge good">+{{ p.added }} new</span>
              <span v-if="p.changed" class="badge info">{{ p.changed }} changed</span>
              <span v-if="mode === 'replace' && p.onlyHere" class="badge bad">{{ p.onlyHere }} to bin</span>
              <span v-if="!p.added && !p.changed && !(mode === 'replace' && p.onlyHere)" class="badge">No changes</span>
            </span>
          </li>
          <li v-if="parsed.settings" :class="{ off: !restoreSettingsToo }">
            <label class="check">
              <input v-model="restoreSettingsToo" type="checkbox">
              <span>Settings</span>
            </label>
            <span class="diff"><span class="badge">theme, sound, preferences</span></span>
          </li>
        </ul>
        <p v-if="parsed.unknown.length" class="note">Skipped, not part of this app: {{ parsed.unknown.join(', ') }}.</p>

        <div class="actions">
          <button type="button" class="btn" :disabled="nothingToDo || restoring" @click="startRestore">
            {{ restoring ? 'Restoring…' : mode === 'replace' ? 'Replace with backup' : 'Restore' }}
          </button>
          <button type="button" class="btn btn-quiet" @click="parsed = undefined">Cancel</button>
        </div>
      </div>
    </section>

    <ConfirmDialog
      :open="confirmReplace"
      title="Replace with the backup?"
      confirm-label="Replace"
      @confirm="restore"
      @close="confirmReplace = false"
    >
      <p>{{ summary.removed }} {{ summary.removed === 1 ? 'item that isn’t' : 'items that aren’t' }} in the backup will move to the Recycle Bin. You can restore them from there for 30 days.</p>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.data {
  display: grid;
  gap: 1rem;
}

.block {
  padding: 1.1rem 1.25rem;
}

h3 {
  font-size: 1.05rem;
}

.note {
  margin: 0.35rem 0 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.sections,
.plans {
  margin: 0.85rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.15rem;
}

.sections {
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
}

.check {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 2.5rem;
  padding: 0 0.5rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.check:hover {
  background: var(--surface-2);
}

.check input {
  width: 1.1rem;
  height: 1.1rem;
  margin: 0;
  accent-color: var(--accent);
}

.count {
  margin-left: auto;
  font-size: var(--text-sm);
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
  margin-top: 1rem;
}

.actions .note {
  margin: 0;
}

.preview {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
  animation: preview-in var(--dur) var(--ease-out);
}

.from {
  margin: 0 0 0.75rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}

.mode {
  max-width: 18rem;
}

.plans li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem 0.75rem;
}

.plans li.off .diff {
  opacity: 0.4;
}

.diff {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  padding-left: 0.5rem;
}

@keyframes preview-in {
  from {
    opacity: 0;
    translate: 0 -4px;
  }
}
</style>
