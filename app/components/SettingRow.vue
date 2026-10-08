<script setup lang="ts">
// One on/off preference: a title, a line explaining it, and a switch (Settings, CHECKLIST.md #31)
defineProps<{ title: string, description?: string }>()
const model = defineModel<boolean>({ required: true })
const id = useId()
const { play } = useSound()

function flip() {
  model.value = !model.value
  play(model.value ? 'toggle-on' : 'toggle-off')
}
</script>

<template>
  <div class="setting-row">
    <div class="text">
      <span :id="`${id}-title`" class="title">{{ title }}</span>
      <span v-if="description" :id="`${id}-desc`" class="desc">{{ description }}</span>
    </div>
    <button
      type="button"
      role="switch"
      class="switch"
      :aria-checked="model"
      :aria-labelledby="`${id}-title`"
      :aria-describedby="description ? `${id}-desc` : undefined"
      @click="flip"
    >
      <span class="knob" />
    </button>
  </div>
</template>

<style scoped>
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 0;
}

.setting-row + .setting-row {
  border-top: 1px solid var(--line);
}

.text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.title {
  font-weight: 600;
}

.desc {
  font-size: var(--text-sm);
  color: var(--ink-2);
}
</style>
