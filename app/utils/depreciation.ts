import { typeOf } from './devices'

// Rough "what is it worth now" when the owner hasn't entered a value: the price falls by a typical
// yearly rate for its type (utils/devices.ts), compounding. A guide only; resale prices vary a lot.

// Never estimate below 10% of the price: most things keep some resale or parts value
const FLOOR = 0.1

export function yearsOwned(purchaseDate: string, now = new Date()) {
  return Math.max((now.getTime() - new Date(`${purchaseDate}T00:00`).getTime()) / (365.25 * 86_400_000), 0)
}

export function estimateValue(price: number, category: string, purchaseDate: string, now = new Date()) {
  const loss = typeOf(category).yearlyLoss
  return Math.max(price * (1 - loss) ** yearsOwned(purchaseDate, now), price * FLOOR)
}
