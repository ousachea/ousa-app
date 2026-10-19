import { defineEventHandler, getQuery } from 'h3'
import { brandCount, searchBrands } from '../utils/brandLogos'

// Searches the brand logos for the Logos & icons page: /api/logos?q=stripe → { total, logos: [{ slug, title, color }] }
export default defineEventHandler(async (event) => {
  const q = String(getQuery(event).q ?? '').slice(0, 40)
  return { total: await brandCount(), logos: await searchBrands(q) }
})
