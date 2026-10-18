import { toast } from 'vue-sonner'
import type { Cached } from '~/utils/cache'
import type { CountdownEvent, DueItem, HolidayLike, Renewal } from '~/utils/calendar'

// What Calendar's two tabs (Dates and Renewals) share: both lists, one clock, the public holidays and the
// "due today or tomorrow" reminder. Each tab reads the other's list too, for the 30-day timeline.

/** Your dates (the Dates tab) */
export const useDates = () => useCollection<CountdownEvent>('countdown', undefined, { demo: DATES_DEMO })

/** Your subscriptions (the Renewals tab) */
export const useRenewals = () => useCollection<Renewal>('renewals', undefined, { demo: RENEWALS_DEMO })

// ---------- One clock ----------
// Every countdown on the page reads the same time, ticking on the second while anything shows seconds
// (`live`), else every 30 s. One timer for the whole app instead of one per page.
const clockNow = ref(Date.now())
const liveCheck = new Set<() => boolean>()
let clockTimer: ReturnType<typeof setTimeout> | undefined

function scheduleClock() {
  clearTimeout(clockTimer)
  if (!liveCheck.size) return
  const live = [...liveCheck].some(check => check())
  // On the second, so every clock on the page turns over together
  const wait = live ? 1000 - (Date.now() % 1000) : 30_000
  clockTimer = setTimeout(() => {
    clockNow.value = Date.now()
    scheduleClock()
  }, wait)
}

/** The time now (ms), shared by every countdown. `live`: whether this page needs it every second right now */
export function useNow(live: () => boolean = () => false) {
  // On the server each render gets its own moment; the shared clock is for the browser
  if (import.meta.server) return ref(Date.now())
  onMounted(() => {
    liveCheck.add(live)
    clockNow.value = Date.now()
    scheduleClock()
  })
  onBeforeUnmount(() => {
    liveCheck.delete(live)
    scheduleClock()
  })
  return readonly(clockNow)
}

// ---------- Public holidays ----------
// From the server (Nager.Date); each one starts at midnight Cambodia time. The last list this device saw
// keeps them working offline (CHECKLIST.md #19).
export const CAMBODIA_TZ = 'Asia/Phnom_Penh'
const DAY = 86_400_000
export const khMidnight = (iso: string) => new Date(`${iso}T00:00:00+07:00`).getTime()

export function useHolidays(now: Readonly<Ref<number>>) {
  const { data: live, status, refresh } = useFetch('/api/holidays', { key: 'holidays', server: false, lazy: true })
  type HolidayData = NonNullable<typeof live.value>
  const cached = ref<Cached<HolidayData>>()
  onMounted(() => (cached.value = readCached<HolidayData>('holidays')))
  watch(live, (d) => {
    if (d?.holidays?.length) writeCached('holidays', d)
  })
  const data = computed(() => live.value ?? (status.value === 'error' ? cached.value?.data : undefined))
  const fromCache = computed(() => !live.value && !!data.value)

  const holidays = computed(() => (data.value?.holidays ?? [])
    .map((h) => {
      const startAt = khMidnight(h.start)
      const endAt = khMidnight(h.end) + DAY
      return { ...h, startAt, endAt, left: startAt - now.value, onNow: now.value >= startAt && now.value < endAt }
    })
    // Anything not yet over, up to a year ahead
    .filter(h => h.endAt > now.value && h.startAt < now.value + 365 * DAY))

  return { holidays, data, status, fromCache, cached, refresh }
}

export type SaverLook = 'page' | 'clock'

/** Calendar settings (the Dates tab's gear); the holidays switch applies to both tabs */
export const useCalendarPrefs = () => useAppPrefs('countdown', { clock: true, holidays: true, saver: 'page' as SaverLook })

// ---------- Due today or tomorrow ----------
// One heads-up a day for the whole of Calendar, on whichever tab opens first: renewals, your dates and
// public holidays together. Never for example data.
export function useDueReminder(source: () => { dates?: CountdownEvent[], renewals?: Renewal[], holidays?: HolidayLike[] } | undefined) {
  let done = false
  watch(source, (lists) => {
    if (done || !lists) return
    done = true
    const due = dueItems(lists)
    if (!due.length) return
    const today = localIsoDate()
    try {
      if (sessionStorage.getItem('ousa-app:calendar-reminded') === today) return
      sessionStorage.setItem('ousa-app:calendar-reminded', today)
    } catch {}
    const first = due[0]!
    const when = (d: DueItem) => (d.days === 0 ? 'today' : 'tomorrow')
    // On a fresh load the page is ready before the app's toast area mounts; wait a moment so it isn't lost
    setTimeout(() => toast.warning(`${first.name} ${first.verb} ${when(first)}`, {
      description: due.length > 1 ? `And ${due.length - 1} more today or tomorrow.` : first.detail
    }), 600)
  }, { immediate: true })
}
