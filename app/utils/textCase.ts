export type CaseMode = 'lower' | 'upper' | 'title' | 'sentence'

export const CASE_MODES: { value: CaseMode, label: string }[] = [
  { value: 'lower', label: 'lowercase' },
  { value: 'upper', label: 'UPPERCASE' },
  { value: 'title', label: 'Title Case' },
  { value: 'sentence', label: 'Sentence case' }
]

// Capitalise the first letter of every word. Letters after an apostrophe stay lowercase ("don't", not "Don'T").
function toTitleCase(text: string) {
  return text.toLowerCase().replace(/(^|[\s\-–—"“(\[{/])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase())
}

// Capitalise the start of the text, each line, and anything after . ! or ?
// Also fixes the pronoun "I" ("i'm" -> "I'm"), which sentence case would otherwise leave lowercase.
function toSentenceCase(text: string) {
  return text
    .toLowerCase()
    .replace(/(^|[.!?]\s+|\n\s*)(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase())
    .replace(/(^|[^\p{L}'’])i(?=$|[^\p{L}])/gu, (_, before: string) => `${before}I`)
}

export function convertCase(text: string, mode: CaseMode) {
  switch (mode) {
    case 'lower': return text.toLowerCase()
    case 'upper': return text.toUpperCase()
    case 'title': return toTitleCase(text)
    case 'sentence': return toSentenceCase(text)
  }
}

export function textStats(text: string) {
  return {
    characters: [...text].length, // counts emoji and accented letters as one character
    words: text.match(/\S+/g)?.length ?? 0,
    paragraphs: text.split(/\n+/).filter(block => block.trim()).length
  }
}
