// What the apps know about well-known services and sites (CHECKLIST.md #30, #54): a suggested folder
// for a bookmark, a category, colour and icon for a subscription. Suggestions only; nothing is applied
// without the person choosing it, and nothing here is fetched from anywhere.

export const RENEWAL_CATEGORIES = [
  'Entertainment', 'Music', 'Cloud & storage', 'Software', 'AI', 'Phone & internet', 'Gaming',
  'News & reading', 'Learning', 'Health & fitness', 'Shopping & delivery', 'Finance', 'Other'
] as const
export type RenewalCategory = (typeof RENEWAL_CATEGORIES)[number]

export interface KnownService {
  name: string
  /** Lower-case words that also mean this service */
  aliases?: string[]
  category: RenewalCategory
  /** Its website, for the icon */
  domain: string
  /** Brand colour for the letter tile when the icon can't load */
  color: string
}

export const SERVICES: KnownService[] = [
  { name: 'Netflix', category: 'Entertainment', domain: 'netflix.com', color: '#e50914' },
  { name: 'YouTube Premium', aliases: ['youtube'], category: 'Entertainment', domain: 'youtube.com', color: '#ff0000' },
  { name: 'Disney+', aliases: ['disney plus', 'disney'], category: 'Entertainment', domain: 'disneyplus.com', color: '#113ccf' },
  { name: 'Prime Video', aliases: ['amazon prime', 'prime'], category: 'Entertainment', domain: 'primevideo.com', color: '#1a98ff' },
  { name: 'HBO Max', aliases: ['max', 'hbo'], category: 'Entertainment', domain: 'max.com', color: '#002be7' },
  { name: 'Apple TV+', aliases: ['apple tv'], category: 'Entertainment', domain: 'tv.apple.com', color: '#1b1f2a' },
  { name: 'Viu', category: 'Entertainment', domain: 'viu.com', color: '#f5b400' },
  { name: 'iQIYI', aliases: ['iqiyi'], category: 'Entertainment', domain: 'iq.com', color: '#00be06' },
  { name: 'Spotify', category: 'Music', domain: 'spotify.com', color: '#1db954' },
  { name: 'Apple Music', category: 'Music', domain: 'music.apple.com', color: '#fa243c' },
  { name: 'YouTube Music', category: 'Music', domain: 'music.youtube.com', color: '#ff0000' },
  { name: 'iCloud+', aliases: ['icloud', 'apple one'], category: 'Cloud & storage', domain: 'icloud.com', color: '#3693f3' },
  { name: 'Google One', aliases: ['google drive', 'google storage'], category: 'Cloud & storage', domain: 'one.google.com', color: '#1a73e8' },
  { name: 'Dropbox', category: 'Cloud & storage', domain: 'dropbox.com', color: '#0061fe' },
  { name: 'OneDrive', category: 'Cloud & storage', domain: 'onedrive.live.com', color: '#0078d4' },
  { name: 'Microsoft 365', aliases: ['office 365', 'office'], category: 'Software', domain: 'microsoft.com', color: '#d83b01' },
  { name: 'Adobe Creative Cloud', aliases: ['adobe', 'photoshop', 'lightroom'], category: 'Software', domain: 'adobe.com', color: '#fa0f00' },
  { name: 'Figma', category: 'Software', domain: 'figma.com', color: '#a259ff' },
  { name: 'Canva', category: 'Software', domain: 'canva.com', color: '#00c4cc' },
  { name: 'Notion', category: 'Software', domain: 'notion.so', color: '#1b1f2a' },
  { name: 'GitHub', aliases: ['github pro', 'copilot', 'github copilot'], category: 'Software', domain: 'github.com', color: '#24292f' },
  { name: '1Password', aliases: ['one password'], category: 'Software', domain: '1password.com', color: '#0572ec' },
  { name: 'Zoom', category: 'Software', domain: 'zoom.us', color: '#2d8cff' },
  { name: 'Slack', category: 'Software', domain: 'slack.com', color: '#4a154b' },
  { name: 'NordVPN', aliases: ['nord', 'vpn'], category: 'Software', domain: 'nordvpn.com', color: '#4687ff' },
  { name: 'ExpressVPN', category: 'Software', domain: 'expressvpn.com', color: '#da3940' },
  { name: 'ChatGPT Plus', aliases: ['chatgpt', 'openai'], category: 'AI', domain: 'chatgpt.com', color: '#10a37f' },
  { name: 'Claude Pro', aliases: ['claude', 'anthropic'], category: 'AI', domain: 'claude.ai', color: '#d97757' },
  { name: 'Gemini Advanced', aliases: ['gemini'], category: 'AI', domain: 'gemini.google.com', color: '#4285f4' },
  { name: 'Smart', aliases: ['smart axiata', 'smart plan'], category: 'Phone & internet', domain: 'smart.com.kh', color: '#009a3e' },
  { name: 'Cellcard', category: 'Phone & internet', domain: 'cellcard.com.kh', color: '#f58220' },
  { name: 'Metfone', category: 'Phone & internet', domain: 'metfone.com.kh', color: '#e3001b' },
  { name: 'EZECOM', aliases: ['ezecom'], category: 'Phone & internet', domain: 'ezecom.com.kh', color: '#0b4ea2' },
  { name: 'Opennet', category: 'Phone & internet', domain: 'opennet.com.kh', color: '#e30613' },
  { name: 'Telegram Premium', aliases: ['telegram'], category: 'Phone & internet', domain: 'telegram.org', color: '#229ed9' },
  { name: 'Xbox Game Pass', aliases: ['game pass', 'xbox'], category: 'Gaming', domain: 'xbox.com', color: '#107c10' },
  { name: 'PlayStation Plus', aliases: ['ps plus', 'playstation'], category: 'Gaming', domain: 'playstation.com', color: '#003791' },
  { name: 'Nintendo Switch Online', aliases: ['nintendo'], category: 'Gaming', domain: 'nintendo.com', color: '#e60012' },
  { name: 'Duolingo', aliases: ['super duolingo'], category: 'Learning', domain: 'duolingo.com', color: '#58cc02' },
  { name: 'Coursera', category: 'Learning', domain: 'coursera.org', color: '#0056d2' },
  { name: 'LinkedIn Premium', aliases: ['linkedin'], category: 'Learning', domain: 'linkedin.com', color: '#0a66c2' },
  { name: 'Medium', category: 'News & reading', domain: 'medium.com', color: '#1b1f2a' },
  { name: 'Kindle Unlimited', aliases: ['kindle'], category: 'News & reading', domain: 'amazon.com', color: '#ff9900' },
  { name: 'Strava', category: 'Health & fitness', domain: 'strava.com', color: '#fc4c02' },
  { name: 'Grab Unlimited', aliases: ['grab', 'grabunlimited'], category: 'Shopping & delivery', domain: 'grab.com', color: '#00b14f' },
  { name: 'pandapro', aliases: ['foodpanda', 'panda pro'], category: 'Shopping & delivery', domain: 'foodpanda.com.kh', color: '#d70f64' },
  { name: 'Amazon Prime', aliases: ['amazon'], category: 'Shopping & delivery', domain: 'amazon.com', color: '#ff9900' }
]

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+ ]/g, '').replace(/\s+/g, ' ').trim()

/** The known service a name refers to, e.g. "netflix premium" → Netflix */
export function findService(name: string): KnownService | undefined {
  const n = norm(name)
  if (n.length < 2) return undefined
  return SERVICES.find(s => norm(s.name) === n)
    ?? SERVICES.find(s => s.aliases?.includes(n))
    ?? SERVICES.find(s => n.startsWith(norm(s.name)) || s.aliases?.some(a => n.startsWith(a)))
}

// ---------- Bookmark folders ----------

const SITE_FOLDERS: Record<string, string> = {
  'github.com': 'development', 'gitlab.com': 'development', 'stackoverflow.com': 'development', 'developer.mozilla.org': 'development',
  'nuxt.com': 'development', 'vuejs.org': 'development', 'npmjs.com': 'development', 'vercel.com': 'development', 'netlify.com': 'development',
  'figma.com': 'design', 'dribbble.com': 'design', 'behance.net': 'design', 'fonts.google.com': 'design', 'canva.com': 'design', 'coolors.co': 'design',
  'youtube.com': 'entertainment', 'netflix.com': 'entertainment', 'spotify.com': 'music', 'twitch.tv': 'entertainment',
  'facebook.com': 'social', 'instagram.com': 'social', 'x.com': 'social', 'twitter.com': 'social', 'tiktok.com': 'social', 'reddit.com': 'social', 'linkedin.com': 'work',
  'khmertimeskh.com': 'news', 'phnompenhpost.com': 'news', 'cambodianess.com': 'news', 'bbc.com': 'news', 'reuters.com': 'news', 'theguardian.com': 'news',
  'amazon.com': 'shopping', 'aliexpress.com': 'shopping', 'shopee.com': 'shopping', 'lazada.com': 'shopping',
  'ababank.com': 'banking', 'acledabank.com.kh': 'banking', 'wing.com.kh': 'banking', 'paypal.com': 'banking', 'wise.com': 'banking',
  'gmail.com': 'work', 'notion.so': 'work', 'slack.com': 'work', 'trello.com': 'work', 'docs.google.com': 'work', 'drive.google.com': 'work',
  'coursera.org': 'learning', 'udemy.com': 'learning', 'duolingo.com': 'learning', 'khanacademy.org': 'learning', 'wikipedia.org': 'learning',
  'booking.com': 'travel', 'agoda.com': 'travel', 'airbnb.com': 'travel', 'maps.google.com': 'travel',
  'chatgpt.com': 'ai', 'claude.ai': 'ai', 'gemini.google.com': 'ai', 'perplexity.ai': 'ai'
}

const hostKey = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

/**
 * A folder for a new bookmark: where you've put other links from the same site, else what the site is
 * known for. Returns undefined rather than guess.
 */
export function suggestFolder(url: string, existing: { url: string, tags: string[] }[]): string | undefined {
  const host = hostKey(url)
  if (!host) return undefined
  const counts = new Map<string, number>()
  for (const b of existing) {
    if (hostKey(b.url) !== host) continue
    for (const t of b.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  const mine = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (mine) return mine
  // The site itself, or the site it's part of (docs.github.com → github.com)
  const parts = host.split('.')
  for (let i = 0; i < parts.length - 1; i++) {
    const folder = SITE_FOLDERS[parts.slice(i).join('.')]
    if (folder) return folder
  }
  if (/(^|\.)docs?\./.test(host) || /\/docs?\//.test(url)) return 'documentation'
  return undefined
}

/** "development" → "Development" for folder names and labels */
export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
