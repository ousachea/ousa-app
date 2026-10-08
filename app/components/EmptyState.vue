<script setup lang="ts">
import type { ToolIconName } from '~/utils/tools'

// What a list shows before it has anything in it: what it's for, and the one thing to do next
// (CHECKLIST.md #23). The default slot is the explanation; `action` is the button's label.
// `level`: the heading level that fits where it sits (h3 under a section heading, h2 straight under the page title)
withDefaults(defineProps<{ title: string, icon?: ToolIconName, action?: string, level?: 2 | 3 }>(), { icon: undefined, action: undefined, level: 3 })
const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div class="empty-state">
    <span v-if="icon" class="empty-icon" aria-hidden="true"><ToolIcon :name="icon" /></span>
    <component :is="`h${level}`">{{ title }}</component>
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
