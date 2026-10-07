// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  routeRules: {
    // The password saver now lives in the Passwords tool
    '/vault': { redirect: { to: '/password?tab=saved', status: 301 } }
  },
  runtimeConfig: {
    public: {
      // Firebase web app config: NUXT_PUBLIC_FIREBASE_API_KEY, _AUTH_DOMAIN, _PROJECT_ID and _APP_ID
      firebase: {
        apiKey: '',
        authDomain: '',
        projectId: '',
        appId: ''
      },
      // Google OAuth client ID for importing contacts on /phone; set NUXT_PUBLIC_GOOGLE_CLIENT_ID
      googleClientId: '',
      // The one Google account this app signs in to; Google offers it first (NUXT_PUBLIC_OWNER_EMAIL)
      ownerEmail: '',
      // The site's public address for canonical links and share images, e.g. https://ousa.app (NUXT_PUBLIC_SITE_URL).
      // Empty uses whatever address the page was served from.
      siteUrl: ''
    }
  },
  app: {
    // Default for the first navigation; the transition middleware picks the direction after that
    pageTransition: { name: 'slide-forward', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Ousa’s Apps',
      titleTemplate: '%s · Ousa’s Apps',
      meta: [
        { name: 'description', content: 'Free everyday tools: check Cambodian phone numbers, KHR/USD rates, gold price in chi and damlung, salary tax, QR codes, passwords and more.' },
        { name: 'application-name', content: 'Ousa’s Apps' },
        { name: 'apple-mobile-web-app-title', content: 'Ousa’s Apps' },
        { name: 'theme-color', content: '#e8ebf0' }
      ],
      script: [
        {
          // Apply the saved theme before first paint so dark mode never flashes white
          innerHTML: "(function(){try{var p=localStorage.getItem('ousa-app:theme')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()",
          tagPosition: 'head'
        },
        {
          // Lite effects for old or slow computers, decided before first paint (see composables/useEffects.ts)
          innerHTML: "(function(){try{var p=localStorage.getItem('ousa-app:effects')||'auto';var n=navigator;var slow=localStorage.getItem('ousa-app:effects-detected')==='slow'||(n.hardwareConcurrency||8)<=2||(n.deviceMemory||8)<=2||!!(n.connection&&n.connection.saveData);document.documentElement.dataset.effects=p==='lite'||(p==='auto'&&slow)?'lite':'full'}catch(e){}})()",
          tagPosition: 'head'
        }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Noto+Sans+Khmer:wght@400..700&display=swap' }
      ]
    }
  }
})
