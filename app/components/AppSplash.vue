<script setup lang="ts">
import type { Tool } from '~/utils/tools'

// On phones, opening an app shows its splash screen like a native app: the app's colour grows out
// of the icon you tapped to fill the screen, with the icon and name in the middle, and fades away
// once the app's page has arrived underneath it
const PHONE = '(max-width: 719.98px)'
const MIN_SHOW = 650 // ms, so it reads as a splash rather than a flicker
const MAX_SHOW = 1600 // ms, in case the page never reports that it finished

const appOf = (path: string) => TOOLS.find(t => path === t.to || path.startsWith(`${t.to}/`))

const tool = ref<Tool | null>(null)
const leaving = ref(false)
const el = ref<HTMLElement>()
const router = useRouter()
const nuxtApp = useNuxtApp()

let shownAt = 0
let timers: ReturnType<typeof setTimeout>[] = []
const clearTimers = () => (timers.forEach(clearTimeout), timers = [])

function hide() {
  if (!tool.value || leaving.value) return
  clearTimers()
  timers.push(setTimeout(() => {
    leaving.value = true
    timers.push(setTimeout(() => {
      tool.value = null
      leaving.value = false
    }, 300))
  }, Math.max(0, MIN_SHOW - (performance.now() - shownAt))))
}

async function show(next: Tool) {
  clearTimers()
  leaving.value = false
  tool.value = next
  shownAt = performance.now()
  timers.push(setTimeout(hide, MAX_SHOW))

  // Grow out of the tapped icon when it's on screen (the home grid or the cube), otherwise just fade in
  const from = document.querySelector<HTMLElement>(`a[href="${next.to}"] .sticker`)?.getBoundingClientRect()
  await nextTick()
  if (!el.value) return
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  const visible = from && from.width && from.bottom > 0 && from.top < innerHeight && from.right > 0 && from.left < innerWidth
  if (visible && !still) {
    const { innerWidth: w, innerHeight: h } = window
    const start = `inset(${from.top}px ${w - from.right}px ${h - from.bottom}px ${from.left}px round 11px)`
    el.value.animate(
      { clipPath: [start, 'inset(0px 0px 0px 0px round 0px)'] },
      { duration: 380, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
    )
  } else {
    el.value.animate({ opacity: [0, 1] }, { duration: 180, easing: 'ease-out' })
  }
}

const offs: (() => void)[] = []
onMounted(() => {
  offs.push(router.beforeEach((to, from) => {
    const next = appOf(to.path)
    // Low-spec PC mode skips it: the page shows as soon as it's ready
    if (!next || next === appOf(from.path) || !matchMedia(PHONE).matches || usePrefs().prefs.lowSpec) return
    show(next)
  }))
  offs.push(nuxtApp.hook('page:transition:finish', hide))
})
onBeforeUnmount(() => {
  offs.forEach(off => off())
  clearTimers()
})
</script>

<template>
  <div
    v-if="tool"
    ref="el"
    class="app-splash"
    :class="{ leaving }"
    :style="{ '--accent': tool.color, '--sticker': tool.gradient, '--on-accent': tool.onColor ?? '#fff' }"
    aria-hidden="true"
  >
    <span class="icon"><ToolIcon :name="tool.icon" /></span>
    <strong>{{ tool.name }}</strong>
  </div>
</template>

<style scoped>
.app-splash {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.1rem;
  color: var(--on-accent);
  background: var(--sticker, var(--accent));
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.app-splash.leaving {
  opacity: 0;
  transform: scale(1.04);
  pointer-events: none;
}

.icon {
  display: grid;
  place-items: center;
  width: 6.5rem;
  height: 6.5rem;
  border-radius: 28px;
  font-size: 3.4rem;
  background: rgb(255 255 255 / 0.16);
  box-shadow:
    inset 0 -6px 0 rgb(0 0 0 / 0.1),
    inset 0 6px 10px rgb(255 255 255 / 0.22);
  animation: splash-icon 0.5s cubic-bezier(0.3, 1.5, 0.6, 1) 0.1s both;
}

.icon :deep(svg) {
  width: 1em;
  height: 1em;
}

strong {
  font-size: var(--text-lg);
  font-weight: 700;
  letter-spacing: -0.01em;
  animation: splash-name 0.4s ease-out 0.2s both;
}

@keyframes splash-icon {
  from { transform: scale(0.6); opacity: 0; }
}

@keyframes splash-name {
  from { transform: translateY(6px); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .app-splash.leaving {
    transform: none;
  }

  .icon,
  strong {
    animation: none;
  }
}
</style>
