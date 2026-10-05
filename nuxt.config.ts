// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  app: {
    // Default for the first navigation; the transition middleware picks the direction after that
    pageTransition: { name: 'slide-forward', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Ousa App',
      titleTemplate: '%s · Ousa App',
      meta: [
        { name: 'description', content: 'Small tools: make QR codes, check Cambodian phone numbers, and compress images in your browser.' },
        { name: 'theme-color', content: '#e8ebf0' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&display=swap' }
      ]
    }
  }
})
