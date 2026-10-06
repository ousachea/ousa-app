import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

// Set when a password reset link signs this browser in. Recorded as soon as the client exists,
// because Supabase emits PASSWORD_RECOVERY only once, possibly before anything else subscribes.
export const passwordRecovery = ref(false)

// Browser-side Supabase client, created once and shared. Use it for realtime, auth and client-side queries.
export function useSupabase() {
  if (import.meta.server) {
    throw new Error('useSupabase() is browser-only. On the server, use createSupabaseServerClient(event) in server/.')
  }
  if (!client) {
    const { supabaseUrl, supabaseKey } = useRuntimeConfig().public
    client = createBrowserClient(supabaseUrl, supabaseKey)
    client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') passwordRecovery.value = true
    })
  }
  return client
}
