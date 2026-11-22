<script setup lang="ts">
// Product & landing polish P1–P20: Before (`after` false) and After, mostly as small mock-ups.
const props = defineProps<{ id: string, after: boolean, run: number }>()

// P18: a counter that ticks for two seconds each time it plays
const tick = ref(1111)
let timer: ReturnType<typeof setInterval> | undefined
function ticking() {
  clearInterval(timer)
  const end = Date.now() + 2000
  timer = setInterval(() => {
    tick.value = Math.floor(Math.random() * 9000) + 1000
    if (Date.now() > end) clearInterval(timer)
  }, 90)
}
onMounted(() => props.id === 'P18' && ticking())
watch(() => props.run, () => props.id === 'P18' && ticking())
onBeforeUnmount(() => clearInterval(timer))

// P19: load
const loading = ref<'idle' | 'busy' | 'done'>('idle')
function load() {
  loading.value = 'busy'
  setTimeout(() => { loading.value = 'done' }, 1300)
}

// P20: add to cart
const added = ref(false)
function add() {
  if (!props.after) return
  added.value = true
  setTimeout(() => { added.value = false }, 1500)
}
</script>

<template>
  <div :key="run" class="d" :class="[id.toLowerCase(), { after }]">
    <!-- P1 Delete filler badges -->
    <div v-if="id === 'P1'" class="product">
      <span class="pic" />
      <span class="badges">
        <template v-if="!after"><b>New</b><b>Hot</b><b>Sale</b><b>Popular</b><b>★ Best</b></template>
        <b v-else class="good">In stock</b>
      </span>
      <strong>Wireless earbuds</strong><span>$49</span>
    </div>

    <!-- P2 Drop redundant labels -->
    <div v-else-if="id === 'P2'" class="form">
      <template v-if="!after">
        <span class="lbl">Email address:</span>
        <span class="fake"><AppIcon name="mail" />Email address</span>
        <small>Enter your email address</small>
      </template>
      <template v-else>
        <span class="lbl">Email</span>
        <span class="fake muted">you@example.com</span>
      </template>
    </div>

    <!-- P3 Unitalicize random words -->
    <p v-else-if="id === 'P3'" class="para">
      Our <em>new</em> plan gives you <em>more</em> storage, <em>faster</em> sync and <em>priority</em> support, at the <em>same</em> price.
    </p>

    <!-- P4 Mono only where needed -->
    <div v-else-if="id === 'P4'" class="order">
      <strong>Order shipped</strong>
      <span>Arrives Thursday, 4 June</span>
      <code>#A-10293</code>
    </div>

    <!-- P5 Use a design system -->
    <div v-else-if="id === 'P5'" class="buttons">
      <span class="sys a">Save</span><span class="sys b">Cancel</span><span class="sys c">Share</span>
    </div>

    <!-- P6 Show the actual product -->
    <div v-else-if="id === 'P6'" class="hero">
      <template v-if="!after"><span class="blob one" /><span class="blob two" /><strong>All-in-one, reimagined</strong></template>
      <div v-else class="screen">
        <span v-for="t in ['Pay rent', 'Call the bank', 'Book flights']" :key="t" class="task"><span class="box" />{{ t }}</span>
      </div>
    </div>

    <!-- P7 Enlarge the main feature -->
    <div v-else-if="id === 'P7'" class="features">
      <span class="f main">Sync</span><span class="f">Themes</span><span class="f">Export</span>
    </div>

    <!-- P8 Group with spacing -->
    <div v-else-if="id === 'P8'" class="groups">
      <span class="g-head">Account</span><span class="g">Name</span><span class="g">Email</span>
      <span class="g-head">Alerts</span><span class="g">Push</span><span class="g">Email</span>
    </div>

    <!-- P9 Make headlines specific -->
    <h4 v-else-if="id === 'P9'" class="headline">{{ after ? 'Send an invoice in 30 seconds' : 'Unlock the future of productivity' }}</h4>

    <!-- P10 Emphasize the CTA -->
    <div v-else-if="id === 'P10'" class="buttons">
      <span class="cta">Start free trial</span><span class="cta two">See pricing</span><span class="cta three">Contact sales</span>
    </div>

    <!-- P11 Add an accent colour -->
    <div v-else-if="id === 'P11'" class="accents">
      <span class="pill one">Buy</span><span class="pill two">Save</span><span class="pill three">Share</span><span class="link-ish">Details</span>
    </div>

    <!-- P12 Keep icons consistent -->
    <div v-else-if="id === 'P12'" class="icons">
      <template v-if="!after">
        <AppIcon name="house" class="thin" /><span class="emoji">⚙️</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor" /></svg><AppIcon name="bell" class="thick" />
      </template>
      <template v-else>
        <AppIcon name="house" /><AppIcon name="settings" /><AppIcon name="user" /><AppIcon name="bell" />
      </template>
    </div>

    <!-- P13 Remove embellishments -->
    <div v-else-if="id === 'P13'" class="fancy">
      <span v-if="!after" class="spark">✨</span>
      <strong>Pro plan</strong>
      <span>$12 a month</span>
      <span v-if="!after" class="spark two">✨</span>
    </div>

    <!-- P14 Inner radius = outer − padding -->
    <div v-else-if="id === 'P14'" class="nest">
      <span class="in">{{ after ? 'radius 16' : 'radius 24' }}</span>
      <small>outer 24 · padding 8</small>
    </div>

    <!-- P15 Improve text contrast -->
    <div v-else-if="id === 'P15'" class="contrast">
      <strong>Your plan renews</strong>
      <span>on 3 May, for $12</span>
    </div>

    <!-- P16 Wrap headlines properly -->
    <h4 v-else-if="id === 'P16'" class="wrap">Track every subscription you pay for</h4>

    <!-- P17 Align by eye, not pixels -->
    <span v-else-if="id === 'P17'" class="playbtn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.75 4.5v15L18.25 12z" fill="currentColor" /></svg></span>

    <!-- P18 Use tabular nums -->
    <span v-else-if="id === 'P18'" class="ticker">${{ tick.toLocaleString('en-US') }}.11</span>

    <!-- P19 Add loading state -->
    <div v-else-if="id === 'P19'" class="loadbox">
      <button type="button" class="btn btn-sm" @click="load">Load messages</button>
      <div class="msgs">
        <template v-if="loading === 'busy' && after"><span class="skeleton line" /><span class="skeleton line short" /><span class="skeleton line" /></template>
        <template v-else-if="loading === 'done'"><span>Dara: See you at 6</span><span>Mom: Call me back</span><span>Bank: Payment received</span></template>
      </div>
    </div>

    <!-- P20 Animate useful feedback -->
    <div v-else-if="id === 'P20'" class="feedback">
      <span v-if="!after" class="bouncer">🛒</span>
      <button type="button" class="btn btn-sm" :class="{ done: added }" @click="add">
        <AppIcon v-if="added" name="check" />{{ added ? 'Added' : 'Add to cart' }}
      </button>
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

/* P1 */
.product {
  display: grid;
  gap: 0.3rem;
  width: 11rem;
  padding: 0.6rem;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
}

.pic {
  height: 2.5rem;
  background: var(--surface-2);
  border-radius: 6px;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.badges b {
  padding: 0.05rem 0.4rem;
  font-size: 0.6rem;
  color: #fff;
  background: #e8590c;
  border-radius: 99px;
}

.badges b:nth-child(2n) {
  background: #7c3aed;
}

.badges b.good {
  font-size: var(--text-2xs);
  color: var(--good-ink);
  background: color-mix(in oklab, var(--green) 14%, var(--surface));
}

/* P2 */
.form {
  display: grid;
  gap: 0.35rem;
  width: min(14rem, 100%);
}

.lbl {
  font-size: var(--text-sm);
  font-weight: 650;
}

.fake {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.5rem;
  padding: 0 0.75rem;
  color: var(--ink-3);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.form small {
  color: var(--ink-3);
}

/* P3 */
.para {
  max-width: 17rem;
  margin: 0;
}

.p3.after em {
  font-style: normal;
}

/* P4 */
.order {
  display: grid;
  gap: 0.15rem;
  padding: 0.8rem 1rem;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
}

.p4:not(.after) .order {
  font-family: var(--font-mono);
}

.order code {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--ink-2);
}

/* P5 */
.buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.sys {
  display: inline-grid;
  place-items: center;
  min-height: 2.5rem;
  padding: 0 1rem;
  font-weight: 650;
  color: #fff;
  background: var(--accent-btn, var(--accent));
  border-radius: var(--radius);
}

.p5.after .sys.b,
.p5.after .sys.c {
  color: var(--ink);
  background: var(--surface);
  box-shadow: inset 0 0 0 1px var(--border);
}

.p5:not(.after) .sys.a { border-radius: 2px; padding: 0 0.4rem; }
.p5:not(.after) .sys.b { border-radius: 99px; background: #0d9488; min-height: 2rem; font-size: 0.8rem; }
.p5:not(.after) .sys.c { border-radius: 14px 0; background: #4f46e5; padding: 0 1.6rem; font-style: italic; }

/* P6 */
.hero {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 7rem;
}

.blob {
  position: absolute;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 46% 54% 42% 58%;
  background: linear-gradient(135deg in oklch, var(--accent), #facc15);
  opacity: 0.6;
}

.blob.one { left: 18%; top: 0.5rem; }
.blob.two { right: 18%; bottom: 0.5rem; width: 3rem; height: 3rem; }

.hero strong {
  position: relative;
  font-size: var(--text-lg);
}

.screen {
  display: grid;
  gap: 0.35rem;
  width: 12rem;
  padding: 0.6rem;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
}

.task {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: var(--text-sm);
}

.task .box {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid var(--accent);
  border-radius: 4px;
}

/* P7 */
.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
  width: min(15rem, 100%);
}

.f {
  display: grid;
  place-items: center;
  height: 3.5rem;
  font-size: var(--text-sm);
  font-weight: 650;
  background: var(--surface);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
}

.p7.after .features {
  grid-template-columns: 2fr 1fr;
}

.p7.after .f.main {
  grid-row: span 2;
  height: auto;
  font-size: var(--text-lg);
  color: #fff;
  background: var(--accent-btn, var(--accent));
}

.p7.after .f:not(.main) {
  height: 2.5rem;
}

/* P8 */
.groups {
  display: grid;
  width: min(13rem, 100%);
  font-size: var(--text-sm);
}

.g-head {
  font-weight: 700;
}

.p8:not(.after) .groups > * {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--ink-3);
  border-bottom-width: 0;
}

.p8:not(.after) .groups > :last-child {
  border-bottom-width: 1px;
}

.p8.after .groups {
  gap: 0.1rem;
}

.p8.after .g-head {
  margin-top: 0.6rem;
  font-size: var(--text-xs);
  color: var(--ink-2);
}

.p8.after .g-head:first-child {
  margin-top: 0;
}

/* P9 */
.headline {
  max-width: 15rem;
  margin: 0;
  font-size: var(--text-xl);
  line-height: 1.15;
  text-align: center;
  text-wrap: balance;
}

/* P10 */
.cta {
  display: inline-grid;
  place-items: center;
  min-height: 2.5rem;
  padding: 0 0.9rem;
  font-size: var(--text-sm);
  font-weight: 650;
  color: #fff;
  background: var(--accent-btn, var(--accent));
  border-radius: var(--radius);
}

.p10.after .cta.two,
.p10.after .cta.three {
  color: var(--ink);
  background: none;
  box-shadow: inset 0 0 0 1px var(--border);
}

.p10.after .cta.three {
  box-shadow: none;
  text-decoration: underline;
}

/* P11 */
.accents {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.pill {
  padding: 0.4rem 0.9rem;
  font-size: var(--text-sm);
  font-weight: 650;
  color: #fff;
  background: var(--accent-btn, var(--accent));
  border-radius: var(--radius-pill);
}

.link-ish {
  font-weight: 650;
  color: var(--accent);
  text-decoration: underline;
}

.p11:not(.after) .pill.two { background: #0f9488; }
.p11:not(.after) .pill.three { background: #e8590c; }
.p11:not(.after) .link-ish { color: #7c3aed; }

.p11.after .pill.two,
.p11.after .pill.three {
  color: var(--ink);
  background: var(--surface);
  box-shadow: inset 0 0 0 1px var(--border);
}

/* P12 */
.icons {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 1.6rem;
}

.icons svg {
  width: 1em;
  height: 1em;
}

.icons .thin :deep(path),
.icons .thin {
  stroke-width: 1;
}

.icons .thick {
  stroke-width: 3;
}

.emoji {
  font-size: 1.4rem;
}

/* P13 */
.fancy {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.15rem;
  padding: 1rem 1.5rem;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.p13:not(.after) .fancy {
  color: #fff;
  background: linear-gradient(135deg, #f43f5e, #8b5cf6, #06b6d4);
  box-shadow: 0 0 24px #f0f, 0 0 0 4px #fde047, 6px 6px 0 #000;
  text-shadow: 0 0 8px #fff;
}

.spark {
  position: absolute;
  top: -0.6rem;
  left: -0.6rem;
}

.spark.two {
  top: auto;
  left: auto;
  right: -0.6rem;
  bottom: -0.6rem;
}

/* P14 */
.nest {
  display: grid;
  justify-items: center;
  gap: 0.4rem;
  padding: 8px;
  background: var(--surface);
  border-radius: 24px;
  box-shadow: var(--shadow-md);
}

.in {
  display: grid;
  place-items: center;
  width: 10rem;
  height: 3rem;
  font-weight: 650;
  color: #fff;
  background: var(--accent-btn, var(--accent));
  border-radius: 24px;
}

.p14.after .in {
  border-radius: 16px;
}

.nest small {
  color: var(--ink-3);
}

/* P15: a white card either way, so the ratios hold in both themes */
.contrast {
  display: grid;
  gap: 0.1rem;
  padding: 0.85rem 1.1rem;
  color: #bcc1ca;
  background: #fff;
  border-radius: var(--radius);
}

.p15.after .contrast {
  color: #555d70;
}

.p15.after .contrast strong {
  color: #1b1f2a;
}

/* P16: the same width, wrapped plainly or balanced */
.wrap {
  width: 15rem;
  margin: 0;
  font-size: var(--text-xl);
  line-height: 1.15;
  text-wrap: wrap;
}

.p16.after .wrap {
  text-wrap: balance;
}

/* P17: the triangle centred by its box sits too far left; nudged right it looks centred */
.playbtn {
  display: grid;
  place-items: center;
  width: 4rem;
  height: 4rem;
  color: #fff;
  background: var(--accent-btn, var(--accent));
  border-radius: 50%;
}

.playbtn svg {
  width: 1.6rem;
  height: 1.6rem;
}

/* The triangle's box is centred either way (the path is); after, it moves right by about 8% of its width */
.p17.after .playbtn svg {
  translate: 0.13rem 0;
}

/* P18: centred, so a number changing width moves sideways */
.ticker {
  font-size: var(--text-2xl);
  font-weight: 800;
  font-variant-numeric: proportional-nums;
}

.p18.after .ticker {
  font-variant-numeric: tabular-nums;
}

/* P19 */
.loadbox {
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  width: min(14rem, 100%);
}

.msgs {
  display: grid;
  gap: 0.35rem;
  width: 100%;
  min-height: 4.6rem;
  font-size: var(--text-sm);
}

.line {
  height: 0.85rem;
}

.line.short {
  width: 60%;
}

/* P20 */
.feedback {
  display: grid;
  justify-items: center;
  gap: 0.6rem;
}

.bouncer {
  font-size: 1.6rem;
  animation: p20-bounce 0.6s ease-in-out infinite alternate;
}

@keyframes p20-bounce {
  to { translate: 0 -0.6rem; }
}

.feedback .btn.done {
  background: var(--green-btn);
  animation: p20-confirm 0.3s var(--ease-out);
}

@keyframes p20-confirm {
  50% { scale: 1.06; }
}
</style>
