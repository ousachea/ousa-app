<script setup lang="ts">
import { formatClock, useAmbientTimer } from '~/composables/ambient-studio/useAmbientTimer'
import { useAmbientMixer } from '~/composables/ambient-studio/useAmbientMixer'
import { useAmbientMusic } from '~/composables/ambient-studio/useAmbientMusic'

// The side panel: the sound mixer and the timer, one at a time. On phones it sits under the
// player and folds away to a single bar.
const tab = smoothRef(ref<'queue' | 'mixer' | 'timer'>('mixer'))
const open = ref(true)
const timer = useAmbientTimer()
const mixer = useAmbientMixer()

const music = useAmbientMusic()
// Starting your music brings its queue to the front
watch(() => music.hasQueue.value, (has) => {
  if (has) tab.value = 'queue'
})

const tabs = [
  { id: 'queue', label: 'Queue' },
  { id: 'mixer', label: 'Mixer' },
  { id: 'timer', label: 'Timer' }
] as const

function pick(id: 'queue' | 'mixer' | 'timer') {
  tab.value = id
  open.value = true
}
</script>

<template>
  <section class="ambient-studio-panel" :class="{ closed: !open }">
    <div class="tabs" role="tablist" aria-label="Queue, sound and timer">
      <button
        v-for="t in tabs"
        :id="`ambient-studio-tab-${t.id}`"
        :key="t.id"
        type="button"
        role="tab"
        :aria-selected="tab === t.id"
        :aria-controls="`ambient-studio-pane-${t.id}`"
        @click="pick(t.id)"
      >
        {{ t.label }}
        <span v-if="t.id === 'mixer' && mixer.state.playing" class="live" aria-label="(playing)" />
        <span v-if="t.id === 'queue' && music.state.queue.length" class="clock">{{ music.state.queue.length }}</span>
        <span v-if="t.id === 'timer' && timer.state.running" class="clock">{{ formatClock(timer.state.remaining) }}</span>
      </button>
      <button type="button" class="fold" :aria-expanded="open" :aria-label="open ? 'Hide mixer and timer' : 'Show mixer and timer'" @click="open = !open">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
    </div>
    <Transition name="collapse">
      <div v-show="open" :id="`ambient-studio-pane-${tab}`" class="pane" role="tabpanel" :aria-labelledby="`ambient-studio-tab-${tab}`">
        <AmbientStudioQueue v-if="tab === 'queue'" />
        <AmbientStudioMixer v-else-if="tab === 'mixer'" />
        <AmbientStudioTimer v-else />
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.ambient-studio-panel {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  padding: 0.6rem 1rem 1.25rem;
  background: var(--as-raised);
  border: 1px solid var(--as-line);
  border-radius: 20px;
}

.tabs {
  display: flex;
  gap: 0.25rem;
  margin-inline: -0.4rem;
  border-bottom: 1px solid var(--as-line);
}

.tabs [role='tab'] {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.75rem;
  padding: 0 0.75rem;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 650;
  color: var(--as-ink-3);
  background: none;
  border: 0;
  cursor: pointer;
}

.tabs [role='tab']::after {
  content: '';
  position: absolute;
  left: 0.75rem;
  right: 0.75rem;
  bottom: -1px;
  height: 2px;
  border-radius: 2px;
  background: transparent;
  transition: background-color var(--dur-fast);
}

.tabs [role='tab'][aria-selected='true'] {
  color: var(--as-ink);
}

.tabs [role='tab'][aria-selected='true']::after {
  background: var(--tint);
}

.live {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--tint);
}

.clock {
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  color: var(--tint);
}

.fold {
  display: none;
  margin-left: auto;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  color: var(--as-ink-3);
  background: none;
  border: 0;
  cursor: pointer;
}

.fold svg {
  width: 1.1rem;
  height: 1.1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: rotate var(--dur) var(--ease-out);
}

.closed .fold svg {
  rotate: -180deg;
}

.closed {
  padding-bottom: 0.6rem;
}

.closed .tabs {
  border-bottom-color: transparent;
}

/* The fold only makes sense where the panel is in the page's flow */
@media (max-width: 860px) {
  .fold {
    display: grid;
  }
}
</style>
