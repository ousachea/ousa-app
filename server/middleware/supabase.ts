import { defineEventHandler } from 'h3'

// Keeps a signed-in visitor's session fresh: refreshing the token rewrites the auth cookies.
// Visitors without a Supabase session are skipped, so normal page loads make no extra network call.
export default defineEventHandler(async (event) => {
  if (!hasSupabaseSession(event)) return
  await createSupabaseServerClient(event).auth.getClaims()
})
