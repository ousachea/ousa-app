// Brand logos (Simple Icons, from the simple-icons package: about 3,500 brands, one colour each, CC0).
// Kept on the server like the line icons, so nothing is fetched from elsewhere. The package is 5 MB, so
// it's only loaded the first time a logo is asked for. Used by /api/icon and /api/logos.

export interface BrandLogo { slug: string, title: string, hex: string, path: string }

let loaded: Promise<{ list: BrandLogo[], bySlug: Map<string, BrandLogo> }> | undefined
function library() {
  loaded ??= import('simple-icons').then((pkg) => {
    const list = Object.values(pkg as unknown as Record<string, BrandLogo>)
      .filter(i => i?.slug)
      .sort((a, b) => a.title.localeCompare(b.title))
    return { list, bySlug: new Map(list.map(i => [i.slug, i])) }
  })
  return loaded
}

export const brandLogo = async (slug: string) => (await library()).bySlug.get(slug)

// A brand colour that would vanish on a white tile (Sony's is white) is drawn in near-black instead
export function inkFor(hex: string) {
  const [r, g, b] = [0, 2, 4].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.85 ? '#1b1f2a' : `#${hex}`
}

/** A logo as SVG, in its brand colour unless `color` is given */
export async function brandSvg(slug: string, color?: string) {
  const logo = await brandLogo(slug)
  if (!logo) return undefined
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="${color ?? inkFor(logo.hex)}" d="${logo.path}"/></svg>`
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Brands whose name contains what's searched, names that start with it first */
export async function searchBrands(query: string, limit = 96) {
  const q = norm(query)
  const { list } = await library()
  const found = q ? list.filter(i => norm(i.title).includes(q) || i.slug.includes(q)) : list
  const rank = (i: BrandLogo) => (norm(i.title) === q ? 0 : norm(i.title).startsWith(q) ? 1 : 2) * 1000 + i.title.length
  return (q ? found.sort((a, b) => rank(a) - rank(b)) : found)
    .slice(0, limit)
    .map(({ slug, title, hex }) => ({ slug, title, color: inkFor(hex) }))
}

export const brandCount = async () => (await library()).list.length
