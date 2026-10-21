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
   Uses the standalone `scale` property so it doesn't fight Sonner's own `transform`.
   The opposite of the page: black in light mode, white in dark mode, so it always stands out. */
[data-sonner-toast].goey {
  --goey-bg: #000;
  --goey-text: #fff;
  --goey-muted: #b7bdca;
  --goey-success: #3ddc84;
  --goey-error: #ff6b7a;
  --goey-warning: #ffd500;
  --goey-info: #7aa7ff;
}

:root[data-theme='dark'] [data-sonner-toast].goey {
  --goey-bg: #fff;
  --goey-text: #0b0d12;
  --goey-muted: #4a5163;
  --goey-success: #12873f;
  --goey-error: #d02a3c;
  --goey-warning: #a86b00;
  --goey-info: #2f62d6;
}

[data-sonner-toast].goey[data-styled='true'] {
  --normal-bg: var(--goey-bg);
  --normal-border: var(--goey-bg);
  --normal-text: var(--goey-text);
  border-radius: var(--radius-pill);
  padding: 12px 18px;
  font-family: var(--font);
  box-shadow: 0 10px 30px rgb(var(--shadow) / 0.3);
}

[data-sonner-toast].goey[data-mounted='true'] {
  animation: goey-in 0.7s cubic-bezier(0.2, 0.9, 0.3, 1);
}

[data-sonner-toast].goey[data-removed='true'] {
  animation: goey-out 0.3s ease-in forwards;
}

[data-sonner-toast].goey [data-description] {
  color: var(--goey-muted);
}

[data-sonner-toast].goey[data-type='success'] [data-icon] { color: var(--goey-success); }
[data-sonner-toast].goey[data-type='error'] [data-icon] { color: var(--goey-error); }
[data-sonner-toast].goey[data-type='warning'] [data-icon] { color: var(--goey-warning); }
[data-sonner-toast].goey[data-type='info'] [data-icon] { color: var(--goey-info); }

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

/* Lite effects: a plain fade; blurring a moving element is expensive on old graphics chips */
:root[data-effects='lite'] [data-sonner-toast].goey[data-mounted='true'] {
  animation: goey-fade 0.15s ease-out;
}

:root[data-effects='lite'] [data-sonner-toast].goey[data-removed='true'] {
  animation: none;
}

@keyframes goey-fade {
  from { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  [data-sonner-toast].goey[data-mounted='true'],
  [data-sonner-toast].goey[data-removed='true'] {
    animation: none;
  }
}
</style>
