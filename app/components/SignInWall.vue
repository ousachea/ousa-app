<script setup lang="ts">
// What the Recycle Bin shows instead of itself while you're signed out (useSignInGate); apps show their example data
defineProps<{ name: string, checking?: boolean }>()
</script>

<template>
  <div v-if="checking" class="wall checking" aria-busy="true" aria-label="Checking your sign-in" />
  <section v-else class="wall" aria-labelledby="wall-title">
    <span class="lock" aria-hidden="true">
      <AnimatedIcon name="lock" trigger="loop" />
    </span>
    <h2 id="wall-title">Sign in to open {{ name }}</h2>
    <p>Your data only shows once you’re signed in, so nobody else using this device can see it.</p>
    <VaultAuth purpose="account" class="wall-auth" />
  </section>
</template>

<style scoped>
.wall {
  width: min(100%, 26rem);
  margin: 1rem auto 0;
  padding: 2rem 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
}

.checking {
  height: 16rem;
  background: var(--surface-2);
  border-color: transparent;
}

.lock {
  width: 3rem;
  height: 3rem;
  display: grid;
  place-items: center;
  margin-bottom: 0.75rem;
  /* Darkened a little, so light app colours (yellow, gold) still show on their own tint */
  color: color-mix(in srgb, var(--accent) 75%, var(--ink));
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  border-radius: var(--radius-lg);
}

.lock svg {
  width: 1.5rem;
  height: 1.5rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

h2 {
  font-size: var(--text-lg);
  text-wrap: balance;
}

p {
  margin: 0.4rem 0 0;
  color: var(--ink-2);
  font-size: var(--text-base);
  text-wrap: pretty;
}

.wall-auth {
  align-self: stretch;
  margin-top: 1.1rem;
}
</style>
