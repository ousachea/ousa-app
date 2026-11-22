<script setup lang="ts">
// Typography T1–T10: Before (`after` false) and After.
defineProps<{ id: string, after: boolean, run: number }>()

const TABS = ['Home', 'Profile', 'Settings']
const tab = ref('Home')
const width = ref(60)
const FILE = 'quarterly-sales-report-final-v12.pdf'
</script>

<template>
  <div :key="run" class="d" :class="[id.toLowerCase(), { after }]">
    <!-- T1 Reserved bold width -->
    <div v-if="id === 'T1'" class="tabs" role="tablist" aria-label="Example tabs">
      <button v-for="t in TABS" :key="t" type="button" role="tab" :aria-selected="tab === t" :data-label="t" @click="tab = t">{{ t }}</button>
      <span class="tabs-hint">Tap the tabs</span>
    </div>

    <!-- T2 Text-box trim: the dashed box is the text's own box -->
    <span v-else-if="id === 'T2'" class="pill"><span class="txt">Badge</span></span>

    <!-- T3 Underline offset -->
    <a v-else-if="id === 'T3'" class="ul" href="#" @click.prevent>Typography, gauging quality</a>

    <!-- T4 Superscript spacing -->
    <p v-else-if="id === 'T4'" class="para">Battery life is up to 20 hours<sup>1</sup> on a full charge, and it charges in about 90 minutes<sup>2</sup> with the included cable.</p>

    <!-- T5 Fluid type -->
    <div v-else-if="id === 'T5'" class="fluid">
      <div class="box" :style="{ width: `${width}%` }"><h4>Fresh coffee</h4></div>
      <label class="slider">Width<input v-model.number="width" type="range" min="30" max="100" aria-label="Box width"></label>
    </div>

    <!-- T6 Small caps acronyms -->
    <p v-else-if="id === 'T6'" class="para">
      Upload the <span class="sc">PDF</span> over <span class="sc">HTTPS</span>, then email it to <span class="sc">NASA</span> and the <span class="sc">FBI</span> before 5 pm.
    </p>

    <!-- T7 Curly quotes -->
    <p v-else-if="id === 'T7'" class="quote">{{ after ? 'She said, “It’s ready.”' : 'She said, "It\'s ready."' }}</p>

    <!-- T8 Middle truncation -->
    <span v-else-if="id === 'T8'" class="file">
      <template v-if="!after"><span class="end-cut">{{ FILE }}</span></template>
      <template v-else><span class="stem">{{ FILE.slice(0, -10) }}</span><span class="tail">{{ FILE.slice(-10) }}</span></template>
    </span>

    <!-- T9 Auto hyphenation -->
    <p v-else-if="id === 'T9'" class="narrow" lang="en">Internationalization and accessibility considerations fundamentally transform documentation.</p>

    <!-- T10 Line-clamped titles -->
    <div v-else-if="id === 'T10'" class="card">
      <span class="thumb" />
      <h4>A complete beginner’s guide to brewing pour-over coffee at home, with the right grind, water and timing</h4>
      <small>8 min read</small>
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

/* T1 */
.tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem;
}

.tabs button {
  display: inline-grid;
  min-height: 2.75rem;
  padding: 0 0.75rem;
  font: inherit;
  font-weight: 400;
  color: var(--ink-2);
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}

.tabs button[aria-selected='true'] {
  font-weight: 800;
  color: var(--ink);
  border-bottom-color: var(--accent);
}

/* After: an invisible bold copy of each label holds the width, so the bold one is no wider */
.t1.after .tabs button::after {
  content: attr(data-label);
  height: 0;
  overflow: hidden;
  visibility: hidden;
  font-weight: 800;
  user-select: none;
}

.tabs-hint {
  flex-basis: 100%;
  text-align: center;
  font-size: var(--text-xs);
  color: var(--ink-3);
}

/* T2 */
.pill {
  display: inline-block;
  padding: 0.5rem 1rem;
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.5;
  color: #fff;
  background: var(--accent-btn, var(--accent));
  border-radius: var(--radius);
}

.txt {
  display: block;
  outline: 1px dashed rgb(255 255 255 / 0.7);
}

.t2.after .txt {
  text-box: trim-both cap alphabetic;
  padding-block: 0.4rem;
}

.t2.after .pill {
  padding-block: 0.6rem;
}

/* T3 */
.ul {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--ink);
  text-decoration-thickness: 0.12em;
  text-underline-offset: 0.02em;
  text-decoration-skip-ink: none;
}

.t3.after .ul {
  text-decoration-thickness: 0.07em;
  text-underline-offset: 0.25em;
  text-decoration-skip-ink: auto;
}

/* T4 */
.para {
  max-width: 17rem;
  margin: 0;
  line-height: 1.45;
}

.t4.after sup {
  position: relative;
  top: -0.45em;
  vertical-align: baseline;
  line-height: 0;
}

/* T5 */
.fluid {
  display: grid;
  gap: 0.6rem;
  width: 100%;
}

.box {
  container-type: inline-size;
  padding: 0.5rem 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.box h4 {
  margin: 0;
  font-size: 1rem;
  line-height: 1.1;
}

@container (min-width: 9rem) {
  .t5:not(.after) .box h4 {
    font-size: 1.9rem;
  }
}

.t5.after .box h4 {
  font-size: clamp(1rem, 14cqi, 1.9rem);
}

.slider {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

/* T6 */
.t6.after .sc {
  font-variant-caps: all-small-caps;
  letter-spacing: 0.04em;
}

/* T7 */
.quote {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.6rem;
}

/* T8 */
.file {
  display: flex;
  width: 12rem;
  padding: 0.6rem 0.8rem;
  font-size: var(--text-sm);
  font-weight: 600;
  white-space: nowrap;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.end-cut,
.stem {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tail {
  flex: none;
}

/* T9 */
.narrow {
  width: 7.5rem;
  margin: 0;
  font-size: var(--text-sm);
  text-align: justify;
  hyphens: manual;
}

.t9.after .narrow {
  hyphens: auto;
}

/* T10 */
.card {
  display: grid;
  gap: 0.35rem;
  width: 12rem;
  padding: 0.6rem;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
}

.thumb {
  height: 2rem;
  background: color-mix(in oklab, var(--accent) 25%, var(--surface-2));
  border-radius: calc(var(--radius) - 0.6rem + 4px);
}

.card h4 {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.3;
}

.t10.after .card h4 {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card small {
  color: var(--ink-3);
}
</style>
