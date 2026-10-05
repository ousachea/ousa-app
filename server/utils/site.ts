import type { H3Event } from 'h3'
import { useRuntimeConfig } from 'nitro/runtime-config'

// The public address of the site: NUXT_PUBLIC_SITE_URL if set, otherwise the address of this request
export function siteUrl(event: H3Event) {
  const configured = String(useRuntimeConfig().public.siteUrl ?? '').replace(/\/+$/, '')
  return configured || new URL(event.req.url).origin
}
