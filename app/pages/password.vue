<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { play } = useSound()

type Tab = 'generate' | 'saved'
const TABS: { value: Tab, label: string }[] = [
  { value: 'generate', label: 'Generate' },
  { value: 'saved', label: 'Saved passwords' }
]

// The tab lives in the URL (?tab=saved) so it survives reloads and works with Back
const tab = computed<Tab>(() => (route.query.tab === 'saved' ? 'saved' : 'generate'))
// A generated password waiting to be saved in the vault
const pending = ref<string>()

function selectTab(value: Tab) {
  if (value === tab.value) return
  viewTransition(() => router.replace({ query: value === 'saved' ? { tab: 'saved' } : {} }))
  play('select')
}

// Passwords settings (the gear in the header); the generator reads the same ones
const { prefs: pwPrefs } = useAppPrefs('password', { tab: 'generate', length: 20, avoidLookAlikes: false })
onMounted(() => {
  if (!route.query.tab && pwPrefs.tab === 'saved') router.replace({ query: { tab: 'saved' } })
})

function saveToVault(password: string) {
  pending.value = password
  selectTab('saved')
}
</script>

<template>
  <ToolPage>
    <template #settings>
      <SettingChoice v-model="pwPrefs.tab" title="Open on" :options="TABS" />
      <SettingChoice v-model="pwPrefs.length" title="New password length" description="20 characters is very hard to crack." :options="[{ value: 12, label: '12' }, { value: 16, label: '16' }, { value: 20, label: '20' }, { value: 32, label: '32' }]" />
      <SettingRow v-model="pwPrefs.avoidLookAlikes" title="Avoid look-alike characters" description="Leaves out 0 and O, 1, l and I, so a password is easy to type from a screen." />
    </template>
    <div class="tabs" role="tablist" aria-label="Passwords">
      <button
        v-for="t in TABS"
        :id="`tab-${t.value}`"
        :key="t.value"
        type="button"
        role="tab"
        class="tab"
        :aria-selected="tab === t.value"
        :aria-controls="`panel-${t.value}`"
        @click="selectTab(t.value)"
      >
        {{ t.label }}
      </button>
    </div>

    <div :id="`panel-${tab}`" role="tabpanel" :aria-labelledby="`tab-${tab}`">
      <PasswordGenerator v-if="tab === 'generate'" @save="saveToVault" />
      <PasswordSaved v-else :prefill="pending" @prefilled="pending = undefined" />
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

.tab:hover {
  color: var(--ink);
}

.tab[aria-selected='true'] {
  color: var(--ink);
  background: var(--surface);
  box-shadow: 0 1px 2px rgb(var(--shadow) / 0.12), 0 0 0 1px var(--line);
}
</style>
