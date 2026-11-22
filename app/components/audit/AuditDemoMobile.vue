<script setup lang="ts">
// Mobile & input M1–M10: Before (`after` false) and After. Most only show on a phone (the keyboard,
// zoom, the tap flash), so each is a real field or button to try rather than a picture of one.
const props = defineProps<{ id: string, after: boolean, run: number }>()

// M4: a touch screen keeps :hover on the last thing tapped, until you tap somewhere else
const stuck = ref(false)
const btn = ref<HTMLElement>()
function tapAdd() {
  if (!props.after) stuck.value = true
}
const unstick = (e: PointerEvent) => {
  if (!btn.value?.contains(e.target as Node)) stuck.value = false
}
onMounted(() => document.addEventListener('pointerdown', unstick))
onBeforeUnmount(() => document.removeEventListener('pointerdown', unstick))

// M8: a counter to tap quickly
const count = ref(0)
</script>

<template>
  <div :key="run" class="d" :class="[id.toLowerCase(), { after }]">
    <!-- M1 16px inputs -->
    <input v-if="id === 'M1'" class="input field" placeholder="Your name" aria-label="Your name" autocomplete="off">

    <!-- M2 No tap highlight -->
    <button v-else-if="id === 'M2'" type="button" class="tap">Add to cart</button>

    <!-- M3 Numeric inputmode -->
    <input v-else-if="id === 'M3' && !after" class="input field" type="text" placeholder="6-digit code" aria-label="Code" autocomplete="off">
    <input v-else-if="id === 'M3'" class="input field" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="6-digit code" aria-label="Code" autocomplete="off">

    <!-- M4 Hover media query -->
    <div v-else-if="id === 'M4'" class="hover-demo">
      <button ref="btn" type="button" class="tap hoverable" :class="{ stuck }" @click="tapAdd">Add</button>
      <small>{{ stuck ? 'Still highlighted. Tap anywhere else to clear it.' : 'Tap the button' }}</small>
    </div>

    <!-- M5 OTP autofill -->
    <input v-else-if="id === 'M5' && !after" class="input field" type="text" placeholder="Code from SMS" aria-label="Code from SMS" autocomplete="off">
    <input v-else-if="id === 'M5'" class="input field" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="Code from SMS" aria-label="Code from SMS">

    <!-- M6 Overscroll contain -->
    <ol v-else-if="id === 'M6'" class="sheet">
      <li v-for="i in 14" :key="i">Item {{ i }}</li>
    </ol>

    <!-- M7 Email input type -->
    <input v-else-if="id === 'M7' && !after" class="input field" type="text" placeholder="you@example.com" aria-label="Email" autocomplete="off">
    <input v-else-if="id === 'M7'" class="input field" type="email" placeholder="you@example.com" aria-label="Email" autocomplete="email">

    <!-- M8 No double-tap zoom -->
    <div v-else-if="id === 'M8'" class="counter">
      <button type="button" class="tap round" aria-label="Add one" @click="count++">+</button>
      <output>{{ count }}</output>
    </div>

    <!-- M9 Enter key hint -->
    <input v-else-if="id === 'M9' && !after" class="input field" type="text" placeholder="Search" aria-label="Search" autocomplete="off">
    <input v-else-if="id === 'M9'" class="input field" type="text" enterkeyhint="search" placeholder="Search" aria-label="Search" autocomplete="off">

    <!-- M10 Scroll snap -->
    <div v-else-if="id === 'M10'" class="carousel">
      <span v-for="i in 5" :key="i">{{ i }}</span>
    </div>
  </div>
</template>

<style scoped>
.d {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 8rem;
}

.field {
  width: min(15rem, 100%);
  font-size: 13px;
}

.m1.after .field,
.m3 .field,
.m5 .field,
.m7 .field,
.m9 .field {
  font-size: 16px;
}

.tap {
  min-height: 2.75rem;
  padding: 0 1.25rem;
  font: inherit;
  font-weight: 650;
  color: #fff;
  background: var(--accent-btn, var(--accent));
  border: 0;
  border-radius: var(--radius);
  cursor: pointer;
  transition: scale 0.1s, background-color var(--dur-fast);
}

/* M2: the browser's grey flash, and no pressed state of its own */
.m2:not(.after) .tap {
  -webkit-tap-highlight-color: rgb(0 0 0 / 0.35);
}

.m2.after .tap:active {
  scale: 0.97;
  background: color-mix(in oklab, var(--accent-btn, var(--accent)) 82%, #000);
}

/* M4 */
.hover-demo {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
}

.hover-demo small {
  color: var(--ink-2);
}

.hoverable.stuck {
  background: #1b1f2a;
  outline: 3px solid color-mix(in oklab, var(--accent) 50%, transparent);
}

/* M6: scroll to the end of this list, and keep going */
.sheet {
  width: min(13rem, 100%);
  height: 8rem;
  margin: 0;
  padding: 0.25rem 0.75rem;
  overflow-y: auto;
  list-style: none;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
}

.m6.after .sheet {
  overscroll-behavior: contain;
}

.sheet li {
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--border);
}

/* M8 */
.counter {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.round {
  width: 3rem;
  height: 3rem;
  padding: 0;
  font-size: 1.5rem;
  border-radius: 50%;
}

.m8:not(.after) .round {
  touch-action: auto;
}

.m8.after .round {
  touch-action: manipulation;
}

.counter output {
  min-width: 2ch;
  font-size: var(--text-xl);
  font-weight: 700;
}

/* M10 */
.carousel {
  display: flex;
  gap: 0.6rem;
  width: 100%;
  padding: 0.25rem 0.5rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.m10.after .carousel {
  scroll-snap-type: x mandatory;
  scroll-padding-inline: 0.5rem;
}

.carousel span {
  flex: none;
  display: grid;
  place-items: center;
  width: 70%;
  height: 6rem;
  font-size: var(--text-xl);
  font-weight: 800;
  color: #fff;
  background: color-mix(in oklab, var(--accent) 80%, #000);
  border-radius: var(--radius-lg);
  scroll-snap-align: start;
}
</style>
