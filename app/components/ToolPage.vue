<script setup lang="ts">
const props = withDefaults(defineProps<{ width?: string }>(), { width: '1320px' })

const route = useRoute()
const tool = computed(() => toolFor(route.path)!)

useHead({ title: () => tool.value.name })
</script>

<template>
  <main class="tool" :style="{ '--accent': tool.color, '--on-accent': tool.onColor ?? '#fff', '--width': props.width }">
    <NuxtLink to="/" class="home"><AppLogo class="home-logo" />Ousa App</NuxtLink>

    <header class="head">
      <span class="sticker" aria-hidden="true"><ToolIcon :name="tool.icon" /></span>
      <h1>{{ tool.name }}</h1>
      <p>{{ tool.summary }}</p>
    </header>

    <div class="body">
      <slot />
    </div>
  </main>
</template>

<style scoped>
.tool {
  min-height: 100dvh;
  padding: 1.25rem clamp(1rem, 4vw, 3rem) 7rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.home {
  align-self: center;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.8rem 0.35rem 0.4rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink-2);
  text-decoration: none;
  border-radius: 999px;
  transition: background-color 0.15s, color 0.15s;
}

.home-logo {
  font-size: 1.4rem;
}

.home:hover {
  color: var(--ink);
  background: var(--surface);
}

.head {
  margin: 2rem 0 2.5rem;
  max-width: 34rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sticker {
  width: 3.5rem;
  height: 3.5rem;
  display: grid;
  place-items: center;
  font-size: 2rem;
  color: var(--on-accent);
  background: var(--accent);
  border-radius: 14px;
  /* Glossy sticker on black plastic, like the cube */
  box-shadow:
    0 0 0 4px var(--ink),
    inset 0 -6px 0 rgb(0 0 0 / 0.12),
    inset 0 6px 10px rgb(255 255 255 / 0.25);
}

h1 {
  margin-top: 1.5rem;
  font-size: clamp(2.25rem, 7vw, 3.5rem);
  font-weight: 800;
  letter-spacing: -0.035em;
  font-variation-settings: 'opsz' 96;
}

.head p {
  margin: 0.75rem 0 0;
  font-size: 1.1rem;
  color: var(--ink-2);
}

.body {
  width: 100%;
  max-width: var(--width);
}
</style>
