import type { Currency } from '~/utils/exchange'

// Today's mid-market riel-per-dollar rate from /api/rate, shared by every page that needs it.
// Offline, or if the rate service is down, the last rate this device saw is used instead.
export function useMarketRate() {
  const { data } = useFetch<{ rate: number, updatedAt: string, source: string }>('/api/rate', {
    key: 'market-rate',
    server: false
  })
  const cached = ref<number>()
  onMounted(() => (cached.value = readCached<{ rate: number }>('rate')?.data.rate))
  watch(data, (d) => {
    if (d?.rate) writeCached('rate', d)
  })
  return computed(() => data.value?.rate ?? cached.value)
}

// When no rate has ever loaded here (first visit offline, or the service is down), pages that need one
// for totals use this typical rate and say so, rather than waiting forever (CHECKLIST.md #69)
export const FALLBACK_RATE = 4000

/** The rate plus where it came from: 'live', 'saved' (last one seen here), 'fallback' or 'loading' */
export function useMarketRateInfo() {
  const { data, status } = useFetch<{ rate: number, updatedAt: string, source: string }>('/api/rate', { key: 'market-rate', server: false })
  const cached = ref<number>()
  onMounted(() => (cached.value = readCached<{ rate: number }>('rate')?.data.rate))
  return computed(() => {
    if (data.value?.rate) return { rate: data.value.rate, from: 'live' as const }
    if (cached.value) return { rate: cached.value, from: 'saved' as const }
    if (status.value === 'error') return { rate: FALLBACK_RATE, from: 'fallback' as const }
    return { rate: undefined, from: 'loading' as const }
  })
}

// Sum amounts kept in USD and KHR, plus a combined dollar total once the rate is known
export function totalsByCurrency(items: { amount: number, currency: Currency }[], rate?: number) {
  const usd = items.filter(i => i.currency === 'USD').reduce((n, i) => n + i.amount, 0)
  const khr = items.filter(i => i.currency === 'KHR').reduce((n, i) => n + i.amount, 0)
  return { usd, khr, combinedUsd: rate ? usd + khr / rate : undefined }
}
