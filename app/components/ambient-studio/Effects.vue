<script setup lang="ts">
import type { AmbientEffect } from '~/types/ambient-studio'

// A light canvas layer over the scene artwork: rain, drops on glass, embers, dust, clouds, stars
// or city lights. It draws only while it's on screen and the tab is visible, keeps particle counts
// low (fewer still in lite effects), and with reduced motion draws one still frame.
const props = defineProps<{ effect: AmbientEffect, tint: string, reduced: boolean }>()

const canvas = ref<HTMLCanvasElement>()

interface P { x: number, y: number, vx: number, vy: number, r: number, a: number, t: number }

let ctx: CanvasRenderingContext2D | null = null
let w = 0
let h = 0
let parts: P[] = []
let frame = 0
let last = 0
let visible = true
let onScreen = true
let ro: ResizeObserver | undefined
let io: IntersectionObserver | undefined

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function count() {
  const lite = document.documentElement.dataset.effects === 'lite'
  const area = (w * h) / (1280 * 720)
  const base: Record<AmbientEffect, number> = { none: 0, rain: 140, droplets: 45, embers: 36, dust: 46, clouds: 6, stars: 130, city: 28 }
  return Math.max(4, Math.round(base[props.effect] * Math.min(1.4, Math.max(0.35, area)) * (lite ? 0.5 : 1)))
}

function spawn(initial: boolean): P {
  switch (props.effect) {
    case 'rain':
      return { x: rand(-0.1, 1.1) * w, y: initial ? rand(0, h) : rand(-h * 0.2, 0), vx: -0.12, vy: rand(0.9, 1.4), r: rand(10, 22), a: rand(0.12, 0.35), t: 0 }
    case 'droplets':
      return { x: rand(0, w), y: initial ? rand(0, h) : rand(-20, 0), vx: 0, vy: Math.random() < 0.25 ? rand(0.02, 0.08) : 0, r: rand(1.5, 5.5), a: rand(0.25, 0.6), t: rand(0, 600) }
    case 'embers':
      return { x: rand(0.2, 0.8) * w, y: initial ? rand(h * 0.3, h) : h + 10, vx: rand(-0.03, 0.03), vy: -rand(0.04, 0.12), r: rand(1, 2.6), a: rand(0.4, 0.9), t: rand(0, 100) }
    case 'dust':
      return { x: rand(0, w), y: rand(0, h), vx: rand(-0.01, 0.01), vy: rand(-0.012, 0.004), r: rand(0.6, 2.2), a: rand(0.1, 0.4), t: rand(0, 100) }
    case 'clouds':
      return { x: initial ? rand(-0.2, 1) * w : -w * 0.4, y: rand(0, h * 0.45), vx: rand(0.004, 0.012), vy: 0, r: rand(0.25, 0.45) * w, a: rand(0.03, 0.07), t: 0 }
    case 'stars':
      return { x: rand(0, w), y: Math.random() ** 1.4 * h * 0.7, vx: 0, vy: 0, r: rand(0.4, 1.4), a: rand(0.3, 0.9), t: rand(0, 100) }
    case 'city':
      return { x: rand(0, w), y: rand(h * 0.45, h), vx: 0, vy: 0, r: rand(6, 22), a: rand(0.05, 0.18), t: rand(0, 100) }
    default:
      return { x: 0, y: 0, vx: 0, vy: 0, r: 0, a: 0, t: 0 }
  }
}

function reset() {
  parts = Array.from({ length: props.effect === 'none' ? 0 : count() }, () => spawn(true))
}

function draw(dt: number) {
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  const tint = props.tint
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!
    p.t += dt
    switch (props.effect) {
      case 'rain': {
        p.x += p.vx * dt * 0.5
        p.y += p.vy * dt * 0.9
        ctx.strokeStyle = `rgba(210,225,245,${p.a})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x + p.vx * p.r, p.y + p.r)
        ctx.stroke()
        if (p.y > h + 20) parts[i] = spawn(false)
        break
      }
      case 'droplets': {
        // Most drops cling; a few run down the glass now and then
        if (p.vy) {
          p.y += p.vy * dt * (0.6 + Math.sin(p.t / 300) * 0.4)
          p.vy = Math.min(0.25, p.vy + 0.00002 * dt)
        } else if (Math.random() < 0.00004 * dt) {
          p.vy = 0.03
        }
        const g = ctx.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, 0, p.x, p.y, p.r)
        g.addColorStop(0, `rgba(255,255,255,${p.a})`)
        g.addColorStop(0.6, `rgba(190,210,235,${p.a * 0.35})`)
        g.addColorStop(1, 'rgba(190,210,235,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, p.r * 0.85, p.r, 0, 0, Math.PI * 2)
        ctx.fill()
        if (p.y > h + 10) parts[i] = spawn(false)
        break
      }
      case 'embers': {
        p.x += (p.vx + Math.sin(p.t / 400) * 0.02) * dt
        p.y += p.vy * dt
        const flicker = 0.6 + Math.sin(p.t / 90) * 0.4
        ctx.fillStyle = `rgba(255,${150 + Math.round(flicker * 60)},80,${p.a * flicker * Math.min(1, (p.y / h) * 1.6)})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
        if (p.y < h * 0.15) parts[i] = spawn(false)
        break
      }
      case 'dust': {
        p.x += (p.vx + Math.sin(p.t / 1800) * 0.006) * dt
        p.y += p.vy * dt
        if (p.y < -5) p.y = h + 5
        if (p.x < -5) p.x = w + 5
        if (p.x > w + 5) p.x = -5
        ctx.fillStyle = `rgba(255,244,225,${p.a * (0.6 + Math.sin(p.t / 900) * 0.4)})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'clouds': {
        p.x += p.vx * dt
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
        g.addColorStop(0, `rgba(220,228,245,${p.a})`)
        g.addColorStop(1, 'rgba(220,228,245,0)')
        ctx.fillStyle = g
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)
        if (p.x - p.r > w) parts[i] = spawn(false)
        break
      }
      case 'stars': {
        const twinkle = 0.55 + Math.sin(p.t / (700 + p.r * 400)) * 0.45
        ctx.fillStyle = `rgba(235,240,255,${p.a * twinkle})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'city': {
        const pulse = 0.7 + Math.sin(p.t / 1500) * 0.3
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
        g.addColorStop(0, i % 3 === 0 ? `${tint}` : i % 3 === 1 ? 'rgba(255,190,110,1)' : 'rgba(140,200,255,1)')
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.globalAlpha = p.a * pulse
        ctx.fillStyle = g
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)
        ctx.globalAlpha = 1
        break
      }
    }
  }
}

function loop(now: number) {
  frame = 0
  const dt = Math.min(64, now - (last || now))
  last = now
  draw(dt)
  schedule()
}

function schedule() {
  if (frame || props.reduced || !visible || !onScreen || props.effect === 'none') return
  frame = requestAnimationFrame(loop)
}

function halt() {
  cancelAnimationFrame(frame)
  frame = 0
  last = 0
}

function resize() {
  const el = canvas.value
  if (!el) return
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  w = el.clientWidth
  h = el.clientHeight
  el.width = Math.round(w * dpr)
  el.height = Math.round(h * dpr)
  ctx = el.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  reset()
  restart()
}

// Reduced motion: one still frame, no loop
function restart() {
  halt()
  if (props.reduced) draw(0)
  else schedule()
}

function onVisibility() {
  visible = document.visibilityState === 'visible'
  if (visible) schedule()
  else halt()
}

onMounted(() => {
  ro = new ResizeObserver(resize)
  ro.observe(canvas.value!)
  io = new IntersectionObserver(([entry]) => {
    onScreen = !!entry?.isIntersecting
    if (onScreen) schedule()
    else halt()
  })
  io.observe(canvas.value!)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  halt()
  ro?.disconnect()
  io?.disconnect()
  document.removeEventListener('visibilitychange', onVisibility)
})

watch(() => props.effect, () => {
  reset()
  restart()
})
watch(() => props.reduced, restart)
</script>

<template>
  <canvas ref="canvas" class="ambient-studio-effects" aria-hidden="true" />
</template>

<style scoped>
.ambient-studio-effects {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
