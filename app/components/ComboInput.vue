<script setup lang="ts">
// A text field with suggestions underneath (CHECKLIST.md #13, #45): type to filter, arrows to move,
// Enter or a click to pick. Anything typed is kept as it is, so values not in the list work too.
export interface ComboOption { value: string, hint?: string, logo?: string }

const props = withDefaults(defineProps<{ options: readonly (string | ComboOption)[], placeholder?: string, ariaLabel?: string, required?: boolean, dataError?: string }>(), {
  placeholder: '', ariaLabel: undefined, required: false, dataError: undefined
})
const model = defineModel<string>({ required: true })
const emit = defineEmits<{ pick: [value: string] }>()

const uid = useId()
const open = ref(false)
const active = ref(-1)
const brokenLogos = ref(new Set<string>())

const all = computed<ComboOption[]>(() => props.options.map(o => (typeof o === 'string' ? { value: o } : o)))
const shown = computed(() => {
  const q = model.value.trim().toLowerCase()
  const list = all.value.filter(o => !q || o.value.toLowerCase().includes(q))
  // Once it exactly matches, there's nothing left to suggest
  return list.length === 1 && list[0]!.value.toLowerCase() === q ? [] : list.slice(0, 40)
})
watch(() => model.value, () => (active.value = -1))

function pick(o: ComboOption) {
  model.value = o.value
  open.value = false
  emit('pick', o.value)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    open.value = true
    active.value = Math.min(shown.value.length - 1, active.value + 1)
  } else if (e.key === 'ArrowUp') {
    active.value = Math.max(-1, active.value - 1)
  } else if (e.key === 'Enter' && open.value && active.value >= 0 && shown.value[active.value]) {
    pick(shown.value[active.value]!)
  } else if (e.key === 'Escape' && open.value) {
    open.value = false
    e.stopPropagation()
  } else {
    return
  }
  e.preventDefault()
}

function onBlur() {
  // Let a click on an option land first
  setTimeout(() => (open.value = false), 120)
}
</script>

<template>
  <div class="combo">
    <input
      v-model="model"
      class="input"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="open && shown.length > 0"
      :aria-controls="`${uid}-list`"
      :aria-activedescendant="open && active >= 0 ? `${uid}-opt-${active}` : undefined"
      :aria-label="ariaLabel"
      :placeholder="placeholder"
      :required="required"
      :data-error="dataError"
      autocomplete="off"
      spellcheck="false"
      @focus="open = true"
      @input="open = true"
      @keydown="onKey"
      @blur="onBlur"
    >
    <Transition name="slide-down">
      <ul v-if="open && shown.length" :id="`${uid}-list`" class="list" role="listbox" :aria-label="ariaLabel">
        <li
          v-for="(o, i) in shown"
          :id="`${uid}-opt-${i}`"
          :key="o.value"
          role="option"
          :aria-selected="i === active"
          @pointerenter="active = i"
          @mousedown.prevent="pick(o)"
        >
          <img v-if="o.logo && !brokenLogos.has(o.logo)" class="logo" :src="o.logo" alt="" referrerpolicy="no-referrer" @error="brokenLogos.add(o.logo)">
          <span class="value">{{ o.value }}</span>
          <span v-if="o.hint" class="hint">{{ o.hint }}</span>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.combo {
  position: relative;
}

.list {
  position: absolute;
  z-index: 20;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  max-height: 15rem;
  overflow-y: auto;
  margin: 0;
  padding: 0.3rem;
  list-style: none;
  background: var(--surface);
  border-radius: 12px;
  box-shadow: 0 18px 40px -12px rgb(var(--shadow) / 0.35), 0 0 0 1px var(--line);
}

li {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 2.4rem;
  padding: 0.3rem 0.65rem;
  font-size: 0.95rem;
  color: var(--ink);
  border-radius: 8px;
  cursor: pointer;
}

li[aria-selected='true'] {
  background: var(--surface-2);
}

.logo {
  width: 1.1rem;
  height: 1.1rem;
  object-fit: contain;
  border-radius: 3px;
}

.value {
  flex: 1;
  min-width: 0;
}

.hint {
  font-size: var(--text-xs);
  color: var(--ink-3);
}
</style>
