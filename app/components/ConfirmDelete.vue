<script setup lang="ts">
// The delete button used everywhere: a quiet trash icon that only turns red when pointed at.
//
// Most deletes are soft: the item goes to the Recycle Bin and the page offers Undo, so one click is
// enough. Pass `permanent` when it can't be undone; then the first click arms it (solid red, "Click
// again to delete") and a second click deletes. People who'd rather always confirm can turn on
// "Confirm before delete" in Settings. It disarms itself after a few seconds, or when focus leaves.
//
// The default look is an icon button; pass `text` for a small text button ("Delete") where a row
// of text links reads better. The default slot replaces the icon.
const props = withDefaults(defineProps<{ name?: string, permanent?: boolean, text?: boolean }>(), { name: '', permanent: false, text: false })
const emit = defineEmits<{ confirm: [] }>()

const ARM_MS = 3500
const armed = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
const { play } = useSound()
const { prefs } = usePrefs()

const needsSecondClick = computed(() => props.permanent || prefs.confirmDelete)

function disarm() {
  armed.value = false
  clearTimeout(timer)
}

function onClick() {
  if (needsSecondClick.value && !armed.value) {
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
const label = computed(() => {
  if (armed.value) return `Click again to delete${what.value}${props.permanent ? ' for good' : ''}`
  return props.permanent ? `Delete${what.value} for good` : `Delete${what.value}`
})
const tip = computed(() => {
  if (armed.value) return 'Click again to delete'
  if (props.permanent) return 'Delete for good (click twice)'
  return needsSecondClick.value ? 'Delete (click twice)' : 'Delete (you can undo)'
})
</script>

<template>
  <button
    type="button"
    class="confirm-delete"
    :class="[text ? 'link danger' : 'icon-btn danger', { armed, 'is-icon': !text }]"
    :aria-label="label"
    :title="tip"
    @click.stop="onClick"
    @blur="disarm"
  >
    <span v-if="armed && text" class="armed-label">Sure?</span>
    <slot v-else>
      <template v-if="text">Delete</template>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" /></svg>
    </slot>
    <span v-if="armed" class="sr-only" role="status">Click again to delete{{ what }}</span>
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
  animation: arm 0.32s var(--ease-spring);
}

.armed-label {
  font-weight: 700;
}

/* Icon button: same size, solid red with a white icon */
.confirm-delete.armed.is-icon {
  color: #fff !important;
  background: var(--red) !important;
  opacity: 1 !important;
  animation: arm 0.32s var(--ease-spring);
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
