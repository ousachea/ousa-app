// The favicon is one face of a Rubik's cube; each page load gets a fresh random scramble.
const STICKERS = ['#1f5bd8', '#d7263d', '#f7c324', '#179a54', '#ffffff', '#ef7d16']

/** Nine sticker colours for one scrambled face; a real one rarely repeats one colour everywhere */
export function randomCubeFace() {
  let colors: string[]
  do colors = Array.from({ length: 9 }, () => STICKERS[Math.floor(Math.random() * STICKERS.length)]!)
  while (new Set(colors).size < 3)
  return colors
}

// The face this page load shows, shared by the favicon and the logo (AppLogo) so they match
let face: string[] | undefined
export const pageCubeFace = () => (face ??= randomCubeFace())

export function randomCubeFavicon() {
  const colors = pageCubeFace()

  const cells = colors
    .map((c, i) => `<rect x="${3 + (i % 3) * 9}" y="${3 + Math.floor(i / 3) * 9}" width="8" height="8" rx="2" fill="${c}"/>`)
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1b1f2a"/>${cells}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
