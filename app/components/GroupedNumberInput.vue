<script setup lang="ts">
// A number field that shows thousands separators as you type (1,000,000) and gives back a plain number.
// Text, not type="number", since number inputs can't show commas; MobileKeyboard still opens its number pad.
const model = defineModel<number | null>()

const text = ref(groupDigits(model.value == null ? '' : String(model.value)))
// Outside changes (presets, the ⇄ swap, saved settings); skipped while typing so "12." isn't turned into "12"
watch(model, (v) => {
  if (v !== parseGrouped(text.value)) text.value = groupDigits(v == null ? '' : String(v))
})

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  // Keep the caret after the same digit once commas move around it
  const digitsBefore = el.value.slice(0, el.selectionStart ?? el.value.length).replace(/[^\d.]/g, '').length
  const grouped = groupDigits(el.value)
  el.value = text.value = grouped
  model.value = parseGrouped(grouped)
  let pos = 0
  for (let seen = 0; pos < grouped.length && seen < digitsBefore; pos++) if (grouped[pos] !== ',') seen++
  el.setSelectionRange(pos, pos)
}
</script>

<template>
  <input :value="text" type="text" inputmode="decimal" autocomplete="off" @input="onInput">
</template>
