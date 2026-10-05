<script setup lang="ts">
import { toast } from 'vue-sonner'

const { vault, signIn, signUp, unlock, signOut } = useVault()
const { play } = useSound()

const MIN_LENGTH = 12

const mode = ref<'sign-in' | 'create'>('sign-in')
const email = ref('')
const password = ref('')
const confirm = ref('')
const show = ref(false)
const busy = ref(false)
const error = ref('')
const awaitingEmail = ref(false)

const locked = computed(() => vault.status === 'locked')

const problem = computed(() => {
  if (locked.value || mode.value === 'sign-in') return ''
  if (password.value && password.value.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters. A short sentence is easy to remember and hard to guess.`
  if (confirm.value && confirm.value !== password.value) return 'The two passwords don’t match.'
  return ''
})

const canSubmit = computed(() => {
  if (busy.value || !password.value) return false
  if (locked.value) return true
  if (!email.value.includes('@')) return false
  if (mode.value === 'create') return password.value.length >= MIN_LENGTH && confirm.value === password.value
  return true
})

function switchMode(next: 'sign-in' | 'create') {
  mode.value = next
  error.value = ''
  confirm.value = ''
}

async function submit() {
  if (!canSubmit.value) return
  busy.value = true
  error.value = ''
  try {
    if (locked.value) {
      await unlock(password.value)
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
    toast.success('Vault unlocked')
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
  <section class="panel auth">
    <template v-if="locked">
      <h2>Vault locked</h2>
      <p class="lead">Signed in as <strong>{{ vault.email }}</strong>. Enter your master password to unlock.</p>
    </template>
    <template v-else>
      <div class="segmented" role="tablist" aria-label="Account">
        <label :class="{ active: mode === 'sign-in' }">
          <input type="radio" name="auth-mode" :checked="mode === 'sign-in'" @change="switchMode('sign-in')">
          Sign in
        </label>
        <label :class="{ active: mode === 'create' }">
          <input type="radio" name="auth-mode" :checked="mode === 'create'" @change="switchMode('create')">
          Create a vault
        </label>
      </div>
      <p v-if="awaitingEmail" class="notice" role="status">
        Check your email and click the confirmation link, then sign in here with the same master password.
      </p>
    </template>

    <form class="form" @submit.prevent="submit">
      <label v-if="!locked" class="field">
        <span class="field-head">Email</span>
        <input v-model="email" class="input" type="email" autocomplete="username" required>
      </label>

      <label class="field">
        <span class="field-head">Master password</span>
        <span class="secret">
          <input
            v-model="password"
            class="input"
            :type="show ? 'text' : 'password'"
            :autocomplete="mode === 'create' && !locked ? 'new-password' : 'current-password'"
            required
          >
          <button type="button" class="btn btn-quiet btn-sm" :aria-pressed="show" @click="show = !show">{{ show ? 'Hide' : 'Show' }}</button>
        </span>
      </label>

      <label v-if="mode === 'create' && !locked" class="field">
        <span class="field-head">Type it again</span>
        <input v-model="confirm" class="input" :type="show ? 'text' : 'password'" autocomplete="new-password" required>
      </label>

      <p v-if="problem" class="hint">{{ problem }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <button type="submit" class="btn" :disabled="!canSubmit">
        <template v-if="busy">Working…</template>
        <template v-else-if="locked">Unlock</template>
        <template v-else-if="mode === 'create'">Create vault</template>
        <template v-else>Sign in and unlock</template>
      </button>
    </form>

    <p v-if="mode === 'create' && !locked" class="warning">
      Your master password never leaves this device, so nobody can reset it for you.
      If you forget it, the passwords in this vault are lost for good.
    </p>

    <button v-if="locked" type="button" class="link" @click="signOut">Sign out</button>
  </section>
</template>

<style scoped>
.auth {
  max-width: 460px;
  margin: 0 auto;
  padding: 1.5rem;
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
