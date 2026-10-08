<script setup lang="ts">
import type { NuxtError } from '#app'

// Friendly page for a missing page or something that broke (CHECKLIST.md #24): what happened in plain
// words, that your data is safe, and a way forward. The technical detail is tucked away for reporting.
const props = defineProps<{ error: NuxtError }>()
// Newer Nuxt reports `status`; older versions `statusCode`
const code = computed(() => (props.error as NuxtError & { status?: number }).status ?? props.error.statusCode ?? 500)
const notFound = computed(() => code.value === 404)

useHead({ title: notFound.value ? 'Page not found' : 'Something went wrong' })

const goHome = () => clearError({ redirect: '/' })
const retry = () => {
  clearError()
  location.reload()
}

// Suggest the app they were probably looking for
const route = useRoute()
const suggestion = computed(() => {
  const word = route.path.split('/').filter(Boolean)[0]?.toLowerCase() ?? ''
  if (!word) return undefined
  return TOOLS.find(t => t.to.slice(1).startsWith(word.slice(0, 3)) || t.name.toLowerCase().includes(word))
})
</script>

<template>
  <main class="error-page">
    <div class="card panel">
      <span class="badge" :class="notFound ? 'info' : 'bad'">{{ notFound ? 'Page not found' : `Error ${code}` }}</span>
      <h1>{{ notFound ? 'There’s nothing here' : 'Something went wrong' }}</h1>
      <p v-if="notFound">That page doesn’t exist. It may have moved, or the address has a typo.</p>
      <p v-else>This page couldn’t load. Everything you’ve saved is safe on this device.</p>

      <div class="actions">
        <NuxtLink v-if="notFound && suggestion" :to="suggestion.to" class="btn" @click.prevent="clearError({ redirect: suggestion.to })">
          Open {{ suggestion.name }}
        </NuxtLink>
        <button v-if="!notFound" type="button" class="btn" @click="retry">Try again</button>
        <button type="button" class="btn" :class="{ 'btn-quiet': !notFound || suggestion }" @click="goHome">Go to the home page</button>
      </div>

      <details v-if="!notFound && error.message" class="detail">
        <summary>Technical details</summary>
        <code>{{ error.message }}</code>
      </details>
    </div>
  </main>
</template>

<style scoped>
.error-page {
  --accent: var(--plastic);
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 1.5rem;
}

.card {
  width: min(32rem, 100%);
  padding: 2rem 1.75rem;
  text-align: center;
}

h1 {
  margin: 0.9rem 0 0.6rem;
  font-size: clamp(1.75rem, 6vw, 2.4rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

p {
  margin: 0;
  color: var(--ink-2);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
  margin-top: 1.5rem;
}

.detail {
  margin-top: 1.5rem;
  text-align: left;
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.detail summary {
  cursor: pointer;
}

.detail code {
  display: block;
  margin-top: 0.5rem;
  padding: 0.6rem 0.75rem;
  overflow-wrap: anywhere;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
}
</style>
