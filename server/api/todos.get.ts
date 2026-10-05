import { defineEventHandler, HTTPError } from 'h3'

export interface Todo {
  id: number | string
  name: string
}

export default defineEventHandler(async (event) => {
  const supabase = createSupabaseServerClient(event)
  const { data, error } = await supabase.from('todos').select()

  if (error) {
    // Pass Supabase's message through (e.g. a missing table) so the page can explain what to fix
    throw new HTTPError({ status: 502, message: error.message, data: { code: error.code } })
  }
  return (data ?? []) as Todo[]
})
