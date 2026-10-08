<script setup lang="ts">
// Placeholder shaped like the list that's about to appear (CHECKLIST.md #22), instead of "Loading…".
// rows: an icon, two lines and an action (bookmarks, renewals, the bin)
// cards: a grid of cards (things, countdowns, gold)
// tiles: small squares (foods and places)
withDefaults(defineProps<{ variant?: 'rows' | 'cards' | 'tiles', count?: number, label?: string }>(), { variant: 'rows', count: 4, label: 'Loading' })
</script>

<template>
  <div class="skeleton-list" :class="variant" role="status" :aria-label="label">
    <template v-if="variant === 'rows'">
      <div v-for="i in count" :key="i" class="row">
        <span class="skeleton icon" />
        <span class="lines">
          <span class="skeleton line" :style="{ width: `${[62, 48, 70, 54][i % 4]}%` }" />
          <span class="skeleton line short" :style="{ width: `${[34, 28, 40, 30][i % 4]}%` }" />
        </span>
        <span class="skeleton action" />
      </div>
    </template>
    <template v-else-if="variant === 'cards'">
      <div v-for="i in count" :key="i" class="card">
        <span class="skeleton line" style="width: 55%" />
        <span class="skeleton block" />
        <span class="skeleton line short" style="width: 35%" />
      </div>
    </template>
    <template v-else>
      <span v-for="i in count" :key="i" class="skeleton tile" />
    </template>
  </div>
</template>

<style scoped>
.rows {
  background: var(--surface);
  border-radius: 18px;
  box-shadow: 0 0 0 1px var(--line);
}

.row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.95rem 1rem;
}

.row + .row {
  border-top: 1px solid var(--line);
}

.icon {
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 10px;
}

.lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.line {
  height: 0.85rem;
}

.line.short {
  height: 0.7rem;
}

.action {
  flex: none;
  width: 4.5rem;
  height: 1.6rem;
  border-radius: 8px;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
  gap: 1rem;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1.1rem;
  background: var(--surface);
  border-radius: 18px;
  box-shadow: 0 0 0 1px var(--line);
}

.block {
  height: 4.5rem;
  border-radius: 12px;
}

.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
  gap: 0.75rem;
}

.tile {
  aspect-ratio: 1;
  border-radius: 14px;
}
</style>
