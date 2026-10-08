<script setup lang="ts">
import type { ToolIconName } from '~/utils/tools'

// What a list shows before it has anything in it: what it's for, and the one thing to do next
// (CHECKLIST.md #23). The default slot is the explanation; `action` is the button's label.
defineProps<{ title: string, icon?: ToolIconName, action?: string }>()
const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div class="empty-state">
    <span v-if="icon" class="empty-icon" aria-hidden="true"><ToolIcon :name="icon" /></span>
    <h3>{{ title }}</h3>
    <p><slot /></p>
    <button v-if="action" type="button" class="btn" @click="emit('action')">{{ action }}</button>
    <slot name="extra" />
  </div>
</template>

<style scoped>
.empty-icon {
  width: 3rem;
  height: 3rem;
  display: grid;
  place-items: center;
  margin-bottom: 0.25rem;
  font-size: 1.5rem;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  border-radius: 14px;
}
</style>
