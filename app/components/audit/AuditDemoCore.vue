<script setup lang="ts">
// Core principles C1–C20: the same element, Before (`after` false) and After. `run` restarts the
// animation: the root is keyed by it, so Play builds it afresh.
const props = defineProps<{ id: string, after: boolean, run: number }>()

// C8: like
const liked = ref(false)

// C10: save
const saved = ref(false)
function save() {
  saved.value = true
  setTimeout(() => { saved.value = false }, 1600)
}

// C17: load
const load = ref<'idle' | 'busy' | 'done'>('idle')
function startLoad() {
  if (load.value === 'busy') return
  // Before: nothing shows until it's done. After: it answers at once with a spinner
  load.value = props.after ? 'busy' : 'idle'
  setTimeout(() => { load.value = 'done' }, 1500)
}

// C18: an amount
const amount = ref('$1,000.50')
const parsed = computed(() => {
  const raw = props.after ? amount.value.replace(/[\s$,]/g, '') : amount.value
  return /^\d+(\.\d+)?$/.test(raw) ? Number(raw).toLocaleString('en-US', { minimumFractionDigits: 2 }) : undefined
})
</script>

<template>
  <div :key="run" class="d" :class="[id.toLowerCase(), { after }]">
    <!-- C1 Squash & stretch -->
    <template v-if="id === 'C1'">
      <span class="ball" /><span class="floor" />
    </template>

    <!-- C2 Anticipation -->
    <template v-else-if="id === 'C2'">
      <span class="box" /><span class="floor" />
    </template>

    <!-- C3 Staging -->
    <div v-else-if="id === 'C3'" class="cards">
      <span v-for="i in 4" :key="i" class="mini" :class="{ new: i === 3 }" />
    </div>

    <!-- C4 Pose to pose -->
    <span v-else-if="id === 'C4'" class="box grow" />

    <!-- C5 Follow through -->
    <span v-else-if="id === 'C5'" class="panel-slide">Panel</span>

    <!-- C6 Slow in & slow out -->
    <div v-else-if="id === 'C6'" class="track"><span class="ball move" /></div>

    <!-- C7 Arcs -->
    <div v-else-if="id === 'C7'" class="arc-area">
      <span class="from" /><span class="to" />
      <span class="x"><span class="y"><span class="ball" /></span></span>
    </div>

    <!-- C8 Secondary action -->
    <button v-else-if="id === 'C8'" type="button" class="heart" :class="{ liked }" :aria-pressed="liked" aria-label="Like" @click="liked = !liked">
      <AppIcon name="heart" />
    </button>

    <!-- C9 Snappy timing -->
    <div v-else-if="id === 'C9'" class="menu-demo">
      <span class="trigger">Menu</span>
      <span class="menu"><i /><i /><i /></span>
    </div>

    <!-- C10 Exaggerated feedback -->
    <button v-else-if="id === 'C10'" type="button" class="save" :class="{ saved }" @click="save">
      <AppIcon v-if="saved && after" name="check" />{{ saved ? 'Saved' : 'Save' }}
    </button>

    <!-- C11 Solid drawing in 3D -->
    <div v-else-if="id === 'C11'" class="shadows">
      <span v-for="i in 3" :key="i" :class="`s${i}`" />
    </div>

    <!-- C12 Overall appeal -->
    <div v-else-if="id === 'C12'" class="profile">
      <span class="avatar">SK</span>
      <span class="who"><strong>Sokha Kim</strong><small>Product designer</small></span>
      <span class="follow">Follow</span>
    </div>

    <!-- C13 Fitts's law -->
    <div v-else-if="id === 'C13'" class="dialog">
      <p>Delete this file?</p>
      <span v-if="!after" class="tiny">yes</span>
      <span v-else class="actions"><span class="b quiet">Cancel</span><span class="b danger">Delete</span></span>
    </div>

    <!-- C14 Bigger hit areas -->
    <button v-else-if="id === 'C14'" type="button" class="close" aria-label="Close"><AppIcon name="x" /></button>

    <!-- C15 Hick's law -->
    <div v-else-if="id === 'C15'" class="choices">
      <template v-if="!after">
        <span v-for="c in ['Standard', 'Express', 'Next day', 'Pickup', 'Locker', 'Same day', 'Evening', 'Weekend', 'Eco', 'Drone']" :key="c">{{ c }}</span>
      </template>
      <template v-else>
        <span v-for="c in ['Standard', 'Express', 'Pickup']" :key="c">{{ c }}</span><span class="more">More options</span>
      </template>
    </div>

    <!-- C16 Miller's law -->
    <dl v-else-if="id === 'C16'" class="chunks">
      <dt>Card</dt><dd>{{ after ? '4242 4242 4242 4242' : '4242424242424242' }}</dd>
      <dt>Phone</dt><dd>{{ after ? '012 345 678' : '012345678' }}</dd>
    </dl>

    <!-- C17 Doherty threshold -->
    <div v-else-if="id === 'C17'" class="loader">
      <button type="button" class="btn btn-sm" @click="startLoad">Load</button>
      <span v-if="load === 'busy'" class="busy"><span class="spin" />Loading…</span>
      <span v-else-if="load === 'done'" class="done">Loaded</span>
    </div>

    <!-- C18 Postel's law -->
    <div v-else-if="id === 'C18'" class="postel">
      <input v-model="amount" class="input" aria-label="Amount" inputmode="decimal">
      <span v-if="parsed" class="ok">Amount: {{ parsed }}</span>
      <span v-else class="bad">Not a number</span>
    </div>

    <!-- C19 Jakob's law -->
    <div v-else-if="id === 'C19'" class="site-head">
      <template v-if="!after">
        <AppIcon name="shopping-cart" /><span class="spacer" /><AppIcon name="menu" /><span class="spacer" /><strong>Shop</strong>
      </template>
      <template v-else>
        <strong>Shop</strong><span class="spacer" /><AppIcon name="search" /><AppIcon name="shopping-cart" />
      </template>
    </div>

    <!-- C20 Frequency of use -->
    <div v-else-if="id === 'C20'" class="mailbar">
      <template v-if="!after">
        <AppIcon name="settings" /><AppIcon name="archive" /><AppIcon name="tag" /><span class="hidden-in">⋯ <small>Compose is in here</small></span>
      </template>
      <template v-else>
        <span class="b primary"><AppIcon name="pencil" />Compose</span><span class="spacer" /><AppIcon name="ellipsis" />
      </template>
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

.ball {
  width: 1.25rem;
  height: 1.25rem;
  background: var(--accent);
  border-radius: 50%;
}

.box {
  width: 2rem;
  height: 2rem;
  background: var(--accent);
  border-radius: var(--radius-xs);
}

.floor {
  position: absolute;
  left: 15%;
  right: 15%;
  bottom: 1.4rem;
  height: 2px;
  background: var(--line);
}

/* C1 */
.c1 .ball {
  transform-origin: 50% 100%;
  animation: c1-drop 0.55s ease-in both;
}

.c1.after .ball {
  animation: c1-drop 0.55s ease-in both, c1-squash 0.4s 0.55s ease-out;
}

@keyframes c1-drop {
  from { translate: 0 -3.25rem; }
  to { translate: 0 2.15rem; }
}

@keyframes c1-squash {
  0% { scale: 1.4 0.6; }
  60% { scale: 0.92 1.08; }
  100% { scale: 1; }
}

/* C2 */
.c2 .box {
  translate: 0 1.4rem;
  transform-origin: 50% 100%;
  animation: c2-jump 0.6s ease-out 0.2s both;
}

.c2.after .box {
  animation: c2-windup 0.9s ease-in-out 0.2s both;
}

@keyframes c2-jump {
  50% { translate: 0 -1.8rem; }
}

@keyframes c2-windup {
  30% { translate: 0 1.4rem; scale: 1.15 0.8; }
  65% { translate: 0 -1.8rem; scale: 0.95 1.05; }
  100% { translate: 0 1.4rem; scale: 1; }
}

/* C3 */
.cards {
  display: flex;
  gap: 0.5rem;
}

.mini {
  width: 2.25rem;
  height: 3rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  animation: c3-wiggle 0.5s ease-in-out 3;
}

.mini.new {
  background: color-mix(in oklab, var(--accent) 20%, var(--surface));
}

.c3.after .mini {
  animation: none;
}

.c3.after .mini.new {
  animation: c3-pop 0.5s var(--ease-out) 2;
}

@keyframes c3-wiggle {
  25% { rotate: -6deg; translate: 0 -3px; }
  75% { rotate: 6deg; translate: 0 3px; }
}

@keyframes c3-pop {
  50% { scale: 1.12; box-shadow: 0 0 0 6px color-mix(in oklab, var(--accent) 25%, transparent); }
}

/* C4: before, width grows on its own and then it moves; after, one move between two states */
.c4 .grow {
  justify-self: start;
  margin-left: 10%;
  animation: c4-wide 0.7s linear 0.2s both, c4-move 0.5s ease-in 0.9s both;
}

.c4.after .grow {
  animation: c4-both 0.6s var(--ease-in-out) 0.2s both;
}

@keyframes c4-wide {
  to { width: 4rem; }
}

@keyframes c4-move {
  to { translate: 6rem 0; }
}

@keyframes c4-both {
  to { width: 4rem; translate: 6rem 0; }
}

/* C5 */
.panel-slide {
  padding: 0.75rem 1.25rem;
  font-weight: 650;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  animation: c5-in 0.45s linear both;
}

.c5.after .panel-slide {
  animation: c5-settle 0.6s var(--ease-out) both;
}

@keyframes c5-in {
  from { translate: -8rem 0; }
}

@keyframes c5-settle {
  0% { translate: -8rem 0; }
  70% { translate: 0.45rem 0; }
  100% { translate: 0 0; }
}

/* C6 */
.track {
  position: relative;
  width: 80%;
  height: 1.25rem;
  border-bottom: 2px dashed var(--line);
}

.move {
  position: absolute;
  left: 0;
  animation: c6-go 1.2s linear 0.2s both;
}

.c6.after .move {
  animation-timing-function: var(--ease-in-out);
}

@keyframes c6-go {
  to { left: calc(100% - 1.25rem); }
}

/* C7: the ball rides two layers, one moving across and one up. Same curve on both draws a straight
   line; different curves bend it into an arc */
.arc-area {
  position: relative;
  width: 80%;
  height: 7rem;
}

.from,
.to {
  position: absolute;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--line);
}

.from {
  left: 0.4rem;
  bottom: 0.4rem;
}

.to {
  right: 0.4rem;
  top: 0.4rem;
}

.x,
.y {
  position: absolute;
  inset: 0;
}

.x .ball {
  position: absolute;
  left: 0;
  bottom: 0;
}

.c7 .x {
  animation: c7-x 1s ease-in-out 0.2s both;
}

.c7 .y {
  animation: c7-y 1s ease-in-out 0.2s both;
}

.c7.after .x {
  animation-timing-function: cubic-bezier(0.5, 0, 0.9, 0.6);
}

.c7.after .y {
  animation-timing-function: cubic-bezier(0.1, 0.5, 0.4, 1);
}

@keyframes c7-x {
  to { translate: calc(100% - 1.25rem) 0; }
}

@keyframes c7-y {
  to { translate: 0 calc(-100% + 1.25rem); }
}

/* C8 */
.heart {
  position: relative;
  display: grid;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  font-size: 1.6rem;
  color: var(--ink-2);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 50%;
  cursor: pointer;
}

.heart.liked {
  color: var(--red);
}

.heart.liked :deep(svg) {
  fill: currentColor;
}

.c8.after .heart.liked {
  animation: c8-pop 0.35s var(--ease-out);
}

.c8.after .heart.liked::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  border: 3px solid var(--red);
  animation: c8-ring 0.5s var(--ease-out) both;
}

@keyframes c8-pop {
  50% { scale: 1.15; }
}

@keyframes c8-ring {
  from { scale: 0.8; opacity: 1; }
  to { scale: 1.6; opacity: 0; }
}

/* C9 */
.menu-demo {
  position: relative;
  display: grid;
  justify-items: start;
  gap: 0.3rem;
  width: 10rem;
}

.trigger {
  padding: 0.3rem 0.7rem;
  font-size: var(--text-sm);
  font-weight: 650;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.menu {
  display: grid;
  gap: 0.4rem;
  width: 100%;
  padding: 0.6rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  transform-origin: top left;
  animation: c9-open 0.9s var(--ease-out) 0.2s both;
}

.menu i {
  height: 0.45rem;
  background: var(--line);
  border-radius: 99px;
}

.c9.after .menu {
  animation-duration: 0.2s;
}

@keyframes c9-open {
  from { opacity: 0; scale: 0.95; translate: 0 -4px; }
}

/* C10 */
.save {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.75rem;
  padding: 0 1.25rem;
  font: inherit;
  font-weight: 650;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
}

.c10.after .save.saved {
  color: #fff;
  background: var(--green-btn);
  border-color: transparent;
  animation: c8-pop 0.3s var(--ease-out);
}

/* C11 */
.shadows {
  display: flex;
  gap: 1rem;
}

.shadows span {
  width: 3rem;
  height: 3.5rem;
  background: var(--surface);
  border-radius: var(--radius-sm);
  box-shadow: 0 8px 18px -8px rgb(var(--shadow) / 0.45);
}

.c11:not(.after) .s1 { box-shadow: -8px 8px 4px rgb(var(--shadow) / 0.35); }
.c11:not(.after) .s2 { box-shadow: 8px -6px 14px rgb(var(--shadow) / 0.3); }
.c11:not(.after) .s3 { box-shadow: 0 0 0 3px rgb(var(--shadow) / 0.5); }

/* C12 */
.profile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.avatar {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  border-radius: 50%;
}

.who {
  display: grid;
  line-height: 1.2;
}

.who small {
  color: var(--ink-2);
}

.follow {
  padding: 0.35rem 0.8rem;
  font-size: var(--text-sm);
  font-weight: 650;
  color: #fff;
  background: var(--accent-btn, var(--accent));
  border-radius: var(--radius-pill);
}

.c12:not(.after) .profile {
  gap: 0.2rem;
  padding: 0.3rem;
  border: 2px solid #888;
  border-radius: 0;
  box-shadow: 4px 4px 0 #f0f;
}

.c12:not(.after) .avatar {
  border-radius: 2px;
  background: #3cf;
}

.c12:not(.after) .who {
  text-align: center;
}

.c12:not(.after) .follow {
  margin-top: 1rem;
  background: #f00;
  border-radius: 12px 0;
}

/* C13 */
.dialog {
  position: relative;
  width: 12rem;
  padding: 1rem;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.dialog p {
  margin: 0 0 0.75rem;
  font-weight: 650;
}

.tiny {
  position: absolute;
  top: 0.3rem;
  right: 0.4rem;
  font-size: 0.6rem;
  color: var(--ink-3);
  text-decoration: underline;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}

.b {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 2.5rem;
  padding: 0 0.85rem;
  font-size: var(--text-sm);
  font-weight: 650;
  border-radius: var(--radius-sm);
}

.b.quiet {
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--border);
}

.b.danger {
  color: #fff;
  background: var(--red);
}

.b.primary {
  color: #fff;
  background: var(--accent-btn, var(--accent));
}

/* C14: the dashed outline is the area that takes the tap */
.close {
  display: grid;
  place-items: center;
  width: 1.15rem;
  height: 1.15rem;
  padding: 0;
  font-size: 0.85rem;
  color: var(--ink);
  background: none;
  border: 0;
  outline: 2px dashed color-mix(in oklab, var(--red) 70%, transparent);
  outline-offset: 0;
  border-radius: 4px;
  cursor: pointer;
}

.c14.after .close {
  width: 2.75rem;
  height: 2.75rem;
  outline-color: color-mix(in oklab, var(--green) 70%, transparent);
  border-radius: var(--radius-sm);
}

.close:active {
  background: var(--line);
}

/* C15 */
.choices {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.3rem;
  max-width: 16rem;
}

.choices span {
  padding: 0.25rem 0.6rem;
  font-size: var(--text-xs);
  font-weight: 600;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
}

.c15.after .choices span {
  padding: 0.45rem 0.9rem;
  font-size: var(--text-sm);
}

.choices .more {
  color: var(--accent);
  border-style: dashed;
}

/* C16 */
.chunks {
  display: grid;
  grid-template-columns: auto auto;
  gap: 0.4rem 0.9rem;
  margin: 0;
}

.chunks dt {
  color: var(--ink-2);
}

.chunks dd {
  margin: 0;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

/* C17 */
.loader {
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  min-height: 5rem;
}

.busy,
.done {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--text-sm);
  font-weight: 600;
}

.done {
  color: var(--good-ink);
}

.spin {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { rotate: 1turn; }
}

/* C18 */
.postel {
  display: grid;
  gap: 0.5rem;
  width: min(14rem, 100%);
}

.ok {
  font-weight: 650;
  color: var(--good-ink);
}

.bad {
  font-weight: 650;
  color: var(--bad-ink);
}

/* C19, C20: a bar across the top of a page */
.site-head,
.mailbar {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1.1rem;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
}

.spacer {
  flex: 1;
}

.hidden-in {
  display: grid;
  line-height: 1;
  text-align: center;
}

.hidden-in small {
  font-size: 0.6rem;
  color: var(--ink-3);
}
</style>
