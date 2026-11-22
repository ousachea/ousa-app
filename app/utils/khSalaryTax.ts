// Cambodia's Tax on Salary and NSSF, for one month, in whole riel. Employers work it out, withhold it and pay
// it to the GDT every month, so there's no yearly return for salary. Pay in dollars is converted at the
// National Bank of Cambodia's rate for the 15th of the month. Used by the Salary app (pages/salary.vue);
// checked by scripts/khSalaryTax.test.mjs against the GDT-style worked example.

/** Monthly bands for residents: the rate on the whole taxable amount, less the quick deduction */
export const KH_TOS_BRACKETS = [
  { upTo: 1_500_000, rate: 0, quick: 0 },
  { upTo: 2_000_000, rate: 5, quick: 75_000 },
  { upTo: 8_500_000, rate: 10, quick: 175_000 },
  { upTo: 12_500_000, rate: 15, quick: 600_000 },
  { upTo: null, rate: 20, quick: 1_225_000 }
] as const

/** Per qualifying dependent, per month (residents only): a spouse at home, children under 14, or under 25 in full-time study */
export const KH_DEPENDENT_RELIEF = 150_000

/** Non-residents (182 days or fewer in Cambodia in 12 months): a flat, final rate on Cambodian salary, no threshold or relief */
export const KH_NON_RESIDENT_RATE = 20

/** Non-cash benefits (housing, a car for personal use, school fees…): taxed at a flat rate of their market value */
export const KH_FRINGE_RATE = 20

/** NSSF: contributions are worked out on the wage clamped to this band */
export const KH_NSSF_FLOOR = 600_000
export const KH_NSSF_CEILING = 1_500_000
/** Employee: 2% pension. Employer: 2% pension + 2.6% healthcare + 0.8% occupational risk */
export const KH_NSSF_EMPLOYEE_RATE = 2
export const KH_NSSF_EMPLOYER_RATE = 5.4

export function khBracket(taxableKhr: number) {
  return KH_TOS_BRACKETS.find(b => b.upTo === null || taxableKhr <= b.upTo)!
}

/** Monthly Tax on Salary for a resident: taxable × rate − quick deduction (the same as taxing each band in turn) */
export function khResidentTax(taxableKhr: number) {
  const t = Math.max(0, taxableKhr)
  const b = khBracket(t)
  return Math.max(0, Math.round((t * b.rate) / 100 - b.quick))
}

/** Monthly NSSF on a gross wage, for the employee and the employer. No pay, no contribution: the floor
 *  only lifts a small wage up to it */
export function khNssf(grossKhr: number) {
  if (!(grossKhr > 0)) return { wage: 0, employee: 0, employer: 0 }
  const wage = Math.min(KH_NSSF_CEILING, Math.max(KH_NSSF_FLOOR, grossKhr))
  return {
    wage,
    employee: Math.round((wage * KH_NSSF_EMPLOYEE_RATE) / 100),
    employer: Math.round((wage * KH_NSSF_EMPLOYER_RATE) / 100)
  }
}
