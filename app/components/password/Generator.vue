<script setup lang="ts">
import { toast } from 'vue-sonner'

const emit = defineEmits<{ save: [password: string] }>()

const { play } = useSound()

const ALL_SETS = Object.keys(CHARSETS) as CharsetName[]

const length = ref(20)
const sets = ref<CharsetName[]>([...ALL_SETS])
const avoidLookAlikes = ref(false)
const password = ref('')
const copied = ref(false)

const options = computed<PasswordOptions>(() => ({
  length: length.value,
  sets: sets.value,
  avoidLookAlikes: avoidLookAlikes.value
}))
const rating = computed(() => strength(options.value))
const timeToCrack = computed(() => crackTime(rating.value.bits))
const scaleAt = computed(() => crackScale(crackSeconds(rating.value.bits)))
// Where the strength labels change (60 and 75 bits), on the same scale
const bands = { weak: crackScale(crackSeconds(60)), fair: crackScale(crackSeconds(75)) }

// Generate in the browser only: never render a password on the server
function regenerate() {
  password.value = generatePassword(options.value)
  copied.value = false
}

onMounted(regenerate)
watch(options, regenerate)

function toggleSet(set: CharsetName) {
  const on = sets.value.includes(set)
  // Keep at least one set switched on
  if (on && sets.value.length === 1) return
  sets.value = on ? sets.value.filter(s => s !== set) : ALL_SETS.filter(s => s === set || sets.value.includes(s))
  play(on ? 'toggle-off' : 'toggle-on')
}

function regenerateWithSound() {
  regenerate()
  play('retry')
}

let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function copyPassword() {
  try {
    await navigator.clipboard.writeText(password.value)
    copied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = false), 1600)
    toast.success('Password copied')
    play('copy')
  } catch {
    toast.error('Could not copy', { description: 'Your browser blocked clipboard access.' })
    play('error')
  }
}

onBeforeUnmount(() => clearTimeout(copiedTimer))
</script>

<template>
  <div class="tab-body">
    <div class="workspace">
      <div class="settings">
        <Step title="Length" hint="Longer is stronger. 16 or more is a good habit.">
          <label class="panel field length">
            <span class="field-head">Length <output>{{ length }} characters</output></span>
            <input v-model.number="length" type="range" min="8" max="64" step="1">
          </label>
        </Step>

        <Step title="Characters" hint="Some sites don’t allow symbols. Turn them off if a site rejects the password." class="chars-step">
          <div class="sets">
            <button
              v-for="set in ALL_SETS"
              :key="set"
              type="button"
              role="switch"
              class="set"
              :aria-checked="sets.includes(set)"
              :disabled="sets.includes(set) && sets.length === 1"
              @click="toggleSet(set)"
            >
              <span class="set-text">
                <strong>{{ CHARSETS[set].label }}</strong>
                <span>{{ CHARSETS[set].example }}</span>
              </span>
              <span class="check" aria-hidden="true">
                <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg>
              </span>
            </button>
          </div>

          <label class="panel lookalike">
            <input v-model="avoidLookAlikes" type="checkbox" @change="play(avoidLookAlikes ? 'check' : 'uncheck')">
            <span>
              <strong>Avoid look-alike characters</strong>
              <span>Leaves out I, l, 1, O, 0 and o, which are easy to mix up when typing a password by hand.</span>
            </span>
          </label>
        </Step>
      </div>

      <Step title="Your password" v-sticky-fit class="result-step">
        <div class="panel result">
          <ClientOnly>
            <output class="password" aria-live="polite" aria-label="Generated password">
              <span v-for="(c, i) in password" :key="i" :class="charKind(c)">{{ c }}</span>
            </output>
            <template #fallback>
              <output class="password placeholder">Generating…</output>
            </template>
          </ClientOnly>

          <div class="meter" :data-level="rating.level">
            <div class="bars" aria-hidden="true">
              <span v-for="n in 4" :key="n" :class="{ on: n <= rating.level }" />
            </div>
            <p>
              <strong>{{ rating.label }}</strong>
              <span>{{ rating.bits }} bits of randomness</span>
            </p>
          </div>

          <div class="crack" :data-level="rating.level">
            <span class="crack-label">Time to crack</span>
            <strong>{{ timeToCrack }}</strong>
            <!-- Log scale from instant to the age of the universe, banded weak / fair / strong like the meter -->
            <div class="scale" role="img" :aria-label="`On a scale from instant to the age of the universe, this password sits at ${Math.round(scaleAt * 100)}%`">
              <div class="bands" :style="{ '--weak': `${bands.weak * 100}%`, '--fair': `${bands.fair * 100}%` }" />
              <span class="marker" :style="{ left: `${scaleAt * 100}%` }" />
              <span v-for="(t, i) in CRACK_TICKS" :key="t.label" class="tick" :class="{ minor: i === 0 || i === 3 }" :style="{ left: `${t.at * 100}%` }"><span>{{ t.label }}</span></span>
              <span class="end start">Instant</span>
              <span class="end finish">Age of the universe</span>
            </div>
            <span class="crack-note">
              Average time for a powerful computer making {{ GUESSES_PER_SECOND / 1e9 }} billion guesses a second,
              if the password leaked from a site that stored it badly.
            </span>
          </div>

          <div class="actions">
            <button type="button" class="btn copy" :class="{ done: copied }" :disabled="!password" @click="copyPassword">
              {{ copied ? 'Copied!' : 'Copy password' }}
            </button>
            <button type="button" class="btn btn-quiet" @click="regenerateWithSound">Regenerate</button>
          </div>
          <button type="button" class="btn btn-quiet save" :disabled="!password" @click="emit('save', password)">
            Save to vault
          </button>

          <p class="legend">
            <span class="upper">Uppercase</span>
            <span class="lower">lowercase</span>
            <span class="digits">numbers</span>
            <span class="symbols">symbols</span>
          </p>
        </div>
      </Step>
    </div>
  </div>
</template>

<style scoped>
/* The password leads, full width; length and characters sit side by side underneath */
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    'result'
    'settings';
  gap: 2rem;
  max-width: 1080px;
  margin: 0 auto;
}

/* Wide screens: the password and its settings side by side, so changes show up right next to them */
@media (min-width: 1400px) {
  .workspace {
    max-width: none;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    grid-template-areas: 'result settings';
    gap: 2.5rem;
    align-items: start;
  }

  .result-step {
    position: sticky;
    top: 5.5rem; /* clear of the menu button */
  }

  .settings {
    grid-template-columns: minmax(0, 1fr);
  }
}

.result-step { grid-area: result; }

.settings {
  grid-area: settings;
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 1.5rem 2rem;
  align-items: start;
}

.chars-step {
  margin-top: 0;
}

.length {
  padding: 1.1rem 1.4rem;
}

.sets {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.set {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  font: inherit;
  text-align: left;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
}

.set:hover:not(:disabled) {
  border-color: var(--ink-3);
}

.set:disabled {
  cursor: not-allowed;
}

.set-text {
  display: flex;
  flex-direction: column;
}

.set-text span {
  font-size: 0.85rem;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.check {
  flex: none;
  width: 1.4rem;
  height: 1.4rem;
  display: grid;
  place-items: center;
  border-radius: 6px;
  box-shadow: inset 0 0 0 1.5px var(--line);
  transition: background-color 0.15s, box-shadow 0.15s;
}

.check svg {
  width: 0.9rem;
  height: 0.9rem;
  fill: none;
  stroke: #fff;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
  transition: opacity 0.15s;
}

.set[aria-checked='true'] {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
}

.set[aria-checked='true'] .check {
  background: var(--accent);
  box-shadow: none;
}

.set[aria-checked='true'] .check svg {
  opacity: 1;
}

.lookalike {
  margin-top: 0.75rem;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.95rem 1.1rem;
  cursor: pointer;
}

.lookalike input {
  flex: none;
  width: 1.15rem;
  height: 1.15rem;
  margin: 0.15rem 0 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.lookalike > span {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.lookalike > span > span {
  font-size: 0.875rem;
  color: var(--ink-2);
}

.result-step {
  position: static;
}

.result {
  padding: 1.75rem;
}

/* Monospace on purpose: every character gets the same width, so look-alikes are easier to tell apart */
.password {
  display: block;
  min-height: 4.5rem;
  padding: 1.25rem 1.4rem;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: clamp(1.4rem, 3.4vw, 2.4rem);
  line-height: 1.45;
  letter-spacing: 0.04em;
  overflow-wrap: anywhere;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 14px;
}

.password.placeholder {
  font-family: var(--font);
  color: var(--ink-3);
}

.upper,
.lower { color: var(--ink); }
.digits { color: var(--digit-ink); }
.symbols { color: var(--symbol-ink); }

.meter {
  margin-top: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.bars {
  flex: none;
  display: flex;
  gap: 0.3rem;
}

.bars span {
  width: 2.25rem;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--line);
  transition: background-color 0.2s;
}

.meter[data-level='1'] .bars .on { background: var(--red); }
.meter[data-level='2'] .bars .on { background: var(--orange); }
.meter[data-level='3'] .bars .on,
.meter[data-level='4'] .bars .on { background: var(--green); }

.meter p {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 0.6rem;
}

.meter p span {
  font-size: 0.875rem;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.crack {
  margin-top: 1.25rem;
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  border-radius: 14px;
  background: var(--surface-2);
  border-left: 5px solid var(--line);
}

.crack[data-level='1'] { border-left-color: var(--red); }
.crack[data-level='2'] { border-left-color: var(--orange); }
.crack[data-level='3'],
.crack[data-level='4'] { border-left-color: var(--green); }

.crack-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-2);
}

.crack strong {
  font-size: 1.35rem;
  letter-spacing: -0.015em;
  line-height: 1.25;
}

.scale {
  position: relative;
  /* Room for the Instant / Age of the universe labels above it */
  margin: 1.6rem 0 1.6rem;
  height: 0.6rem;
}

.bands {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: linear-gradient(to right,
    color-mix(in srgb, var(--red) 70%, transparent) 0 var(--weak),
    color-mix(in srgb, var(--orange) 70%, transparent) var(--weak) var(--fair),
    color-mix(in srgb, var(--green) 70%, transparent) var(--fair) 100%);
}

.marker {
  position: absolute;
  top: 50%;
  width: 1.1rem;
  height: 1.1rem;
  margin: -0.55rem 0 0 -0.55rem;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 0 0 3px var(--ink), 0 2px 6px rgb(var(--shadow) / 0.3);
  transition: left 0.35s cubic-bezier(0.2, 0, 0, 1);
}

.tick {
  position: absolute;
  top: 100%;
  width: 1px;
  height: 0.35rem;
  background: var(--ink-3);
}

.tick span {
  position: absolute;
  top: 0.35rem;
  left: 0;
  transform: translateX(-50%);
  font-size: 0.65rem;
  color: var(--ink-3);
  white-space: nowrap;
}

.end {
  position: absolute;
  bottom: calc(100% + 0.3rem);
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--ink-3);
}

.end.start { left: 0; }
.end.finish { right: 0; }

/* Narrow screens: every other label would run into the next one; the ticks stay */
@media (max-width: 560px) {
  .tick.minor span { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .marker { transition: none; }
}

.crack-note {
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: var(--ink-3);
}

.actions {
  margin-top: 1.5rem;
  display: flex;
  gap: 0.5rem;
}

.copy {
  flex: 1;
}

.save {
  width: 100%;
  margin-top: 0.5rem;
}

.copy.done {
  background: color-mix(in srgb, var(--green) 80%, #000);
}

.legend {
  margin: 1.25rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.legend .upper,
.legend .lower {
  color: var(--ink-2);
}

@media (max-width: 900px) {
  .settings {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 480px) {
  .sets {
    grid-template-columns: minmax(0, 1fr);
  }

  .result {
    padding: 1.1rem;
  }
}
</style>
