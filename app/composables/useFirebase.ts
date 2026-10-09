import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, type Firestore } from 'firebase/firestore'

interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
}

const firebaseConfig = () => useRuntimeConfig().public.firebase as FirebaseConfig

let instance: { app: FirebaseApp, auth: Auth, db: Firestore } | undefined

// Browser-side Firebase app, created once and shared. Auth signs in; Firestore stores each user's data
// under users/{uid}, which the rules in firestore.rules limit to that user.
export function useFirebase() {
  if (import.meta.server) {
    throw new Error('useFirebase() is browser-only.')
  }
  if (!instance) {
    const config = firebaseConfig()
    if (!config.apiKey || !config.projectId) {
      // .env is only read in development; a deployed site needs these set as real environment variables
      throw new Error('Firebase is not configured. Set the NUXT_PUBLIC_FIREBASE_* environment variables.')
    }
    const app = initializeApp(config)
    instance = {
      app,
      auth: getAuth(app),
      // Optional fields (a vault entry's notes, say) are left out rather than rejected
      db: initializeFirestore(app, { ignoreUndefinedProperties: true })
    }
    // Local testing against the Firebase emulators (CHECKLIST.md #82); never in a production build
    const emulator = useRuntimeConfig().public.firebaseEmulatorHost as string
    if (import.meta.dev && emulator) {
      connectAuthEmulator(instance.auth, `http://${emulator}:9099`, { disableWarnings: true })
      connectFirestoreEmulator(instance.db, emulator, 8089)
    }
  }
  return instance
}

export const firebaseConfigured = () => {
  const config = firebaseConfig()
  return !!(config.apiKey && config.projectId)
}

// Firestore says permission-denied until the rules are published, and not-found before the database exists
export const needsFirestoreSetup = (e: unknown) => {
  const code = (e as { code?: string } | null)?.code
  return code === 'permission-denied' || code === 'not-found'
}

// Firestore queues writes while offline and only settles once the server answers,
// so give up waiting after a while; the write still goes through when the connection returns
export function withTimeout<T>(promise: Promise<T>, ms = 10_000) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Firebase didn’t answer in time.')), ms))
  ])
}

// Rules to publish once in the Firebase console: each signed-in user reads and writes only their own data
export const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}`

export const firestoreRulesUrl = () =>
  `https://console.firebase.google.com/project/${firebaseConfig().projectId}/firestore/databases/-default-/rules`
