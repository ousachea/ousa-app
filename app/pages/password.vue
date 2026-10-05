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
  router.replace({ query: value === 'saved' ? { tab: 'saved' } : {} })
  play('select')
}

function saveToVault(password: string) {
  pending.value = password
  selectTab('saved')
}
</script>

<template>
  <ToolPage>
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
