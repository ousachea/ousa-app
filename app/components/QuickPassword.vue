<script setup lang="ts">
import { toast } from 'vue-sonner'

// Settings → Account & sync: a password for signing back in without the Google window (useVault).
// Same account and data; separate from the password vault's master password.
const { vault, setQuickPassword, removeQuickPassword } = useVault()
const { play } = useSound()

const MIN_LENGTH = 6
const editing = ref(false)
const password = ref('')
const confirm = ref('')
const busy = ref(false)
const error = ref('')

function startEditing() {
  editing.value = true
  error.value = ''
  password.value = ''
  confirm.value = ''
}

async function save() {
  if (busy.value) return
  // Said on submit, next to the button, rather than greying the button out
  if (password.value.length < MIN_LENGTH) {
    error.value = `Use at least ${MIN_LENGTH} characters.`
    play('error')
    return
  }
  if (confirm.value !== password.value) {
    error.value = 'The two passwords don’t match.'
    play('error')
    return
  }
  busy.value = true
  error.value = ''
  const changing = vault.quickPassword
  try {
    await setQuickPassword(password.value)
    editing.value = false
    play('success')
    toast.success(changing ? 'Quick sign-in password changed' : 'Quick sign-in is on', { description: `Next time, sign in as ${vault.email} with this password.` })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Something went wrong. Try again.'
    play('error')
  } finally {
    busy.value = false
    password.value = ''
    confirm.value = ''
  }
}

async function remove() {
  busy.value = true
  error.value = ''
  try {
    await removeQuickPassword()
    play('toggle-off')
    toast('Quick sign-in is off', { description: 'Sign in with Google from now on.' })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Something went wrong. Try again.'
    play('error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="panel quick" aria-labelledby="quick-title">
    <div class="quick-top">
      <span class="quick-icon" :class="{ on: vault.quickPassword }" aria-hidden="true"><AppIcon name="key-round" /></span>
      <div class="quick-text">
        <h3 id="quick-title">
          Quick sign-in password
          <span class="state" :class="{ on: vault.quickPassword }">{{ vault.quickPassword ? 'On' : 'Off' }}</span>
        </h3>
        <p>Sign back in with a password instead of going through Google every time. Same account, same data.</p>
      </div>
      <div v-if="!editing" class="quick-actions">
        <button type="button" class="btn btn-sm" :class="{ 'btn-quiet': vault.quickPassword }" @click="startEditing">{{ vault.quickPassword ? 'Change' : 'Set up' }}</button>
        <button v-if="vault.quickPassword" type="button" class="btn btn-quiet btn-sm" :disabled="busy" @click="remove">Turn off</button>
      </div>
    </div>

    <form v-if="editing" class="quick-form" @submit.prevent="save">
      <input :value="vault.email" type="email" autocomplete="username" hidden>
      <div class="pair">
        <PasswordField v-model="password" :label="vault.quickPassword ? 'New password' : 'Password'" autocomplete="new-password" :placeholder="`At least ${MIN_LENGTH} characters`" />
        <PasswordField v-model="confirm" label="Type it again" autocomplete="new-password" />
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="submit" class="btn btn-sm" :disabled="busy">{{ busy ? 'Saving…' : 'Save password' }}</button>
        <button type="button" class="btn btn-quiet btn-sm" @click="editing = false; error = ''">Cancel</button>
        <span class="note">Google may ask you to confirm it’s you first. This isn’t your vault’s master password.</span>
      </div>
    </form>
    <p v-else-if="error" class="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.quick {
  padding: 1.1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.quick-top {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.quick-icon {
  flex: none;
  width: 2.75rem;
  height: 2.75rem;
  display: grid;
  place-items: center;
  color: var(--ink-2);
  background: var(--surface-2);
  border-radius: 12px;
  transition: color 0.2s, background-color 0.2s;
}

.quick-icon.on {
  color: #fff;
  background: var(--green);
}

.quick-icon svg {
  width: 1.3rem;
  height: 1.3rem;
}

.quick-text {
  flex: 1;
  min-width: 0;
}

h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
}

.quick-text p {
  margin: 0.15rem 0 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.state {
  padding: 0.05rem 0.5rem;
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--ink-2);
  background: var(--surface-2);
  border-radius: 999px;
}

.state.on {
  color: var(--good-ink);
  background: color-mix(in srgb, var(--green) 14%, var(--surface));
}

.quick-actions {
  flex: none;
  display: flex;
  gap: 0.4rem;
}

/* Lines up under the text, past the icon */
.quick-form {
  margin-left: 3.65rem;
  padding-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  border-top: 1px solid var(--line);
}

.pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  max-width: 34rem;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.6rem;
}

.note {
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.error {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--bad-ink);
}

@media (max-width: 640px) {
  .quick-top {
    flex-wrap: wrap;
  }

  .quick-actions {
    width: 100%;
    padding-left: 3.65rem;
  }

  .quick-form {
    margin-left: 0;
  }

  .pair {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
