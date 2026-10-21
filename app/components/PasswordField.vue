<script setup lang="ts">
// A password box with its Show / Hide toggle inside it, so it lines up with the fields around it
// (quick sign-in). The phone's own keyboard always types into it, so password managers work.
defineProps<{ autocomplete: string, label: string, placeholder?: string }>()
const model = defineModel<string>({ required: true })
const show = ref(false)
const id = useId()
</script>

<template>
  <div class="field">
    <label class="field-head" :for="id">{{ label }}</label>
    <span class="pw">
      <input
        :id="id"
        v-model="model"
        class="input"
        :type="show ? 'text' : 'password'"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        data-keys="off"
        spellcheck="false"
      >
      <button type="button" class="toggle" :aria-pressed="show" :aria-label="show ? 'Hide password' : 'Show password'" @click="show = !show">
        <AppIcon :name="show ? 'eye-off' : 'eye'" />
      </button>
    </span>
  </div>
</template>

<style scoped>
.pw {
  position: relative;
  display: block;
}

.pw .input {
  width: 100%;
  padding-right: 2.75rem;
}

.toggle {
  position: absolute;
  top: 50%;
  right: 0.35rem;
  translate: 0 -50%;
  width: 2.1rem;
  height: 2.1rem;
  display: grid;
  place-items: center;
  color: var(--ink-3);
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color var(--dur-fast), background-color var(--dur-fast);
}

.toggle:hover {
  color: var(--ink);
  background: var(--surface-2);
}

.toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.toggle svg {
  width: 1.05rem;
  height: 1.05rem;
}
</style>
