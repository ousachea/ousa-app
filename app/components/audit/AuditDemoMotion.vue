<script setup lang="ts">
// Motion details D1–D20: Before (`after` false) and After. `run` restarts the animated ones; the rest
// (press, switch, drag, icon swap, expand) are there to try.
const props = defineProps<{ id: string, after: boolean, run: number }>()

// D5: switch
const on = ref(false)
const stretching = ref(false)
function toggle() {
  on.value = !on.value
  if (props.after) stretching.value = true
}

// D14 and D19: drag a knob or card sideways
const x = ref(0)
const dragging = ref(false)
let startX = 0
let startPos = 0
function down(e: PointerEvent) {
  dragging.value = true
  startX = e.clientX
  startPos = x.value
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function move(e: PointerEvent, min: number, max: number, elastic: boolean) {
  if (!dragging.value) return
  const want = startPos + e.clientX - startX
  // D19 after: past the edge it gives a little (a third of the extra), then springs back on release
  if (elastic && want > max) x.value = max + (want - max) * 0.3
  else if (elastic && want < min) x.value = min + (want - min) * 0.3
  else x.value = Math.min(max, Math.max(min, want))
}
function up(min: number, max: number) {
  dragging.value = false
  x.value = Math.min(max, Math.max(min, x.value))
}

// D18: theme icon
const dark = ref(false)

// D20: expand a photo
const open = ref(false)
</script>

<template>
  <div :key="run" class="d" :class="[id.toLowerCase(), { after }]">
    <!-- D1 Ease-out for entrances -->
    <span v-if="id === 'D1'" class="card enter">New message</span>

    <!-- D2 Dropdowns at 150–250 ms -->
    <div v-else-if="id === 'D2'" class="dd">
      <span class="trigger">Sort</span>
      <span class="menu"><i /><i /><i /></span>
    </div>

    <!-- D3 Stagger list rows -->
    <ul v-else-if="id === 'D3'" class="rows">
      <li v-for="i in 6" :key="i" :style="{ '--i': i - 1 }" />
    </ul>

    <!-- D4 Scale to 0.97 on press -->
    <button v-else-if="id === 'D4'" type="button" class="press">Press and hold</button>

    <!-- D5 Stretch moving knobs -->
    <button v-else-if="id === 'D5'" type="button" class="switch-demo" role="switch" :aria-checked="on" aria-label="Example switch" @click="toggle">
      <span class="knob" :class="{ on, stretching }" @animationend="stretching = false" />
    </button>

    <!-- D6 Stagger as details settle -->
    <div v-else-if="id === 'D6'" class="settle">
      <span class="pic" /><strong>Weekend in Kampot</strong><small>3 nights · from $120</small><span class="mini-btn">Book</span>
    </div>

    <!-- D7 Arcs for object movement -->
    <div v-else-if="id === 'D7'" class="fly">
      <span class="cart"><AppIcon name="shopping-cart" /></span>
      <span class="x"><span class="y"><span class="item" /></span></span>
    </div>

    <!-- D8 Pulse to confirm success -->
    <span v-else-if="id === 'D8'" class="saved"><AppIcon name="check" />Saved</span>

    <!-- D9 Ease-in-out for moves -->
    <div v-else-if="id === 'D9'" class="tabs">
      <span>Day</span><span>Week</span><span>Month</span><i class="indicator" />
    </div>

    <!-- D10–D13 Popovers -->
    <div v-else-if="['D10', 'D11', 'D12', 'D13'].includes(id)" class="pop-demo">
      <span class="trigger">Options</span>
      <span class="pop"><i /><i /><i /></span>
    </div>

    <!-- D14 Don't tween while held -->
    <div v-else-if="id === 'D14'" class="track">
      <span class="handle" :class="{ dragging }" :style="{ translate: `${x}px 0` }" @pointerdown="down" @pointermove="move($event, 0, 160, false)" @pointerup="up(0, 160)" @pointercancel="up(0, 160)" />
      <small>Drag the knob</small>
    </div>

    <!-- D15 Exits 20% shorter -->
    <span v-else-if="id === 'D15'" class="toast">Copied to clipboard</span>

    <!-- D16 Overlap old & new -->
    <div v-else-if="id === 'D16'" class="swap">
      <span class="state a">Step 1</span><span class="state b">Step 2</span>
    </div>

    <!-- D17 Masks for reveals -->
    <span v-else-if="id === 'D17'" class="reveal">Summer sale</span>

    <!-- D18 Crossfade icons + blur -->
    <button v-else-if="id === 'D18'" type="button" class="theme" :aria-label="dark ? 'Dark theme' : 'Light theme'" @click="dark = !dark">
      <span class="icons">
        <template v-if="!after">
          <AppIcon v-if="dark" key="moon" name="moon" />
          <AppIcon v-else key="sun" name="sun" />
        </template>
        <Transition v-else name="blur-swap">
          <AppIcon v-if="dark" key="moon" name="moon" />
          <AppIcon v-else key="sun" name="sun" />
        </Transition>
      </span>
    </button>

    <!-- D19 Rubber band past bounds -->
    <div v-else-if="id === 'D19'" class="band">
      <span
        class="sheet-card"
        :class="{ dragging }"
        :style="{ translate: `${x}px 0` }"
        @pointerdown="down"
        @pointermove="move($event, -24, 24, after)"
        @pointerup="up(-24, 24)"
        @pointercancel="up(-24, 24)"
      >Drag me sideways</span>
    </div>

    <!-- D20 Reuse the same layoutId -->
    <div v-else-if="id === 'D20'" class="gallery">
      <template v-if="!after">
        <button v-if="!open" key="small" type="button" class="photo small" aria-label="Open photo" @click="open = true" />
        <button v-else key="big" type="button" class="photo big" aria-label="Close photo" @click="open = false" />
      </template>
      <button v-else type="button" class="photo morph" :class="{ big: open, small: !open }" :aria-label="open ? 'Close photo' : 'Open photo'" @click="open = !open" />
      <small>Tap the photo</small>
    </div>
  </div>
</template>

<style scoped>
.d {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 8rem;
}

.card,
.toast,
.saved {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.7rem 1.1rem;
  font-weight: 650;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
}

/* D1 */
.d1 .enter {
  animation: d1-in 0.6s ease-in 0.2s both;
}

.d1.after .enter {
  animation-timing-function: var(--ease-out);
}

@keyframes d1-in {
  from { opacity: 0; translate: 0 2.5rem; }
}

/* D2: opens, waits, closes */
.dd,
.pop-demo {
  display: grid;
  justify-items: start;
  gap: 0.3rem;
  width: 10rem;
}

.trigger {
  padding: 0.35rem 0.75rem;
  font-size: var(--text-sm);
  font-weight: 650;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.menu,
.pop {
  display: grid;
  gap: 0.4rem;
  width: 100%;
  padding: 0.6rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
}

.menu i,
.pop i,
.rows li {
  height: 0.45rem;
  background: var(--line);
  border-radius: 99px;
}

.d2 .menu {
  transform-origin: top left;
  animation: d2-slow 2.2s 0.2s both;
}

.d2.after .menu {
  animation-name: d2-fast;
}

@keyframes d2-slow {
  0% { opacity: 0; scale: 0.95; animation-timing-function: ease-out; }
  27%, 73% { opacity: 1; scale: 1; animation-timing-function: ease-in; }
  100% { opacity: 0; scale: 0.95; }
}

@keyframes d2-fast {
  0% { opacity: 0; scale: 0.95; animation-timing-function: ease-out; }
  9%, 93% { opacity: 1; scale: 1; animation-timing-function: ease-in; }
  100% { opacity: 0; scale: 0.95; }
}

/* D3 */
.rows {
  display: grid;
  gap: 0.5rem;
  width: 12rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rows li {
  height: 0.8rem;
  animation: d3-in 0.35s var(--ease-out) 0.2s both;
}

.d3.after .rows li {
  animation-delay: calc(0.2s + var(--i) * 30ms);
}

@keyframes d3-in {
  from { opacity: 0; translate: 0 8px; }
}

/* D4 */
.press {
  min-height: 2.75rem;
  padding: 0 1.25rem;
  font: inherit;
  font-weight: 650;
  color: #fff;
  background: var(--accent-btn, var(--accent));
  border: 0;
  border-radius: var(--radius);
  cursor: pointer;
  transition: scale 0.12s var(--ease-out);
}

.d4.after .press:active {
  scale: 0.97;
}

/* D5 */
.switch-demo {
  position: relative;
  width: 3.5rem;
  height: 2rem;
  padding: 0;
  background: var(--line);
  border: 0;
  border-radius: 99px;
  cursor: pointer;
  transition: background-color var(--dur);
}

.switch-demo[aria-checked='true'] {
  background: var(--green);
}

.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 1.625rem;
  height: 1.625rem;
  background: #fff;
  border-radius: 99px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
  transition: translate 0.25s var(--ease-in-out);
}

.knob.on {
  translate: 1.5rem 0;
}

.knob.stretching {
  animation: d5-stretch 0.25s var(--ease-in-out);
}

/* Wider in the middle of the move, about 12% */
@keyframes d5-stretch {
  50% { width: 1.82rem; }
}

/* D6 */
.settle {
  display: grid;
  gap: 0.3rem;
  width: 11rem;
  padding: 0.6rem;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  animation: d6-in 0.35s var(--ease-out) 0.2s both;
}

.settle > * {
  animation: d6-in 0.35s var(--ease-out) 0.2s both;
}

.d6.after .settle > :nth-child(2) { animation-delay: 0.3s; }
.d6.after .settle > :nth-child(3) { animation-delay: 0.36s; }
.d6.after .settle > :nth-child(4) { animation-delay: 0.42s; }

.settle .pic {
  height: 2.5rem;
  background: color-mix(in oklab, var(--accent) 25%, var(--surface-2));
  border-radius: 6px;
}

.settle small {
  color: var(--ink-2);
}

.mini-btn {
  justify-self: start;
  padding: 0.2rem 0.7rem;
  font-size: var(--text-xs);
  font-weight: 700;
  color: #fff;
  background: var(--accent-btn, var(--accent));
  border-radius: 99px;
}

@keyframes d6-in {
  from { opacity: 0; translate: 0 8px; }
}

/* D7: the same two-layer trick as C7; the item rides into the cart */
.fly {
  position: relative;
  width: 80%;
  height: 7rem;
}

.cart {
  position: absolute;
  top: 0;
  right: 0;
  font-size: 1.4rem;
}

.fly .x,
.fly .y {
  position: absolute;
  inset: 0;
}

.item {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 1.5rem;
  height: 1.5rem;
  background: var(--accent);
  border-radius: 6px;
  animation: d7-shrink 0.9s ease-in 0.2s both;
}

.d7 .x { animation: d7-x 0.9s ease-in-out 0.2s both; }
.d7 .y { animation: d7-y 0.9s ease-in-out 0.2s both; }
.d7.after .x { animation-timing-function: cubic-bezier(0.5, 0, 0.9, 0.6); }
.d7.after .y { animation-timing-function: cubic-bezier(0.1, 0.5, 0.4, 1); }

@keyframes d7-x {
  to { translate: calc(100% - 1.5rem) 0; }
}

@keyframes d7-y {
  to { translate: 0 calc(-100% + 1.5rem); }
}

@keyframes d7-shrink {
  to { scale: 0.5; opacity: 0.4; }
}

/* D8 */
.saved {
  color: var(--good-ink);
  animation: d8-in 0.25s var(--ease-out) 0.2s both;
}

.d8.after .saved {
  animation: d8-in 0.25s var(--ease-out) 0.2s both, d8-pulse 0.5s var(--ease-out) 0.45s;
}

@keyframes d8-in {
  from { opacity: 0; scale: 0.95; }
}

@keyframes d8-pulse {
  from { box-shadow: var(--shadow-md), 0 0 0 0 color-mix(in oklab, var(--green) 50%, transparent); }
  to { box-shadow: var(--shadow-md), 0 0 0 14px transparent; }
}

/* D9: the line under the tabs moves Day → Week → Month */
.tabs {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 4rem);
  text-align: center;
  font-weight: 650;
}

.tabs span {
  padding: 0.5rem 0;
}

.indicator {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 4rem;
  height: 3px;
  background: var(--accent);
  border-radius: 99px;
  animation: d9-move 2s linear 0.2s both;
}

@keyframes d9-move {
  0%, 10% { translate: 0 0; }
  45%, 55% { translate: 4rem 0; }
  90%, 100% { translate: 8rem 0; }
}

.d9.after .indicator {
  animation-timing-function: var(--ease-in-out);
}

/* D10: from 0 versus from 0.95 */
.d10 .pop {
  transform-origin: top left;
  animation: d10-zero 0.3s var(--ease-out) 0.2s both;
}

.d10.after .pop {
  animation-name: d10-near;
}

@keyframes d10-zero {
  from { opacity: 0; scale: 0; }
}

@keyframes d10-near {
  from { opacity: 0; scale: 0.95; }
}

/* D11, D12: where it grows from and shrinks to; scaled further than real menus, so you can see it */
.d11 .pop {
  transform-origin: center;
  animation: d11-open 0.5s var(--ease-out) 0.2s both;
}

.d11.after .pop {
  transform-origin: top left;
}

@keyframes d11-open {
  from { opacity: 0; scale: 0.5; }
}

.d12 .pop {
  transform-origin: center;
  animation: d12-close 0.45s var(--ease-in) 0.7s both;
}

.d12.after .pop {
  transform-origin: top left;
}

@keyframes d12-close {
  to { opacity: 0; scale: 0.5; }
}

/* D13 */
.d13 .pop {
  transform-origin: top left;
  animation: d13-open 0.55s cubic-bezier(0.3, 1.9, 0.5, 1) 0.2s both;
}

.d13.after .pop {
  animation-duration: 0.2s;
  animation-timing-function: var(--ease-out);
}

@keyframes d13-open {
  from { opacity: 0; scale: 0.6; }
}

/* D14: while held, the knob should sit under the finger; before, it eases after it */
.track {
  position: relative;
  display: grid;
  gap: 0.75rem;
  width: 12.5rem;
  padding-top: 0.5rem;
  touch-action: none;
}

.track::before {
  content: '';
  position: absolute;
  top: calc(0.5rem + 1rem);
  left: 0;
  right: 0;
  height: 4px;
  background: var(--line);
  border-radius: 99px;
}

.handle {
  position: relative;
  width: 2rem;
  height: 2rem;
  background: var(--accent);
  border-radius: 50%;
  box-shadow: var(--shadow-sm);
  cursor: grab;
  touch-action: none;
  transition: translate 0.4s var(--ease-out);
}

.d14.after .handle.dragging {
  transition: none;
}

.track small,
.gallery small {
  color: var(--ink-3);
}

/* D15: in, a moment, out. Before: 0.4 s each way. After: 0.3 s in, 0.24 s out */
.d15 .toast {
  animation: d15-slow 1.8s 0.2s both;
}

.d15.after .toast {
  animation-name: d15-fast;
}

@keyframes d15-slow {
  0% { opacity: 0; translate: 0 1rem; animation-timing-function: var(--ease-out); }
  22%, 78% { opacity: 1; translate: 0 0; animation-timing-function: var(--ease-in); }
  100% { opacity: 0; translate: 0 1rem; }
}

@keyframes d15-fast {
  0% { opacity: 0; translate: 0 1rem; animation-timing-function: var(--ease-out); }
  17%, 87% { opacity: 1; translate: 0 0; animation-timing-function: var(--ease-in); }
  100% { opacity: 0; translate: 0 1rem; }
}

/* D16: Step 1 gives way to Step 2 */
.swap {
  display: grid;
}

.state {
  grid-area: 1 / 1;
  padding: 1rem 1.5rem;
  font-weight: 700;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
}

.state.a {
  animation: d16-out 0.3s ease-in 0.6s both;
}

.state.b {
  opacity: 0;
  color: var(--accent);
  animation: d16-in 0.3s ease-out 1.05s both;
}

.d16.after .state.b {
  animation-delay: 0.6s;
}

@keyframes d16-out {
  to { opacity: 0; }
}

@keyframes d16-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* D17 */
.reveal {
  padding: 1rem 1.75rem;
  font-size: var(--text-xl);
  font-weight: 800;
  color: #fff;
  background: linear-gradient(90deg in oklch, var(--accent), #f59e0b);
  border-radius: var(--radius);
  animation: d17-fade 0.7s ease-out 0.2s both;
}

.d17.after .reveal {
  animation-name: d17-wipe;
  animation-timing-function: var(--ease-in-out);
}

@keyframes d17-fade {
  from { opacity: 0; }
}

@keyframes d17-wipe {
  from { clip-path: inset(0 100% 0 0 round var(--radius)); }
  to { clip-path: inset(0 0 0 0 round var(--radius)); }
}

/* D18 */
.theme {
  display: grid;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  font-size: 1.5rem;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 50%;
  cursor: pointer;
}

.icons {
  display: grid;
}

.icons > :deep(*) {
  grid-area: 1 / 1;
}

.blur-swap-enter-active,
.blur-swap-leave-active {
  transition: opacity 0.25s var(--ease-out), scale 0.25s var(--ease-out), filter 0.25s var(--ease-out), rotate 0.25s var(--ease-out);
}

.blur-swap-leave-active {
  transition-duration: 0.2s;
}

.blur-swap-enter-from,
.blur-swap-leave-to {
  opacity: 0;
  scale: 0.6;
  rotate: -40deg;
  filter: blur(3px);
}

/* D19: it may move 24px either way. Before, it stops dead there; after, it gives a little and springs back */
.band {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
}

.band::before,
.band::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--line);
}

.band::before { left: calc(50% - 6.5rem - 24px); }
.band::after { right: calc(50% - 6.5rem - 24px); }

.sheet-card {
  width: 13rem;
  padding: 1.1rem;
  font-weight: 650;
  text-align: center;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  cursor: grab;
  touch-action: none;
  user-select: none;
  transition: translate 0.35s var(--ease-out);
}

.sheet-card.dragging {
  transition: none;
}

/* D20: before, two different elements swap; after, the one photo changes size and the browser
   animates it, so it grows into place */
.gallery {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
}

.photo {
  padding: 0;
  background: linear-gradient(135deg in oklch, #0ea5e9, #a855f7);
  border: 0;
  cursor: pointer;
}

.photo.small {
  width: 3rem;
  height: 3rem;
  border-radius: 8px;
}

.photo.big {
  width: 12rem;
  height: 6.5rem;
  border-radius: 16px;
}

.photo.morph {
  transition: width 0.35s var(--ease-in-out), height 0.35s var(--ease-in-out), border-radius 0.35s var(--ease-in-out);
}
</style>
