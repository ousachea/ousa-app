// The animated icons (<AnimatedIcon>, Settings → Logos & icons → Animated): Lucide's drawings, the same as <AppIcon>
// draws, split into the parts that move (a bin's lid, a bell's clapper, a wifi's arcs) so each can be
// animated on its own. The motion for each lives in AnimatedIcon.vue, under `.ai-<name>`. Geometry is
// copied from @iconify-json/lucide, so a still animated icon looks exactly like its <AppIcon>.

export type AnimatedTrigger = 'hover' | 'click' | 'loop' | 'manual'

export interface AnimatedIconDef {
  label: string
  /** The SVG inside a 24 × 24 box; moving parts carry a class the CSS animates */
  body: string
  /** How long one play takes (ms); loops wait this long plus a rest between plays */
  ms: number
  /** What it's good for, shown in the library */
  use: string
  /** The trigger that suits it best */
  trigger: AnimatedTrigger
  /** Spins without rest while shown (a loader), instead of playing once per trigger */
  spin?: boolean
  group: 'Actions' | 'Status' | 'Navigation' | 'Objects'
}

// pathLength="1" lets a stroke draw itself in from 0 to 1, whatever its real length
const ICONS = {
  'check': { group: 'Status', label: 'Check', ms: 450, trigger: 'manual', use: 'Saved, done, copied: draws itself in', body: '<path class="draw" pathLength="1" d="M20 6L9 17l-5-5"/>' },
  'circle-check': { group: 'Status', label: 'Circle check', ms: 650, trigger: 'manual', use: 'A success message or a finished step', body: '<circle class="ring" pathLength="1" cx="12" cy="12" r="10"/><path class="draw late" pathLength="1" d="m16 9l-5.5 5.5L8 12"/>' },
  'circle-alert': { group: 'Status', label: 'Alert', ms: 500, trigger: 'manual', use: 'An error or a warning that needs a look', body: '<g class="shake"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></g>' },
  'loader-circle': { group: 'Status', label: 'Loader', ms: 800, trigger: 'loop', spin: true, use: 'Loading or syncing, while it lasts', body: '<path class="spin" d="M21 12a9 9 0 1 1-6.219-8.56"/>' },
  'rotate-cw': { group: 'Actions', label: 'Reload', ms: 600, trigger: 'hover', use: 'Refresh a price, start a test again; spins while busy', body: '<g class="turn"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></g>' },
  'pencil': { group: 'Actions', label: 'Edit', ms: 600, trigger: 'hover', use: 'Edit, rename, write', body: '<path class="scribble" d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4"/>' },
  'refresh-cw': { group: 'Actions', label: 'Refresh', ms: 700, trigger: 'hover', use: 'Sync again, reload, get site details', body: '<g class="turn"><path d="M3 12a9 9 0 0 1 9-9a9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5m5 4a9 9 0 0 1-9 9a9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></g>' },
  'copy': { group: 'Actions', label: 'Copy', ms: 450, trigger: 'hover', use: 'Copy a code, a link or a password', body: '<rect class="front" width="14" height="14" x="8" y="8" rx="2" ry="2"/><path class="back" d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>' },
  'trash-2': { group: 'Actions', label: 'Delete', ms: 500, trigger: 'hover', use: 'Delete or move to the Recycle Bin', body: '<path class="lid" d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6m4-6v6"/>' },
  'download': { group: 'Actions', label: 'Download', ms: 600, trigger: 'hover', use: 'Export, back up, save a file', body: '<path class="drop" d="M12 15V3M7 10l5 5l5-5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' },
  'upload': { group: 'Actions', label: 'Upload', ms: 600, trigger: 'hover', use: 'Import, restore, add a file', body: '<path class="rise" d="M12 3v12m5-7l-5-5l-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' },
  'send': { group: 'Actions', label: 'Send', ms: 700, trigger: 'click', use: 'Send, share out, submit', body: '<path class="fly" d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11zm7.318-19.539l-10.94 10.939"/>' },
  'plus': { group: 'Actions', label: 'Add', ms: 400, trigger: 'hover', use: 'Add something new', body: '<path class="quarter" d="M5 12h14m-7-7v14"/>' },
  'x': { group: 'Actions', label: 'Close', ms: 400, trigger: 'hover', use: 'Close a popup, clear a field', body: '<path class="quarter" d="M18 6L6 18M6 6l12 12"/>' },
  'search': { group: 'Actions', label: 'Search', ms: 700, trigger: 'hover', use: 'Search and find', body: '<g class="scan"><path d="m21 21l-4.34-4.34"/><circle cx="11" cy="11" r="8"/></g>' },
  'share-2': { group: 'Actions', label: 'Share', ms: 600, trigger: 'hover', use: 'Share a folder or a link', body: '<circle class="node n1" cx="18" cy="5" r="3"/><circle class="node n0" cx="6" cy="12" r="3"/><circle class="node n2" cx="18" cy="19" r="3"/><path d="m8.59 13.51l6.83 3.98m-.01-10.98l-6.82 3.98"/>' },
  'heart': { group: 'Objects', label: 'Heart', ms: 600, trigger: 'click', use: 'Like or favourite', body: '<path class="beat" d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676a.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>' },
  'star': { group: 'Objects', label: 'Star', ms: 550, trigger: 'click', use: 'Favourite: shown on the home page', body: '<path class="pop" d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z"/>' },
  'bookmark': { group: 'Objects', label: 'Bookmark', ms: 550, trigger: 'click', use: 'Save a link for later', body: '<path class="land" d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"/>' },
  'pin': { group: 'Objects', label: 'Pin', ms: 550, trigger: 'click', use: 'Pin to the top', body: '<path class="press" d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4a1 1 0 0 1 1 1z"/>' },
  'bell': { group: 'Objects', label: 'Bell', ms: 800, trigger: 'hover', use: 'Reminders and notifications', body: '<g class="swing"><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/><path class="clapper" d="M10.268 21a2 2 0 0 0 3.464 0"/></g>' },
  'lock': { group: 'Objects', label: 'Lock', ms: 550, trigger: 'hover', use: 'Locked, encrypted, private', body: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path class="shackle" d="M7 11V7a5 5 0 0 1 10 0v4"/>' },
  'eye': { group: 'Objects', label: 'Eye', ms: 450, trigger: 'hover', use: 'Show, preview, visible', body: '<g class="blink"><path d="M2.062 12.348a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 19.876 0a1 1 0 0 1 0 .696a10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></g>' },
  'settings': { group: 'Objects', label: 'Settings', ms: 700, trigger: 'hover', use: 'Settings and preferences', body: '<path class="gear" d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0a2.34 2.34 0 0 0 3.319 1.915a2.34 2.34 0 0 1 2.33 4.033a2.34 2.34 0 0 0 0 3.831a2.34 2.34 0 0 1-2.33 4.033a2.34 2.34 0 0 0-3.319 1.915a2.34 2.34 0 0 1-4.659 0a2.34 2.34 0 0 0-3.32-1.915a2.34 2.34 0 0 1-2.33-4.033a2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>' },
  'clock': { group: 'Objects', label: 'Clock', ms: 900, trigger: 'hover', use: 'Time, countdowns, renewals', body: '<circle cx="12" cy="12" r="10"/><path class="hands" d="M12 6v6l4 2"/>' },
  'mail': { group: 'Objects', label: 'Mail', ms: 600, trigger: 'hover', use: 'Email and messages', body: '<rect width="20" height="16" x="2" y="4" rx="2"/><path class="flap" d="m22 7l-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/>' },
  'sparkles': { group: 'Objects', label: 'Sparkles', ms: 900, trigger: 'hover', use: 'New, magic, made for you', body: '<path class="twinkle" d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path class="glint g1" d="M20 2v4m2-2h-4"/><circle class="glint g2" cx="4" cy="20" r="2"/>' },
  'zap': { group: 'Objects', label: 'Zap', ms: 500, trigger: 'hover', use: 'Fast, performance, power', body: '<path class="flash" d="M15.914 4a1.5 1.5 0 0 0-2.474-1.561l-9 9A1.5 1.5 0 0 0 5.5 14h4.002a.5.5 0 0 1 .471.666L8.086 20a1.5 1.5 0 0 0 2.475 1.56l9-9A1.5 1.5 0 0 0 18.5 10h-3.997a.5.5 0 0 1-.472-.667z"/>' },
  'loader': { group: 'Status', label: 'Loader ticks', ms: 900, trigger: 'loop', spin: true, use: 'Working on it: a spinner in eight ticks', body: '<path class="tick-spin" d="M12 2v4m4.2 1.8l2.9-2.9M18 12h4m-5.8 4.2l2.9 2.9M12 18v4m-7.1-2.9l2.9-2.9M2 12h4M4.9 4.9l2.9 2.9"/>' },
  'hourglass': { group: 'Status', label: 'Hourglass', ms: 1100, trigger: 'loop', use: 'Waiting, time running out, a trial ending', body: '<g class="flip"><path d="M5 22h14M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></g>' },
  'activity': { group: 'Status', label: 'Activity', ms: 1400, trigger: 'loop', use: 'Live readings, a test running, a trend', body: '<path class="trace" pathLength="1" d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>' },
  'battery-charging': { group: 'Status', label: 'Charging', ms: 1000, trigger: 'loop', use: 'Charging, battery health', body: '<path class="charge" d="m11 7l-3 5h4l-3 5"/><path d="M14.856 6H16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.935M22 14v-4M5.14 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.936"/>' },
  'radio': { group: 'Status', label: 'Broadcast', ms: 1000, trigger: 'loop', use: 'Live, sharing, a signal going out', body: '<circle cx="12" cy="12" r="2"/><path class="bar b1" d="M16.247 7.761a6 6 0 0 1 0 8.478M7.753 16.239a6 6 0 0 1 0-8.478"/><path class="bar b2" d="M19.075 4.933a10 10 0 0 1 0 14.134M4.925 19.067a10 10 0 0 1 0-14.134"/>' },
  'signal': { group: 'Status', label: 'Signal', ms: 1000, trigger: 'loop', use: 'Network strength, a phone number’s carrier', body: '<path class="bar b0" d="M2 20h.01"/><path class="bar b1" d="M7 20v-4"/><path class="bar b2" d="M12 20v-8"/><path class="bar b3" d="M17 20V8"/><path class="bar b4" d="M22 4v16"/>' },
  'timer': { group: 'Status', label: 'Timer', ms: 1200, trigger: 'loop', use: 'A countdown or a stopwatch running', body: '<path d="M10 2h4"/><path class="tick-hand" d="M12 14l3-3"/><circle cx="12" cy="14" r="8"/>' },
  'gauge': { group: 'Status', label: 'Speed', ms: 1100, trigger: 'loop', use: 'Speed, a reading on a dial', body: '<path class="needle" d="m12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>' },
  'wifi': { group: 'Status', label: 'Wifi', ms: 900, trigger: 'loop', use: 'Online, connecting, speed test', body: '<path class="bar b0" d="M12 20h.01"/><path class="bar b1" d="M8.5 16.429a5 5 0 0 1 7 0"/><path class="bar b2" d="M5 12.859a10 10 0 0 1 14 0"/><path class="bar b3" d="M2 8.82a15 15 0 0 1 20 0"/>' },
  'volume-2': { group: 'Status', label: 'Volume', ms: 800, trigger: 'hover', use: 'Sound on, play a sound', body: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path class="bar b1" d="M16 9a5 5 0 0 1 0 6"/><path class="bar b2" d="M19.364 18.364a9 9 0 0 0 0-12.728"/>' },
  'map-pin': { group: 'Objects', label: 'Location', ms: 900, trigger: 'loop', use: 'A place, “you are here”', body: '<g class="hop"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></g>' },
  'flame': { group: 'Objects', label: 'Flame', ms: 900, trigger: 'loop', use: 'A streak, hot, popular', body: '<path class="flicker" d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0a5 5 0 0 1 1-3a1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>' },
  'cloud': { group: 'Objects', label: 'Cloud', ms: 1200, trigger: 'hover', use: 'Synced, saved online, the account', body: '<path class="drift" d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9"/>' },
  'sun': { group: 'Objects', label: 'Sun', ms: 800, trigger: 'hover', use: 'Light theme', body: '<circle class="core" cx="12" cy="12" r="4"/><path class="rays" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>' },
  'moon': { group: 'Objects', label: 'Moon', ms: 800, trigger: 'hover', use: 'Dark theme', body: '<path class="rock" d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>' },
  'arrow-right': { group: 'Navigation', label: 'Arrow right', ms: 500, trigger: 'hover', use: 'Go on, next, open', body: '<path class="nudge" d="M5 12h14m-7-7l7 7l-7 7"/>' },
  'chevron-down': { group: 'Navigation', label: 'Chevron down', ms: 500, trigger: 'hover', use: 'Open a menu or a section', body: '<path class="dip" d="m6 9l6 6l6-6"/>' },
  'menu': { group: 'Navigation', label: 'Menu', ms: 550, trigger: 'hover', use: 'Open the menu', body: '<path class="line l0" d="M4 5h16"/><path class="line l1" d="M4 12h16"/><path class="line l2" d="M4 19h16"/>' },
  'house': { group: 'Navigation', label: 'Home', ms: 500, trigger: 'hover', use: 'Back to the home page', body: '<path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path class="door" d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>' }
} satisfies Record<string, AnimatedIconDef>

export type AnimatedIconName = keyof typeof ICONS
export const ANIMATED_ICONS: Record<AnimatedIconName, AnimatedIconDef> = ICONS
export const ANIMATED_ICON_NAMES = Object.keys(ICONS) as AnimatedIconName[]
