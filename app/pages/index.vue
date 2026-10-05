<script setup lang="ts">
useHead({ title: 'Ousa App', titleTemplate: '%s' })
</script>

<template>
  <main class="home">
    <div class="hero">
      <RubikCube :size="60" follow-pointer class="hero-cube" />
      <h1>Ousa App</h1>
      <p>Small tools for everyday jobs: QR codes, Cambodian phone numbers, images, text and passwords.</p>
    </div>

    <nav class="tools" aria-label="Tools">
      <NuxtLink
        v-for="tool in TOOLS"
        :key="tool.to"
        :to="tool.to"
        class="tile"
        :style="{ '--accent': tool.color, '--on-accent': tool.onColor ?? '#fff' }"
      >
        <span class="sticker" aria-hidden="true"><ToolIcon :name="tool.icon" /></span>
        <strong>{{ tool.name }}</strong>
        <span class="summary">{{ tool.summary }}</span>
      </NuxtLink>
    </nav>
  </main>
</template>

<style scoped>
.home {
  min-height: 100dvh;
  padding: 2rem 1rem 7rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3rem;
  overflow: hidden;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.hero-cube {
  margin: -1rem 0 1rem;
}

h1 {
  font-size: clamp(3.25rem, 12vw, 6.5rem);
  font-weight: 800;
  letter-spacing: -0.05em;
  line-height: 0.95;
  font-variation-settings: 'opsz' 96;
}

.hero p {
  margin: 1rem 0 0;
  max-width: 28rem;
  font-size: 1.15rem;
  color: var(--ink-2);
}

.tools {
  width: 100%;
  max-width: 1320px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
}

.tools > * {
  flex: 1 1 220px;
  max-width: 260px;
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 1.5rem 1.25rem 1.4rem;
  text-align: center;
  text-decoration: none;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 20px;
  transition: border-color 0.15s;
}

.tile:hover {
  border-color: var(--accent);
}

.sticker {
  width: 2.75rem;
  height: 2.75rem;
  margin-bottom: 0.6rem;
  display: grid;
  place-items: center;
  font-size: 1.6rem;
  color: var(--on-accent);
  background: var(--accent);
  border-radius: 11px;
  box-shadow:
    0 0 0 3px var(--ink),
    inset 0 -5px 0 rgb(0 0 0 / 0.12),
    inset 0 5px 8px rgb(255 255 255 / 0.25);
  transition: transform 0.25s cubic-bezier(0.3, 1.6, 0.6, 1);
}

/* The one playful moment: the sticker gives a quarter-turn, like a cube face */
.tile:hover .sticker {
  transform: rotate(90deg);
}

.tile strong {
  font-size: 1.15rem;
  letter-spacing: -0.01em;
}

.summary {
  font-size: 0.925rem;
  color: var(--ink-2);
}

@media (max-width: 720px) {
  .tools {
    flex-direction: column;
    max-width: 420px;
  }

  .tools > * {
    flex: none;
    max-width: none;
  }

  .tile {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 1.1rem;
    padding: 1rem 1.15rem;
    text-align: left;
    align-items: center;
  }

  .sticker {
    grid-row: span 2;
    margin: 0 0 0 3px;
  }

  .hero-cube {
    margin: -3.5rem 0 -2.5rem;
    scale: 0.75;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tile:hover .sticker {
    transform: none;
  }
}
</style>
