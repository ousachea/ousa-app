<script setup lang="ts">
// The static file serves the first paint; after that each load shows a freshly scrambled cube face
const favicon = ref('/favicon.svg')
onMounted(() => (favicon.value = randomCubeFavicon()))
// App pages set their own icon (ToolPage); everywhere else shows the cube
const appFavicon = useState<string | null>('app-favicon', () => null)
useHead({ link: [{ key: 'favicon', rel: 'icon', type: 'image/svg+xml', href: () => appFavicon.value ?? favicon.value }] })

// Share-image cards are screenshotted alone, without the menu or toasts on top
const route = useRoute()
const bare = computed(() => route.path.startsWith('/og-card/'))
// Opening the site on its home page (from a phone's home screen, say) starts with a splash; only the
// page it was opened on counts, so it's decided once
const launchedHome = route.path === '/'
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <template v-if="!bare">
      <LaunchSplash v-if="launchedHome" />
      <FloatingNav />
      <ClientOnly>
        <CommandPalette />
        <ContextMenu />
        <PullIndicator />
        <OfflineBadge />
        <MobileKeyboard />
        <AppSplash />
      </ClientOnly>
      <GooeyToaster />
    </template>
  </div>
</template>
