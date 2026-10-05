<script setup lang="ts">
import type { SyncState } from '~/composables/useCollection'

// Small badge saying where a list's data lives, with a short explanation on click
const props = defineProps<{ sync: { state: Ref<SyncState> | SyncState, retry: () => void } }>()

const state = computed(() => unref(props.sync.state))
const open = ref(false)
const root = ref<HTMLElement>()

const COPY: Record<SyncState, { label: string, detail: string }> = {
  'loading': { label: 'Checking…', detail: 'Looking for your saved data.' },
  'device': { label: 'On this device', detail: 'Saved in this browser only. Sign in to keep it in Supabase and see it on your other devices.' },
  'saving': { label: 'Saving…', detail: 'Sending your latest change to Supabase.' },
  'synced': { label: 'Synced with Supabase', detail: 'Stored in your Supabase account and also kept on this device, so it works offline.' },
  'offline': { label: 'Saved on this device', detail: 'Couldn’t reach Supabase, so your changes are saved in this browser for now.' },
  'needs-setup': { label: 'On this device', detail: 'You’re signed in, but Supabase needs a one-time setup before it can store this data.' }
}

function onOutside(e: PointerEvent) {
  if (open.value && !root.value?.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('pointerdown', onOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))
</script>

<template>
  <div ref="root" class="source" :data-state="state">
    <button type="button" class="badge" :aria-expanded="open" @click="open = !open">
      <!-- Cloud when the data lives in Supabase, a device otherwise -->
      <svg v-if="state === 'synced' || state === 'saving'" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5h10.5a4 4 0 0 0 .4-8A6 6 0 0 0 6.3 9.6 4.5 4.5 0 0 0 7 18.5z" /></svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="11.5" rx="2" /><path d="M8.5 20h7M12 16v4" /></svg>
      <span>{{ COPY[state].label }}</span>
      <span class="dot" aria-hidden="true" />
    </button>
    <div v-if="open" class="pop" role="status">
      <p>{{ COPY[state].detail }}</p>
      <NuxtLink v-if="state === 'device'" to="/settings#sync" class="btn btn-sm">Sign in to sync</NuxtLink>
      <NuxtLink v-else-if="state === 'needs-setup'" to="/settings#sync" class="btn btn-sm">Set up Supabase</NuxtLink>
      <button v-else-if="state === 'offline'" type="button" class="btn btn-sm" @click="sync.retry(); open = false">Try again</button>
    </div>
  </div>
</template>

<style scoped>
.source {
  position: relative;
  display: inline-block;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.65rem 0.3rem 0.5rem;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 999px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.badge:hover {
  border-color: var(--ink-3);
}

.badge svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--ink-3);
}

[data-state='synced'] .dot { background: var(--green); }
[data-state='saving'] .dot { background: var(--blue); animation: pulse 0.9s ease-in-out infinite alternate; }
[data-state='offline'] .dot,
[data-state='needs-setup'] .dot { background: var(--orange); }

.pop {
  position: absolute;
  z-index: 20;
  top: calc(100% + 0.4rem);
  right: 0;
  width: min(18rem, 80vw);
  padding: 0.85rem 0.95rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.6rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: 0 10px 28px rgb(var(--shadow) / 0.18);
}

.pop p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--ink-2);
}

@keyframes pulse {
  to { opacity: 0.35; }
}

@media (prefers-reduced-motion: reduce) {
  [data-state='saving'] .dot { animation: none; }
}
</style>
