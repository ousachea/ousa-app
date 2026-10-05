<script setup lang="ts">
// The static file serves the first paint; after that each load shows a freshly scrambled cube face
const favicon = ref('/favicon.svg')
onMounted(() => (favicon.value = randomCubeFavicon()))
useHead({ link: [{ key: 'favicon', rel: 'icon', type: 'image/svg+xml', href: favicon }] })
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <FloatingNav />
    <GooeyToaster />
  </div>
</template>
