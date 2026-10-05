import { createServerClient } from '@supabase/ssr'
import { HTTPError, parseCookies, setCookie, type H3Event } from 'h3'
import { useRuntimeConfig } from 'nitro/runtime-config'

// Server-side Supabase client for API routes and server middleware.
// Reads the visitor's auth cookies from the request and writes refreshed ones to the response.
export function createSupabaseServerClient(event: H3Event) {
  const { supabaseUrl, supabaseKey } = useRuntimeConfig().public
  if (!supabaseUrl || !supabaseKey) {
    // .env is only read in development; a deployed server needs these set as real environment variables
    throw new HTTPError({
      status: 500,
      message: 'Supabase is not configured. Set NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_KEY.'
    })
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return Object.entries(parseCookies(event)).map(([name, value]) => ({ name, value: value ?? '' }))
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) setCookie(event, name, value, options)
      }
    }
  })
}

// Supabase auth cookies are named sb-<project-ref>-auth-token (split into .0, .1… when large)
export const hasSupabaseSession = (event: H3Event) =>
  Object.keys(parseCookies(event)).some(name => name.startsWith('sb-') && name.includes('-auth-token'))
