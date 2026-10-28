import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
}

const firebaseConfig = () => useRuntimeConfig().public.firebase as FirebaseConfig

export type FirebaseSdk = typeof import('~/lib/firebaseSdk')
export interface FirebaseHandle { app: FirebaseApp, auth: Auth, db: Firestore, sdk: FirebaseSdk }

let instance: FirebaseHandle | undefined
let loading: Promise<FirebaseHandle> | undefined

/**
 * Browser-side Firebase, loaded on first use and shared. Auth signs in; Firestore stores each user's data
 * under users/{uid}, which the rules in firestore.rules limit to that user. The SDK isn't part of any page's
 * own code (lib/firebaseSdk.ts), so pages work before it arrives; `sdk` is its functions.
 */
export function loadFirebase(): Promise<FirebaseHandle> {
  if (import.meta.server) return Promise.reject(new Error('Firebase is browser-only.'))
  if (instance) return Promise.resolve(instance)
  loading ??= pageLoaded().then(() => import('~/lib/firebaseSdk')).then((sdk) => {
    const config = firebaseConfig()
    if (!config.apiKey || !config.projectId) {
      // .env is only read in development; a deployed site needs these set as real environment variables
      throw new Error('Firebase is not configured. Set the NUXT_PUBLIC_FIREBASE_* environment variables.')
    }
    const app = sdk.initializeApp(config)
    const handle: FirebaseHandle = {
      app,
      auth: sdk.getAuth(app),
      // Optional fields (a vault entry's notes, say) are left out rather than rejected
      db: sdk.initializeFirestore(app, { ignoreUndefinedProperties: true }),
      sdk
    }
    // Local testing against the Firebase emulators (CHECKLIST.md #82); never in a production build
    const emulator = useRuntimeConfig().public.firebaseEmulatorHost as string
    if (import.meta.dev && emulator) {
      sdk.connectAuthEmulator(handle.auth, `http://${emulator}:9099`, { disableWarnings: true })
      sdk.connectFirestoreEmulator(handle.db, emulator, 8089)
    }
    instance = handle
    return handle
  }).catch((e) => {
    // A failed download (offline on a first visit) can be tried again later
    loading = undefined
    throw e
  })
  return loading
}

/**
 * loadFirebase, tried again until it works. A failed load (offline, a dropped connection, or in development
 * Vite re-optimising its dependencies) used to leave the app showing signed out until a reload, though the
 * session was still saved. `onFail` runs once, after the first failure, so the page can carry on meanwhile.
 */
export function loadFirebaseRetrying(onFail?: () => void): Promise<FirebaseHandle> {
  return new Promise((resolve) => {
    let failed = false
    let attempt = 0
    const tryNow = () => {
      loadFirebase().then((fb) => {
        window.removeEventListener('online', tryNow)
        resolve(fb)
      }, () => {
        if (!failed) {
          failed = true
          onFail?.()
          window.addEventListener('online', tryNow)
        }
        if (!firebaseConfigured()) return
        setTimeout(tryNow, [2, 5, 15, 30, 60][Math.min(attempt++, 4)]! * 1000)
      })
    }
    tryNow()
  })
}

// Firebase waits for the page's own files (the browser's load event), so it never competes with them
function pageLoaded() {
  if (document.readyState === 'complete') return Promise.resolve()
  return new Promise<void>(resolve => window.addEventListener('load', () => resolve(), { once: true }))
}

/**
 * Firebase, for code that runs once it's loaded (after sign-in, inside a sync session).
 * Sign-in buttons use it too: a popup only opens straight from a click, with no waiting in between.
 */
export function useFirebase(): FirebaseHandle {
  if (!instance) throw new Error('Firebase is still loading. Try again in a moment.')
  return instance
}

/** Firebase if it has loaded already, else undefined */
export const firebaseNow = () => instance

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

// Rules to publish once in the Firebase console: each signed-in user reads and writes only their own data,
// shared bookmark folders (shares/<id>) can be read by anyone with the link, and so can Eat's shared foods
export const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /shares/{shareId} {
      allow read: if true;
      allow create: if request.auth != null && request.resource.data.owner == request.auth.uid;
      allow update: if request.auth != null && resource.data.owner == request.auth.uid
        && request.resource.data.owner == request.auth.uid;
      allow delete: if request.auth != null && resource.data.owner == request.auth.uid;
    }
    // Eat's shared foods (/eat): anyone can read them; a signed-in person adds their own, and only they
    // (or the site owner's account, which can take anything down) can change or delete it
    match /eatShared/{id} {
      function validSpot(d) {
        return d.keys().hasOnly(['name', 'nameKm', 'kind', 'note', 'price', 'image', 'focus', 'owner', 'createdAt'])
          && d.name is string && d.name.size() > 0 && d.name.size() <= 120
          && (!('nameKm' in d) || (d.nameKm is string && d.nameKm.size() <= 120))
          && (!('note' in d) || (d.note is string && d.note.size() <= 300))
          && d.kind in ['food', 'place'] && d.price in [1, 2, 3]
          && d.image is string && d.image.size() <= 400000
          && (!('focus' in d) || (d.focus is string && d.focus.size() <= 20));
      }
      function siteOwner() {
        return request.auth != null && request.auth.token.email == 'ousauser@gmail.com'
          && request.auth.token.email_verified == true;
      }
      allow read: if true;
      allow create: if request.auth != null && request.resource.data.owner == request.auth.uid
        && validSpot(request.resource.data);
      allow update: if request.auth != null && resource.data.owner == request.auth.uid
        && request.resource.data.owner == request.auth.uid && validSpot(request.resource.data);
      allow delete: if request.auth != null && (resource.data.owner == request.auth.uid || siteOwner());
    }
  }
}`

export const firestoreRulesUrl = () =>
  `https://console.firebase.google.com/project/${firebaseConfig().projectId}/firestore/databases/-default-/rules`
