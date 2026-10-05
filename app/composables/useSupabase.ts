import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

// Browser-side Supabase client, created once and shared. Use it for realtime, auth and client-side queries.
export function useSupabase() {
  if (import.meta.server) {
    throw new Error('useSupabase() is browser-only. On the server, use createSupabaseServerClient(event) in server/.')
  }
  if (!client) {
    const { supabaseUrl, supabaseKey } = useRuntimeConfig().public
    client = createBrowserClient(supabaseUrl, supabaseKey)
  }
  return client
}
