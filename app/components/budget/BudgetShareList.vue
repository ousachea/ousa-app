<script setup lang="ts">
// Ranked spending, one row per category (or subcategory, method…): name, a thin share bar in the
// row's own colour, the amount and its share. Text stays in text colours; the bar carries identity.
export interface ShareRow {
  key: string
  label: string
  icon?: string
  color?: string
  value: number | undefined
  detail?: string
}

const props = withDefaults(defineProps<{ rows: ShareRow[], format: (v: number) => string, limit?: number, clickable?: boolean }>(), { limit: 0, clickable: true })
const emit = defineEmits<{ pick: [key: string] }>()

const sum = computed(() => props.rows.reduce((n, r) => n + (r.value ?? 0), 0))
const shown = computed(() => {
  if (!props.limit || props.rows.length <= props.limit) return props.rows
  // Past the limit, the rest fold into one "Other" row rather than getting colours of their own
  const head = props.rows.slice(0, props.limit - 1)
  const rest = props.rows.slice(props.limit - 1)
  return [...head, { key: '', label: `${rest.length} more`, color: 'gray', value: rest.reduce((n, r) => n + (r.value ?? 0), 0) }]
})
const pct = (v: number | undefined) => (sum.value && v ? (v / sum.value) * 100 : 0)
</script>

<template>
  <ul class="share-list">
    <li v-for="r in shown" :key="r.key || 'other'" :class="`slot-${r.color ?? 'gray'}`">
      <component :is="clickable && r.key ? 'button' : 'div'" :type="clickable && r.key ? 'button' : undefined" class="row" @click="clickable && r.key && emit('pick', r.key)">
        <span class="top">
          <span class="name"><span v-if="r.icon" aria-hidden="true">{{ r.icon }}</span> {{ r.label }}</span>
          <span class="value">{{ r.value === undefined ? '…' : format(r.value) }}</span>
          <span class="pct">{{ Math.round(pct(r.value)) }}%</span>
        </span>
        <span class="bar" aria-hidden="true"><span :style="{ width: `${pct(r.value)}%` }" /></span>
        <span v-if="r.detail" class="detail">{{ r.detail }}</span>
      </component>
    </li>
  </ul>
</template>

<style scoped>
.share-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.row {
  width: 100%;
  padding: 0.4rem 0.5rem;
  margin-inline: -0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  border-radius: var(--radius);
  box-sizing: content-box;
}

button.row {
  cursor: pointer;
}

button.row:hover {
  background: var(--surface-2);
}

.top {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.value {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.pct {
  width: 3ch;
  font-size: var(--text-xs);
  color: var(--ink-3);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.bar {
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  overflow: hidden;
}

.bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--slot);
}

.detail {
  font-size: var(--text-xs);
  color: var(--ink-3);
}
</style>
