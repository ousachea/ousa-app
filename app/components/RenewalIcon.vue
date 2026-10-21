<script setup lang="ts">
// A subscription's icon (CHECKLIST.md #54). Automatic: the service's logo when the name is a known
// service (Netflix, Spotify…; from the shared library, else its own site icon), else a letter in a
// colour from the name. It can be set by hand: 'svc:<service>' to look like another service, 'letter' for just the letter, 'ico:<set>:<name>' for an
// icon from the library (IconLibrary) on the name's colour, or an image link.
const props = defineProps<{ name: string, icon?: string }>()
const broken = ref(false)

const service = computed(() => {
  if (props.icon?.startsWith('svc:')) return SERVICES.find(s => s.name === props.icon!.slice(4))
  return props.icon ? undefined : findService(props.name)
})
const glyph = computed(() => props.icon?.startsWith(ICON_LIBRARY_PREFIX) ? props.icon.slice(ICON_LIBRARY_PREFIX.length) : undefined)
const src = computed(() => {
  if (props.icon?.startsWith('http')) return props.icon
  if (glyph.value) return libraryIconUrl(glyph.value)
  if (!service.value) return undefined
  return service.value.brand ? brandLogoUrl(service.value.brand) : siteLogo(service.value.domain)
})
watch(src, () => (broken.value = false))

// A steady colour per name for letter tiles
const color = computed(() => {
  if (service.value) return service.value.color
  let h = 0
  for (const c of props.name) h = (h * 31 + c.charCodeAt(0)) % 360
  return `hsl(${h} 55% 42%)`
})
const letter = computed(() => (props.name.trim()[0] ?? '?').toUpperCase())
</script>

<template>
  <span class="renewal-icon" :class="{ image: src && !broken && !glyph }" :style="{ '--c': color }" aria-hidden="true">
    <img v-if="src && !broken" :src="src" alt="" loading="lazy" referrerpolicy="no-referrer" @error="broken = true">
    <span v-else>{{ letter }}</span>
  </span>
</template>

<style scoped>
.renewal-icon {
  flex: none;
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  font-size: var(--text-title);
  font-weight: 800;
  color: #fff;
  background: var(--c);
  border-radius: var(--radius);
  box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.12);
}

.renewal-icon.image {
  background: #fff;
  box-shadow: inset 0 0 0 1px var(--line);
}

img {
  width: 1.6rem;
  height: 1.6rem;
  object-fit: contain;
}
</style>
