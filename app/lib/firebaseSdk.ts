// Everything the app uses from the Firebase SDK, in one module that's only ever loaded with import()
// (loadFirebase in composables/useFirebase.ts). Firebase is the biggest library in the app, so pages don't
// wait for it: they show and work first, and it arrives just after for signing in and syncing.
// Kept out of utils/ on purpose: Nuxt auto-imports utils, and one bare use of a name from here would pull
// the whole SDK back into every page.
export { initializeApp } from 'firebase/app'
export {
  connectAuthEmulator, EmailAuthProvider, getAuth, GoogleAuthProvider, linkWithCredential, onAuthStateChanged, reauthenticateWithPopup,
  signInWithEmailAndPassword, signInWithPopup, signOut, unlink, updatePassword
} from 'firebase/auth'
export {
  addDoc, collection, connectFirestoreEmulator, deleteDoc, doc, getDocFromServer, getDocsFromServer, initializeFirestore,
  limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch
} from 'firebase/firestore'
