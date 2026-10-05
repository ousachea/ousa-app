import type { Currency } from '~/utils/exchange'

// Today's mid-market riel-per-dollar rate from /api/rate, shared by every page that needs it.
export function useMarketRate() {
  const { data } = useFetch<{ rate: number, updatedAt: string, source: string }>('/api/rate', {
    key: 'market-rate',
    server: false
  })
  return computed(() => data.value?.rate)
}

// Sum amounts kept in USD and KHR, plus a combined dollar total once the rate is known
export function totalsByCurrency(items: { amount: number, currency: Currency }[], rate?: number) {
  const usd = items.filter(i => i.currency === 'USD').reduce((n, i) => n + i.amount, 0)
  const khr = items.filter(i => i.currency === 'KHR').reduce((n, i) => n + i.amount, 0)
  return { usd, khr, combinedUsd: rate ? usd + khr / rate : undefined }
}
