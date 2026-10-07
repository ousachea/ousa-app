<script setup lang="ts">
// A delete button that needs two clicks: the first arms it, the second deletes.
// It disarms itself after a few seconds, or when focus leaves it. Pass the button's look as a class
// (e.g. "link danger" or "icon-btn danger"); the default slot is what it shows before it's armed.
// Armed, it keeps the same footprint so nothing around it moves or gets covered: a text button reads
// "Sure?" in a red pill, an icon button (`icon`) turns solid red. The full instruction is in the tooltip
// and for screen readers.
const props = withDefaults(defineProps<{ name?: string, icon?: boolean }>(), { name: '', icon: false })
const emit = defineEmits<{ confirm: [] }>()

const ARM_MS = 3500
const armed = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
const { play } = useSound()

function disarm() {
  armed.value = false
  clearTimeout(timer)
}

function onClick() {
  if (!armed.value) {
    armed.value = true
    play('warning')
    clearTimeout(timer)
    timer = setTimeout(disarm, ARM_MS)
    return
  }
  disarm()
  emit('confirm')
}

onBeforeUnmount(() => clearTimeout(timer))

const what = computed(() => (props.name ? ` ${props.name}` : ''))
</script>

<template>
  <button
    type="button"
    class="confirm-delete"
    :class="{ armed, 'is-icon': icon }"
    :aria-label="armed ? `Click again to delete${what}` : `Delete${what}`"
    :title="armed ? 'Click again to delete' : 'Delete (click twice)'"
    @click.stop="onClick"
    @blur="disarm"
  >
    <span v-if="armed && !icon" class="armed-label">Sure?</span>
    <slot v-else>Delete</slot>
    <span v-if="armed" class="sr-status" role="status">Click again to delete{{ what }}</span>
  </button>
</template>

<style scoped>
.confirm-delete {
  position: relative;
}

/* Text button: a red pill whose padding is cancelled by negative margins, so it takes the same room */
.confirm-delete.armed:not(.is-icon) {
  margin-inline: -0.4rem;
  padding-inline: 0.4rem;
  color: #fff !important;
  text-decoration: none;
  white-space: nowrap;
  background: var(--red) !important;
  border-radius: 999px;
  animation: arm 0.32s cubic-bezier(0.3, 1.5, 0.5, 1);
}

.armed-label {
  font-weight: 700;
}

/* Icon button: same size, solid red with a white icon */
.confirm-delete.armed.is-icon {
  color: #fff !important;
  background: var(--red) !important;
  opacity: 1 !important;
  animation: arm 0.32s cubic-bezier(0.3, 1.5, 0.5, 1);
}

.sr-status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@keyframes arm {
  0% { scale: 0.9; }
  45% { scale: 1.06; translate: -2px 0; }
  70% { translate: 2px 0; }
  100% { scale: 1; translate: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .confirm-delete.armed { animation: none; }
}
</style>
