// node scripts/khSalaryTax.test.mjs: self-check for app/utils/khSalaryTax.ts
import assert from 'node:assert/strict'
import { KH_DEPENDENT_RELIEF, KH_TOS_BRACKETS, khBracket, khNssf, khResidentTax } from '../app/utils/khSalaryTax.ts'

// The worked example: a resident on 6,000,000 ៛ with a spouse at home and 2 children
const taxable = 6_000_000 - 3 * KH_DEPENDENT_RELIEF
assert.equal(taxable, 5_550_000)
assert.equal(khResidentTax(taxable), 380_000)
assert.equal(khNssf(6_000_000).employee, 30_000)
assert.equal(6_000_000 - khResidentTax(taxable) - khNssf(6_000_000).employee, 5_590_000)

// The quick-deduction formula gives the same tax as taxing each band in turn, at every band edge and between
function byBands(t) {
  let tax = 0
  let floor = 0
  for (const b of KH_TOS_BRACKETS) {
    const ceil = b.upTo ?? Infinity
    if (t > floor) tax += ((Math.min(t, ceil) - floor) * b.rate) / 100
    floor = ceil
  }
  return tax
}
for (const t of [0, 1_000_000, 1_500_000, 1_500_001, 2_000_000, 5_000_000, 8_500_000, 10_000_000, 12_500_000, 20_000_000]) {
  assert.ok(Math.abs(khResidentTax(t) - byBands(t)) <= 0.5, `quick deduction disagrees at ${t}`)
}
assert.equal(khBracket(1_500_000).rate, 0)
assert.equal(khBracket(1_500_001).rate, 5)
assert.equal(khResidentTax(-5), 0)

// NSSF: nothing on no pay, then the floor, the ceiling and the employer cap
assert.deepEqual(khNssf(0), { wage: 0, employee: 0, employer: 0 })
assert.equal(khNssf(300_000).employee, 12_000)
assert.equal(khNssf(1_000_000).employee, 20_000)
assert.equal(khNssf(50_000_000).employee, 30_000)
assert.equal(khNssf(50_000_000).employer, 81_000)
console.log('khSalaryTax: ok')
