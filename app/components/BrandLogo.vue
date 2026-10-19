<script setup lang="ts">
// A brand's logo from the shared icon library (Simple Icons, served by /api/icon), in its brand colour:
// <BrandLogo name="stripe" />. 1em square like AppIcon. `title` names it for screen readers; leave it
// out when the brand's name is already written next to it.
const props = defineProps<{ name: string, title?: string }>()
</script>

<template>
  <img
    class="brand-logo"
    :src="brandLogoUrl(props.name)"
    :alt="props.title ?? ''"
    :aria-hidden="props.title ? undefined : 'true'"
    width="24"
    height="24"
    loading="lazy"
  >
</template>

<style>
.brand-logo {
  flex: none;
  width: 1em;
  height: 1em;
  vertical-align: -0.125em;
}
</style>
