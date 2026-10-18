import lucide from '@iconify-json/lucide/icons.json'

// The icon library (Lucide, from @iconify-json/lucide), kept on the server so nothing is fetched from
// elsewhere and the browser bundle stays small. Used by /api/icon and /api/icons.
const icons = lucide.icons as Record<string, { body: string }>
const aliases = (lucide.aliases ?? {}) as Record<string, { parent: string }>
const names = Object.keys(icons)

/** An icon as SVG in one colour, or undefined when there's no such icon */
export function iconSvg(name: string, color: string) {
  const icon = icons[name] ?? icons[aliases[name]?.parent ?? '']
  if (!icon) return undefined
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${icon.body.replaceAll('currentColor', color)}</svg>`
}

// Everyday words for things people subscribe to, onto the names Lucide uses
const SYNONYMS: Record<string, string[]> = {
  gym: ['dumbbell', 'biceps-flexed'], fitness: ['dumbbell', 'heart-pulse'], electricity: ['zap', 'plug'], power: ['zap', 'plug'],
  water: ['droplets', 'droplet'], internet: ['wifi', 'globe', 'router'], phone: ['smartphone', 'phone'], mobile: ['smartphone'],
  insurance: ['shield-check', 'umbrella'], rent: ['house', 'key-round'], streaming: ['tv', 'film', 'clapperboard'],
  movie: ['film', 'clapperboard', 'popcorn'], game: ['gamepad-2', 'joystick'], storage: ['cloud', 'hard-drive', 'database'],
  school: ['graduation-cap', 'school'], course: ['graduation-cap', 'book-open'], food: ['utensils', 'pizza', 'salad'],
  pet: ['paw-print', 'dog', 'cat'], vpn: ['shield', 'lock'], domain: ['globe', 'link'], hosting: ['server', 'cloud'],
  news: ['newspaper'], magazine: ['newspaper', 'book-open'], ai: ['bot', 'sparkles', 'brain'], loan: ['landmark', 'banknote'],
  bank: ['landmark', 'credit-card'], car: ['car', 'fuel'], transport: ['bus', 'car', 'bike'], health: ['heart-pulse', 'stethoscope', 'pill']
}

/** Icons whose name contains every word searched, plus everyday words like "gym", best matches first */
export function searchIcons(query: string, limit = 64) {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  if (!words.length) return []
  const found = new Set<string>()
  for (const w of words) for (const n of SYNONYMS[w] ?? []) if (icons[n]) found.add(n)
  const matches = names.filter(n => words.every(w => n.includes(w)))
  const rank = (n: string) => (n === words.join('-') ? 0 : n.startsWith(words[0]!) ? 1 : 2) * 100 + n.length
  for (const n of matches.sort((a, b) => rank(a) - rank(b))) found.add(n)
  return [...found].slice(0, limit).map(n => `lucide:${n}`)
}
