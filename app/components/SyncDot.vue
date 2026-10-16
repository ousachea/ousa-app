<script setup lang="ts">
import type { SyncState } from '~/composables/useCollection'

// The small dot on the app icon saying where the page's data lives: it pulses green while synced
// with Firebase, and turns grey, orange or red when it's only on this device or something's wrong.
// Tapping it explains, with a button to sign in or try again where that helps
const { state, retry } = useSyncSources()
const session = useSync().state
const open = ref(false)
const root = ref<HTMLElement>()

const COPY: Record<SyncState, { label: string, detail: string }> = {
  'loading': { label: 'Checking…', detail: 'Looking for your saved data.' },
  'device': { label: 'On this device', detail: 'Saved in this browser only. Sign in to keep it in Firebase and see it on your other devices.' },
  'saving': { label: 'Saving…', detail: 'Sending your latest change to Firebase.' },
  'synced': { label: 'Synced with Firebase', detail: 'Stored in your Firebase account and also kept on this device, so it works offline.' },
  'offline': { label: 'Offline', detail: 'Couldn’t reach Firebase, so your changes are saved in this browser for now. They’ll sync when the connection is back.' },
  'error': { label: 'Sync error', detail: 'Firebase didn’t accept your latest changes after several tries. They’re safe on this device; details are in Settings → Sync.' },
  'needs-setup': { label: 'On this device', detail: 'You’re signed in, but Firebase needs a one-time setup before it can store this data.' },
  'demo': { label: 'Example data', detail: 'Example data to show how the app works. Changes here aren’t saved. Click the app icon again to go back to your own data.' }
}

function onOutside(e: PointerEvent) {
  if (open.value && !root.value?.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('pointerdown', onOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))
</script>

<template>
  <span v-if="state" ref="root" class="sync" :data-state="state">
    <button type="button" class="dot" :aria-expanded="open" :aria-label="COPY[state].label" :title="COPY[state].label" @click.stop="open = !open" />
    <Transition name="slide-down">
      <span v-if="open" class="pop" role="status">
        <strong>{{ COPY[state].label }}</strong>
        <span>{{ COPY[state].detail }}</span>
        <span v-if="state === 'offline' && session.offlineReason" class="why">{{ offlineHelp(session.offlineReason) }}</span>
        <NuxtLink v-if="state === 'device'" to="/settings#sync" class="btn btn-sm">Sign in to sync</NuxtLink>
        <NuxtLink v-else-if="state === 'needs-setup'" to="/settings#sync" class="btn btn-sm">Set up Firebase</NuxtLink>
        <button v-else-if="state === 'offline' || state === 'error'" type="button" class="btn btn-sm" @click="retry(); open = false">Try again</button>
      </span>
    </Transition>
  </span>
</template>

<style scoped>
/* Sits on the icon's top-right corner, across from the demo badge at the bottom */
.sync {
  position: absolute;
  z-index: 2;
  top: -0.4rem;
  right: -0.4rem;
}

.dot {
  position: relative;
  display: block;
  width: 0.85rem;
  height: 0.85rem;
  padding: 0;
  background: var(--ink-3);
  border: 0;
  border-radius: 50%;
  box-shadow: 0 0 0 2.5px var(--bg);
  cursor: pointer;
  transition: scale 0.15s;
}

/* A bigger target than the dot itself, for fingers */
.dot::before {
  content: '';
  position: absolute;
  inset: -0.6rem;
}

.dot:hover {
  scale: 1.15;
}

.dot:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 3px;
}

[data-state='synced'] .dot { background: var(--green); }
[data-state='synced'] .dot::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--green);
  animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
}
[data-state='saving'] .dot { background: var(--blue); animation: pulse 0.9s ease-in-out infinite alternate; }
[data-state='demo'] .dot { background: var(--purple); }
[data-state='error'] .dot { background: var(--red); }
[data-state='offline'] .dot,
[data-state='needs-setup'] .dot { background: var(--orange); }

.pop {
  position: absolute;
  z-index: 20;
  top: calc(100% + 0.5rem);
  left: -0.5rem;
  width: min(18rem, 80vw);
  padding: 0.85rem 0.95rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 400;
  line-height: 1.45;
  text-align: left;
  color: var(--ink-2);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: 0 10px 28px rgb(var(--shadow) / 0.18);
}

.pop strong {
  font-size: 0.9rem;
  color: var(--ink);
}

.pop .why {
  color: var(--ink);
}

.pop .btn {
  margin-top: 0.35rem;
}

@keyframes ping {
  0% { opacity: 0.75; scale: 1; }
  80%, 100% { opacity: 0; scale: 2.6; }
}

@keyframes pulse {
  to { opacity: 0.35; }
}

@media (prefers-reduced-motion: reduce) {
  [data-state='saving'] .dot,
  [data-state='synced'] .dot::after { animation: none; }
}
</style>
