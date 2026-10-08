// Things I own: what kinds of things there are, and a catalog of common devices for suggestions
// (CHECKLIST.md #44–#50). Adding a kind of thing is one entry in THING_TYPES (#49): its icon,
// colour, how fast it loses value, and which details are worth asking for.
//
// Catalog details (release year, RAM, screen size, storage options) are offered as suggestions you
// can accept or ignore; anything not in the catalog can be typed in by hand.

export type Spec = 'storage' | 'ram' | 'display' | 'year'

export interface ThingType {
  /** Stored on each thing (the old `category` field) */
  key: string
  label: string
  /** Line icon in CategoryIcon */
  icon: string
  color: string
  /** Typical value lost per year, compounding (for the estimate) */
  yearlyLoss: number
  /** Details the add form asks for */
  specs: Spec[]
  /** Only kept so older items still show; not offered for new ones */
  legacy?: boolean
}

export const THING_TYPES: ThingType[] = [
  { key: 'Phone', label: 'Phone', icon: 'Phone', color: '#1f5bd8', yearlyLoss: 0.3, specs: ['year', 'storage', 'ram', 'display'] },
  { key: 'Tablet', label: 'Tablet', icon: 'Tablet', color: '#1479b0', yearlyLoss: 0.25, specs: ['year', 'storage', 'ram', 'display'] },
  { key: 'Laptop', label: 'Laptop', icon: 'Laptop', color: '#3949ab', yearlyLoss: 0.22, specs: ['year', 'storage', 'ram', 'display'] },
  { key: 'Desktop', label: 'Desktop', icon: 'Desktop', color: '#4b5b78', yearlyLoss: 0.2, specs: ['year', 'storage', 'ram'] },
  { key: 'Monitor', label: 'Monitor', icon: 'Monitor', color: '#0e7490', yearlyLoss: 0.15, specs: ['year', 'display'] },
  { key: 'TV', label: 'TV', icon: 'TV', color: '#7448d1', yearlyLoss: 0.18, specs: ['year', 'display'] },
  { key: 'Keyboard', label: 'Keyboard', icon: 'Keyboard', color: '#4f8a12', yearlyLoss: 0.2, specs: ['year'] },
  { key: 'Mouse', label: 'Mouse', icon: 'Mouse', color: '#b8471c', yearlyLoss: 0.22, specs: ['year'] },
  { key: 'Headphones', label: 'Headphones', icon: 'Headphones', color: '#0f9488', yearlyLoss: 0.22, specs: ['year'] },
  { key: 'Watch', label: 'Watch', icon: 'Watch', color: '#ef7d16', yearlyLoss: 0.18, specs: ['year', 'display'] },
  { key: 'Camera', label: 'Camera', icon: 'Camera', color: '#7448d1', yearlyLoss: 0.15, specs: ['year'] },
  { key: 'Gaming', label: 'Game console', icon: 'Gaming', color: '#d43d78', yearlyLoss: 0.2, specs: ['year', 'storage'] },
  { key: 'Audio', label: 'Speaker / audio', icon: 'Audio', color: '#0f9488', yearlyLoss: 0.2, specs: ['year'] },
  { key: 'Home', label: 'Home', icon: 'Home', color: '#179a54', yearlyLoss: 0.1, specs: [] },
  { key: 'Vehicle', label: 'Vehicle', icon: 'Vehicle', color: '#d7263d', yearlyLoss: 0.12, specs: ['year'] },
  { key: 'Other', label: 'Other', icon: 'Other', color: '#8d5f33', yearlyLoss: 0.15, specs: [] },
  // Before Laptop and Desktop existed
  { key: 'Computer', label: 'Computer', icon: 'Computer', color: '#3949ab', yearlyLoss: 0.22, specs: ['year', 'storage', 'ram', 'display'], legacy: true }
]

export const typeOf = (key: string) => THING_TYPES.find(t => t.key === key) ?? THING_TYPES.find(t => t.key === 'Other')!
export const NEW_TYPES = THING_TYPES.filter(t => !t.legacy)

// ---------- Companies (#50: their own site icon is the logo) ----------

export interface Company { name: string, domain: string }

export const COMPANIES: Company[] = [
  { name: 'Apple', domain: 'apple.com' }, { name: 'Samsung', domain: 'samsung.com' }, { name: 'Google', domain: 'store.google.com' },
  { name: 'Xiaomi', domain: 'mi.com' }, { name: 'OPPO', domain: 'oppo.com' }, { name: 'vivo', domain: 'vivo.com' },
  { name: 'OnePlus', domain: 'oneplus.com' }, { name: 'realme', domain: 'realme.com' }, { name: 'Huawei', domain: 'huawei.com' },
  { name: 'Honor', domain: 'honor.com' }, { name: 'Redmi', domain: 'mi.com' }, { name: 'POCO', domain: 'po.co' },
  { name: 'RedMagic', domain: 'redmagic.gg' }, { name: 'Nubia', domain: 'nubia.com' }, { name: 'ZTE', domain: 'zte.com.cn' },
  { name: 'Nothing', domain: 'nothing.tech' }, { name: 'Motorola', domain: 'motorola.com' }, { name: 'Nokia', domain: 'nokia.com' },
  { name: 'Infinix', domain: 'infinixmobility.com' }, { name: 'Tecno', domain: 'tecno-mobile.com' }, { name: 'iQOO', domain: 'iqoo.com' },
  { name: 'Lenovo', domain: 'lenovo.com' }, { name: 'Dell', domain: 'dell.com' }, { name: 'HP', domain: 'hp.com' },
  { name: 'ASUS', domain: 'asus.com' }, { name: 'Acer', domain: 'acer.com' }, { name: 'MSI', domain: 'msi.com' },
  { name: 'LG', domain: 'lg.com' }, { name: 'Sony', domain: 'sony.com' }, { name: 'TCL', domain: 'tcl.com' },
  { name: 'Logitech', domain: 'logitech.com' }, { name: 'Keychron', domain: 'keychron.com' }, { name: 'Razer', domain: 'razer.com' },
  { name: 'Bose', domain: 'bose.com' }, { name: 'JBL', domain: 'jbl.com' }, { name: 'Garmin', domain: 'garmin.com' },
  { name: 'Fujifilm', domain: 'fujifilm.com' }, { name: 'Canon', domain: 'canon.com' }, { name: 'Nikon', domain: 'nikon.com' },
  { name: 'GoPro', domain: 'gopro.com' }, { name: 'DJI', domain: 'dji.com' }, { name: 'Nintendo', domain: 'nintendo.com' },
  { name: 'Microsoft', domain: 'microsoft.com' }, { name: 'Valve', domain: 'steamdeck.com' }, { name: 'Honda', domain: 'honda.com' },
  { name: 'Yamaha', domain: 'yamaha.com' }, { name: 'Toyota', domain: 'toyota.com' }, { name: 'Panasonic', domain: 'panasonic.com' },
  { name: 'Sharp', domain: 'sharp.com' }, { name: 'Philips', domain: 'philips.com' }
]

export const companyOf = (name?: string) => (name ? COMPANIES.find(c => c.name.toLowerCase() === name.trim().toLowerCase()) : undefined)

/** The icon a site declares, served from this app (/api/logo finds it; works for brands without /favicon.ico) */
export const siteLogo = (domain: string) => `/api/logo?domain=${encodeURIComponent(domain)}`

/**
 * A company's logo: from the known list, or for a one-word name typed by hand, one guess at
 * <name>.com. When nothing loads, the page shows the type's icon instead.
 */
export const companyLogo = (name?: string) => {
  const c = companyOf(name)
  if (c) return siteLogo(c.domain)
  const word = name?.trim().toLowerCase()
  return word && /^[a-z0-9]{2,20}$/.test(word) ? siteLogo(`${word}.com`) : undefined
}

// ---------- Catalog (#45, #46) ----------

export interface Generation { name: string, year?: number, ram?: number, display?: number }

export interface Model {
  type: string
  company: string
  name: string
  year?: number
  /** GB options it was sold with */
  storage?: number[]
  ram?: number
  /** Inches; several for TVs sold in sizes */
  display?: number | number[]
  generations?: Generation[]
}

const m = (type: string, company: string, name: string, extra: Omit<Model, 'type' | 'company' | 'name'> = {}): Model => ({ type, company, name, ...extra })
const P = 'Phone'
const T = 'Tablet'
const L = 'Laptop'
const D = 'Desktop'

export const CATALOG: Model[] = [
  // Phones
  m(P, 'Apple', 'iPhone 16 Pro Max', { year: 2024, storage: [256, 512, 1024], ram: 8, display: 6.9 }),
  m(P, 'Apple', 'iPhone 16 Pro', { year: 2024, storage: [128, 256, 512, 1024], ram: 8, display: 6.3 }),
  m(P, 'Apple', 'iPhone 16', { year: 2024, storage: [128, 256, 512], ram: 8, display: 6.1 }),
  m(P, 'Apple', 'iPhone 15 Pro Max', { year: 2023, storage: [256, 512, 1024], ram: 8, display: 6.7 }),
  m(P, 'Apple', 'iPhone 15 Pro', { year: 2023, storage: [128, 256, 512, 1024], ram: 8, display: 6.1 }),
  m(P, 'Apple', 'iPhone 15', { year: 2023, storage: [128, 256, 512], ram: 6, display: 6.1 }),
  m(P, 'Apple', 'iPhone 14 Pro', { year: 2022, storage: [128, 256, 512, 1024], ram: 6, display: 6.1 }),
  m(P, 'Apple', 'iPhone 14', { year: 2022, storage: [128, 256, 512], ram: 6, display: 6.1 }),
  m(P, 'Apple', 'iPhone 13', { year: 2021, storage: [128, 256, 512], ram: 4, display: 6.1 }),
  m(P, 'Apple', 'iPhone SE', { storage: [64, 128, 256], display: 4.7, generations: [{ name: '2nd generation', year: 2020, ram: 3 }, { name: '3rd generation', year: 2022, ram: 4 }] }),
  m(P, 'Samsung', 'Galaxy S24 Ultra', { year: 2024, storage: [256, 512, 1024], ram: 12, display: 6.8 }),
  m(P, 'Samsung', 'Galaxy S24', { year: 2024, storage: [128, 256, 512], ram: 8, display: 6.2 }),
  m(P, 'Samsung', 'Galaxy S23 Ultra', { year: 2023, storage: [256, 512, 1024], ram: 12, display: 6.8 }),
  m(P, 'Samsung', 'Galaxy A55', { year: 2024, storage: [128, 256], ram: 8, display: 6.6 }),
  m(P, 'Samsung', 'Galaxy Z Fold6', { year: 2024, storage: [256, 512, 1024], ram: 12, display: 7.6 }),
  m(P, 'Samsung', 'Galaxy Z Flip6', { year: 2024, storage: [256, 512], ram: 12, display: 6.7 }),
  m(P, 'Google', 'Pixel 9 Pro', { year: 2024, storage: [128, 256, 512, 1024], ram: 16, display: 6.3 }),
  m(P, 'Google', 'Pixel 9', { year: 2024, storage: [128, 256], ram: 12, display: 6.3 }),
  m(P, 'Google', 'Pixel 8a', { year: 2024, storage: [128, 256], ram: 8, display: 6.1 }),
  m(P, 'Google', 'Pixel 8 Pro', { year: 2023, storage: [128, 256, 512, 1024], ram: 12, display: 6.7 }),
  m(P, 'Xiaomi', 'Xiaomi 14', { year: 2023, storage: [256, 512], ram: 12, display: 6.36 }),
  m(P, 'Redmi', 'Redmi Note 13 Pro', { year: 2024, storage: [128, 256, 512], ram: 8, display: 6.67 }),
  m(P, 'Honor', 'Honor 200', { year: 2024, storage: [256, 512], ram: 12 }),
  m(P, 'Honor', 'Honor Magic6 Pro', { year: 2024, storage: [512], ram: 12 }),
  m(P, 'RedMagic', 'RedMagic 9 Pro', { year: 2023, storage: [256, 512, 1024], ram: 12, display: 6.8 }),
  m(P, 'OnePlus', 'OnePlus 12', { year: 2024, storage: [256, 512], ram: 12, display: 6.82 }),
  m(P, 'OPPO', 'Reno12', { year: 2024, storage: [256, 512], ram: 12 }),
  m(P, 'vivo', 'V30', { year: 2024, storage: [256, 512], ram: 12 }),

  // Tablets
  m(T, 'Apple', 'iPad Pro 13-inch (M4)', { year: 2024, storage: [256, 512, 1024, 2048], ram: 8, display: 13 }),
  m(T, 'Apple', 'iPad Pro 11-inch (M4)', { year: 2024, storage: [256, 512, 1024, 2048], ram: 8, display: 11 }),
  m(T, 'Apple', 'iPad Air 11-inch (M2)', { year: 2024, storage: [128, 256, 512, 1024], ram: 8, display: 11 }),
  m(T, 'Apple', 'iPad', { storage: [64, 256], display: 10.9, generations: [{ name: '10th generation', year: 2022, ram: 4 }] }),
  m(T, 'Apple', 'iPad mini', { storage: [128, 256, 512], display: 8.3, generations: [{ name: '6th generation', year: 2021, ram: 4 }, { name: 'A17 Pro', year: 2024, ram: 8 }] }),
  m(T, 'Samsung', 'Galaxy Tab S9', { year: 2023, storage: [128, 256], ram: 8, display: 11 }),
  m(T, 'Samsung', 'Galaxy Tab S9 FE', { year: 2023, storage: [128, 256], ram: 6, display: 10.9 }),
  m(T, 'Lenovo', 'Legion Y700', { storage: [128, 256, 512], display: 8.8, generations: [{ name: 'Gen 1', year: 2022 }, { name: 'Gen 2', year: 2023 }, { name: 'Gen 3', year: 2025 }] }),
  m(T, 'Xiaomi', 'Xiaomi Pad 6', { year: 2023, storage: [128, 256], ram: 8, display: 11 }),

  // Laptops
  m(L, 'Apple', 'MacBook Air 13-inch', { storage: [256, 512, 1024, 2048], display: 13.6, generations: [{ name: 'M2', year: 2022, ram: 8 }, { name: 'M3', year: 2024, ram: 8 }] }),
  m(L, 'Apple', 'MacBook Air 15-inch', { storage: [256, 512, 1024, 2048], display: 15.3, generations: [{ name: 'M2', year: 2023, ram: 8 }, { name: 'M3', year: 2024, ram: 8 }] }),
  m(L, 'Apple', 'MacBook Pro 14-inch', { storage: [512, 1024, 2048], display: 14.2, generations: [{ name: 'M3', year: 2023, ram: 8 }, { name: 'M4', year: 2024, ram: 16 }] }),
  m(L, 'Lenovo', 'ThinkPad X1 Carbon', { storage: [256, 512, 1024], display: 14, generations: [{ name: 'Gen 11', year: 2023 }, { name: 'Gen 12', year: 2024 }] }),
  m(L, 'Lenovo', 'Legion 5', { storage: [512, 1024], display: 16, generations: [{ name: 'Gen 8', year: 2023 }, { name: 'Gen 9', year: 2024 }] }),
  m(L, 'Lenovo', 'IdeaPad Slim 5', { storage: [512, 1024], ram: 16 }),
  m(L, 'Dell', 'XPS 13', { storage: [512, 1024], display: 13.4 }),
  m(L, 'ASUS', 'ROG Zephyrus G14', { storage: [512, 1024], display: 14 }),
  m(L, 'ASUS', 'Zenbook 14 OLED', { storage: [512, 1024], display: 14 }),
  m(L, 'HP', 'Spectre x360 14', { storage: [512, 1024, 2048], display: 14 }),
  m(L, 'Acer', 'Swift Go 14', { storage: [512, 1024], display: 14 }),

  // Desktops
  m(D, 'Apple', 'Mac mini', { storage: [256, 512, 1024, 2048], generations: [{ name: 'M2', year: 2023, ram: 8 }, { name: 'M4', year: 2024, ram: 16 }] }),
  m(D, 'Apple', 'iMac 24-inch', { storage: [256, 512, 1024], generations: [{ name: 'M3', year: 2023, ram: 8, display: 24 }, { name: 'M4', year: 2024, ram: 16, display: 24 }] }),
  m(D, 'Apple', 'Mac Studio', { storage: [512, 1024, 2048], generations: [{ name: 'M2 Max', year: 2023, ram: 32 }] }),
  m(D, 'Dell', 'OptiPlex', { storage: [256, 512] }),

  // Monitors
  m('Monitor', 'Dell', 'UltraSharp U2723QE', { year: 2022, display: 27 }),
  m('Monitor', 'LG', 'UltraGear 27GP850', { year: 2021, display: 27 }),
  m('Monitor', 'Samsung', 'Odyssey G7', { display: [27, 32] }),
  m('Monitor', 'Apple', 'Studio Display', { year: 2022, display: 27 }),
  m('Monitor', 'ASUS', 'ProArt PA278QV', { display: 27 }),

  // TVs
  m('TV', 'LG', 'OLED C3', { year: 2023, display: [42, 48, 55, 65, 77, 83] }),
  m('TV', 'LG', 'OLED C4', { year: 2024, display: [42, 48, 55, 65, 77, 83] }),
  m('TV', 'Samsung', 'QN90C Neo QLED', { year: 2023, display: [43, 50, 55, 65, 75, 85] }),
  m('TV', 'Sony', 'Bravia 7', { year: 2024, display: [50, 55, 65, 75, 85] }),
  m('TV', 'TCL', 'C845', { year: 2023, display: [55, 65, 75, 85] }),

  // Keyboards and mice
  m('Keyboard', 'Logitech', 'MX Keys S', { year: 2023 }),
  m('Keyboard', 'Keychron', 'K2'),
  m('Keyboard', 'Keychron', 'Q1'),
  m('Keyboard', 'Apple', 'Magic Keyboard'),
  m('Keyboard', 'Razer', 'BlackWidow V4', { year: 2023 }),
  m('Mouse', 'Logitech', 'MX Master 3S', { year: 2022 }),
  m('Mouse', 'Logitech', 'G Pro X Superlight 2', { year: 2023 }),
  m('Mouse', 'Razer', 'DeathAdder V3', { year: 2023 }),
  m('Mouse', 'Apple', 'Magic Mouse'),

  // Headphones
  m('Headphones', 'Apple', 'AirPods Pro', { generations: [{ name: '2nd generation', year: 2022 }] }),
  m('Headphones', 'Apple', 'AirPods 4', { year: 2024 }),
  m('Headphones', 'Apple', 'AirPods Max', { year: 2020 }),
  m('Headphones', 'Sony', 'WH-1000XM5', { year: 2022 }),
  m('Headphones', 'Sony', 'WF-1000XM5', { year: 2023 }),
  m('Headphones', 'Bose', 'QuietComfort Ultra Headphones', { year: 2023 }),
  m('Headphones', 'Samsung', 'Galaxy Buds3 Pro', { year: 2024 }),

  // Watches, cameras, consoles
  m('Watch', 'Apple', 'Apple Watch', { generations: [{ name: 'Series 9', year: 2023 }, { name: 'Series 10', year: 2024 }, { name: 'Ultra 2', year: 2023 }] }),
  m('Watch', 'Samsung', 'Galaxy Watch7', { year: 2024 }),
  m('Watch', 'Garmin', 'Forerunner 265', { year: 2023 }),
  m('Camera', 'Sony', 'Alpha 7 IV', { year: 2021 }),
  m('Camera', 'Fujifilm', 'X-T5', { year: 2022 }),
  m('Camera', 'Canon', 'EOS R6 Mark II', { year: 2022 }),
  m('Camera', 'GoPro', 'HERO12 Black', { year: 2023 }),
  m('Gaming', 'Sony', 'PlayStation 5', { storage: [825, 1000, 2000], generations: [{ name: 'Original', year: 2020 }, { name: 'Slim', year: 2023 }, { name: 'Pro', year: 2024 }] }),
  m('Gaming', 'Nintendo', 'Switch', { storage: [32, 64], generations: [{ name: 'Original', year: 2017 }, { name: 'OLED', year: 2021 }] }),
  m('Gaming', 'Microsoft', 'Xbox Series X', { year: 2020, storage: [1000, 2000] }),
  m('Gaming', 'Valve', 'Steam Deck OLED', { year: 2023, storage: [512, 1024] })
]

const norm = (s?: string) => (s ?? '').trim().toLowerCase()

/** Companies to suggest for a type: ones in the catalog first, then every other known one */
export function companiesFor(type: string) {
  const inCatalog = [...new Set(CATALOG.filter(x => x.type === type || (type === 'Computer' && (x.type === L || x.type === D))).map(x => x.company))]
  return [...inCatalog, ...COMPANIES.map(c => c.name).filter(n => !inCatalog.includes(n))]
}

export function modelsFor(type: string, company: string) {
  return CATALOG.filter(x => (x.type === type || (type === 'Computer' && (x.type === L || x.type === D))) && (!company || norm(x.company) === norm(company)))
}

export function findModel(type: string, company: string, name: string) {
  return modelsFor(type, company).find(x => norm(x.name) === norm(name))
}

export interface SpecSuggestion { year?: number, ram?: number, display?: number, storage?: number[] }

/** What the catalog knows about this model (and generation), for the "Suggested details" card */
export function suggestSpecs(type: string, company: string, model: string, generation: string): SpecSuggestion | undefined {
  const found = findModel(type, company, model)
  if (!found) return undefined
  const gen = found.generations?.find(g => norm(g.name) === norm(generation))
  const display = gen?.display ?? (Array.isArray(found.display) ? undefined : found.display)
  return { year: gen?.year ?? found.year, ram: gen?.ram ?? found.ram, display, storage: found.storage }
}

/** "1 TB", "256 GB" (1024 GB and 1000 GB both read as 1 TB) */
export const storageLabel = (gb: number) => (gb >= 1000 ? `${Number((gb / (gb % 1024 === 0 ? 1024 : 1000)).toFixed(1))} TB` : `${gb} GB`)
