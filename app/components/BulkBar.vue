<script setup lang="ts">
import type { BulkAction, BulkSelect } from '~/composables/useBulkSelect'

// The floating bar while selecting several (useBulkSelect): count, Select all, and the page's actions.
// It's moved to <body> so it floats over everything; it borrows the page's accent colour.
const props = defineProps<{ select: BulkSelect, actions: BulkAction[], label: string, /** plural, e.g. 'bookmarks' */ noun: string }>()

const ICONS: Record<BulkAction['icon'], string[]> = {
  pin: ['M7 3.5h10a1 1 0 0 1 1 1v16l-6-4.2-6 4.2v-16a1 1 0 0 1 1-1z'],
  star: ['M12 3.8l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z'],
  move: ['M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z', 'M10 13.5h6M13.5 11l2.5 2.5-2.5 2.5'],
  copy: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  delete: ['M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10.5 11v5M13.5 11v5'],
  archive: ['M4 5h16v4H4z', 'M5.5 9v10h13V9M10 13h4']
}

function run(a: BulkAction) {
  if (a.confirm) props.select.guard(a.confirm, a.run)
  else a.run()
}

// Room under the page's last rows so the bar never covers them
watch(() => props.select.selecting, on => document.body.classList.toggle('bulk-open', on))
onBeforeUnmount(() => document.body.classList.remove('bulk-open'))
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition name="bulk">
        <div v-if="select.selecting" class="bulk-bar" role="toolbar" :aria-label="label" :style="select.accent ? { '--accent': select.accent } : undefined">
          <div class="bulk-head">
            <button type="button" class="bulk-close" aria-label="Stop selecting" title="Done (Esc)" @click="select.stop()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
            </button>
            <span class="bulk-count" aria-live="polite">
              <template v-if="select.selected.size">{{ select.selected.size }} selected<span v-if="select.hiddenCount" class="bulk-hidden"> · {{ select.hiddenCount }} not shown</span></template>
              <template v-else>Pick {{ noun }}</template>
            </span>
            <button type="button" class="bulk-all" @click="select.toggleAll()">{{ select.allShownSelected ? 'Clear' : `Select all ${select.shownCount}` }}</button>
          </div>
          <div class="bulk-actions" :style="{ '--bulk-n': actions.length }">
            <button
              v-for="a in actions"
              :key="a.label"
              type="button"
              class="bulk-act"
              :class="{ 'bulk-delete': a.danger }"
              :disabled="!select.selected.size"
              @click="run(a)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in ICONS[a.icon]" :key="d" :d="d" /></svg>
              <span>{{ a.label }}</span>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>

  <ConfirmDialog
    :open="!!select.confirming"
    :title="select.confirming?.title ?? ''"
    confirm-label="Move to Recycle Bin"
    @confirm="select.confirming?.run(); select.confirming = null"
    @close="select.confirming = null"
  >
    <p>They go to the Recycle Bin, where you can restore them for 30 days.</p>
  </ConfirmDialog>
</template>

<style>
body.bulk-open main.tool {
  padding-bottom: 6rem;
}

@media (max-width: 640px) {
  body.bulk-open main.tool {
    padding-bottom: 10rem;
  }
}
</style>

<style scoped>
.bulk-bar {
  position: fixed;
  z-index: 90;
  left: 50%;
  bottom: max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem));
  translate: -50% 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: calc(100vw - 2rem);
  padding: 0.4rem;
  /* Concentric with the 12px buttons inside: 12 + 0.4rem padding */
  border-radius: 18px;
  background: var(--surface);
  box-shadow:
    0 0 0 1px rgb(var(--shadow) / 0.08),
    0 2px 6px rgb(var(--shadow) / 0.08),
    0 12px 32px rgb(var(--shadow) / 0.2);
}

/* On dark backgrounds a shadow alone disappears; a faint light ring keeps the edge */
:root[data-theme='dark'] .bulk-bar {
  background: color-mix(in srgb, var(--ink) 6%, var(--surface));
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.1),
    0 12px 32px rgb(0 0 0 / 0.5);
}

.bulk-head {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding-right: 0.5rem;
  border-right: 1px solid var(--line);
}

.bulk-close,
.bulk-all,
.bulk-act {
  font: inherit;
  border: 0;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  transition-property: background-color, color, scale, opacity;
  transition-duration: 0.15s;
  transition-timing-function: ease-out;
}

.bulk-close:active,
.bulk-all:active,
.bulk-act:active:not(:disabled) {
  scale: 0.96;
}

.bulk-close {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  color: var(--ink-2);
}

.bulk-close:hover {
  color: var(--ink);
  background: color-mix(in srgb, var(--ink) 7%, transparent);
}

.bulk-count {
  min-width: 6.5rem;
  padding: 0 0.25rem;
  font-size: 0.9rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.bulk-hidden {
  font-weight: 500;
  color: var(--ink-2);
}

.bulk-all {
  height: 2.5rem;
  padding: 0 0.65rem;
  font-size: 0.85rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
  white-space: nowrap;
}

.bulk-all:hover {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.bulk-actions {
  display: flex;
  gap: 0.15rem;
}

.bulk-act {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 2.5rem;
  padding: 0 0.8rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
}

.bulk-act svg,
.bulk-close svg {
  width: 1.15rem;
  height: 1.15rem;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.bulk-act:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.bulk-act:disabled {
  opacity: 0.4;
  cursor: default;
}

.bulk-delete {
  color: var(--red);
}

.bulk-delete:hover:not(:disabled) {
  background: color-mix(in srgb, var(--red) 10%, transparent);
}

/* Enter slides up a little; leaving is quicker and softer */
.bulk-enter-active {
  transition: opacity 0.2s ease-out, transform 0.2s ease-out;
}

.bulk-leave-active {
  transition: opacity 0.12s ease-out, transform 0.12s ease-out;
}

.bulk-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.bulk-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

/* Phones: count and Select all on top, four actions as an even icon row underneath */
@media (max-width: 640px) {
  .bulk-bar {
    left: 0.75rem;
    right: 0.75rem;
    translate: none;
    flex-direction: column;
    align-items: stretch;
    gap: 0.25rem;
    max-width: none;
  }

  .bulk-head {
    padding: 0 0 0.25rem;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .bulk-count {
    flex: 1;
    min-width: 0;
  }

  .bulk-actions {
    display: grid;
    grid-template-columns: repeat(var(--bulk-n, 4), 1fr);
  }

  .bulk-act {
    flex-direction: column;
    justify-content: center;
    gap: 0.2rem;
    height: auto;
    min-height: 3.25rem;
    padding: 0.35rem 0.25rem;
    font-size: 0.75rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bulk-enter-active,
  .bulk-leave-active {
    transition: opacity 0.15s ease-out;
  }

  .bulk-enter-from,
  .bulk-leave-to {
    transform: none;
  }
}

:root[data-motion='reduced'] .bulk-enter-from,
:root[data-motion='reduced'] .bulk-leave-to {
  transform: none;
}
</style>
