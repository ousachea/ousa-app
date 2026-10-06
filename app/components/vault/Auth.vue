<script setup lang="ts">
import { toast } from 'vue-sonner'

// `account` is the sign-in popup from the top bar: same account, worded for syncing data
const props = withDefaults(defineProps<{ purpose?: 'vault' | 'account' }>(), { purpose: 'vault' })
const emit = defineEmits<{ done: [] }>()
const forAccount = computed(() => props.purpose === 'account')

const { vault, signIn, signUp, unlock, signOut, requestReset, setNewMasterPassword } = useVault()
const { play } = useSound()

const MIN_LENGTH = 12

const mode = ref<'sign-in' | 'create' | 'forgot'>('sign-in')
const email = ref('')
const password = ref('')
const confirm = ref('')
const show = ref(false)
const busy = ref(false)
const error = ref('')
const awaitingEmail = ref(false)
const resetSent = ref(false)

const locked = computed(() => vault.status === 'locked')
// Arrived from a reset email: choose a new master password
const recovering = computed(() => vault.status === 'recovery')
// Forms that set a new master password need it typed twice and long enough
const choosing = computed(() => recovering.value || (!locked.value && mode.value === 'create'))

const problem = computed(() => {
  if (!choosing.value) return ''
  if (password.value && password.value.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters. A short sentence is easy to remember and hard to guess.`
  if (confirm.value && confirm.value !== password.value) return 'The two passwords don’t match.'
  return ''
})

const canSubmit = computed(() => {
  if (busy.value) return false
  if (mode.value === 'forgot' && !locked.value && !recovering.value) return email.value.includes('@')
  if (!password.value) return false
  if (choosing.value) return password.value.length >= MIN_LENGTH && confirm.value === password.value
  if (locked.value) return true
  return email.value.includes('@')
})

function switchMode(next: 'sign-in' | 'create' | 'forgot') {
  mode.value = next
  error.value = ''
  confirm.value = ''
  resetSent.value = false
}

async function cancelRecovery() {
  await signOut()
  switchMode('sign-in')
}

async function submit() {
  if (!canSubmit.value) return
  busy.value = true
  error.value = ''
  const changing = recovering.value
  try {
    if (recovering.value) {
      await setNewMasterPassword(password.value)
    } else if (locked.value) {
      await unlock(password.value)
    } else if (mode.value === 'forgot') {
      await requestReset(email.value)
      resetSent.value = true
      play('success')
      return
    } else if (mode.value === 'create') {
      const { needsConfirmation } = await signUp(email.value, password.value)
      if (needsConfirmation) {
        awaitingEmail.value = true
        mode.value = 'sign-in'
        return
      }
    } else {
      await signIn(email.value, password.value)
    }
    play('unlock')
    if (changing) toast.success('Master password changed', { description: 'You’re signed in with the new one.' })
    else if (forAccount.value) toast.success('Signed in', { description: 'Your apps now save to Supabase and sync across devices.' })
    else toast.success('Vault unlocked')
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
    <template v-if="recovering">
      <h2>Choose a new master password</h2>
      <p class="lead">For <strong>{{ vault.email }}</strong>. You’ll use it to sign in from now on.</p>
    </template>
    <template v-else-if="locked">
      <h2>Vault locked</h2>
      <p class="lead">Signed in as <strong>{{ vault.email }}</strong>. Enter your master password to unlock.</p>
    </template>
    <template v-else-if="mode === 'forgot'">
      <h2>Forgot your master password?</h2>
      <p class="lead">We’ll email you a link to choose a new one. Open it in this browser.</p>
    </template>
    <template v-else>
      <div class="segmented" role="tablist" aria-label="Account">
        <label :class="{ active: mode === 'sign-in' }">
          <input type="radio" name="auth-mode" :checked="mode === 'sign-in'" @change="switchMode('sign-in')">
          Sign in
        </label>
        <label :class="{ active: mode === 'create' }">
          <input type="radio" name="auth-mode" :checked="mode === 'create'" @change="switchMode('create')">
          {{ forAccount ? 'Create an account' : 'Create a vault' }}
        </label>
      </div>
      <p v-if="awaitingEmail" class="notice" role="status">
        Check your email and click the confirmation link, then sign in here with the same master password.
      </p>
      <p v-if="vault.resetError" class="error" role="alert">{{ vault.resetError }}</p>
    </template>

    <form class="form" @submit.prevent="submit">
      <p v-if="resetSent" class="notice" role="status">
        If there’s an account for {{ email }}, a reset link is on its way. Open it in this browser.
      </p>

      <label v-if="!locked && !recovering" class="field">
        <span class="field-head">Email</span>
        <input v-model="email" class="input" type="email" autocomplete="username" required>
      </label>

      <label v-if="recovering || locked || mode !== 'forgot'" class="field">
        <span class="field-head">{{ recovering ? 'New master password' : 'Master password' }}</span>
        <span class="secret">
          <input
            v-model="password"
            class="input"
            :type="show ? 'text' : 'password'"
            :autocomplete="choosing ? 'new-password' : 'current-password'"
            required
          >
          <button type="button" class="btn btn-quiet btn-sm" :aria-pressed="show" @click="show = !show">{{ show ? 'Hide' : 'Show' }}</button>
        </span>
      </label>

      <label v-if="choosing" class="field">
        <span class="field-head">Type it again</span>
        <input v-model="confirm" class="input" :type="show ? 'text' : 'password'" autocomplete="new-password" required>
      </label>

      <p v-if="problem" class="hint">{{ problem }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <button type="submit" class="btn" :disabled="!canSubmit">
        <template v-if="busy">Working…</template>
        <template v-else-if="recovering">Save new master password</template>
        <template v-else-if="locked">Unlock</template>
        <template v-else-if="mode === 'forgot'">{{ resetSent ? 'Send again' : 'Email me a reset link' }}</template>
        <template v-else-if="mode === 'create'">{{ forAccount ? 'Create account' : 'Create vault' }}</template>
        <template v-else>{{ forAccount ? 'Sign in' : 'Sign in and unlock' }}</template>
      </button>
    </form>

    <p v-if="mode === 'create' && !locked && !recovering" class="warning">
      Your master password never leaves this device, so nobody can see or recover it.
      If you forget it you can reset it by email, but passwords saved in the vault are lost for good.
    </p>
    <p v-else-if="recovering || (mode === 'forgot' && !locked)" class="warning">
      Your trackers keep syncing after a reset. Passwords saved in the vault were locked with the old
      master password, so they can’t be opened with the new one.
    </p>

    <button v-if="recovering" type="button" class="link" @click="cancelRecovery">Cancel and sign out</button>
    <button v-else-if="locked" type="button" class="link" @click="signOut">Sign out</button>
    <button v-else-if="mode === 'sign-in'" type="button" class="link" @click="switchMode('forgot')">Forgot master password?</button>
    <button v-else-if="mode === 'forgot'" type="button" class="link" @click="switchMode('sign-in')">Back to sign in</button>
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

.notice {
  margin: 1rem 0 0;
  padding: 0.75rem 0.9rem;
  font-size: 0.9rem;
  background: color-mix(in srgb, var(--blue) 12%, var(--surface));
  border-radius: 12px;
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

.link {
  margin-top: 1rem;
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
