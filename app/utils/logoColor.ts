/**
 * The colour around a logo's edge, to fill the space around it so the logo looks like it runs to the tile's
 * edge (a teal Logitech icon gets a teal frame, a white-backed one a white frame). The image must come from
 * this site (/api/logo, /logos) so the browser lets a canvas read it.
 *
 * Shrinks the logo to 24×24, takes the ring of pixels around the edge and returns the most common colour,
 * so a few anti-aliased or accent pixels don't muddy it. Mostly transparent edges give `fallback`.
 */
export function logoEdgeColor(img: HTMLImageElement, fallback = '#ffffff') {
  const n = 24
  const canvas = document.createElement('canvas')
  canvas.width = n
  canvas.height = n
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx || !img.naturalWidth) return fallback
  try {
    ctx.drawImage(img, 0, 0, n, n)
    const { data } = ctx.getImageData(0, 0, n, n)
    const counts = new Map<string, { count: number, r: number, g: number, b: number }>()
    let edge = 0
    let clear = 0
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (x !== 0 && y !== 0 && x !== n - 1 && y !== n - 1) continue
        edge++
        const i = (y * n + x) * 4
        if (data[i + 3]! < 200) {
          clear++
          continue
        }
        // Grouped by rounding each channel to 16 levels, then averaged within the winning group
        const r = data[i]!
        const g = data[i + 1]!
        const b = data[i + 2]!
        const key = `${r >> 4},${g >> 4},${b >> 4}`
        const c = counts.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
        c.count++
        c.r += r
        c.g += g
        c.b += b
        counts.set(key, c)
      }
    }
    let best: { count: number, r: number, g: number, b: number } | undefined
    for (const c of counts.values()) if (!best || c.count > best.count) best = c
    // Transparent around the edge (or no clear winner there): the tile's own white shows
    if (!best || clear > best.count) return fallback
    const avg = (v: number) => Math.round(v / best!.count)
    return `rgb(${avg(best.r)} ${avg(best.g)} ${avg(best.b)})`
  } catch {
    // A canvas the browser won't let us read (an image from another site)
    return fallback
  }
}
