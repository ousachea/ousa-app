<script setup lang="ts">
import { toast } from 'vue-sonner'

// Compare two texts word by word (CHECKLIST.md #52, #53). Side by side on wide screens: the original
// with what was removed, the new version with what was added. Inline puts it all in one column.
// Phones stack everything. Added text is underlined, removed text struck through, changes show both,
// so colour is never the only clue; screen readers hear <ins> and <del>.
const { play } = useSound()
const original = ref('')
const modified = ref('')
const ignoreCase = useRemembered('compare-ignore-case', false, v => typeof v === 'boolean')
const ignoreWhitespace = useRemembered('compare-ignore-space', true, v => typeof v === 'boolean')
const layout = useRemembered<'side' | 'inline'>('compare-layout', 'side', v => v === 'side' || v === 'inline')

// Big texts are compared a moment after typing stops, so typing never lags
const settled = ref({ a: '', b: '' })
let timer: ReturnType<typeof setTimeout> | undefined
watch([original, modified], ([a, b]) => {
  clearTimeout(timer)
  const delay = a.length + b.length > 20_000 ? 250 : 0
  if (!delay) settled.value = { a, b }
  else timer = setTimeout(() => (settled.value = { a, b }), delay)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))

const parts = computed(() => diffText(settled.value.a, settled.value.b, { ignoreCase: ignoreCase.value, ignoreWhitespace: ignoreWhitespace.value }))
const stats = computed(() => diffStats(parts.value))
const ready = computed(() => !!(original.value.trim() && modified.value.trim()))

// Demo: two versions of a note
const DEMO_A = `Hi team,

The new office opens in Phnom Penh next month. Please bring your ID card on the first day.
Lunch is provided on Monday.`
const DEMO_B = `Hi everyone,

The new office opens in Phnom Penh on 3 November. Please bring your ID card and a photo on the first day.`
const { active: demoOn } = useDemoState('/text')
let saved = { a: '', b: '' }
watch(demoOn, (on) => {
  if (on) {
    saved = { a: original.value, b: modified.value }
    original.value = DEMO_A
    modified.value = DEMO_B
  } else {
    original.value = saved.a
    modified.value = saved.b
  }
}, { immediate: true })

function swap() {
  ;[original.value, modified.value] = [modified.value, original.value]
  play('select')
}

function clearAll() {
  const before = { a: original.value, b: modified.value }
  original.value = ''
  modified.value = ''
  play('delete')
  toast('Both texts cleared', { action: { label: 'Undo', onClick: () => {
    original.value = before.a
    modified.value = before.b
  } } })
}

const wordCount = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length
</script>

<template>
  <div class="compare">
    <div class="inputs">
      <label class="field box">
        <span class="field-head">Original <output>{{ wordCount(original).toLocaleString() }} words</output></span>
        <textarea v-model="original" class="input text" placeholder="Paste the original text…" spellcheck="false" />
      </label>
      <div class="vs" aria-hidden="true">VS</div>
      <label class="field box">
        <span class="field-head">Modified <output>{{ wordCount(modified).toLocaleString() }} words</output></span>
        <textarea v-model="modified" class="input text" placeholder="Paste the changed text…" spellcheck="false" />
      </label>
    </div>

    <div class="bar">
      <label class="check"><input v-model="ignoreCase" type="checkbox">Ignore capitals</label>
      <label class="check"><input v-model="ignoreWhitespace" type="checkbox">Ignore extra spaces</label>
      <div class="bar-right">
        <div class="segmented layout" role="radiogroup" aria-label="Show changes">
          <label :class="{ active: layout === 'side' }"><input v-model="layout" type="radio" value="side">Side by side</label>
          <label :class="{ active: layout === 'inline' }"><input v-model="layout" type="radio" value="inline">Inline</label>
        </div>
        <button type="button" class="btn btn-quiet btn-sm" :disabled="!original && !modified" @click="swap">Swap</button>
        <button type="button" class="btn btn-quiet btn-sm" :disabled="!original && !modified" @click="clearAll">Clear</button>
      </div>
    </div>

    <section class="panel result" aria-live="polite" aria-label="Differences">
      <template v-if="ready">
        <p class="summary">
          <template v-if="stats.identical"><span class="badge good">✓ Identical</span> The two texts match{{ ignoreCase || ignoreWhitespace ? ' (ignoring the differences you chose to ignore)' : '' }}.</template>
          <template v-else>
            <span v-if="stats.added" class="badge good">+{{ stats.added }} added</span>
            <span v-if="stats.removed" class="badge bad">−{{ stats.removed }} removed</span>
            <span v-if="stats.changed" class="badge warn">~{{ stats.changed }} changed</span>
            <span v-if="!stats.added && !stats.removed && !stats.changed" class="badge warn">Spacing or punctuation changed</span>
            <span class="legend"><ins>added</ins> <del>removed</del> <del class="chg">old</del><ins class="chg">new</ins></span>
          </template>
        </p>

        <!-- Side by side: the original on the left, the new version on the right -->
        <div v-if="layout === 'side'" class="sides">
          <div class="side">
            <h2>Original</h2>
            <div class="diff">
              <template v-for="(p, i) in parts" :key="i">
                <span v-if="p.kind === 'same'">{{ p.text }}</span>
                <del v-else-if="p.kind === 'removed'">{{ p.text }}</del>
                <del v-else-if="p.kind === 'changed'" class="chg">{{ p.from }}</del>
              </template>
            </div>
          </div>
          <div class="side">
            <h2>Modified</h2>
            <div class="diff">
              <template v-for="(p, i) in parts" :key="i">
                <span v-if="p.kind === 'same'">{{ p.text }}</span>
                <ins v-else-if="p.kind === 'added'">{{ p.text }}</ins>
                <ins v-else-if="p.kind === 'changed'" class="chg">{{ p.to }}</ins>
              </template>
            </div>
          </div>
        </div>

        <!-- Inline: everything in one column -->
        <div v-else class="diff inline">
          <template v-for="(p, i) in parts" :key="i">
            <span v-if="p.kind === 'same'">{{ p.text }}</span>
            <ins v-else-if="p.kind === 'added'">{{ p.text }}</ins>
            <del v-else-if="p.kind === 'removed'">{{ p.text }}</del>
            <template v-else><del class="chg">{{ p.from }}</del><ins class="chg">{{ p.to }}</ins></template>
          </template>
        </div>
      </template>
      <EmptyState v-else title="Paste two versions to compare" icon="case" :level="2">
        Put the original on the left and the changed version on the right. Every word that was added, removed or changed is highlighted.
      </EmptyState>
    </section>
  </div>
</template>

<style scoped>
.compare {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.inputs {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 0.75rem;
  align-items: stretch;
}

.vs {
  align-self: center;
  font-size: var(--text-xs);
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--ink-3);
}

.text {
  min-height: 11rem;
  height: 100%;
  resize: vertical;
  font-size: 1rem;
  line-height: 1.55;
}

.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1.25rem;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
  cursor: pointer;
}

.check input {
  width: 1.05rem;
  height: 1.05rem;
  margin: 0;
  accent-color: var(--accent);
}

.bar-right {
  margin-left: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.layout {
  font-size: var(--text-sm);
  white-space: nowrap;
}

.result {
  padding: 1.1rem 1.25rem;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 1rem;
  color: var(--ink-2);
}

.legend {
  margin-left: auto;
  font-size: var(--text-sm);
}

.sides {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
}

.side h2 {
  margin-bottom: 0.4rem;
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
}

/* Long text stays readable: real line breaks kept, long words wrap, a comfortable measure */
.diff {
  max-height: 32rem;
  overflow-y: auto;
  padding: 0.85rem 1rem;
  font-size: 1rem;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--surface-2);
  border-radius: 12px;
}

ins,
del {
  padding: 0.05em 0.1em;
  border-radius: 4px;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

ins {
  color: var(--good-ink);
  background: color-mix(in srgb, var(--green) 16%, transparent);
  text-decoration: underline;
}

del {
  color: var(--bad-ink);
  background: color-mix(in srgb, var(--red) 13%, transparent);
  text-decoration: line-through;
}

ins.chg,
del.chg {
  color: var(--warn-ink);
  background: color-mix(in srgb, var(--orange) 16%, transparent);
}

.inline del.chg + ins.chg {
  margin-left: 0.15em;
}

/* Phones: everything stacks (#53) */
@media (max-width: 760px) {
  .inputs {
    grid-template-columns: minmax(0, 1fr);
  }

  .vs {
    justify-self: center;
  }

  .sides {
    grid-template-columns: minmax(0, 1fr);
  }

  .bar-right {
    margin-left: 0;
  }

  .legend {
    margin-left: 0;
    flex-basis: 100%;
  }
}
</style>
