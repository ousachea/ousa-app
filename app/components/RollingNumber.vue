<script setup lang="ts">
// A number whose digits roll when they change (CHECKLIST.md #60): the old digit slides up and fades
// as the new one comes in from below. Only digits that actually change move, so a ticking clock
// shows one small motion a second. Off with reduced motion. Screen readers get the plain value.
const props = defineProps<{ value: string | number }>()
const chars = computed(() => String(props.value).split(''))
</script>

<template>
  <span class="rolling">
    <span class="sr-only">{{ value }}</span>
    <span v-for="(c, i) in chars" :key="`${chars.length - i}`" class="slot" aria-hidden="true">
      <Transition name="roll">
        <span :key="c" class="digit">{{ c }}</span>
      </Transition>
    </span>
  </span>
</template>

<style scoped>
.rolling {
  display: inline-flex;
  font-variant-numeric: tabular-nums;
}

.slot {
  position: relative;
  display: inline-block;
  overflow: hidden;
  /* Room for the incoming digit without clipping descenders */
  padding-block: 0.05em;
  margin-block: -0.05em;
}

.digit {
  display: inline-block;
}

.roll-enter-active,
.roll-leave-active {
  transition: translate 0.35s var(--ease-out), opacity 0.35s var(--ease-out);
}

.roll-leave-active {
  position: absolute;
  left: 0;
  top: 0.05em;
}

.roll-enter-from {
  translate: 0 60%;
  opacity: 0;
}

.roll-leave-to {
  translate: 0 -60%;
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .roll-enter-active,
  .roll-leave-active {
    transition: none;
  }
}
</style>
