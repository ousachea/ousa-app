// SQL the user runs once in Supabase. Only ciphertext is stored; RLS limits every row to its owner.
export const VAULT_SETUP_SQL = `create table public.vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vault_items enable row level security;

create policy "Owners can read their items"
  on public.vault_items for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Owners can add items"
  on public.vault_items for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Owners can update their items"
  on public.vault_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owners can delete their items"
  on public.vault_items for delete to authenticated
  using ((select auth.uid()) = user_id);`

export const SUPABASE_SQL_EDITOR = 'https://supabase.com/dashboard/project/gbrakhuipohomossuvas/sql/new'
