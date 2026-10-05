// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  routeRules: {
    // The password saver now lives in the Passwords tool
    '/vault': { redirect: { to: '/password?tab=saved', statusCode: 301 } }
  },
  runtimeConfig: {
    public: {
      // Set NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_KEY, or SUPABASE_URL / SUPABASE_KEY as in Supabase's quickstart
      supabaseUrl: process.env.SUPABASE_URL ?? '',
      supabaseKey: process.env.SUPABASE_KEY ?? ''
    }
  },
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
      script: [
        {
          // Apply the saved theme before first paint so dark mode never flashes white
          innerHTML: "(function(){try{var p=localStorage.getItem('ousa-app:theme')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()",
          tagPosition: 'head'
        }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Noto+Sans+Khmer:wght@400..700&display=swap' }
      ]
    }
  }
})
