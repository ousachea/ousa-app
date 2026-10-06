// Search and social-share tags for a page: title, description, canonical link, Open Graph,
// X card type and JSON-LD. The share image is a 1200×630 PNG in public/og (scripts/og-images.cjs).
interface AppSeo {
  title: string
  description: string
  path: string
  /** File name in public/og without the extension; defaults to the path ("/gold" -> "gold") */
  image?: string
  imageAlt?: string
  /** Keep the page out of search results (demos, previews) */
  noindex?: boolean
  /** Structured data describing the page */
  jsonLd?: Record<string, unknown>
}

export const SITE_NAME = 'Ousa’s Apps'

// Absolute URLs are required for og:image and canonical links. NUXT_PUBLIC_SITE_URL pins the domain;
// without it, the address the page was served from is used.
export function useSiteUrl() {
  const configured = (useRuntimeConfig().public.siteUrl as string | undefined)?.replace(/\/+$/, '')
  return configured || useRequestURL().origin
}

export const ogSlug = (path: string) => path.replace(/^\/+|\/+$/g, '') || 'home'

export function useAppSeo(seo: AppSeo | (() => AppSeo)) {
  const site = useSiteUrl()
  const value = computed(() => (typeof seo === 'function' ? seo() : seo))
  const url = computed(() => `${site}${value.value.path}`)
  const image = computed(() => `${site}/og/${value.value.image ?? ogSlug(value.value.path)}.png`)

  useSeoMeta({
    description: () => value.value.description,
    ogType: 'website',
    ogSiteName: SITE_NAME,
    ogTitle: () => value.value.title,
    ogDescription: () => value.value.description,
    ogUrl: () => url.value,
    ogImage: () => image.value,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageType: 'image/png',
    ogImageAlt: () => value.value.imageAlt ?? `${value.value.title} — ${SITE_NAME}`,
    ogLocale: 'en_US',
    // X reads title, description and image from the Open Graph tags; only the card type is its own
    twitterCard: 'summary_large_image',
    robots: () => (value.value.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large')
  })

  useHead({
    link: [{ key: 'canonical', rel: 'canonical', href: () => url.value }],
    script: () => value.value.jsonLd
      ? [{ key: 'ld-json', type: 'application/ld+json', innerHTML: JSON.stringify({ '@context': 'https://schema.org', ...value.value.jsonLd }) }]
      : []
  })

  return { url, image, site }
}
