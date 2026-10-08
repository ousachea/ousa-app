<script setup lang="ts">
import { toast } from 'vue-sonner'

// "● Offline" while the internet is gone (CHECKLIST.md #19). Nothing breaks: saving keeps working on
// this device and syncs once you're back. Coming back online says so once.
const online = useOnline()
const { play } = useSound()

watch(online, (now, before) => {
  if (now && !before) {
    toast.success('Back online', { description: 'Anything you changed will sync now.' })
    play('notification')
  } else if (!now) {
    toast('You’re offline', { description: 'Keep going: changes are saved on this device and sync when you’re back.' })
  }
})
</script>

<template>
  <Transition name="slide-down">
    <div v-if="!online" class="offline" role="status" title="Changes are saved on this device and sync when you’re back online">
      <span class="dot" aria-hidden="true" />Offline
    </div>
  </Transition>
</template>

<style scoped>
.offline {
  position: fixed;
  top: max(0.75rem, env(safe-area-inset-top));
  left: 50%;
  z-index: 120;
  translate: -50% 0;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.85rem;
  font-size: var(--text-sm);
  font-weight: 700;
  color: #fff;
  background: var(--plastic);
  border-radius: var(--radius-pill);
  box-shadow: 0 8px 20px rgb(var(--shadow) / 0.3), inset 0 0 0 1px var(--plastic-edge);
  pointer-events: auto;
}

.dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: #ffb020;
}

/* slide-down moves it with `translate`; keep the centring */
.offline.slide-down-enter-from,
.offline.slide-down-leave-to {
  translate: -50% -6px;
}
</style>
