<script setup lang="ts">
// Visual details V1–V10: Before (`after` false) and After of the same element.
defineProps<{ id: string, after: boolean, run: number }>()

const HUES = [25, 70, 145, 200, 265, 330]
const copied = ref(false)
function copy() {
  copied.value = true
  setTimeout(() => { copied.value = false }, 1400)
}
</script>

<template>
  <div :key="run" class="d" :class="[id.toLowerCase(), { after }]">
    <!-- V1 Concentric radius -->
    <div v-if="id === 'V1'" class="outer"><span class="inner">Upgrade</span></div>

    <!-- V2 Alpha borders -->
    <div v-else-if="id === 'V2'" class="tiles">
      <span v-for="t in ['plain', 'tint', 'warm']" :key="t" :class="t"><i /></span>
    </div>

    <!-- V3 OKLCH palettes: one row of hues at the "same" lightness -->
    <div v-else-if="id === 'V3'" class="swatches">
      <span v-for="h in HUES" :key="h" :style="{ background: after ? `oklch(65% 0.15 ${h})` : `hsl(${h} 85% 50%)` }" />
    </div>

    <!-- V4 OKLCH gradients -->
    <span v-else-if="id === 'V4'" class="gradient" />

    <!-- V5 Matched icon weight -->
    <span v-else-if="id === 'V5'" class="label"><AppIcon name="settings" />Settings</span>

    <!-- V6 Masked edges -->
    <div v-else-if="id === 'V6'" class="scroller">
      <span v-for="t in ['All', 'Unread', 'Starred', 'Drafts', 'Sent', 'Spam', 'Archive', 'Trash']" :key="t">{{ t }}</span>
    </div>

    <!-- V7 Blurred icon swaps -->
    <button v-else-if="id === 'V7'" type="button" class="copy" :aria-label="copied ? 'Copied' : 'Copy'" @click="copy">
      <span class="icons">
        <!-- Keyed apart, so it's a hard swap: the same AppIcon changing name would blur itself in -->
        <template v-if="!after">
          <AppIcon v-if="copied" key="check" name="check" />
          <AppIcon v-else key="copy" name="copy" />
        </template>
        <Transition v-else name="blur-swap">
          <AppIcon v-if="copied" key="check" name="check" />
          <AppIcon v-else key="copy" name="copy" />
        </Transition>
      </span>
    </button>

    <!-- V8 Dark mode depth -->
    <div v-else-if="id === 'V8'" class="dark-ui">
      <span class="card"><i /><i /><span class="pop"><i /><i /></span></span>
    </div>

    <!-- V9 Dynamic viewport -->
    <div v-else-if="id === 'V9'" class="phone">
      <div class="page"><i /><i /><i /><span class="cta">Buy now</span></div>
      <span class="bar">example.com</span>
    </div>

    <!-- V10 Multiply blending -->
    <div v-else-if="id === 'V10'" class="product">
      <span class="photo">👟</span>
      <strong>Runner 2</strong>
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

/* V1: outer radius 24 with 8 padding; inside, 24 again (before) or 16 (after) */
.outer {
  padding: 8px;
  background: var(--surface);
  border-radius: 24px;
  box-shadow: var(--shadow-md);
}

.inner {
  display: grid;
  place-items: center;
  width: 10rem;
  height: 3rem;
  font-weight: 650;
  color: #fff;
  background: var(--accent-btn, var(--accent));
  border-radius: 24px;
}

.v1.after .inner {
  border-radius: 16px;
}

/* V2 */
.tiles {
  display: flex;
  gap: 0.6rem;
}

.tiles span {
  display: grid;
  place-items: center;
  width: 4rem;
  height: 4rem;
  border-radius: var(--radius);
}

.tiles .plain { background: var(--surface); }
.tiles .tint { background: color-mix(in oklab, var(--accent) 28%, var(--surface)); }
.tiles .warm { background: #f7c324; }

.tiles i {
  width: 2.4rem;
  height: 2.4rem;
  border: 2px solid #c9ced8;
  border-radius: var(--radius-sm);
}

.v2.after .tiles i {
  border-color: rgb(27 31 42 / 0.2);
}

/* V3 */
.swatches {
  display: flex;
  gap: 0.35rem;
}

.swatches span {
  width: 2.25rem;
  height: 3.5rem;
  border-radius: var(--radius-sm);
}

/* V4 */
.gradient {
  width: 85%;
  height: 3rem;
  background: linear-gradient(90deg, #2563eb, #facc15);
  border-radius: var(--radius);
}

.v4.after .gradient {
  background: linear-gradient(90deg in oklch, #2563eb, #facc15);
}

/* V5 */
.label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.5rem;
  font-weight: 800;
}

.label :deep(svg) {
  stroke-width: 0.9;
}

.v5.after .label :deep(svg) {
  stroke-width: 2.75;
}

/* V6 */
.scroller {
  display: flex;
  gap: 0.4rem;
  width: 100%;
  padding: 0.25rem 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.v6.after .scroller {
  padding-inline: 1rem;
  mask-image: linear-gradient(to right, transparent, #000 1rem, #000 calc(100% - 1.5rem), transparent);
}

.scroller span {
  flex: none;
  padding: 0.5rem 0.9rem;
  font-size: var(--text-sm);
  font-weight: 600;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
}

/* V7: both icons share one cell, so the old and the new overlap as they swap */
.copy {
  display: grid;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  font-size: 1.4rem;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
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
  transition: opacity 0.2s var(--ease-out), scale 0.2s var(--ease-out), filter 0.2s var(--ease-out);
}

.blur-swap-leave-active {
  transition-duration: 0.16s;
}

.blur-swap-enter-from,
.blur-swap-leave-to {
  opacity: 0;
  scale: 0.6;
  filter: blur(3px);
}

/* V8: a dark screen either way */
.dark-ui {
  display: grid;
  place-items: center;
  width: 100%;
  height: 8rem;
  background: #0b0d12;
  border-radius: var(--radius);
}

.card {
  position: relative;
  display: grid;
  gap: 0.4rem;
  width: 9rem;
  padding: 0.8rem;
  background: #0b0d12;
  border-radius: var(--radius);
  box-shadow: 0 10px 24px rgb(0 0 0 / 0.6);
}

.card i {
  height: 0.45rem;
  background: #2a2f3a;
  border-radius: 99px;
}

.pop {
  position: absolute;
  right: -1.5rem;
  bottom: -1.25rem;
  display: grid;
  gap: 0.35rem;
  width: 5rem;
  padding: 0.6rem;
  background: #0b0d12;
  border-radius: var(--radius-sm);
  box-shadow: 0 10px 24px rgb(0 0 0 / 0.6);
}

.v8.after .card {
  background: #171a21;
}

.v8.after .pop {
  background: #232832;
}

/* V9: a phone screen; the browser bar covers its bottom. 100vh is the screen without the bar, so
   the page runs under it; 100dvh is the room actually left */
.phone {
  position: relative;
  width: 7rem;
  height: 8.5rem;
  overflow: hidden;
  background: var(--surface);
  border: 3px solid var(--ink);
  border-radius: 1rem;
}

.page {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  height: 10rem;
  padding: 0.6rem;
}

.v9.after .page {
  height: calc(100% - 1.6rem);
}

.page i {
  height: 0.4rem;
  background: var(--line);
  border-radius: 99px;
}

.cta {
  margin-top: auto;
  padding: 0.3rem;
  font-size: 0.65rem;
  font-weight: 700;
  text-align: center;
  color: #fff;
  background: var(--accent-btn, var(--accent));
  border-radius: 6px;
}

.bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1.6rem;
  display: grid;
  place-items: center;
  font-size: 0.55rem;
  color: var(--ink-2);
  background: var(--surface-2);
  border-top: 1px solid var(--border);
}

/* V10: a product photo shot on white, on a coloured card */
.product {
  display: grid;
  justify-items: center;
  gap: 0.4rem;
  padding: 1rem 1.5rem;
  background: #f6d6e2;
  border-radius: var(--radius-lg);
}

.product strong {
  color: #1b1f2a;
}

.photo {
  display: grid;
  place-items: center;
  width: 4rem;
  height: 4rem;
  font-size: 2.5rem;
  background: #fff;
}

.v10.after .photo {
  mix-blend-mode: multiply;
}
</style>
