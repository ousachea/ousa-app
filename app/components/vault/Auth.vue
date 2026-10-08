<script setup lang="ts">
import { toast } from 'vue-sonner'

// `account` is the sign-in popup from the top bar: same Google account, worded for syncing data
const props = withDefaults(defineProps<{ purpose?: 'vault' | 'account' }>(), { purpose: 'vault' })
const emit = defineEmits<{ done: [] }>()
const forAccount = computed(() => props.purpose === 'account')

const { vault, signIn, unlock, setMasterPassword, signOut } = useVault()
const { play } = useSound()

const MIN_LENGTH = 6

// `reset`: forgot the master password and choosing a new one
const mode = ref<'unlock' | 'reset'>('unlock')
const password = ref('')
const confirm = ref('')
const show = ref(false)
const busy = ref(false)
const error = ref('')

const signedOut = computed(() => vault.status === 'signed-out')
// Forms that set a new master password need it typed twice and long enough
const choosing = computed(() => vault.status === 'new' || mode.value === 'reset')

const problem = computed(() => {
  if (!choosing.value) return ''
  if (password.value && password.value.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters. A short sentence is easy to remember and hard to guess.`
  if (confirm.value && confirm.value !== password.value) return 'The two passwords don’t match.'
  return ''
})

const canSubmit = computed(() => {
  if (busy.value || !password.value) return false
  if (choosing.value) return password.value.length >= MIN_LENGTH && confirm.value === password.value
  return true
})

function switchMode(next: 'unlock' | 'reset') {
  mode.value = next
  error.value = ''
  password.value = ''
  confirm.value = ''
}

async function google() {
  busy.value = true
  error.value = ''
  try {
    if (!(await signIn())) return
    play('unlock')
    toast.success('Signed in', { description: forAccount.value ? 'Your apps now save to Firebase and sync across devices.' : undefined })
    if (forAccount.value) emit('done')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Something went wrong. Try again.'
    play('error')
  } finally {
    busy.value = false
  }
}

async function submit() {
  if (!canSubmit.value) return
  busy.value = true
  error.value = ''
  const resetting = mode.value === 'reset'
  try {
    if (choosing.value) await setMasterPassword(password.value)
    else await unlock(password.value)
    play('unlock')
    toast.success(resetting ? 'Master password changed' : 'Vault unlocked')
    mode.value = 'unlock'
    emit('done')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Something went wrong. Try again.'
    play('error')
  } finally {
    busy.value = false
    password.value = ''
    confirm.value = ''
  }
}
</script>

<template>
  <section class="panel auth" :class="{ bare: forAccount }">
    <template v-if="signedOut">
      <template v-if="!forAccount">
        <h2>Sign in to use the vault</h2>
        <p class="lead">Use your Google account. You’ll then set a master password that only you know.</p>
      </template>
      <div class="form">
        <button type="button" class="btn google" :disabled="busy" @click="google">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.8 0-5.2-1.9-6.1-4.5H2.2v2.9A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.9 14.1a6.6 6.6 0 0 1 0-4.2V7H2.2a11 11 0 0 0 0 10z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.1 1.6l3.1-3.1A11 11 0 0 0 2.2 7l3.7 2.9C6.8 7.3 9.2 5.4 12 5.4z" /></svg>
          {{ busy ? 'Signing in…' : 'Continue with Google' }}
        </button>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
      </div>
    </template>

    <template v-else>
      <template v-if="vault.status === 'new'">
        <h2>Choose a master password</h2>
        <p class="lead">For <strong>{{ vault.email }}</strong>. It encrypts your saved passwords on this device.</p>
      </template>
      <template v-else-if="mode === 'reset'">
        <h2>Choose a new master password</h2>
        <p class="lead">For <strong>{{ vault.email }}</strong>.</p>
      </template>
      <template v-else>
        <h2>Vault locked</h2>
        <p class="lead">Signed in as <strong>{{ vault.email }}</strong>. Enter your master password to unlock.</p>
      </template>

      <form v-validate class="form" @submit.prevent="submit">
        <!-- Hidden username keeps password managers pairing the password with the right account -->
        <input :value="vault.email" type="email" autocomplete="username" hidden>

        <label class="field">
          <span class="field-head">{{ choosing ? 'New master password' : 'Master password' }}</span>
          <span class="secret">
            <input
              v-model="password"
              class="input"
              :type="show ? 'text' : 'password'"
              :autocomplete="choosing ? 'new-password' : 'current-password'"
              required
              data-error="Enter your master password"
              v-check="choosing && password && password.length < MIN_LENGTH ? `Use at least ${MIN_LENGTH} characters` : ''"
            >
            <button type="button" class="btn btn-quiet btn-sm" :aria-pressed="show" @click="show = !show">{{ show ? 'Hide' : 'Show' }}</button>
          </span>
        </label>

        <label v-if="choosing" class="field">
          <span class="field-head">Type it again</span>
          <input v-model="confirm" class="input" :type="show ? 'text' : 'password'" autocomplete="new-password" required data-error="Type the password again" v-check="confirm && confirm !== password ? 'The two passwords don’t match' : ''">
        </label>

        <p v-if="problem" class="hint">{{ problem }}</p>
        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <button type="submit" class="btn" :disabled="busy">
          <template v-if="busy">Working…</template>
          <template v-else-if="choosing">Save master password</template>
          <template v-else>Unlock</template>
        </button>
      </form>

      <p v-if="vault.status === 'new'" class="warning">
        Your master password never leaves this device, so nobody can see or recover it.
        If you forget it you can choose a new one, but passwords saved in the vault are lost for good.
      </p>
      <p v-else-if="mode === 'reset'" class="warning">
        Passwords saved in the vault were locked with the old master password, so they can’t be opened
        with the new one. Your trackers aren’t affected.
      </p>

      <button v-if="mode === 'reset'" type="button" class="link" @click="switchMode('unlock')">Back to unlock</button>
      <button v-else-if="vault.status === 'locked'" type="button" class="link" @click="switchMode('reset')">Forgot master password?</button>
      <button type="button" class="link" @click="signOut">Sign out</button>
    </template>
  </section>
</template>

<style scoped>
.auth {
  max-width: 460px;
  margin: 0 auto;
  padding: 1.5rem;
}

/* Inside the sign-in popup the dialog is already the panel */
.auth.bare {
  max-width: none;
  padding: 0;
  background: none;
  border: 0;
  box-shadow: none;
}

h2 {
  font-size: 1.35rem;
}

.lead {
  margin: 0.4rem 0 0;
  color: var(--ink-2);
}

.form {
  margin-top: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.secret {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.hint,
.error {
  margin: 0;
  font-size: 0.875rem;
}

.hint { color: var(--ink-2); }
.error { color: var(--bad-ink); font-weight: 600; }

.warning {
  margin: 1.25rem 0 0;
  padding: 0.8rem 0.95rem;
  font-size: 0.85rem;
  color: var(--ink-2);
  background: var(--surface-2);
  border-left: 4px solid var(--orange);
  border-radius: 4px 10px 10px 4px;
}

.google {
  gap: 0.6rem;
}

.google svg {
  width: 1.1rem;
  height: 1.1rem;
}

.link {
  margin-top: 1rem;
  margin-right: 1rem;
  padding: 0;
  font: inherit;
  font-size: 0.9rem;
  color: var(--ink-2);
  background: none;
  border: 0;
  text-decoration: underline;
  cursor: pointer;
}
</style>
