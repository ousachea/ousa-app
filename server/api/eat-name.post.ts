import Anthropic from '@anthropic-ai/sdk'
import { defineEventHandler, HTTPError } from 'h3'

// Names a food photo with Claude, so + Photos fills in the name, Khmer name, note and price for you.
// Development only, like eat-image. Uses ANTHROPIC_API_KEY (or an `ant auth login` profile).
const TYPES = new Set(['image/webp', 'image/jpeg', 'image/png'])
const MAX_BYTES = 4 * 1024 * 1024

const SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'The dish in English, as it is usually called in Cambodia (e.g. Fish amok, Beef lok lak). For a restaurant or shop photo, its name if visible.' },
    nameKm: { type: 'string', description: 'The same name written in Khmer script' },
    kind: { type: 'string', enum: ['food', 'place'], description: 'food for a dish, place for a restaurant, café or stall' },
    note: { type: 'string', description: 'A few words describing it, under 50 characters' },
    price: { type: 'integer', enum: [1, 2, 3], description: '1 cheap street food, 2 an ordinary restaurant meal, 3 fine dining' }
  },
  required: ['name', 'nameKm', 'kind', 'note', 'price'],
  additionalProperties: false
} as const

type Named = { name: string, nameKm: string, kind: 'food' | 'place', note: string, price: 1 | 2 | 3 }

export default defineEventHandler(async (event) => {
  if (!import.meta.dev) throw new HTTPError({ status: 403, message: 'Photos can only be named while running the app locally.' })

  const type = event.req.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
  if (!TYPES.has(type)) throw new HTTPError({ status: 415, message: 'Only WebP, JPEG or PNG images can be named.' })
  const bytes = Buffer.from(await event.req.arrayBuffer())
  if (!bytes.length || bytes.length > MAX_BYTES) throw new HTTPError({ status: 413, message: 'Images must be under 4 MB.' })

  const client = new Anthropic()
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: type as 'image/webp' | 'image/jpeg' | 'image/png', data: bytes.toString('base64') } },
          { type: 'text', text: 'This photo is for a list of things to eat in Phnom Penh, Cambodia. Name what it shows.' }
        ]
      }]
    })
    if (response.stop_reason === 'refusal') throw new HTTPError({ status: 422, message: 'Claude couldn’t name this photo.' })
    const text = response.content.find(b => b.type === 'text')
    if (!text || text.type !== 'text') throw new HTTPError({ status: 502, message: 'Claude didn’t return a name.' })
    return JSON.parse(text.text) as Named
  } catch (e) {
    if (e instanceof HTTPError) throw e
    if (e instanceof Anthropic.AuthenticationError) throw new HTTPError({ status: 401, message: 'No Claude API key. Set ANTHROPIC_API_KEY before npm run dev.' })
    if (e instanceof Anthropic.RateLimitError) throw new HTTPError({ status: 429, message: 'Claude is busy. Try again in a moment.' })
    if (e instanceof Anthropic.APIError) throw new HTTPError({ status: 502, message: `Claude API error ${e.status}` })
    if (e instanceof Error && /api key|apiKey|authToken/i.test(e.message)) throw new HTTPError({ status: 401, message: 'No Claude API key. Set ANTHROPIC_API_KEY before npm run dev.' })
    throw e
  }
})
