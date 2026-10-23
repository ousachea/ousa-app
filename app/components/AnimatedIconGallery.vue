<script setup lang="ts">
import { toast } from 'vue-sonner'
import { ANIMATED_ICONS, ANIMATED_ICON_NAMES, type AnimatedIconName, type AnimatedTrigger } from '~/utils/animatedIcons'

// Settings → Logos & icons → Animated: every <AnimatedIcon>, to see moving and copy into any app.
// The Icons / Logos / Animated switch comes in through the `switch` slot, at the head of the controls. Point at a card
// (or Tab to it) to play its icon; the switch previews them all with one trigger instead of their own.
const { play } = useSound()
const query = ref('')
type Preview = 'own' | AnimatedTrigger
const preview = ref<Preview>('own')
const PREVIEWS: { value: Preview, label: string }[] = [
  { value: 'own', label: 'Their own' },
  { value: 'hover', label: 'Hover' },
  { value: 'click', label: 'Click' },
  { value: 'loop', label: 'Loop' }
]
const TRIGGER_TEXT: Record<AnimatedTrigger, string> = {
  hover: 'On hover',
  click: 'On click',
  loop: 'Loops',
  manual: 'When a value changes'
}

const GROUPS = ['Actions', 'Status', 'Objects', 'Navigation'] as const
const groups = computed(() => {
  const q = query.value.trim().toLowerCase()
  return GROUPS.map(g => ({
    name: g,
    icons: ANIMATED_ICON_NAMES.filter((n) => {
      const d = ANIMATED_ICONS[n]
      return d.group === g && (!q || `${n} ${d.label} ${d.use}`.toLowerCase().includes(q))
    })
  })).filter(g => g.icons.length)
})
const count = computed(() => groups.value.reduce((n, g) => n + g.icons.length, 0))

// What a card previews with: the switch, or the icon's own; "manual" plays on hover here, so it can be seen
const triggerFor = (n: AnimatedIconName): AnimatedTrigger => {
  const t = preview.value === 'own' ? ANIMATED_ICONS[n].trigger : preview.value
  return t === 'manual' ? 'hover' : t
}

const icons = ref<Record<string, { play: () => void }>>({})
function playAll() {
  play('select')
  groups.value.flatMap(g => g.icons).forEach((n, i) => setTimeout(() => icons.value[n]?.play(), i * 45))
}

const codeFor = (n: AnimatedIconName) => {
  const t = ANIMATED_ICONS[n].trigger
  return t === 'hover' ? `<AnimatedIcon name="${n}" />` : t === 'manual' ? `<AnimatedIcon name="${n}" trigger="manual" :play="count" />` : `<AnimatedIcon name="${n}" trigger="${t}" />`
}
async function copy(n: AnimatedIconName) {
  try {
    await navigator.clipboard.writeText(codeFor(n))
    toast.success('Code copied', { description: ANIMATED_ICONS[n].label })
    play('success')
  } catch {
    toast.error('Couldn’t copy')
  }
}
</script>

<template>
  <div class="gallery">
    <section class="panel controls">
      <slot name="switch" />
      <label class="search">
        <AppIcon name="search" />
        <input v-model="query" type="search" placeholder="Find an icon" aria-label="Find an animated icon">
      </label>
      <div class="segmented previews" role="radiogroup" aria-label="Preview with">
        <label v-for="p in PREVIEWS" :key="p.value" :class="{ active: preview === p.value }">
          <input v-model="preview" type="radio" name="ai-preview" :value="p.value">{{ p.label }}
        </label>
      </div>
      <button type="button" class="btn btn-sm" @click="playAll">Play all</button>
      <p class="note">
        Point at an icon, or Tab to it, to see it move. They look the same as <code>&lt;AppIcon&gt;</code> until they play, so you can swap one for the other.
        The drawings are Lucide's, split into the parts that move, in <code>utils/animatedIcons.ts</code>; the motion is in <code>components/AnimatedIcon.vue</code>.
        Nothing moves with reduced motion turned on.
      </p>
    </section>

    <section class="panel usage">
      <h3>How to use one</h3>
      <pre class="code"><code>&lt;button&gt;&lt;AnimatedIcon name="trash-2" /&gt; Delete&lt;/button&gt;   <span>plays when its button is hovered or focused</span>
&lt;AnimatedIcon name="send" trigger="click" /&gt;                <span>plays when its button is clicked</span>
&lt;AnimatedIcon name="wifi" trigger="loop" /&gt;                 <span>repeats every few seconds while on screen</span>
&lt;AnimatedIcon name="check" trigger="manual" :play="saved" /&gt; <span>plays each time `saved` changes</span>
&lt;AnimatedIcon name="bell" :size="20" label="Reminders" /&gt;   <span>a size in pixels; a label when it stands alone</span></code></pre>
    </section>

    <p v-if="!count" class="empty">No animated icon matches “{{ query }}”.</p>

    <template v-for="g in groups" :key="g.name">
      <h3 class="group-head">{{ g.name }} <span>{{ g.icons.length }}</span></h3>
      <div class="grid">
        <article v-for="n in g.icons" :key="n" class="panel card">
          <button type="button" class="demo" :aria-label="`${ANIMATED_ICONS[n].label}: play`">
            <AnimatedIcon :ref="(c: any) => { if (c) icons[n] = c }" :name="n" :trigger="triggerFor(n)" />
          </button>
          <div class="text">
            <strong>{{ ANIMATED_ICONS[n].label }}</strong>
            <span class="use">{{ ANIMATED_ICONS[n].use }}</span>
            <span class="meta"><code>{{ n }}</code> · {{ TRIGGER_TEXT[ANIMATED_ICONS[n].trigger] }}</span>
          </div>
          <button type="button" class="btn btn-quiet btn-sm copy" :aria-label="`Copy the code for ${ANIMATED_ICONS[n].label}`" @click="copy(n)">
            <AppIcon name="copy" />Copy
          </button>
        </article>
      </div>
    </template>
  </div>
</template>

<style scoped>
.gallery {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  padding: 1.1rem 1.25rem;
}

.search {
  flex: 1 1 14rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem;
  min-height: 2.4rem;
  color: var(--ink-3);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.search:focus-within {
  border-color: var(--accent);
}

.search input {
  flex: 1;
  min-width: 0;
  font: inherit;
  color: var(--ink);
  background: none;
  border: 0;
  outline: none;
}

.previews {
  font-size: var(--text-sm);
}

.previews label {
  padding: 0.3rem 0.7rem;
  white-space: nowrap;
}

.note {
  flex-basis: 100%;
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.usage {
  padding: 1.1rem 1.25rem;
}

.usage h3 {
  margin: 0 0 0.6rem;
  font-size: var(--text-md);
}

.code {
  margin: 0;
  padding: 0.75rem 0.85rem;
  overflow-x: auto;
  font-size: var(--text-xs);
  line-height: 1.7;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--line);
}

.code span {
  color: var(--ink-3);
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.empty {
  margin: 0;
  padding: 1.5rem;
  text-align: center;
  color: var(--ink-3);
}

.group-head {
  margin: 0.5rem 0 0;
  font-size: var(--text-sm);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.group-head span {
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
  opacity: 0.7;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  gap: 0.75rem;
}

.card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: 1fr auto;
  gap: 0.5rem 0.9rem;
  padding: 0.9rem 1rem;
  min-width: 0;
}

.demo {
  grid-row: span 2;
  width: 4rem;
  height: 4rem;
  display: grid;
  place-items: center;
  padding: 0;
  font-size: 1.85rem;
  color: var(--ink);
  background: var(--surface-2);
  border: 0;
  border-radius: var(--radius-lg);
  box-shadow: inset 0 0 0 1px var(--line);
  cursor: pointer;
  transition: color var(--dur-fast), background-color var(--dur-fast), scale var(--dur-fast);
}

.demo:hover {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}

.demo:active {
  scale: 0.95;
}

.demo:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.text strong {
  font-size: var(--text-md);
}

.use {
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.meta {
  margin-top: 0.15rem;
  font-size: var(--text-xs);
  color: var(--ink-3);
}

.copy {
  justify-self: start;
  gap: 0.35rem;
}
</style>
