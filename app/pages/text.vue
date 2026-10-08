<script setup lang="ts">
import { toast } from 'vue-sonner'

const { play } = useSound()

// Two tools: change case, or compare two texts (CHECKLIST.md #51, #52). The tab lives in the URL.
type Tab = 'case' | 'compare'
const route = useRoute()
const router = useRouter()
const tab = computed<Tab>(() => (route.query.tab === 'compare' ? 'compare' : 'case'))
function setTab(next: Tab) {
  if (next === tab.value) return
  router.replace({ query: next === 'compare' ? { tab: 'compare' } : {} })
  play('select')
}

const input = ref('')
const mode = ref<CaseMode>('sentence')
const copied = ref(false)

const output = computed(() => convertCase(input.value, mode.value))

// Demo (the app icon switches it on): messy text to convert; your own text comes back when it's off
const DEMO_TEXT = `MEETING NOTES – monday
the new office opens in phnom penh next MONTH. please bring your ID card on the first day.

action items: book the meeting room, ORDER coffee, and send the slides to sokha before friday.`
const { active: demoOn } = useDemo()
// The demo fills whichever tool is showing; Compare fills its own two boxes
let savedInput = ''
watch(demoOn, (on) => {
  if (on) {
    savedInput = input.value
    input.value = DEMO_TEXT
  } else {
    input.value = savedInput
  }
})

// Each case button previews the start of the visitor's own text in that case
const SAMPLE = 'the quick brown fox. jumps over the lazy dog'
const specimen = (m: CaseMode) => {
  const source = input.value.trim().split('\n')[0]!.slice(0, 40) || SAMPLE
  return convertCase(source, m)
}
const stats = computed(() => textStats(input.value))

const STAT_LABELS = [
  { key: 'characters', one: 'character', many: 'characters' },
  { key: 'words', one: 'word', many: 'words' },
  { key: 'paragraphs', one: 'paragraph', many: 'paragraphs' }
] as const

function pickMode(value: CaseMode) {
  mode.value = value
  play('select')
}

let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function copyOutput() {
  try {
    await navigator.clipboard.writeText(output.value)
    copied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = false), 1600)
    toast.success('Copied to clipboard')
    play('copy')
  } catch {
    toast.error('Could not copy', { description: 'Your browser blocked clipboard access.' })
    play('error')
  }
}

function clearText() {
  input.value = ''
  copied.value = false
  play('delete')
}

onBeforeUnmount(() => clearTimeout(copiedTimer))
</script>

<template>
  <ToolPage header="bar">
    <div class="tabs segmented" role="radiogroup" aria-label="Text tools">
      <label :class="{ active: tab === 'case' }">
        <input type="radio" name="text-tool" :checked="tab === 'case'" @change="setTab('case')">Change case
      </label>
      <label :class="{ active: tab === 'compare' }">
        <input type="radio" name="text-tool" :checked="tab === 'compare'" @change="setTab('compare')">Compare texts
      </label>
    </div>

    <ClientOnly v-if="tab === 'compare'">
      <TextCompare />
    </ClientOnly>

    <div v-else class="workspace">
      <Step title="Your text" class="input-step">
        <div class="panel editor">
          <textarea
            v-model="input"
            class="text"
            placeholder="Paste or type your text here…"
            aria-label="Text to convert"
            spellcheck="false"
          />
          <footer class="editor-foot">
            <dl class="stats" aria-live="polite">
              <div v-for="s in STAT_LABELS" :key="s.key">
                <dt>{{ stats[s.key] === 1 ? s.one : s.many }}</dt>
                <dd>{{ stats[s.key].toLocaleString() }}</dd>
              </div>
            </dl>
            <button type="button" class="btn btn-quiet btn-sm" :disabled="!input" @click="clearText">Clear</button>
          </footer>
        </div>
      </Step>

      <div class="side">
        <Step title="Case" class="modes-step">
          <div class="modes" role="radiogroup" aria-label="Case">
            <label
              v-for="m in CASE_MODES"
              :key="m.value"
              class="mode"
              :class="{ active: mode === m.value }"
            >
              <input
                type="radio"
                name="case"
                :value="m.value"
                :checked="mode === m.value"
                @change="pickMode(m.value)"
              >
              <span class="mode-name">{{ m.label }}</span>
              <span class="specimen">{{ specimen(m.value) }}</span>
            </label>
          </div>
        </Step>

        <Step title="Result" class="output-step">
          <div class="panel result">
            <output class="output" :class="{ empty: !input }" aria-live="polite">
              {{ input ? output : 'Your converted text shows up here as you type.' }}
            </output>
            <button
              type="button"
              class="btn copy"
              :class="{ done: copied }"
              :disabled="!input"
              @click="copyOutput"
            >
              {{ copied ? 'Copied!' : 'Copy to clipboard' }}
            </button>
          </div>
        </Step>
      </div>
    </div>
  </ToolPage>
</template>

<style scoped>
.tabs {
  width: fit-content;
  margin-bottom: 1.25rem;
  font-size: 0.95rem;
}

.tabs label {
  padding-inline: 1.1rem;
  white-space: nowrap;
}

/* Editor: the case picker is a toolbar across the top, input and result side by side below */
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-areas:
    'modes modes'
    'input output';
  gap: 1.5rem 1.25rem;
  align-items: stretch;
}

/* Its two steps join the grid directly (beats the flex rule below) */
.workspace > .side {
  display: contents;
}

.modes-step { grid-area: modes; }
.input-step { grid-area: input; }
.output-step { grid-area: output; }

.input-step,
.side {
  display: flex;
  flex-direction: column;
}

.output-step {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.editor,
.result {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor:focus-within {
  border-color: var(--ink);
  box-shadow: 0 0 0 3px rgb(var(--shadow) / 0.12);
}

.text {
  flex: 1;
  min-height: 22rem;
  padding: 1.25rem 1.4rem;
  font: inherit;
  font-size: 1.05rem;
  line-height: 1.6;
  color: var(--ink);
  background: transparent;
  border: 0;
  outline: none;
  resize: vertical;
}

.text::placeholder {
  color: var(--ink-3);
}

.editor-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem 0.75rem 1.4rem;
  background: var(--surface-2);
  border-top: 1px solid var(--line);
}

.stats {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.5rem;
}

.stats div {
  display: flex;
  flex-direction: row-reverse;
  align-items: baseline;
  gap: 0.35rem;
}

.stats dt {
  font-size: 0.875rem;
  color: var(--ink-2);
}

.stats dd {
  margin: 0;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.modes {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}

/* Each option is shown in its own case, so the buttons preview the result */
.mode {
  position: relative;
  min-width: 0;
  padding: 0.85rem 1rem 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s, box-shadow 0.15s;
}

/* Small label, then the user's text set large in that case, like a type specimen */
.mode-name {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--ink-3);
}

.specimen {
  font-size: 1.3rem;
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mode.active .mode-name {
  color: var(--ink);
}

.mode:hover {
  border-color: var(--ink-3);
}

.mode.active {
  background: color-mix(in srgb, var(--yellow) 22%, var(--surface));
  border-color: var(--ink);
  box-shadow: 0 0 0 1px var(--ink);
}

.mode:has(input:focus-visible) {
  outline: 3px solid color-mix(in srgb, var(--ink) 40%, transparent);
  outline-offset: 2px;
}

.mode input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.output {
  flex: 1;
  display: block;
  min-height: 12rem;
  max-height: 28rem;
  overflow: auto;
  padding: 1.4rem 1.5rem;
  font-size: 1.35rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.output.empty {
  color: var(--ink-3);
}

.copy {
  margin: 0 1rem 1rem;
}

.copy.done {
  color: #fff;
  background: var(--green);
}

@media (max-width: 900px) {
  .workspace {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'modes' 'input' 'output';
  }

  .modes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .text {
    min-height: 12rem;
  }
}
</style>
