<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { VaultItem } from '~/composables/useVault'

// A password handed over from the Generate tab; opens the add form pre-filled once the vault is unlocked
const props = defineProps<{ prefill?: string }>()
const emit = defineEmits<{ prefilled: [] }>()

const { vault, lock, signOut, remove, reload } = useVault()
const { play } = useSound()

const CLIPBOARD_CLEAR_MS = 30_000

const query = ref('')
// undefined = editor closed, null = adding a new entry, item = editing that entry
const editing = ref<VaultItem | null | undefined>(undefined)
const revealed = ref(new Set<string>())

// Site icons come straight from each site, never via a third-party favicon service,
// so no outside company learns which sites are in the vault
function faviconFor(url?: string) {
  if (!url) return undefined
  try {
    const { hostname } = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
    return hostname.includes('.') ? `https://${hostname}/favicon.ico` : undefined
  } catch {
    return undefined
  }
}

// Preload each icon in the background and only show it once it has really loaded;
// missing or broken icons keep the letter tile. Maps icon address -> the URL that loaded.
const iconReady = ref(new Map<string, string>())
const iconTried = new Set<string>()

function preloadIcon(src: string, retry = false) {
  if (!retry && iconTried.has(src)) return
  iconTried.add(src)
  // A failed load can be remembered by the browser; one retry with a fresh URL gets past a passing hiccup
  const url = retry ? `${src}?retry=1` : src
  const img = new Image()
  img.referrerPolicy = 'no-referrer'
  img.onload = () => {
    if (img.naturalWidth) iconReady.value = new Map(iconReady.value).set(src, url)
  }
  img.onerror = () => {
    if (!retry) preloadIcon(src, true)
  }
  img.src = url
}

const iconUrl = (url?: string) => iconReady.value.get(faviconFor(url) ?? '')

watch(() => vault.items.map(item => faviconFor(item.url)), (srcs) => {
  for (const src of srcs) if (src) preloadIcon(src)
}, { immediate: true })
const confirmingDelete = ref<string>()

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return vault.items
  return vault.items.filter(item => [item.site, item.username, item.url ?? ''].some(v => v.toLowerCase().includes(q)))
})

watch([() => props.prefill, () => vault.status], ([prefill, status]) => {
  if (prefill && status === 'unlocked') editing.value = null
}, { immediate: true })

function editorDone() {
  editing.value = undefined
  emit('prefilled')
}

function toggleReveal(id: string) {
  const next = new Set(revealed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  revealed.value = next
}

let clipboardTimer: ReturnType<typeof setTimeout> | undefined
async function copy(value: string, what: 'password' | 'username') {
  try {
    await navigator.clipboard.writeText(value)
    play('copy')
    if (what === 'password') {
      toast.success('Password copied', { description: 'It will be cleared from the clipboard in 30 seconds.' })
      clearTimeout(clipboardTimer)
      clipboardTimer = setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), CLIPBOARD_CLEAR_MS)
    } else {
      toast.success('Username copied')
    }
  } catch {
    toast.error('Could not copy', { description: 'Your browser blocked clipboard access.' })
    play('error')
  }
}

let confirmTimer: ReturnType<typeof setTimeout> | undefined
async function askDelete(item: VaultItem) {
  if (confirmingDelete.value !== item.id) {
    // First click arms the button; a second click within 4 seconds deletes
    confirmingDelete.value = item.id
    clearTimeout(confirmTimer)
    confirmTimer = setTimeout(() => (confirmingDelete.value = undefined), 4000)
    return
  }
  confirmingDelete.value = undefined
  try {
    await remove(item.id)
    if (editing.value && editing.value.id === item.id) editing.value = undefined
    toast.success(`${item.site} deleted`)
    play('delete')
  } catch (e) {
    toast.error('Couldn’t delete', { description: e instanceof Error ? e.message : undefined })
    play('error')
  }
}

async function copySetupSql() {
  try {
    await navigator.clipboard.writeText(VAULT_SETUP_SQL)
    toast.success('SQL copied', { description: 'Paste it into the Supabase SQL editor and run it.' })
    play('copy')
  } catch {
    toast.error('Could not copy')
  }
}

async function retrySetup() {
  try {
    await reload()
    if (vault.status === 'needs-setup') toast.error('The vault table still isn’t there', { description: 'Run the SQL in Supabase first.' })
  } catch (e) {
    toast.error('Couldn’t load the vault', { description: e instanceof Error ? e.message : undefined })
  }
}

function lockNow() {
  editing.value = undefined
  lock()
  play('lock')
}

onBeforeUnmount(() => {
  clearTimeout(clipboardTimer)
  clearTimeout(confirmTimer)
})
</script>

<template>
  <div class="tab-body">
    <ClientOnly>
      <section v-if="vault.status === 'loading'" class="panel loading" aria-busy="true">Opening your vault…</section>

      <VaultAuth v-else-if="vault.status === 'signed-out' || vault.status === 'locked' || vault.status === 'recovery'" />

      <section v-else-if="vault.status === 'needs-setup'" class="setup">
        <Step :n="1" title="Create the vault table" hint="You’re signed in, but this Supabase project doesn’t have the vault table yet. It stores only encrypted data.">
          <div class="panel code">
            <pre><code>{{ VAULT_SETUP_SQL }}</code></pre>
            <div class="code-actions">
              <button type="button" class="btn btn-sm" @click="copySetupSql">Copy SQL</button>
              <a class="btn btn-quiet btn-sm" :href="SUPABASE_SQL_EDITOR" target="_blank" rel="noopener">Open the SQL editor</a>
            </div>
          </div>
        </Step>
        <Step :n="2" title="Open your vault" hint="Run the SQL in Supabase, then come back here." class="step-gap">
          <button type="button" class="btn" @click="retrySetup">Open vault</button>
        </Step>
      </section>

      <div v-else class="workspace">
        <section class="list-side">
          <div class="toolbar">
            <input
              v-model="query"
              class="input search"
              type="search"
              placeholder="Search sites and usernames"
              aria-label="Search saved passwords"
            >
            <button type="button" class="btn" @click="editing = null">Add password</button>
          </div>

          <p class="account">
            {{ vault.items.length }} saved for {{ vault.email }}.
            <button type="button" class="link" @click="lockNow">Lock</button>
            <button type="button" class="link" @click="signOut">Sign out</button>
          </p>

          <p v-if="vault.unreadable" class="unreadable" role="status">
            {{ vault.unreadable }} {{ vault.unreadable === 1 ? 'entry' : 'entries' }} couldn’t be decrypted and {{ vault.unreadable === 1 ? 'is' : 'are' }} hidden.
          </p>

          <div v-if="!vault.items.length" class="panel empty">
            <h2>Your vault is empty</h2>
            <p>Add your first password. It’s encrypted on this device before it’s saved.</p>
            <button type="button" class="btn btn-sm" @click="editing = null">Add password</button>
          </div>

          <p v-else-if="!filtered.length" class="no-match">Nothing matches “{{ query }}”.</p>

          <ul v-else class="items">
            <li v-for="item in filtered" :key="item.id" class="panel item" :class="{ selected: editing?.id === item.id }">
              <div class="item-head">
                <span class="monogram" :class="{ 'has-icon': iconUrl(item.url) }" aria-hidden="true">
                  <img v-if="iconUrl(item.url)" :src="iconUrl(item.url)" alt="" referrerpolicy="no-referrer">
                  <template v-else>{{ item.site.slice(0, 1).toUpperCase() }}</template>
                </span>
                <div class="item-title">
                  <strong>{{ item.site }}</strong>
                  <a v-if="item.url" :href="item.url" target="_blank" rel="noopener noreferrer">{{ item.url.replace(/^https?:\/\//, '') }}</a>
                </div>
              </div>

              <dl class="creds">
                <div v-if="item.username">
                  <dt>Username</dt>
                  <dd>{{ item.username }}</dd>
                  <button type="button" class="btn btn-quiet btn-sm" @click="copy(item.username, 'username')">Copy</button>
                </div>
                <div>
                  <dt>Password</dt>
                  <dd class="secret">{{ revealed.has(item.id) ? item.password : '••••••••••••' }}</dd>
                  <span class="pair">
                    <button type="button" class="btn btn-quiet btn-sm" :aria-pressed="revealed.has(item.id)" @click="toggleReveal(item.id)">
                      {{ revealed.has(item.id) ? 'Hide' : 'Show' }}
                    </button>
                    <button type="button" class="btn btn-quiet btn-sm" @click="copy(item.password, 'password')">Copy</button>
                  </span>
                </div>
              </dl>

              <p v-if="item.notes" class="notes">{{ item.notes }}</p>

              <div class="item-actions">
                <button type="button" class="link" @click="editing = item">Edit</button>
                <button type="button" class="link danger" @click="askDelete(item)">
                  {{ confirmingDelete === item.id ? 'Click again to delete' : 'Delete' }}
                </button>
              </div>
            </li>
          </ul>
        </section>

        <aside class="editor-side">
          <VaultEditor v-if="editing !== undefined" :item="editing ?? undefined" :prefill-password="editing ? undefined : prefill" @done="editorDone" />
          <div v-else class="panel how">
            <h2>How your passwords are protected</h2>
            <ul>
              <li>Each entry is encrypted with AES-256 in this browser before it’s sent. Supabase only stores scrambled data.</li>
              <li>Your master password never leaves this device. The key that unlocks the vault exists only in this tab.</li>
              <li>The vault locks itself after 5 minutes without activity, and whenever the page reloads.</li>
              <li>Copied passwords are cleared from the clipboard after 30 seconds.</li>
              <li>Site icons load straight from each site, never through a third-party service.</li>
            </ul>
          </div>
        </aside>
      </div>

      <template #fallback>
        <section class="panel loading" aria-busy="true">Opening your vault…</section>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.loading {
  max-width: 460px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
  color: var(--ink-3);
}

.setup {
  max-width: 760px;
  margin: 0 auto;
}

.step-gap {
  margin-top: 2rem;
}

.code {
  overflow: hidden;
}

pre {
  margin: 0;
  padding: 1.1rem 1.25rem;
  max-height: 22rem;
  overflow: auto;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.85rem;
  line-height: 1.55;
  background: var(--surface-2);
  border-bottom: 1px solid var(--line);
}

.code-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr);
  gap: 2rem;
  align-items: start;
}

.toolbar {
  display: flex;
  gap: 0.6rem;
}

.search {
  flex: 1;
}

.account {
  margin: 0.75rem 0 1rem;
  font-size: 0.9rem;
  color: var(--ink-2);
}

.link {
  margin-left: 0.6rem;
  padding: 0;
  font: inherit;
  font-size: 0.9rem;
  color: var(--ink-2);
  background: none;
  border: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.link:hover {
  color: var(--ink);
}

.link.danger {
  color: var(--bad-ink);
}

.unreadable {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  color: var(--warn-ink);
}

.empty {
  padding: 2rem 1.5rem;
  text-align: center;
}

.empty h2 {
  font-size: 1.2rem;
}

.empty p {
  margin: 0.5rem 0 1rem;
  color: var(--ink-2);
}

.no-match {
  color: var(--ink-2);
}

.items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 0.75rem;
}

.item {
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.item.selected {
  border-color: var(--ink-3);
  box-shadow: 0 0 0 1px var(--ink-3);
}

.item-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.monogram.has-icon {
  background: #fff;
}

.monogram img {
  width: 1.35rem;
  height: 1.35rem;
  object-fit: contain;
}

.monogram {
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  font-weight: 800;
  color: #fff;
  background: var(--settings);
  border-radius: 9px;
  box-shadow: 0 0 0 2px var(--plastic), 0 0 0 3px var(--plastic-edge);
}

.item-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.item-title strong,
.item-title a {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-title a {
  font-size: 0.85rem;
  color: var(--ink-2);
}

.creds {
  margin: 0;
}

.creds div {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0;
  border-top: 1px solid var(--line);
}

dt {
  font-size: 0.8rem;
  color: var(--ink-2);
}

dd {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

dd.secret {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.9rem;
}

.pair {
  display: flex;
  gap: 0.3rem;
}

.notes {
  margin: 0;
  font-size: 0.875rem;
  color: var(--ink-2);
  white-space: pre-wrap;
}

.item-actions {
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
}

.editor-side {
  position: sticky;
  top: 5.5rem; /* clear of the menu button in the top-right corner */
}

.how {
  padding: 1.4rem;
}

.how h2 {
  font-size: 1.1rem;
}

.how ul {
  margin: 0.75rem 0 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--ink-2);
}

@media (max-width: 960px) {
  .workspace {
    grid-template-columns: 1fr;
  }

  .editor-side {
    position: static;
    order: -1;
  }

  .how {
    display: none;
  }
}

@media (max-width: 480px) {
  .toolbar {
    flex-direction: column;
  }
}
</style>
