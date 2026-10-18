// Keep every tracker in step with the signed-in account from the first page on (CHECKLIST.md #77).
// Started once the page is up and idle, so Firebase (loaded by the session) never holds up the page itself;
// a page that needs it sooner (useCollection's syncReady) starts it straight away.
export default defineNuxtPlugin(() => {
  onNuxtReady(() => startSync())
})
