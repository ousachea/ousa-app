// Autosave for unfinished Add forms (CHECKLIST.md #12). While someone fills a form in, it's kept on this
// device; close the popup, leave the page or lose the tab and the next time the form opens it offers
// "Continue where you left off?". Saving clears it. Turned off with Settings → Autosave.
//
// Never use it for secrets (passwords): drafts are stored as plain text.
const PREFIX = 'ousa-app:draft:'

interface DraftOptions<T> {
  /** Only autosave while this is true: the Add form is open, not an edit */
  active: () => boolean
  /** True when nothing worth keeping has been typed (choices like a currency alone don't count) */
  isEmpty: (value: T) => boolean
  /** A few words per filled-in field for the "Continue where you left off?" card */
  summary: (draft: T) => (string | undefined | false)[]
}

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) as T : undefined
  } catch {
    return undefined
  }
}

export function useDraft<T extends object>(key: string, form: T, opts: DraftOptions<T>) {
  const { prefs } = usePrefs()
  const offered = ref<T>()
  const lines = computed(() => (offered.value ? opts.summary(offered.value).filter((l): l is string => !!l) : []))
  let timer: ReturnType<typeof setTimeout> | undefined

  function write(value: T) {
    try {
      if (opts.isEmpty(value)) localStorage.removeItem(PREFIX + key)
      else localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {}
  }

  // Save shortly after each change; while the card is asking, leave the old draft alone
  watch(() => ({ ...form }), (value) => {
    if (!import.meta.client || !prefs.autosave || offered.value || !opts.active()) return
    clearTimeout(timer)
    timer = setTimeout(() => write(value as T), 300)
  }, { deep: true })

  // Closing the tab mid-typing still keeps the last few keystrokes
  const flush = () => {
    if (prefs.autosave && !offered.value && opts.active()) write({ ...form } as T)
  }
  onMounted(() => window.addEventListener('pagehide', flush))
  onBeforeUnmount(() => {
    flush()
    window.removeEventListener('pagehide', flush)
  })

  return {
    /** The draft waiting to be continued, if any */
    offered,
    lines,
    /** Call when an empty Add form opens: offers the saved draft if there is one */
    check() {
      const d = read<T>(key)
      offered.value = prefs.autosave && d && !opts.isEmpty(d) ? d : undefined
    },
    resume() {
      if (offered.value) Object.assign(form, offered.value)
      offered.value = undefined
    },
    discard() {
      offered.value = undefined
      try {
        localStorage.removeItem(PREFIX + key)
      } catch {}
    },
    /** After a successful save */
    clear() {
      clearTimeout(timer)
      offered.value = undefined
      try {
        localStorage.removeItem(PREFIX + key)
      } catch {}
    }
  }
}
