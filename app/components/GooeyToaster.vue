<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'
</script>

<template>
  <ClientOnly>
    <Toaster
      theme="light"
      position="top-center"
      :gap="10"
      :toast-options="{ class: 'goey' }"
    />
  </ClientOnly>
</template>

<style>
/* Gooey look: pill-shaped toasts that squash and stretch like a blob when they appear.
   Uses the standalone `scale` property so it doesn't fight Sonner's own `transform`. */
[data-sonner-toast].goey[data-styled='true'] {
  --normal-bg: var(--ink);
  --normal-border: var(--ink);
  --normal-text: #fff;
  border-radius: 999px;
  padding: 12px 18px;
  font-family: var(--font);
  box-shadow: 0 10px 30px rgb(27 31 42 / 0.3);
}

[data-sonner-toast].goey[data-mounted='true'] {
  animation: goey-in 0.7s cubic-bezier(0.2, 0.9, 0.3, 1);
}

[data-sonner-toast].goey[data-removed='true'] {
  animation: goey-out 0.3s ease-in forwards;
}

[data-sonner-toast].goey [data-description] {
  color: #b7bdca;
}

[data-sonner-toast].goey[data-type='success'] [data-icon] { color: #3ddc84; }
[data-sonner-toast].goey[data-type='error'] [data-icon] { color: #ff6b7a; }
[data-sonner-toast].goey[data-type='warning'] [data-icon] { color: #ffd500; }
[data-sonner-toast].goey[data-type='info'] [data-icon] { color: #7aa7ff; }

@keyframes goey-in {
  0% { scale: 0.3 0.6; filter: blur(6px); }
  35% { scale: 1.08 0.9; filter: blur(0); }
  55% { scale: 0.96 1.05; }
  75% { scale: 1.02 0.98; }
  100% { scale: 1 1; }
}

@keyframes goey-out {
  to { scale: 0.6 0.8; filter: blur(4px); }
}

@media (prefers-reduced-motion: reduce) {
  [data-sonner-toast].goey[data-mounted='true'],
  [data-sonner-toast].goey[data-removed='true'] {
    animation: none;
  }
}
</style>
