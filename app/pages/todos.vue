<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Tool } from '~/utils/tools'

interface Todo {
  id: number | string
  name: string
}

const PAGE: Tool = {
  to: '/todos',
  name: 'Todos',
  summary: 'Your todos, loaded from Supabase.',
  color: 'var(--settings)',
  icon: 'list'
}

// Creates the table, lets anyone read it (the publishable key acts as the anonymous role), and adds two rows
const SETUP_SQL = `create table public.todos (
  id bigint generated always as identity primary key,
  name text not null
);

alter table public.todos enable row level security;

create policy "Anyone can read todos"
  on public.todos for select
  to anon
  using (true);

insert into public.todos (name)
values ('Try Ousa’s Apps'), ('Connect Supabase');`

const { play } = useSound()
const { data: todos, error, status, refresh } = await useFetch<Todo[]>('/api/todos')

const errorCode = computed(() => (error.value?.data as { data?: { code?: string } } | undefined)?.data?.code)
const errorMessage = computed(() => (error.value?.data as { message?: string } | undefined)?.message ?? error.value?.message)
const tableMissing = computed(() => errorCode.value === 'PGRST205' || errorCode.value === '42P01')

async function copySql() {
  try {
    await navigator.clipboard.writeText(SETUP_SQL)
    toast.success('SQL copied', { description: 'Paste it into the Supabase SQL editor and run it.' })
    play('copy')
  } catch {
    toast.error('Could not copy', { description: 'Your browser blocked clipboard access.' })
    play('error')
  }
}

async function reload() {
  await refresh()
  if (error.value) play('error')
  else play('success')
}
</script>

<template>
  <ToolPage :tool="PAGE" width="760px">
    <section v-if="status === 'pending' && !todos" class="panel skeleton" aria-busy="true" aria-label="Loading todos">
      <span v-for="n in 3" :key="n" />
    </section>

    <section v-else-if="tableMissing" class="setup">
      <Step :n="1" title="Create the todos table" hint="Your Supabase project is connected, but it doesn’t have a todos table yet.">
        <div class="panel code">
          <pre><code>{{ SETUP_SQL }}</code></pre>
          <div class="code-actions">
            <button type="button" class="btn btn-sm" @click="copySql">Copy SQL</button>
            <a class="btn btn-quiet btn-sm" :href="SUPABASE_SQL_EDITOR" target="_blank" rel="noopener">Open the SQL editor</a>
          </div>
        </div>
      </Step>

      <Step :n="2" title="Load your todos" hint="Run the SQL in Supabase, then come back here." class="step-gap">
        <button type="button" class="btn" :disabled="status === 'pending'" @click="reload">
          {{ status === 'pending' ? 'Checking…' : 'Load todos' }}
        </button>
      </Step>
    </section>

    <section v-else-if="error" class="panel problem" role="alert">
      <h2>Couldn’t load todos</h2>
      <p>Supabase said: {{ errorMessage }}</p>
      <button type="button" class="btn btn-quiet btn-sm" :disabled="status === 'pending'" @click="reload">Try again</button>
    </section>

    <section v-else-if="!todos?.length" class="panel empty">
      <h2>No todos yet</h2>
      <p>
        The todos table is empty, or Row Level Security is hiding its rows.
        Add rows in Supabase, and make sure a policy lets the anon role select them.
      </p>
      <button type="button" class="btn btn-quiet btn-sm" @click="reload">Refresh</button>
    </section>

    <section v-else>
      <div class="list-head">
        <p>{{ todos.length }} {{ todos.length === 1 ? 'todo' : 'todos' }}</p>
        <button type="button" class="btn btn-quiet btn-sm" :disabled="status === 'pending'" @click="reload">Refresh</button>
      </div>
      <ul class="panel list">
        <li v-for="todo in todos" :key="todo.id">
          <span class="bullet" aria-hidden="true" />
          {{ todo.name }}
        </li>
      </ul>
    </section>
  </ToolPage>
</template>

<style scoped>
.skeleton {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.skeleton span {
  height: 1rem;
  border-radius: 6px;
  background: var(--surface-2);
  animation: pulse 1.2s ease-in-out infinite alternate;
}

.skeleton span:nth-child(2) { width: 75%; }
.skeleton span:nth-child(3) { width: 55%; }

.step-gap {
  margin-top: 2rem;
}

.code {
  overflow: hidden;
}

/* Monospace because this is code to paste into Supabase */
pre {
  margin: 0;
  padding: 1.1rem 1.25rem;
  overflow-x: auto;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.85rem;
  line-height: 1.55;
  background: var(--surface-2);
  border-bottom: 1px solid var(--line);
}

.code-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
}

.problem,
.empty {
  padding: 1.5rem;
  text-align: center;
}

.problem h2,
.empty h2 {
  font-size: 1.2rem;
}

.problem p,
.empty p {
  margin: 0.5rem auto 1rem;
  max-width: 32rem;
  color: var(--ink-2);
}

.problem {
  border-color: color-mix(in srgb, var(--red) 40%, var(--line));
}

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.list-head p {
  margin: 0;
  font-weight: 600;
  color: var(--ink-2);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.list li {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.9rem 1.15rem;
  font-size: 1.05rem;
}

.list li + li {
  border-top: 1px solid var(--line);
}

.bullet {
  flex: none;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 2px;
  background: var(--accent);
  box-shadow: 0 0 0 2px var(--plastic-edge);
}

@keyframes pulse {
  to { opacity: 0.45; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton span { animation: none; }
}
</style>
