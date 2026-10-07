<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { VaultEntry, VaultItem } from '~/composables/useVault'

// `bare`: shown inside a popup, which already has the title and the panel
const props = defineProps<{ item?: VaultItem, prefillPassword?: string, bare?: boolean }>()
const emit = defineEmits<{ done: [] }>()

const { save } = useVault()
const { play } = useSound()

const blank = (): VaultEntry => ({ site: '', url: '', username: '', password: '', notes: '' })
const form = reactive<VaultEntry>(blank())
const show = ref(false)
const busy = ref(false)

watch([() => props.item, () => props.prefillPassword], ([item, prefill]) => {
  Object.assign(form, blank(), item ? { site: item.site, url: item.url ?? '', username: item.username, password: item.password, notes: item.notes ?? '' } : {})
  if (!item && prefill) form.password = prefill
  show.value = !item && !!prefill
}, { immediate: true })

function generate() {
  form.password = generatePassword({ length: 20, sets: ['upper', 'lower', 'digits', 'symbols'], avoidLookAlikes: false })
  show.value = true
  play('retry')
}

async function submit() {
  if (!form.site.trim() || !form.password) return
  busy.value = true
  try {
    await save({ ...form, site: form.site.trim(), username: form.username.trim() }, props.item?.id)
    toast.success(props.item ? 'Changes saved' : 'Password saved')
    play('success')
    emit('done')
  } catch (e) {
    toast.error('Couldn’t save', { description: e instanceof Error ? e.message : undefined })
    play('error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="editor" :class="bare ? 'bare' : 'panel'" @submit.prevent="submit">
    <h2 v-if="!bare">{{ item ? `Edit ${item.site}` : 'Add a password' }}</h2>

    <label class="field">
      <span class="field-head">Site or app</span>
      <input v-model="form.site" class="input" placeholder="GitHub" required>
    </label>

    <label class="field">
      <span class="field-head">Web address <span class="optional">Optional</span></span>
      <input v-model="form.url" class="input" type="url" placeholder="https://github.com">
    </label>

    <label class="field">
      <span class="field-head">Username or email</span>
      <input v-model="form.username" class="input" autocomplete="off">
    </label>

    <label class="field">
      <span class="field-head">Password</span>
      <span class="secret">
        <input v-model="form.password" class="input mono" :type="show ? 'text' : 'password'" autocomplete="new-password" required>
        <button type="button" class="btn btn-quiet btn-sm" :aria-pressed="show" @click="show = !show">{{ show ? 'Hide' : 'Show' }}</button>
      </span>
    </label>
    <button type="button" class="btn btn-quiet btn-sm generate" @click="generate">Generate a strong password</button>

    <label class="field">
      <span class="field-head">Notes <span class="optional">Optional</span></span>
      <textarea v-model="form.notes" class="input" rows="3" />
    </label>

    <div class="actions">
      <button type="submit" class="btn" :disabled="busy || !form.site.trim() || !form.password">
        {{ busy ? 'Encrypting…' : item ? 'Save changes' : 'Save password' }}
      </button>
      <button type="button" class="btn btn-quiet" @click="emit('done')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.editor {
  padding: 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.editor.bare {
  padding: 0;
}

h2 {
  font-size: 1.2rem;
  overflow-wrap: anywhere;
}

.optional {
  font-weight: 400;
  color: var(--ink-3);
}

.secret {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mono {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
}

.generate {
  align-self: flex-start;
  margin-top: -0.5rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.actions .btn:first-child {
  flex: 1;
}
</style>
