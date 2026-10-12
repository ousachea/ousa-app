// Each app's own keys for the phone keyboard (MobileKeyboard.vue). Number fields get a keypad in place of
// the phone's own keyboard, with the app's keys in a row above the digits; text fields keep the phone's
// keyboard and get the app's keys in a bar above it.
//
// A key either types its text where the caret is (`insert`), replaces the whole field (`set`), works
// out a new value from the current one (`apply`), or types something only known when pressed (`action`).
// A field can pick a set with data-keys="<name>" when the page's default set doesn't suit it, or turn the
// custom keyboard off with data-keys="off".

export interface KeyboardKey {
  label: string
  /** Read aloud instead of the label, for keys like “+0.1” or “.com” */
  aria?: string
  insert?: string
  set?: string
  apply?: (value: string) => string
  action?: 'paste' | 'today' | 'now'
}

export type FieldKind = 'number' | 'tel' | 'text' | 'url' | 'email' | 'search'

export interface KeySet {
  /** Shown above the keys, so it's clear which keyboard this is */
  title?: string
  keys: KeyboardKey[]
}

const num = (v: string) => Number(v.replace(/[^\d.-]/g, '')) || 0
// Rounds away float noise (72.1 + 0.1 = 72.19999…) to the step's decimals
const round = (n: number, step: number) => {
  const places = (String(step).split('.')[1] ?? '').length
  return String(Number(n.toFixed(places)))
}
const step = (by: number): KeyboardKey => ({
  label: by > 0 ? `+${by}` : `−${-by}`,
  aria: by > 0 ? `Add ${by}` : `Take away ${-by}`,
  apply: v => round(Math.max(0, num(v) + by), by)
})
const zeros = (n: number): KeyboardKey => ({ label: '0'.repeat(n), aria: `${n} zeros`, insert: '0'.repeat(n) })
const amounts = (...values: number[]): KeyboardKey[] =>
  values.map(v => ({ label: v >= 1000 ? v.toLocaleString('en-US') : String(v), set: String(v) }))
const times = (by: number, label = `×${by}`): KeyboardKey => ({
  label,
  aria: `Times ${by.toLocaleString('en-US')}`,
  apply: v => String(num(v) * by)
})
const words = (...list: string[]): KeyboardKey[] => list.map(w => ({ label: w, insert: w }))

const PASTE: KeyboardKey = { label: 'Paste', action: 'paste' }

const thisYear = () => new Date().getFullYear()

// Shared sets, used by several apps and as the fallback for each kind of field
const SETS = {
  number: { keys: [zeros(2), zeros(3)] },
  money: { title: 'Amounts', keys: [zeros(3), ...amounts(5, 10, 20, 50, 100)] },
  riel: { title: 'Riel', keys: [zeros(3), ...amounts(1000, 5000, 10000, 50000, 100000)] },
  percent: { title: 'Percent', keys: amounts(5, 10, 20, 50, 80, 100) },
  rate: { title: 'Riel per dollar', keys: [...amounts(4000, 4050, 4100, 4150), step(-10), step(10)] },
  year: { title: 'Year', keys: Array.from({ length: 5 }, (_, i) => ({ label: String(thisYear() - i), set: String(thisYear() - i) })) },
  minutes: { title: 'Minutes', keys: amounts(15, 25, 45, 60, 90, 120) },
  tel: {
    title: 'Network prefixes',
    // Smart, Cellcard and Metfone's most used prefixes, then +855 for numbers written the international way
    keys: [...['010', '012', '015', '016', '069', '070', '077', '078', '085', '086', '088', '089', '092', '093', '096', '097', '098', '099'].map(p => ({ label: p, set: `${p} ` })), { label: '+855', insert: '+855 ' }, { label: 'Space', insert: ' ' }]
  },
  url: { title: 'Links', keys: [...words('https://', 'www.', '.com', '.kh', '.com.kh', '.org', '.io', '/'), PASTE] },
  email: { title: 'Email', keys: words('@gmail.com', '@yahoo.com', '@outlook.com', '@icloud.com', '.com') },
  search: { keys: [PASTE, { label: 'Clear', set: '' }] },
  text: { keys: [PASTE, { label: 'Clear', set: '' }] }
} satisfies Record<string, KeySet>

interface AppKeyboard {
  /** The app's keys for each kind of field; anything left out uses the shared set for that kind */
  kinds?: Partial<Record<FieldKind, KeySet>>
  /** Named sets fields on this page can pick with data-keys */
  named?: Record<string, KeySet>
}

// Search on Home and in the Recycle Bin: tap an app's name to find it, or what was deleted from it
const APP_NAMES: KeySet = { title: 'Apps', keys: words('Notes', 'Bookmarks', 'Things', 'Renewals', 'Countdown', 'Gold', 'Weight', 'Speed') }

const APPS: Record<string, AppKeyboard> = {
  '/qr': {
    kinds: {
      text: { title: 'QR content', keys: [...words('https://', 'www.', '.com', 'mailto:', 'tel:+855', 'WIFI:T:WPA;S:;P:;;'), PASTE] },
      url: SETS.url
    }
  },
  '/phone': {
    kinds: { tel: SETS.tel, text: SETS.tel }
  },
  '/text': {
    kinds: {
      text: { title: 'Text', keys: [PASTE, { label: 'Clear', set: '' }, ...words('“', '”', '—', '…', '•')] }
    }
  },
  '/password': {
    kinds: {
      text: { title: 'Passwords', keys: [...words('@gmail.com', '.com', '!', '#', '$', '_'), PASTE] }
    }
  },
  '/exchange': {
    kinds: { number: SETS.money },
    named: { rate: SETS.rate, riel: SETS.riel }
  },
  '/things': {
    kinds: {
      number: { title: 'Price', keys: [zeros(2), zeros(3), ...amounts(99, 199, 499, 999)] },
      text: { title: 'Things', keys: words('iPhone', 'iPad', 'MacBook', 'AirPods', 'Apple Watch', 'Samsung', 'Pro', 'Max') }
    },
    named: { year: SETS.year, gb: { title: 'Storage (GB)', keys: amounts(64, 128, 256, 512, 1024) }, ram: { title: 'RAM (GB)', keys: amounts(4, 6, 8, 12, 16, 32) }, inch: { title: 'Screen (inches)', keys: amounts(6.1, 6.3, 6.7, 11, 13, 14, 16) } }
  },
  '/eat': {
    kinds: {
      text: { title: 'Food', keys: [...words('Bai sach chrouk', 'Kuy teav', 'Lok lak', 'Amok', 'Num banh chok', 'Coffee', 'Pizza', 'Sushi')] },
      url: SETS.url
    }
  },
  '/weight': {
    kinds: { number: { title: 'Weight', keys: [step(-1), step(-0.1), step(0.1), step(1)] } }
  },
  '/countdown': {
    kinds: { text: { title: 'Events', keys: words('Birthday', 'Trip to ', 'Exam', 'Payday', 'Wedding', 'Holiday', 'Anniversary', '🎉', '✈️', '🎂') } }
  },
  '/renewals': {
    kinds: {
      number: { title: 'Prices', keys: amounts(0.99, 2.99, 4.99, 9.99, 14.99, 19.99) },
      text: { title: 'Services', keys: words('Netflix', 'Spotify', 'YouTube Premium', 'iCloud+', 'ChatGPT', 'Claude', 'Disney+', 'Domain') }
    }
  },
  '/bookmarks': {
    kinds: { text: SETS.url, url: SETS.url }
  },
  '/notes': {
    kinds: {
      text: {
        title: 'Notes',
        keys: [
          { label: 'Today', aria: 'Type today’s date', action: 'today' },
          { label: 'Now', aria: 'Type the time', action: 'now' },
          ...words('• ', '☐ ', '→', '✓', '#')
        ]
      },
      search: { title: 'Find', keys: words('folder:', 'tag:', 'is:favorite', 'is:archived', 'before:', 'after:') }
    }
  },
  '/battery': {
    kinds: { number: SETS.percent },
    named: { mah: { title: 'Capacity (mAh)', keys: amounts(3000, 3500, 4000, 4500, 5000, 6000) } }
  },
  '/salary': {
    kinds: { number: { title: 'Salary', keys: [zeros(2), zeros(3), ...amounts(300, 500, 1000, 1500, 2000)] } },
    named: {
      percent: { title: 'Raise', keys: [{ label: '−', aria: 'Minus', apply: v => (v.startsWith('-') ? v.slice(1) : `-${v}`) }, ...amounts(3, 5, 10, 15, 20)] },
      hours: { title: 'Hours', keys: [step(-0.5), step(0.5), ...amounts(1, 2, 4, 8)] },
      multiplier: { title: 'Multiplier', keys: amounts(1.5, 2, 3) }
    }
  },
  '/speed': {
    kinds: { number: { title: 'Plan speed (Mbps)', keys: amounts(10, 20, 30, 50, 100, 200, 500, 1000) } }
  },
  '/gold': {
    kinds: { number: { title: 'Gold', keys: [step(-0.5), step(0.5), ...amounts(1, 2, 5, 10), times(10)] } },
    named: { price: SETS.money }
  },
  '/': { kinds: { search: APP_NAMES } },
  '/trash': { kinds: { search: APP_NAMES } },
  '/ambient-studio': {
    kinds: { number: SETS.minutes, url: SETS.url, text: SETS.url }
  }
}

/** What a key types where the caret is, filling in keys that depend on the moment, like Notes' Today */
export function keyText(key: KeyboardKey): string | undefined {
  if (key.action === 'today') return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  if (key.action === 'now') return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return key.insert
}

/** The keys for a field: its own data-keys set, else its app's set for that kind, else the shared one */
export function keySetFor(path: string, kind: FieldKind, name?: string): KeySet {
  const app = APPS[path]
  if (name) {
    const picked = app?.named?.[name] ?? (SETS as Record<string, KeySet>)[name]
    if (picked) return picked
  }
  return app?.kinds?.[kind] ?? SETS[kind]
}
