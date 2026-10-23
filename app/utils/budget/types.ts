// Budget planner records. Each list is its own synced collection (see composables/useBudget.ts), all
// named budget-*. Amounts keep the currency they were entered in; totals convert explicitly.
import type { Currency } from '~/utils/exchange'

export type { Currency }

/** When a record was created and last changed on a device (ISO time). The server keeps its own clock too. */
export interface Stamped {
  id: string
  createdAt: string
  updatedAt: string
}

export type Kind = 'expense' | 'income'

/** A colour slot, not a hex: each slot has a light and a dark shade (BudgetApp's --budget-* tokens) */
export type ColorSlot = 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'c7' | 'c8' | 'gray'

/**
 * Categories and subcategories share one list. A subcategory has a parentId; `group` gathers
 * subcategories under a heading in the picker (Food › Breakfast, Drinks › Coffee).
 */
export interface BudgetCategory extends Stamped {
  kind: Kind
  name: string
  parentId: string | null
  group?: string
  icon: string
  color: ColorSlot
  order: number
  archived?: boolean
  favorite?: boolean
  /** Came with the app; its id is fixed so every device creates the same one */
  builtin?: boolean
}

export interface BudgetTransaction extends Stamped {
  kind: Kind
  amount: number
  currency: Currency
  /** An expense category, or an income source */
  categoryId: string
  /** Empty for income */
  subcategoryId: string
  date: string // yyyy-mm-dd, the device's own calendar day
  note: string
  /** A payment method id (expenses) or where the money went in (income) */
  method: string
  merchant: string
  tags: string[]
  /** Paid from a recurring bill: which one, and for which due date */
  recurringId?: string
  occurrence?: string
}

export type BudgetPeriod = 'month' | 'week' | 'day'
export type BudgetScope = 'overall' | 'category' | 'subcategory'

export interface BudgetLimit extends Stamped {
  scope: BudgetScope
  /** Category or subcategory id; empty for the overall budget */
  targetId: string
  period: BudgetPeriod
  amount: number
  currency: Currency
}

export type Cycle = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'

export interface BudgetRecurring extends Stamped {
  name: string
  amount: number
  currency: Currency
  categoryId: string
  subcategoryId: string
  method: string
  cycle: Cycle
  /** For custom: every this many days */
  every: number
  /** The first due date; later ones follow from it */
  startDate: string
  active: boolean
  /** Due dates skipped on purpose, so they aren't overdue */
  skipped: string[]
  note: string
}

export interface BudgetGoal extends Stamped {
  name: string
  target: number
  currency: Currency
  targetDate: string
  note: string
  archived?: boolean
}

/** Money moved into or out of a savings goal. Not an expense or income: a transfer between your own money. */
export interface BudgetContribution extends Stamped {
  goalId: string
  type: 'deposit' | 'withdrawal'
  amount: number
  currency: Currency
  date: string
  note: string
}

export interface PaymentMethod {
  id: string
  name: string
  archived?: boolean
}

export type Widget = 'totals' | 'gauges' | 'alerts' | 'trend' | 'categories' | 'bills' | 'recent'

export interface BudgetSettings extends Stamped {
  primaryCurrency: Currency
  /** live: today's market rate; fixed: the user's own rate, with the date they set it */
  rateMode: 'live' | 'fixed'
  fixedRate: number
  fixedRateDate: string
  /** 1 = Monday, 0 = Sunday */
  weekStart: 0 | 1
  methods: PaymentMethod[]
  /** Percent of a budget at which to warn; 100 always means "reached" */
  alerts: number[]
  /** Also warn when a budget goes past 100% by this much (0 = off) */
  overAlert: number
  widgets: Record<Widget, boolean>
  /** Which version of the built-in categories this account has been given (see defaults.ts) */
  defaultsVersion: number
}

export type Draft<T extends Stamped> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>

export type BudgetTab = 'dashboard' | 'transactions' | 'budgets' | 'categories' | 'recurring' | 'income' | 'savings' | 'reports' | 'settings'
