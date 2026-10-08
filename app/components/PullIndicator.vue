<script setup lang="ts">
// The round arrow that follows a pull-to-refresh, then spins while the data refreshes (usePullToRefresh)
const pull = usePullState()
const ready = computed(() => pull.pull >= 72)
</script>

<template>
  <div
    v-if="pull.active && (pull.pull > 0 || pull.refreshing)"
    class="pull"
    :class="{ ready, spinning: pull.refreshing }"
    :style="{ '--pull': `${pull.pull}px`, 'opacity': pull.refreshing ? 1 : Math.min(1, pull.pull / 50) }"
    role="status"
    :aria-label="pull.refreshing ? 'Refreshing' : ready ? 'Release to refresh' : 'Pull to refresh'"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true" :style="{ rotate: pull.refreshing ? undefined : `${pull.pull * 4}deg` }">
      <path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4" />
    </svg>
  </div>
</template>

<style scoped>
.pull {
  position: fixed;
  top: 0;
  left: 50%;
  z-index: 110;
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  translate: -50% calc(var(--pull) - 1.5rem);
  color: var(--ink-2);
  background: var(--surface);
  border-radius: 50%;
  box-shadow: 0 6px 18px rgb(var(--shadow) / 0.25), 0 0 0 1px var(--line);
}

.pull.ready {
  color: var(--accent, var(--green));
}

svg {
  width: 1.25rem;
  height: 1.25rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.spinning svg {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { rotate: 360deg; }
}
</style>
