import type { BudgetCategory, BudgetSettings, ColorSlot, PaymentMethod, Widget } from './types'

// The categories a new account starts with. Ids are fixed ("food-drinks", "food-drinks.breakfast"), so two
// devices setting up at once create the same records instead of duplicates, and a later version can add
// what's missing by id (see missingDefaults). Bump DEFAULTS_VERSION whenever this list grows.
export const DEFAULTS_VERSION = 1

interface Def {
  key: string
  name: string
  icon: string
  color: ColorSlot
  /** [group, names] pairs; a group of '' has no heading */
  subs: [string, string[]][]
}

const EXPENSES: Def[] = [
  {
    key: 'food-drinks', name: 'Food & Drinks', icon: '🍜', color: 'c2',
    subs: [
      ['Food', ['Breakfast', 'Lunch', 'Dinner', 'Other Food']],
      ['Drinks', ['Coffee', 'Tea', 'Beer', 'Soft Drinks', 'Juice', 'Other Drinks']],
      ['', ['Water', 'Snacks']]
    ]
  },
  {
    key: 'transport', name: 'Transportation', icon: '🛵', color: 'c1',
    subs: [
      ['', ['Car Wash', 'Motorcycle Wash']],
      ['Gasoline', ['Motorcycle Gasoline', 'Car Gasoline']],
      ['', ['Parking', 'Vehicle Accessories', 'Vehicle Repairs & Maintenance', 'Public Transportation', 'Ride-hailing', 'Other Transportation']]
    ]
  },
  {
    key: 'tech', name: 'Mobile & Technology', icon: '📱', color: 'c7',
    subs: [['', ['Phone Top-up', 'Mobile Plan', 'Subscriptions', 'Wi-Fi / Internet', 'Laptop & Computer', 'Device Repairs', 'Accessories', 'Software & Apps', 'Other Technology']]]
  },
  {
    key: 'housing', name: 'Housing & Utilities', icon: '🏠', color: 'c3',
    subs: [['', ['Rent', 'Electricity', 'Water Bill', 'Home Internet', 'Waste Collection', 'Household Supplies', 'Household Accessories', 'Home Repairs & Maintenance', 'Other Housing Expenses']]]
  },
  {
    key: 'personal', name: 'Personal Care', icon: '🧴', color: 'c5',
    subs: [['', ['Medicine & Healthcare', 'Clothes', 'Body Wash & Toiletries', 'Haircut', 'Skincare', 'Grooming', 'Personal Accessories', 'Other Personal Expenses']]]
  },
  {
    key: 'fitness', name: 'Sports & Fitness', icon: '🏋️', color: 'c6',
    subs: [['', ['Gym Membership', 'Sportswear', 'Protein Powder', 'Supplements', 'Sports Equipment', 'Fitness Activities', 'Other Fitness Expenses']]]
  },
  {
    key: 'gifts', name: 'Gifts', icon: '🎁', color: 'c8',
    subs: [['', ['Birthday Gifts', 'Family Gifts', 'Friends’ Gifts', 'Special Occasions', 'Donations', 'Other Gifts']]]
  },
  {
    key: 'fun', name: 'Entertainment & Leisure', icon: '🎬', color: 'c4',
    subs: [['', ['Movies & Events', 'Gaming', 'Streaming Services', 'Music Services', 'Outings & Activities', 'Travel & Leisure', 'Hobbies', 'Other Entertainment']]]
  },
  {
    key: 'misc', name: 'Miscellaneous', icon: '🧾', color: 'gray',
    subs: [['', ['Unexpected Expenses', 'Other Expenses']]]
  }
]

const INCOME: { key: string, name: string, icon: string }[] = [
  { key: 'salary', name: 'Salary', icon: '💼' },
  { key: 'freelance', name: 'Freelance Income', icon: '🧑‍💻' },
  { key: 'business', name: 'Business Income', icon: '🏪' },
  { key: 'investment', name: 'Investment Income', icon: '📈' },
  { key: 'gifts-received', name: 'Gifts Received', icon: '🎀' },
  { key: 'other-income', name: 'Other Income', icon: '➕' }
]

const slug = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Every built-in category and subcategory, with fixed ids and a fixed creation time */
export function defaultCategories(now = new Date().toISOString()): BudgetCategory[] {
  const out: BudgetCategory[] = []
  const stamp = { createdAt: now, updatedAt: now, builtin: true }
  EXPENSES.forEach((d, i) => {
    out.push({ id: `exp.${d.key}`, kind: 'expense', name: d.name, parentId: null, icon: d.icon, color: d.color, order: i, ...stamp })
    let n = 0
    for (const [group, names] of d.subs) {
      for (const name of names) {
        out.push({ id: `exp.${d.key}.${slug(name)}`, kind: 'expense', name, parentId: `exp.${d.key}`, group: group || undefined, icon: d.icon, color: d.color, order: n++, ...stamp })
      }
    }
  })
  INCOME.forEach((d, i) => out.push({ id: `inc.${d.key}`, kind: 'income', name: d.name, parentId: null, icon: d.icon, color: 'c1', order: i, ...stamp }))
  return out
}

/** Built-ins this account doesn't have yet, by id. Archived or renamed ones count as present. */
export const missingDefaults = (existing: { id: string }[]) => {
  const have = new Set(existing.map(c => c.id))
  return defaultCategories().filter(c => !have.has(c.id))
}

export const DEFAULT_METHODS: PaymentMethod[] = [
  { id: 'cash', name: 'Cash' },
  { id: 'bank', name: 'Bank account' },
  { id: 'card', name: 'Debit/Credit card' },
  { id: 'qr', name: 'QR payment' },
  { id: 'other', name: 'Other' }
]

export const WIDGETS: { value: Widget, label: string }[] = [
  { value: 'totals', label: 'Totals' },
  { value: 'alerts', label: 'Budget alerts' },
  { value: 'trend', label: 'Daily spending' },
  { value: 'categories', label: 'Top categories' },
  { value: 'bills', label: 'Upcoming bills' },
  { value: 'recent', label: 'Recent transactions' }
]

export const SETTINGS_ID = 'settings'

export const defaultSettings = (now = new Date().toISOString()): BudgetSettings => ({
  id: SETTINGS_ID,
  createdAt: now,
  updatedAt: now,
  primaryCurrency: 'USD',
  rateMode: 'live',
  fixedRate: 4100,
  fixedRateDate: now.slice(0, 10),
  weekStart: 1,
  methods: DEFAULT_METHODS,
  alerts: [80],
  overAlert: 0,
  widgets: { totals: true, alerts: true, trend: true, categories: true, bills: true, recent: true },
  defaultsVersion: DEFAULTS_VERSION
})

export const COLOR_SLOTS: { value: ColorSlot, label: string }[] = [
  { value: 'c1', label: 'Blue' },
  { value: 'c2', label: 'Orange' },
  { value: 'c3', label: 'Aqua' },
  { value: 'c4', label: 'Yellow' },
  { value: 'c5', label: 'Pink' },
  { value: 'c6', label: 'Green' },
  { value: 'c7', label: 'Violet' },
  { value: 'c8', label: 'Red' },
  { value: 'gray', label: 'Grey' }
]

export const ICONS = ['🍜', '☕', '🛵', '🚗', '⛽', '📱', '💻', '🏠', '💡', '🧴', '💊', '👕', '🏋️', '🎁', '🎬', '🎮', '✈️', '🐶', '👶', '📚', '🎓', '⛪', '💇', '🧾', '💼', '🧑‍💻', '🏪', '📈', '🎀', '➕', '🛒', '🍺', '🏥', '🔧', '🌱', '💰']
