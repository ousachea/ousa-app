import { defineEventHandler, getHeader, getQuery, HTTPError } from 'h3'

// Claude usage (the API tab): your organization's token usage and costs from Anthropic's Usage and Cost
// Admin API. The Admin API key lives only in your browser; it comes with each request and is passed
// straight to Anthropic, never stored or logged here. Only these two read-only reports can be reached,
// so this is no general-purpose proxy.
//   /api/claude/report?kind=usage&days=30   tokens per day and model (usage_report/messages)
//   /api/claude/report?kind=cost&days=30    US dollars per day and line item (cost_report)
const BASE = 'https://api.anthropic.com/v1/organizations'
const PATHS = { usage: 'usage_report/messages', cost: 'cost_report' } as const
const MAX_PAGES = 6

type Bucket = { starting_at: string, ending_at: string, results: Record<string, unknown>[] }

export default defineEventHandler(async (event) => {
  const key = (getHeader(event, 'x-admin-key') ?? '').trim()
  if (!/^sk-ant-admin[\w-]+$/.test(key)) throw new HTTPError({ status: 400, message: 'An Admin API key (sk-ant-admin…) is needed' })

  const query = getQuery(event)
  const kind = query.kind === 'cost' ? 'cost' : 'usage'
  const days = Math.min(Math.max(Number(query.days) || 30, 1), 90)

  const end = new Date()
  end.setUTCHours(0, 0, 0, 0)
  end.setUTCDate(end.getUTCDate() + 1) // through the end of today (UTC)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - days)

  const params = new URLSearchParams({ starting_at: start.toISOString(), ending_at: end.toISOString(), bucket_width: '1d', limit: '31' })
  params.append('group_by[]', kind === 'cost' ? 'description' : 'model')

  // Daily buckets come at most 31 a page; follow next_page for longer ranges
  const data: Bucket[] = []
  let page: string | null = null
  for (let i = 0; i < MAX_PAGES; i++) {
    const url = new URL(`${BASE}/${PATHS[kind]}`)
    url.search = params.toString()
    if (page) url.searchParams.set('page', page)
    const res = await fetch(url, {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'user-agent': 'OusasApps/1.0 (Claude usage)' },
      signal: AbortSignal.timeout(15_000)
    })
    if (!res.ok) {
      const status = res.status === 401 || res.status === 403 ? res.status : 502
      const message = res.status === 401 ? 'Anthropic didn’t accept that key. Check it’s an Admin API key.'
        : res.status === 403 ? 'That key can’t read usage. It needs to be an Admin API key for your organization.'
          : res.status === 429 ? 'Anthropic is rate-limiting usage reports. Try again in a minute.'
            : `Anthropic’s usage report didn’t load (${res.status}).`
      throw new HTTPError({ status, message })
    }
    const body = await res.json() as { data: Bucket[], has_more: boolean, next_page: string | null }
    data.push(...body.data)
    if (!body.has_more || !body.next_page) break
    page = body.next_page
  }
  return { kind, days, data }
})
