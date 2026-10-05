<script setup lang="ts">
import { toast } from 'vue-sonner'

const { play } = useSound()

const input = ref('')
const result = computed(() => checkCambodiaPhone(input.value))
const valid = computed(() => (result.value.valid ? result.value : undefined))
// A known prefix while the number is still incomplete, e.g. just "96"
const partial = computed(() => {
  const r = result.value
  return !r.valid && r.match && r.match.have < r.match.expected ? r.match : undefined
})

// A quiet tick the moment a typed number becomes valid
watch(() => result.value.valid, (isValid, wasValid) => {
  if (isValid && !wasValid) play('check')
})

const formats = computed(() => valid.value
  ? [
      { label: 'Local', value: valid.value.national },
      { label: 'International', value: valid.value.international },
      { label: 'E.164', value: valid.value.e164 }
    ]
  : [])

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success('Copied', { description: value })
    play('copy')
  } catch {
    toast.error('Could not copy')
    play('error')
  }
}
</script>

<template>
  <ToolPage>
    <div class="workspace">
    <div class="check">
    <Step :n="1" title="Type a number" hint="The first 2 digits are enough to see the network. The 0 is optional.">
    <label class="number input">
      <span class="cc" aria-hidden="true">🇰🇭 +855</span>
      <input
        v-model="input"
        type="tel"
        inputmode="tel"
        autocomplete="off"
        placeholder="012 345 678"
        aria-label="Phone number"
        aria-describedby="phone-result"
        autofocus
      >
    </label>
    </Step>

    <Step :n="2" title="Check the result and copy" class="result-step">
    <div id="phone-result" aria-live="polite">
      <section v-if="valid" class="panel result">
        <div class="verdict ok">
          <span class="dot" />
          Valid {{ valid.type === 'mobile' ? 'mobile' : 'landline' }} number
        </div>

        <div class="owner" :style="{ '--op': valid.operator?.color ?? 'var(--blue)' }">
          <strong>{{ valid.operator?.name ?? valid.region }}</strong>
          <span>{{ valid.type === 'mobile' ? 'Mobile network, based on the prefix' : 'Province, based on the area code' }}</span>
        </div>

        <dl class="formats">
          <div v-for="f in formats" :key="f.label">
            <dt>{{ f.label }}</dt>
            <dd>{{ f.value }}</dd>
            <button type="button" class="btn btn-quiet btn-sm" :aria-label="`Copy ${f.label} format`" @click="copy(f.value)">Copy</button>
          </div>
        </dl>

        <div class="links">
          <a class="btn btn-sm" :href="`tel:${valid.e164}`">Call</a>
          <template v-if="valid.type === 'mobile'">
            <a class="btn btn-quiet btn-sm" :href="`https://wa.me/${valid.e164.slice(1)}`" target="_blank" rel="noopener">WhatsApp</a>
            <a class="btn btn-quiet btn-sm" :href="`https://t.me/${valid.e164}`" target="_blank" rel="noopener">Telegram</a>
          </template>
        </div>
      </section>

      <section v-else-if="partial" class="panel result partial">
        <div class="owner" :style="{ '--op': partial.operator?.color ?? 'var(--blue)' }">
          <strong>{{ partial.operator?.name ?? partial.region }}</strong>
          <span>
            0{{ partial.prefix }} is a {{ partial.type === 'mobile' ? `${partial.operator?.name} mobile prefix` : `landline area code for ${partial.region}` }}
          </span>
        </div>

        <div class="slots" :aria-label="`${partial.have} of ${partial.expected} digits after the prefix`">
          <span class="slot prefix">0{{ partial.prefix }}</span>
          <span
            v-for="n in partial.expected"
            :key="n"
            class="slot"
            :class="{ filled: n <= partial.have }"
          />
        </div>
        <p class="progress">{{ result.valid ? '' : result.reason }}</p>
      </section>

      <p v-else-if="input.trim() && !result.valid" class="verdict bad">
        <span class="dot" />
        {{ result.reason }}
      </p>

      <p v-else class="waiting">The network and every format of the number show up here.</p>
    </div>
    </Step>
    </div>

    <section class="panel reference">
      <h2>Mobile prefixes</h2>
      <ul class="ops">
        <li v-for="op in OPERATORS" :key="op.name" :style="{ '--op': op.color }">
          <strong>{{ op.name }}</strong>
          <span class="prefixes">
            <span v-for="(len, prefix) in op.prefixes" :key="prefix" :title="`${len} digits after the prefix`">0{{ prefix }}</span>
          </span>
        </li>
      </ul>
      <p class="note">
        People can keep their number when they switch networks, so the network shown is a best guess from the prefix.
      </p>
    </section>
    </div>
  </ToolPage>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
}

.number {
  display: flex;
  align-items: center;
  padding: 0;
  overflow: hidden;
  border-radius: 16px;
}

/* Red is this tool's colour, but a red ring around an input reads as an error, so focus stays neutral */
.number:focus-within {
  border-color: var(--ink);
  box-shadow: 0 0 0 3px rgb(27 31 42 / 0.12);
}

.cc {
  align-self: stretch;
  display: flex;
  align-items: center;
  padding: 0 1rem;
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface-2);
  border-right: 1px solid var(--line);
  white-space: nowrap;
}

.number input {
  flex: 1;
  min-width: 0;
  padding: 1rem 1.1rem;
  font: inherit;
  font-size: clamp(1.4rem, 5vw, 1.75rem);
  font-weight: 600;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
  background: transparent;
  border: 0;
  outline: none;
}

.number input::placeholder {
  color: var(--ink-3);
  font-weight: 400;
}

.result-step {
  margin-top: 2rem;
}

.waiting {
  margin: 0;
  padding: 1.5rem;
  text-align: center;
  color: var(--ink-3);
  border: 2px dashed var(--line);
  border-radius: 20px;
}

.result {
  padding: 1.25rem;
  animation: settle 0.2s ease-out;
}

.partial .owner {
  margin-top: 0;
}

.slots {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.slot {
  width: 1.1rem;
  height: 1.6rem;
  border-radius: 5px;
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1.5px var(--line);
  transition: background-color 0.15s, box-shadow 0.15s;
}

.slot.filled {
  background: var(--ink);
  box-shadow: none;
}

.slot.prefix {
  width: auto;
  height: 1.6rem;
  padding: 0 0.5rem;
  margin-right: 0.35rem;
  display: grid;
  place-items: center;
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #fff;
  background: var(--ink);
  box-shadow: none;
}

.progress {
  margin: 0.75rem 0 0;
  font-size: 0.925rem;
  color: var(--ink-2);
}

.verdict {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
  font-weight: 600;
}

p.verdict {
  padding: 0.9rem 1.1rem;
  color: #a61b2e;
  background: color-mix(in srgb, var(--red) 9%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--red) 30%, transparent);
  border-radius: 14px;
  font-weight: 500;
}

.dot {
  flex: none;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
}

.ok .dot { background: var(--green); box-shadow: 0 0 0 4px color-mix(in srgb, var(--green) 20%, transparent); }
.bad .dot { background: var(--red); box-shadow: 0 0 0 4px color-mix(in srgb, var(--red) 20%, transparent); }

.owner {
  margin: 1.1rem 0 1.25rem;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  border-left: 5px solid var(--op);
  background: color-mix(in srgb, var(--op) 9%, var(--surface));
  border-radius: 4px 12px 12px 4px;
}

.owner strong {
  font-size: 1.6rem;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.owner span {
  font-size: 0.875rem;
  color: var(--ink-2);
}

.formats {
  margin: 0;
}

.formats div {
  display: grid;
  grid-template-columns: 7.5rem 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0;
  border-top: 1px solid var(--line);
}

dt {
  font-size: 0.875rem;
  color: var(--ink-2);
}

dd {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.links {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.reference {
  padding: 1.4rem;
}

h2 {
  font-size: 1.25rem;
  letter-spacing: -0.015em;
}

.ops {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ops li {
  display: grid;
  grid-template-columns: 6.5rem 1fr;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.7rem 0.9rem;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-left: 5px solid var(--op);
  border-radius: 4px 12px 12px 4px;
}

.prefixes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.6rem;
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
}

.note {
  margin: 1rem 0 0;
  font-size: 0.875rem;
  color: var(--ink-3);
}

@keyframes settle {
  from { opacity: 0; transform: translateY(4px); }
}

@media (max-width: 900px) {
  .workspace { grid-template-columns: 1fr; }
}

@media (max-width: 480px) {
  .formats div { grid-template-columns: 1fr auto; }
  dt { grid-column: 1 / -1; margin-bottom: -0.5rem; }
  .ops li { grid-template-columns: 1fr; gap: 0.25rem; }
}

@media (prefers-reduced-motion: reduce) {
  .result { animation: none; }
}
</style>
