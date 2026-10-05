<script setup lang="ts">
import { toast } from 'vue-sonner'

const { play } = useSound()

const input = ref('')
const mode = ref<CaseMode>('sentence')
const copied = ref(false)

const output = computed(() => convertCase(input.value, mode.value))
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
  <ToolPage>
    <div class="workspace">
      <Step :n="1" title="Paste or type your text" class="input-step">
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
        <Step :n="2" title="Pick a case">
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
              {{ m.label }}
            </label>
          </div>
        </Step>

        <Step :n="3" title="Copy the result" class="output-step">
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
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 2rem 2.5rem;
  align-items: stretch;
}

.input-step,
.side {
  display: flex;
  flex-direction: column;
}

.output-step {
  margin-top: 2rem;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

/* Each option is shown in its own case, so the buttons preview the result */
.mode {
  position: relative;
  padding: 0.85rem 1rem;
  font-size: 1.05rem;
  font-weight: 600;
  text-align: center;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s, box-shadow 0.15s;
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
  padding: 1.25rem 1.4rem;
  font-size: 1.05rem;
  line-height: 1.6;
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
    grid-template-columns: 1fr;
  }

  .text {
    min-height: 12rem;
  }
}
</style>
