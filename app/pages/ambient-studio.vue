<script setup lang="ts">
import { useAmbientStudio } from '~/composables/ambient-studio/useAmbientStudio'

// Ambient Studio: YouTube ambience, a sound mixer made in the browser, scenes and timers.
// Everything it needs lives in its own ambient-studio folders and storage key.
const studio = useAmbientStudio()
onMounted(studio.setup)
onBeforeUnmount(studio.teardown)

const tint = computed(() => studio.current.value.tint)
</script>

<template>
  <ToolPage header="bar">
    <template #settings>
      <AmbientStudioSettings />
    </template>

    <div class="ambient-studio" :style="{ '--tint': tint }">
      <AmbientStudioSidebar class="side" />
      <AmbientStudioStage class="stage" />
      <AmbientStudioTransport class="transport" />
      <AmbientStudioPanel class="panel" />
      <AmbientStudioLibrary class="library" />
    </div>
  </ToolPage>
</template>

<style scoped>
/* Always dark, whatever the app's theme: its own tokens, scoped to the studio */
.ambient-studio {
  --as-bg: #0b0d12;
  --as-raised: #12151c;
  --as-hover: rgb(255 255 255 / 0.06);
  --as-line: rgb(255 255 255 / 0.08);
  --as-ink: #eceef3;
  --as-ink-2: #a9b0bd;
  --as-ink-3: #868e9c;
  /* Shared controls (.btn, .input, empty states) pick these up inside the studio */
  --ink: var(--as-ink);
  --ink-2: var(--as-ink-2);
  --ink-3: var(--as-ink-3);
  --surface: var(--as-raised);
  --surface-2: #181c24;
  --line: rgb(255 255 255 / 0.1);
  --accent: var(--tint);
  --accent-btn: var(--tint);
  --on-accent: #0b0d12;
  color-scheme: dark;

  display: grid;
  grid-template-columns: 14rem minmax(0, 1fr) 21rem;
  grid-template-areas:
    'side stage panel'
    'side transport panel'
    'side library panel';
  grid-template-rows: auto auto 1fr;
  gap: 1rem 1.5rem;
  padding: clamp(0.75rem, 2vw, 1.5rem);
  color: var(--as-ink);
  background:
    radial-gradient(70% 50% at 50% 0%, color-mix(in srgb, var(--tint) 13%, transparent), transparent 70%),
    var(--as-bg);
  border-radius: 28px;
  box-shadow: 0 30px 80px -30px rgb(0 0 0 / 0.5);
  transition: background-color 0.8s;
}

.side {
  grid-area: side;
  align-self: start;
  position: sticky;
  top: var(--pin-top);
  padding-top: 0.25rem;
}

.stage { grid-area: stage; }
.transport { grid-area: transport; }
.library { grid-area: library; margin-top: 1rem; }

.panel {
  grid-area: panel;
  align-self: start;
  position: sticky;
  top: var(--pin-top);
}

/* No sidebar: its sections become tabs above the library */
@media (max-width: 1180px) {
  .ambient-studio {
    grid-template-columns: minmax(0, 1fr) 20rem;
    grid-template-areas:
      'stage panel'
      'transport panel'
      'library panel';
  }

  .side {
    display: none;
  }
}

/* One column: stage, controls, mixer and timer, then the library */
@media (max-width: 860px) {
  .ambient-studio {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'stage' 'transport' 'panel' 'library';
    grid-template-rows: auto;
    gap: 0.75rem;
    border-radius: 22px;
  }

  .panel {
    position: static;
  }

  .library {
    margin-top: 0.75rem;
  }
}

@media (max-width: 520px) {
  .ambient-studio {
    margin-inline: calc(var(--gutter, 1rem) * -0.5);
    padding: 0.6rem;
  }
}
</style>
