<script setup lang="ts">
// Opening the site on a phone's home page starts like a native app: the cube and the name on black
// plastic, then the home screen fades in underneath. It's in the server's HTML, so it covers the very
// first paint instead of flashing in after the page has drawn. Once per visit (a reload in the same tab
// skips it; the head script in nuxt.config.ts sets data-launched before anything is drawn), only on
// phone-sized screens, and never in Low-spec PC mode. Opening an app shows that app's splash (AppSplash).
const MIN_SHOW = 700 // ms, so it reads as a splash rather than a flicker
const MAX_SHOW = 2500 // ms, in case the page never finishes loading

const gone = ref(false)
const leaving = ref(false)

onMounted(() => {
  const root = document.documentElement
  try {
    sessionStorage.setItem('ousa-app:launched', '1')
  } catch {}
  // Not showing (a computer, a reload, Low-spec mode): just take it out
  if ('launched' in root.dataset || !matchMedia('(max-width: 759.98px)').matches) {
    gone.value = true
    return
  }
  const start = performance.timeOrigin ? performance.now() : 0
  let done = false
  const finish = () => {
    if (done) return
    done = true
    setTimeout(() => {
      leaving.value = true
      setTimeout(() => (gone.value = true), 400)
    }, Math.max(0, MIN_SHOW - (performance.now() - start)))
  }
  if (document.readyState === 'complete') finish()
  else window.addEventListener('load', finish, { once: true })
  setTimeout(finish, MAX_SHOW)
})
</script>

<template>
  <div v-if="!gone" class="launch-splash" :class="{ leaving }" aria-hidden="true">
    <AppLogo class="logo" />
    <strong>Ousa’s Apps</strong>
    <span class="dots"><i /><i /><i /></span>
  </div>
</template>

<style scoped>
.launch-splash {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: #fff;
  background: radial-gradient(120% 80% at 50% 35%, #2a3040 0%, #12151d 70%);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

/* Phones only, and only the first time this visit */
@media (max-width: 759.98px) {
  :root:not([data-launched]) .launch-splash {
    display: flex;
  }
}

.launch-splash.leaving {
  opacity: 0;
  transform: scale(1.04);
  pointer-events: none;
}

.logo {
  font-size: 6rem;
  filter: drop-shadow(0 18px 30px rgb(0 0 0 / 0.45));
  animation: launch-logo 0.6s cubic-bezier(0.3, 1.5, 0.6, 1) both;
}

strong {
  font-size: var(--text-xl);
  font-weight: 800;
  letter-spacing: -0.02em;
  animation: launch-name 0.45s ease-out 0.15s both;
}

.dots {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

.dots i {
  width: 0.45rem;
  height: 0.45rem;
  background: rgb(255 255 255 / 0.55);
  border-radius: 50%;
  animation: launch-dot 0.9s ease-in-out infinite;
}

.dots i:nth-child(2) { animation-delay: 0.15s; }
.dots i:nth-child(3) { animation-delay: 0.3s; }

@keyframes launch-logo {
  from { transform: scale(0.6) rotate(-12deg); opacity: 0; }
}

@keyframes launch-name {
  from { transform: translateY(8px); opacity: 0; }
}

@keyframes launch-dot {
  0%, 100% { opacity: 0.3; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-3px); }
}

@media (prefers-reduced-motion: reduce) {
  .launch-splash.leaving {
    transform: none;
  }

  .logo,
  strong,
  .dots i {
    animation: none;
  }
}
</style>
