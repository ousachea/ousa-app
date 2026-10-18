import { defineEventHandler, getQuery } from 'h3'
import { searchIcons } from '../utils/iconLibrary'

// Searches the icon library for IconLibrary: /api/icons?q=car → ['lucide:car', …]
export default defineEventHandler(event => searchIcons(String(getQuery(event).q ?? '').slice(0, 40)))
