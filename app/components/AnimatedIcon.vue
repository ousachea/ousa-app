<script setup lang="ts">
import { ANIMATED_ICONS, type AnimatedIconName, type AnimatedTrigger } from '~/utils/animatedIcons'

// An icon that moves (Settings → Logos & icons → Animated has them all, to copy). It looks exactly like the
// <AppIcon> of the same name until it plays: once when its button is hovered or keyboard-focused
// (trigger="hover"), clicked ("click"), every few seconds while on screen ("loop"), or each time `play`
// changes ("manual", e.g. :play="savedCount"). `spin` turns a refresh or loader for as long as something's busy,
// and `appear` plays it once when it first shows (a "Saved" tick). Only transforms, opacity and stroke drawing move, on a
// 1em icon, so it's cheap; loops rest off screen and in a hidden tab, and nothing moves with reduced
// motion (the system's or Settings → Motion). Without a `label` it's decoration, hidden from screen readers.
const props = withDefaults(defineProps<{
  name: AnimatedIconName
  /** Leave out for the icon's own best fit (shown in the library) */
  trigger?: AnimatedTrigger
  /** With trigger="manual": plays each time this changes to something truthy */
  play?: number | boolean | string
  /** Turns round without stopping while true: a refresh while it loads */
  spin?: boolean
  /** Plays once when it first shows, on top of its trigger */
  appear?: boolean
  /** Pixels square; leave out to size with the text, like <AppIcon> */
  size?: number
  /** For an icon that means something on its own; most sit in a labelled button and need none */
  label?: string
}>(), { trigger: undefined, play: undefined, spin: false, appear: false, size: undefined, label: undefined })

const def = computed(() => ANIMATED_ICONS[props.name])
const mode = computed(() => props.trigger ?? def.value.trigger)
const root = ref<SVGSVGElement>()
const resting = ref(false)
const REST = 1600

const stillWanted = () => import.meta.client && !matchMedia('(prefers-reduced-motion: reduce)').matches && document.documentElement.dataset.motion !== 'reduced'

function run() {
  const el = root.value
  if (!el || !stillWanted()) return
  // Off and on again, with a layout read between, so a play that's still going starts over
  el.classList.remove('is-playing')
  void el.getBoundingClientRect()
  el.classList.add('is-playing')
}
defineExpose({ play: run })

watch(() => props.play, v => mode.value === 'manual' && v && run())

let host: Element | undefined
let loopTimer: ReturnType<typeof setTimeout> | undefined
let observer: IntersectionObserver | undefined
const onEnter = (e: PointerEvent) => e.pointerType !== 'touch' && run()
const onFocus = () => host?.matches(':focus-visible') && run()

function loop() {
  clearTimeout(loopTimer)
  if (mode.value !== 'loop' || resting.value || document.hidden) return
  run()
  loopTimer = setTimeout(loop, def.value.ms + REST)
}
const onVisibility = () => (document.hidden ? clearTimeout(loopTimer) : loop())

function bind() {
  unbind()
  // The control it sits in plays it: a button, a link, a label, or anything marked data-anim-host
  host = root.value?.closest('button, a, [role="button"], summary, label, [data-anim-host]') ?? root.value?.parentElement ?? undefined
  if (!host) return
  if (mode.value === 'hover') {
    host.addEventListener('pointerenter', onEnter as EventListener)
    host.addEventListener('focusin', onFocus)
  }
  if (mode.value === 'click') host.addEventListener('click', run)
  if (mode.value === 'loop' || def.value.spin || props.spin) {
    observer = new IntersectionObserver(([entry]) => {
      resting.value = !entry?.isIntersecting
      loop()
    })
    if (root.value) observer.observe(root.value)
    document.addEventListener('visibilitychange', onVisibility)
  }
}
function unbind() {
  host?.removeEventListener('pointerenter', onEnter as EventListener)
  host?.removeEventListener('focusin', onFocus)
  host?.removeEventListener('click', run)
  observer?.disconnect()
  clearTimeout(loopTimer)
  document.removeEventListener('visibilitychange', onVisibility)
}
onMounted(() => {
  bind()
  if (props.appear) requestAnimationFrame(run)
})
watch([mode, () => props.name, () => props.spin], () => nextTick(bind))
onBeforeUnmount(unbind)

const style = computed(() => ({
  '--ai-ms': `${def.value.ms}ms`,
  ...(props.size && { width: `${props.size}px`, height: `${props.size}px` })
}))
</script>

<template>
  <!-- The drawings are this app's own (utils/animatedIcons.ts), never user input -->
  <svg
    ref="root"
    class="ai app-icon"
    :class="[`ai-${name}`, { resting, spinning: spin }]"
    :style="style"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    v-html="def.body"
  />
</template>

<style>
.ai {
  flex: none;
  width: 1em;
  height: 1em;
  vertical-align: -0.125em;
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Every part turns and grows about the icon's centre unless it says otherwise */
.ai * {
  transform-box: view-box;
  transform-origin: 12px 12px;
}

/* ---------- One play, while .is-playing ---------- */
.ai.is-playing :is(.draw, .ring) { animation: ai-draw var(--ai-ms) var(--ease-out) backwards; }
.ai.is-playing .draw.late { animation-duration: calc(var(--ai-ms) * 0.55); animation-delay: calc(var(--ai-ms) * 0.45); }
.ai.is-playing .shake { animation: ai-shake var(--ai-ms) var(--ease-out); }
.ai.is-playing :is(.turn) { animation: ai-turn var(--ai-ms) var(--ease-out); }
.ai.is-playing .quarter { animation: ai-quarter var(--ai-ms) var(--ease-out); }
.ai.is-playing .gear { animation: ai-gear var(--ai-ms) var(--ease-out); }
.ai.is-playing .hands { animation: ai-turn var(--ai-ms) var(--ease-out); }
.ai.is-playing .back { animation: ai-copy-back var(--ai-ms) var(--ease-out); }
.ai.is-playing .front { animation: ai-copy-front var(--ai-ms) var(--ease-out); }
.ai.is-playing .lid { transform-origin: 3px 6px; animation: ai-lid var(--ai-ms) var(--ease-out); }
.ai.is-playing .drop { animation: ai-drop var(--ai-ms) var(--ease-out); }
.ai.is-playing .rise { animation: ai-rise var(--ai-ms) var(--ease-out); }
.ai.is-playing .fly { animation: ai-fly var(--ai-ms) var(--ease-out); }
.ai.is-playing .scan { animation: ai-scan var(--ai-ms) var(--ease-out); }
.ai.is-playing .node { transform-box: fill-box; transform-origin: center; animation: ai-node calc(var(--ai-ms) * 0.6) var(--ease-out) backwards; }
.ai.is-playing .n1 { animation-delay: calc(var(--ai-ms) * 0.2); }
.ai.is-playing .n2 { animation-delay: calc(var(--ai-ms) * 0.4); }
.ai.is-playing .beat { animation: ai-beat var(--ai-ms) var(--ease-out); }
.ai.is-playing .pop { animation: ai-pop var(--ai-ms) var(--ease-spring); }
.ai.is-playing .land { animation: ai-land var(--ai-ms) var(--ease-out); }
.ai.is-playing .press { transform-origin: 12px 22px; animation: ai-press var(--ai-ms) var(--ease-out); }
.ai.is-playing .swing { transform-origin: 12px 3px; animation: ai-swing var(--ai-ms) var(--ease-out); }
.ai.is-playing .clapper { transform-origin: 12px 17px; animation: ai-clapper var(--ai-ms) var(--ease-out); }
.ai.is-playing .shackle { animation: ai-shackle var(--ai-ms) var(--ease-out); }
.ai.is-playing .blink { animation: ai-blink var(--ai-ms) var(--ease-out); }
.ai.is-playing .flap { transform-origin: 12px 7px; animation: ai-flap var(--ai-ms) var(--ease-out); }
.ai.is-playing .twinkle { animation: ai-twinkle var(--ai-ms) var(--ease-out); }
.ai.is-playing .glint { animation: ai-glint calc(var(--ai-ms) * 0.6) var(--ease-out) backwards; }
.ai.is-playing .g2 { animation-delay: calc(var(--ai-ms) * 0.3); }
.ai.is-playing .flash { animation: ai-flash var(--ai-ms) linear; }
.ai.is-playing .bar { animation: ai-bar calc(var(--ai-ms) * 0.5) var(--ease-out) backwards; }
.ai.is-playing .b1 { animation-delay: calc(var(--ai-ms) * 0.15); }
.ai.is-playing .b2 { animation-delay: calc(var(--ai-ms) * 0.3); }
.ai.is-playing .b3 { animation-delay: calc(var(--ai-ms) * 0.45); }
.ai.is-playing .rays { animation: ai-rays var(--ai-ms) var(--ease-out); }
.ai.is-playing .core { animation: ai-core var(--ai-ms) var(--ease-out); }
.ai.is-playing .rock { animation: ai-rock var(--ai-ms) var(--ease-out); }
.ai.is-playing .nudge { animation: ai-nudge var(--ai-ms) var(--ease-out); }
.ai.is-playing .dip { animation: ai-dip var(--ai-ms) var(--ease-out); }
.ai.is-playing .line { transform-origin: 4px 12px; animation: ai-line calc(var(--ai-ms) * 0.7) var(--ease-out) backwards; }
.ai.is-playing .l1 { animation-delay: calc(var(--ai-ms) * 0.15); }
.ai.is-playing .l2 { animation-delay: calc(var(--ai-ms) * 0.3); }
.ai.is-playing .door { transform-origin: 9px 21px; animation: ai-door var(--ai-ms) var(--ease-out); }

/* Loops of their own, for the icons that loop: each play is one round of these */
.ai.is-playing .flip { animation: ai-flip var(--ai-ms) var(--ease-out); }
.ai.is-playing .trace { animation: ai-trace var(--ai-ms) var(--ease-out); }
.ai.is-playing .charge { animation: ai-charge var(--ai-ms) var(--ease-out); }
.ai.is-playing .b4 { animation-delay: calc(var(--ai-ms) * 0.6); }
.ai.is-playing .tick-hand { transform-origin: 12px 14px; animation: ai-turn var(--ai-ms) var(--ease-out); }
.ai.is-playing .needle { transform-origin: 12px 14px; animation: ai-needle var(--ai-ms) var(--ease-out); }
.ai.is-playing .hop { animation: ai-hop var(--ai-ms) var(--ease-out); }
.ai.is-playing .flicker { transform-origin: 12px 21px; animation: ai-flicker var(--ai-ms) ease-in-out; }
.ai.is-playing .drift { animation: ai-drift var(--ai-ms) ease-in-out; }
.ai.is-playing .scribble { transform-origin: 3px 21px; animation: ai-scribble var(--ai-ms) var(--ease-out); }

/* A loader turns for as long as it's shown, and `spin` turns a refresh while it's busy; both rest off screen */
.ai .spin { animation: ai-turn var(--ai-ms) linear infinite; }
.ai .tick-spin { animation: ai-turn var(--ai-ms) steps(8) infinite; }
.ai.spinning :is(.turn, .gear, .rays) { animation: ai-turn 0.9s linear infinite; }
.ai.resting :is(.spin, .tick-spin),
.ai.resting.spinning * { animation-play-state: paused; }

@keyframes ai-draw { from { stroke-dasharray: 1; stroke-dashoffset: 1; } to { stroke-dasharray: 1; stroke-dashoffset: 0; } }
@keyframes ai-shake { 20% { transform: translateX(-2px); } 40% { transform: translateX(2px); } 60% { transform: translateX(-1.5px); } 80% { transform: translateX(1px); } }
@keyframes ai-turn { from { transform: rotate(0); } to { transform: rotate(360deg); } }
@keyframes ai-quarter { from { transform: rotate(0); } to { transform: rotate(90deg); } }
@keyframes ai-gear { from { transform: rotate(0); } to { transform: rotate(120deg); } }
@keyframes ai-copy-back { 50% { transform: translate(3px, 3px); opacity: 0.5; } }
@keyframes ai-copy-front { 50% { transform: translate(-1px, -1px); } }
@keyframes ai-lid { 40% { transform: translateY(-1.5px) rotate(-14deg); } }
@keyframes ai-drop { 45% { transform: translateY(3px); } 70% { transform: translateY(-1px); } }
@keyframes ai-rise { 45% { transform: translateY(-3px); } 70% { transform: translateY(1px); } }
@keyframes ai-fly { 45% { transform: translate(9px, -9px); opacity: 0; } 46% { transform: translate(-9px, 9px); opacity: 0; } }
@keyframes ai-scan { 25% { transform: translate(-2px, -1px); } 50% { transform: translate(1px, -2px); } 75% { transform: translate(1px, 1px); } }
@keyframes ai-node { 50% { transform: scale(1.35); } }
@keyframes ai-beat { 20% { transform: scale(1.22); } 40% { transform: scale(0.95); } 60% { transform: scale(1.12); } }
@keyframes ai-pop { 0% { transform: scale(0.6) rotate(-20deg); } 60% { transform: scale(1.15) rotate(8deg); } }
@keyframes ai-land { 0% { transform: translateY(-5px); opacity: 0; } 60% { transform: translateY(1px); opacity: 1; } }
@keyframes ai-press { 35% { transform: translateY(2px) scaleY(0.92); } 70% { transform: translateY(-1px); } }
@keyframes ai-swing { 15% { transform: rotate(14deg); } 35% { transform: rotate(-12deg); } 55% { transform: rotate(7deg); } 75% { transform: rotate(-4deg); } }
@keyframes ai-clapper { 15% { transform: translateX(-1.5px); } 35% { transform: translateX(1.5px); } 55% { transform: translateX(-1px); } }
@keyframes ai-shackle { 40% { transform: translateY(-2.5px); } 70% { transform: translateY(0.5px); } }
@keyframes ai-blink { 45% { transform: scaleY(0.12); } }
@keyframes ai-flap { 50% { transform: scaleY(-0.6); } }
@keyframes ai-twinkle { 30% { transform: scale(0.8) rotate(-12deg); } 65% { transform: scale(1.1) rotate(6deg); } }
@keyframes ai-glint { 50% { opacity: 0; } }
@keyframes ai-flash { 20% { opacity: 0.25; } 35% { opacity: 1; } 50% { opacity: 0.45; } }
@keyframes ai-bar { from { opacity: 0.15; } }
@keyframes ai-rays { from { transform: rotate(0); } to { transform: rotate(90deg); } }
@keyframes ai-core { 50% { transform: scale(0.8); } }
@keyframes ai-rock { 30% { transform: rotate(-18deg); } 65% { transform: rotate(8deg); } }
@keyframes ai-nudge { 45% { transform: translateX(3px); } 75% { transform: translateX(-1px); } }
@keyframes ai-dip { 45% { transform: translateY(2.5px); } 75% { transform: translateY(-0.5px); } }
@keyframes ai-line { 50% { transform: scaleX(0.55); } }
@keyframes ai-door { 50% { transform: scaleX(0.25); } }
@keyframes ai-flip { 15% { transform: rotate(0); } 70%, 100% { transform: rotate(180deg); } }
@keyframes ai-trace { 0% { stroke-dasharray: 1; stroke-dashoffset: 1; } 55% { stroke-dasharray: 1; stroke-dashoffset: 0; } 100% { stroke-dasharray: 1; stroke-dashoffset: -1; } }
@keyframes ai-charge { 0%, 100% { opacity: 1; transform: translateY(0); } 30% { opacity: 0.2; transform: translateY(1.5px); } 60% { opacity: 1; transform: translateY(-1px); } }
@keyframes ai-needle { 0% { transform: rotate(0); } 35% { transform: rotate(-130deg); } 75% { transform: rotate(25deg); } }
@keyframes ai-hop { 30% { transform: translateY(-3px); } 55% { transform: translateY(0) scaleY(0.92); } 70% { transform: translateY(-1px); } }
@keyframes ai-flicker { 25% { transform: scale(0.94, 1.06) skewX(-3deg); } 50% { transform: scale(1.04, 0.95) skewX(2deg); } 75% { transform: scale(0.97, 1.04) skewX(-1deg); } }
@keyframes ai-drift { 50% { transform: translateX(2px); } }
@keyframes ai-scribble { 20% { transform: rotate(-8deg); } 40% { transform: rotate(6deg) translateX(1px); } 60% { transform: rotate(-4deg); } 80% { transform: rotate(2deg); } }

@media (prefers-reduced-motion: reduce) {
  .ai * {
    animation: none !important;
  }
}

:root[data-motion='reduced'] .ai * {
  animation: none !important;
}
</style>
