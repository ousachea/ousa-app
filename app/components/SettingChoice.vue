<script setup lang="ts" generic="T extends string | number">
// One pick-one preference: a title, a line explaining it, and the choices. A few short ones show as a
// segmented control; more become a dropdown. The on/off sibling is SettingRow.
const props = defineProps<{ title: string, description?: string, options: readonly { value: T, label: string }[] }>()
const model = defineModel<T>({ required: true })
const id = useId()
const { play } = useSound()

const segmented = computed(() => props.options.length <= 4 && props.options.every(o => o.label.length <= 12))

function pick(v: T) {
  model.value = v
  play('select')
}
</script>

<template>
  <div class="setting-choice" :class="{ stacked: !segmented }">
    <div class="text">
      <span :id="`${id}-title`" class="title">{{ title }}</span>
      <span v-if="description" class="desc">{{ description }}</span>
    </div>
    <div v-if="segmented" class="segmented" role="radiogroup" :aria-labelledby="`${id}-title`">
      <label v-for="o in options" :key="o.value" :class="{ active: model === o.value }">
        <input type="radio" :name="id" :checked="model === o.value" @change="pick(o.value)">{{ o.label }}
      </label>
    </div>
    <AppSelect v-else v-model="model" class="select" :aria-label="title" :options="options" />
  </div>
</template>

<style scoped>
.setting-choice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.6rem 1rem;
  padding: 0.85rem 0;
}

.text {
  display: flex;
  flex-direction: column;
  flex: 1 1 12rem;
  min-width: 0;
}

.title {
  font-weight: 600;
}

.desc {
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.segmented {
  flex: none;
  font-size: 0.85rem;
}

.segmented label {
  padding-inline: 0.7rem;
  white-space: nowrap;
}

.select {
  flex: 0 1 15rem;
}
</style>
