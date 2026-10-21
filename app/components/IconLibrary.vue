<script setup lang="ts">
// Pick a line icon for a subscription with no logo of its own (Lucide, searched through /api/icons).
// Suggestions first; typing searches the whole set. The value is the icon's id, e.g. 'lucide:car'.
const model = defineModel<string>()

const query = ref('')
const results = ref<string[]>()
const searching = ref(false)
const failed = ref(false)

let timer: ReturnType<typeof setTimeout> | undefined
let latest = 0
watch(query, (q) => {
  clearTimeout(timer)
  const term = q.trim()
  if (!term) {
    results.value = undefined
    failed.value = false
    return
  }
  timer = setTimeout(async () => {
    const run = ++latest
    searching.value = true
    try {
      const icons = await $fetch<string[]>('/api/icons', { query: { q: term } })
      if (run === latest) {
        results.value = icons
        failed.value = false
      }
    }
    catch {
      if (run === latest) failed.value = true
    }
    finally {
      if (run === latest) searching.value = false
    }
  }, 250)
})
onBeforeUnmount(() => clearTimeout(timer))

const shown = computed(() => results.value ?? SUGGESTED_ICONS)
const label = (id: string) => id.split(':')[1]!.replace(/-/g, ' ')
</script>

<template>
  <div class="icon-library">
    <input v-model="query" class="input" type="search" placeholder="Search icons: car, gym, water…" aria-label="Search icons" autocomplete="off">
    <p v-if="failed" class="note">Couldn’t search the icon library. Check your connection and try again.</p>
    <p v-else-if="results && !results.length && !searching" class="note">No icons for “{{ query.trim() }}”. Try a simpler word.</p>
    <div v-else class="grid" role="radiogroup" aria-label="Icons" :aria-busy="searching">
      <button
        v-for="id in shown"
        :key="id"
        type="button"
        role="radio"
        class="glyph"
        :class="{ active: model === id }"
        :aria-checked="model === id"
        :aria-label="label(id)"
        :title="label(id)"
        @click="model = model === id ? '' : id"
      >
        <span :style="{ '--src': `url('${libraryIconUrl(id, '#000')}')` }" />
      </button>
    </div>
    <p class="credit">Icons from <a href="https://lucide.dev" target="_blank" rel="noopener">Lucide</a></p>
  </div>
</template>

<style scoped>
.icon-library {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.grid {
  max-height: 11.5rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(2.5rem, 1fr));
  gap: 0.35rem;
  padding: 0.15rem;
}

.glyph {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  color: var(--ink-2);
  background: var(--surface-2);
  border: 1.5px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: border-color var(--dur-fast), color var(--dur-fast), transform var(--dur-fast);
}

.glyph:hover {
  color: var(--ink);
  border-color: var(--line);
}

.glyph:active {
  transform: scale(0.92);
}

.glyph.active {
  color: var(--accent);
  border-color: var(--accent);
}

/* The SVG as a mask, so it takes the button's colour in light and dark */
.glyph span {
  width: 1.25rem;
  height: 1.25rem;
  background: currentColor;
  mask: var(--src) center / contain no-repeat;
}

.note,
.credit {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.credit a {
  color: inherit;
}
</style>
