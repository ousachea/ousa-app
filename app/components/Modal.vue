<script setup lang="ts">
// Popup built on the native <dialog>: focus moves inside, Esc closes, the page behind is inert
const props = defineProps<{ open: boolean, title: string }>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement>()

// Start typing straight away: focus the first field (or anything marked autofocus), not the close button.
// Popups without fields (confirmations) leave focus to their own buttons.
function focusFirstField() {
  const target = dialog.value?.querySelector<HTMLElement>('[autofocus], input:not([type=hidden]):not([hidden]):not([type=file]):not([type=radio]):not([type=checkbox]):not([tabindex="-1"]), textarea, select')
  if (target && !target.closest('.modal-head')) target.focus()
}

function show() {
  const el = dialog.value
  if (!el || el.open) return
  el.showModal()
  nextTick(focusFirstField)
}

watch(() => props.open, (open) => {
  const el = dialog.value
  if (!el) return
  if (open) show()
  else if (el.open) el.close()
}, { flush: 'post' })

onMounted(() => {
  if (props.open) show()
})

// Clicking the dimmed backdrop (the dialog element itself, outside the panel) closes it
function onClick(e: MouseEvent) {
  if (e.target === dialog.value) emit('close')
}
</script>

<template>
  <dialog ref="dialog" class="modal" :aria-label="title" @close="emit('close')" @click="onClick">
    <div class="panel-inner">
      <header class="modal-head">
        <h2>{{ title }}</h2>
        <button type="button" class="close" aria-label="Close" @click="emit('close')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>
      <slot />
    </div>
  </dialog>
</template>

<style scoped>
.modal {
  width: min(560px, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  padding: 0;
  color: var(--ink);
  background: var(--surface);
  border: 0;
  border-radius: 22px;
  box-shadow: 0 30px 80px -20px rgb(var(--shadow) / 0.45), 0 0 0 1px var(--line);
}

.modal::backdrop {
  background: rgb(var(--shadow) / 0.45);
  backdrop-filter: blur(3px);
}

/* Soft entrance; exits instantly so closing never feels sluggish */
.modal[open] {
  animation: modal-in 0.22s cubic-bezier(0.2, 0, 0, 1);
}

.modal[open]::backdrop {
  animation: fade-in 0.22s ease-out;
}

.panel-inner {
  padding: 1.25rem 1.4rem 1.4rem;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.modal-head h2 {
  font-size: 1.25rem;
  letter-spacing: -0.015em;
}

.close {
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  margin: -0.4rem -0.5rem -0.4rem 0;
  padding: 0;
  color: var(--ink-2);
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.close:hover {
  color: var(--ink);
  background: var(--surface-2);
}

.close svg {
  width: 1.2rem;
  height: 1.2rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

@keyframes modal-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}

@keyframes fade-in {
  from { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .modal[open],
  .modal[open]::backdrop {
    animation: none;
  }
}
</style>
