// Client-side encryption for the password vault. Nothing here ever leaves the browser except
// `authSecret` (used as the Supabase login password) and ciphertext.
//
// master password ──PBKDF2 (600k, salted with the email)──▶ master key
// master key ──HKDF "auth"──▶ authSecret   (sent to Supabase instead of the real password)
// master key ──HKDF "enc"───▶ AES-256-GCM key (non-extractable, stays in memory)

const PBKDF2_ITERATIONS = 600_000 // OWASP 2023 recommendation for PBKDF2-SHA256
const enc = new TextEncoder()
const dec = new TextDecoder()

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

function toBase64(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const b of view) s += String.fromCharCode(b)
  return btoa(s)
}

function fromBase64(text: string) {
  return Uint8Array.from(atob(text), c => c.charCodeAt(0))
}

export interface VaultKeys {
  authSecret: string
  key: CryptoKey
}

export async function deriveVaultKeys(email: string, masterPassword: string): Promise<VaultKeys> {
  // Browsers only expose crypto.subtle on https:// and localhost, so plain http on a LAN address can't sign in
  if (!crypto.subtle) throw new Error('Signing in needs a secure connection. Open this page over https:// (or on localhost).')
  const subtle = crypto.subtle
  const passwordKey = await subtle.importKey('raw', enc.encode(masterPassword), 'PBKDF2', false, ['deriveBits'])
  const masterBits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`ousa-vault:${normalizeEmail(email)}`), iterations: PBKDF2_ITERATIONS },
    passwordKey,
    256
  )
  const masterKey = await subtle.importKey('raw', masterBits, 'HKDF', false, ['deriveBits', 'deriveKey'])
  const hkdf = (info: string) => ({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode(info) })

  const authBits = await subtle.deriveBits(hkdf('ousa-vault:auth'), masterKey, 256)
  const key = await subtle.deriveKey(hkdf('ousa-vault:enc'), masterKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])

  return { authSecret: toBase64(authBits), key }
}

export interface EncryptedBlob {
  ciphertext: string
  iv: string
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12)) // fresh IV for every encryption
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)))
  return { ciphertext: toBase64(data), iv: toBase64(iv) }
}

export async function decryptJson<T>(key: CryptoKey, blob: EncryptedBlob): Promise<T> {
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(blob.iv) }, key, fromBase64(blob.ciphertext))
  return JSON.parse(dec.decode(data)) as T
}
