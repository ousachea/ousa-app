// Rough "what is it worth now" when the owner hasn't entered a value: the price falls by a typical
// yearly rate for its category, compounding. A guide only; resale prices vary a lot.
export const YEARLY_LOSS: Record<string, number> = {
  Phone: 0.3,
  Computer: 0.22,
  Tablet: 0.25,
  Camera: 0.15,
  Gaming: 0.2,
  Audio: 0.2,
  Watch: 0.18,
  Home: 0.1,
  Vehicle: 0.12,
  Other: 0.15
}

// Never estimate below 10% of the price: most things keep some resale or parts value
const FLOOR = 0.1

export function yearsOwned(purchaseDate: string, now = new Date()) {
  return Math.max((now.getTime() - new Date(`${purchaseDate}T00:00`).getTime()) / (365.25 * 86_400_000), 0)
}

export function estimateValue(price: number, category: string, purchaseDate: string, now = new Date()) {
  const loss = YEARLY_LOSS[category] ?? YEARLY_LOSS.Other!
  return Math.max(price * (1 - loss) ** yearsOwned(purchaseDate, now), price * FLOOR)
}
