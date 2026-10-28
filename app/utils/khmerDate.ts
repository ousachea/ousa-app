// Dates in Khmer. Written out by hand: not every browser ships Khmer locale data for Intl.
const KM_DAYS = ['អាទិត្យ', 'ច័ន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍']
const KM_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ']

/** Numbers in Khmer digits (២០២៦) */
export const kmDigits = (n: number) => String(n).replace(/\d/g, d => '០១២៣៤៥៦៧៨៩'[+d]!)

/** ថ្ងៃពុធ ទី២៨ ខែតុលា ឆ្នាំ២០២៦, from a weekday (0 = Sunday), day, month (0 = January) and year */
export const khmerDate = (weekday: number, day: number, month: number, year: number) =>
  `ថ្ងៃ${KM_DAYS[weekday]} ទី${kmDigits(day)} ខែ${KM_MONTHS[month]} ឆ្នាំ${kmDigits(year)}`
