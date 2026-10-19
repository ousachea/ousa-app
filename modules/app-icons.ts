import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { addTemplate, addTypeTemplate, defineNuxtModule, updateTemplates } from 'nuxt/kit'
import lucide from '@iconify-json/lucide/icons.json' with { type: 'json' }

// The line icons the apps draw with <AppIcon name="…" /> (Lucide, from @iconify-json/lucide). Only the
// icons the code names go into the browser bundle, not all 1,600: this reads every <AppIcon> in app/
// and writes their drawings to #build/app-icons.mjs, again whenever a file changes in development.
// A name worked out at runtime has to appear as a quoted literal in the :name binding, e.g.
// :name="open ? 'eye' : 'eye-off'", or anywhere in the code with its set, e.g. { edit: 'lucide:pencil' }.
//
// It also writes #build/app-icons-usage.mjs for Settings → Logos & icons: every icon and brand logo the
// code names, the file and line it's on, and the pages that end up showing it (followed through the
// components and auto-imported utils in between).
const icons = lucide.icons as Record<string, { body: string }>
const aliases = (lucide.aliases ?? {}) as Record<string, { parent: string }>
// Lucide's stroke style moves to CSS (.app-icon in AppIcon.vue), so a page can still restyle an icon
// with e.g. `.close svg { stroke-width: 1.5 }`; attributes on the drawing would win over that.
const STYLE = ' fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"'
function body(name: string) {
  const raw = icons[name]?.body ?? icons[aliases[name]?.parent ?? '']?.body
  return raw?.replaceAll(STYLE, '').replace(/^<g>(.*)<\/g>$/, '$1')
}

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return files(path)
    return /\.(vue|ts)$/.test(e.name) ? [path] : []
  })
}

/** Where something is named: the file (from app/) and line */
type Spot = [file: string, line: number]
interface Brand { name: string, domain: string, brand?: string, logo?: string, at: Spot }
interface Usage {
  icons: Record<string, Spot[]>
  /** Simple Icons slugs, from <BrandLogo>, brandLogoUrl() and `brand:` in the service and company lists */
  logos: Record<string, Spot[]>
  /** Every service and company the lists know, with where its logo comes from */
  brands: Brand[]
  /** Logos written straight into a page: Google's four-colour G, and the Battery app's phone brand marks */
  drawn: { google: Spot[], phoneBrands: Spot[] }
  /** Pages each spot ends up on ('file:line' → ['/notes']), '*' for the parts every page has */
  pages: Record<string, string[]>
}

// The reference pages in Settings name everything as examples, and the components' own comments show
// one; neither is using them
const REFERENCE = /(IconGallery|GaugeGallery|AppIcon|BrandLogo)\.vue$/
const pascal = (s: string) => s.replace(/(^|[-_])(\w)/g, (_, __, c: string) => c.toUpperCase())

// The tag a component is written with: Nuxt's name for it (components/password/Saved.vue → PasswordSaved,
// components/folder/FolderIcon.vue → FolderIcon) or just its file name (notes/NoteEditor.vue → NoteEditor)
function componentTag(path: string) {
  const parts = path.replace(/^components\//, '').replace(/\.vue$/, '').split('/').map(pascal)
  const file = parts.pop()!
  const prefix = parts.join('')
  const names = new Set([file.startsWith(prefix) ? file : prefix + file, file])
  return new RegExp(`<(?:Lazy)?(?:${[...names].join('|')})[\\s/>]`)
}

function scan(srcDir: string) {
  const sources = files(srcDir).map(abs => ({ path: relative(srcDir, abs), code: readFileSync(abs, 'utf8') }))
  const lineAt = (code: string, i: number) => code.slice(0, i).split('\n').length
  const bundle = new Set<string>()
  const usage: Usage = { icons: {}, logos: {}, brands: [], drawn: { google: [], phoneBrands: [] }, pages: {} }
  const add = (map: Record<string, Spot[]>, name: string, spot: Spot) => {
    if (!REFERENCE.test(spot[0])) (map[name] ??= []).push(spot)
  }
  // A quoted word in a :name binding may be a value it compares, not an icon ('food' in
  // s.kind === 'food' ? 'soup' : 'map-pin'), so a name counts only when Lucide has it
  const missing = new Set<string>()
  const icon = (name: string, spot: Spot, fixed = false) => {
    if (!body(name)) {
      if (fixed) missing.add(name)
      return
    }
    bundle.add(name)
    add(usage.icons, name, spot)
  }

  for (const { path, code } of sources) {
    for (const m of code.matchAll(/<AppIcon\b[^>]*>/g)) {
      const spot: Spot = [path, lineAt(code, m.index)]
      const fixed = m[0].match(/(?:^|\s)name="([a-z0-9-]+)"/)?.[1]
      if (fixed) icon(fixed, spot, true)
      const bound = m[0].match(/:name="([^"]*)"/)?.[1]
      for (const [, n] of bound?.matchAll(/'([a-z0-9-]+)'/g) ?? []) icon(n!, spot)
    }
    for (const m of code.matchAll(/['"`]lucide:([a-z0-9-]+)['"`]/g)) icon(m[1]!, [path, lineAt(code, m.index)])
    for (const m of code.matchAll(/<BrandLogo\b[^>]*\sname="([a-z0-9-]+)"|brandLogoUrl\('([a-z0-9-]+)'\)/g)) {
      add(usage.logos, (m[1] ?? m[2])!, [path, lineAt(code, m.index)])
    }
    for (const m of code.matchAll(/\{ name: '([^']+)'[^{}]*?domain: '([^']+)'[^{}]*\}/g)) {
      const at: Spot = [path, lineAt(code, m.index)]
      const brand = m[0].match(/brand: '([a-z0-9-]+)'/)?.[1]
      const logo = m[0].match(/logo: '([^']+)'/)?.[1]
      usage.brands.push({ name: m[1]!, domain: m[2]!, brand, logo, at })
      if (brand) add(usage.logos, brand, at)
    }
    for (const m of code.matchAll(/<path fill="#4285F4"/g)) usage.drawn.google.push([path, lineAt(code, m.index)])
    for (const m of code.matchAll(/^const BRAND_LOGOS\b/gm)) usage.drawn.phoneBrands.push([path, lineAt(code, m.index)])
  }

  // ---------- Which pages each spot ends up on ----------
  // A node is a file, or for a .ts module one export in it, so a page using one helper from
  // utils/services.ts isn't counted as showing every logo in that file. Edges go to the files using it.
  const words = new Map(sources.map(s => [s.path, new Set(s.code.match(/[A-Za-z_$][\w$]*/g))]))
  // Each export of a .ts module with the words in its body, for the other exports in the file that use it
  const exportsOf = new Map<string, { name: string, line: number, words: Set<string> }[]>()
  for (const { path, code } of sources) {
    if (!path.endsWith('.ts')) continue
    const found = [...code.matchAll(/^export (?:async )?(?:const|let|function|class) ([A-Za-z_$][\w$]*)/gm)]
    exportsOf.set(path, found.map((m, i) => ({
      name: m[1]!,
      line: lineAt(code, m.index),
      words: new Set(code.slice(m.index + m[0].length, found[i + 1]?.index).match(/[A-Za-z_$][\w$]*/g))
    })))
  }
  const declares = (code: string, name: string) => new RegExp(`\\b(?:const|let|var|function|class)\\s+${name.replace('$', '\\$')}\\b`).test(code)
  const users = (node: string): string[] => {
    const [file, name] = node.split('#') as [string, string?]
    if (name) {
      // Files that use the name without declaring one of their own, and the other exports here that use it
      const elsewhere = sources.filter(s => s.path !== file && words.get(s.path)!.has(name) && !declares(s.code, name)).map(s => s.path)
      const here = (exportsOf.get(file) ?? []).filter(e => e.name !== name && e.words.has(name)).map(e => `${file}#${e.name}`)
      return [...elsewhere, ...here]
    }
    if (file.startsWith('components/')) {
      const tag = componentTag(file)
      return sources.filter(s => s.path !== file && tag.test(s.code)).map(s => s.path)
    }
    if (file.endsWith('.ts')) return (exportsOf.get(file) ?? []).flatMap(e => users(`${file}#${e.name}`))
    return []
  }
  const memo = new Map<string, Set<string>>()
  function reach(node: string, seen: Set<string>): Set<string> {
    const known = memo.get(node)
    if (known) return known
    const out = new Set<string>()
    const file = node.split('#')[0]!
    if (REFERENCE.test(file) || seen.has(node)) return out
    seen.add(node)
    if (file === 'app.vue' || file.startsWith('plugins/') || file.startsWith('layouts/')) out.add('*')
    else if (file.startsWith('pages/')) out.add('/' + file.slice('pages/'.length).replace(/(^|\/)index\.vue$/, '').replace(/\.vue$/, ''))
    else for (const u of users(node)) for (const p of reach(u, seen)) out.add(p)
    seen.delete(node)
    memo.set(node, out)
    return out
  }
  // A spot in a .ts file belongs to the export it sits under
  const nodeFor = ([file, line]: Spot) => {
    const exp = exportsOf.get(file)?.filter(e => e.line <= line).at(-1)
    return exp ? `${file}#${exp.name}` : file
  }
  const all = [...Object.values(usage.icons), ...Object.values(usage.logos), usage.drawn.google, usage.drawn.phoneBrands].flat()
  for (const spot of all.concat(usage.brands.map(b => b.at))) {
    usage.pages[`${spot[0]}:${spot[1]}`] ??= [...reach(nodeFor(spot), new Set())].sort()
  }
  return { bundle: [...bundle].sort(), missing: [...missing], usage }
}

export default defineNuxtModule({
  meta: { name: 'app-icons' },
  setup(_, nuxt) {
    const srcDir = nuxt.options.srcDir
    let found = scan(srcDir)

    addTemplate({
      filename: 'app-icons.mjs',
      getContents: () => {
        if (found.missing.length) console.warn(`[app-icons] Not in Lucide: ${found.missing.join(', ')}`)
        const entries = found.bundle.map(n => `  ${JSON.stringify(n)}: ${JSON.stringify(body(n))}`)
        return `export default {\n${entries.join(',\n')}\n}\n`
      }
    })
    addTemplate({
      filename: 'app-icons-usage.mjs',
      getContents: () => `export default ${JSON.stringify(found.usage)}\n`
    })
    addTypeTemplate({
      filename: 'types/app-icons.d.ts',
      getContents: () => `declare module '#build/app-icons.mjs' {
  const icons: Record<string, string>
  export default icons
}
declare module '#build/app-icons-usage.mjs' {
  type Spot = [file: string, line: number]
  const usage: {
    icons: Record<string, Spot[]>
    logos: Record<string, Spot[]>
    brands: { name: string, domain: string, brand?: string, logo?: string, at: Spot }[]
    drawn: { google: Spot[], phoneBrands: Spot[] }
    pages: Record<string, string[]>
  }
  export default usage
}
export {}
`
    })

    nuxt.hook('builder:watch', async (_event, path) => {
      if (!/\.(vue|ts)$/.test(path)) return
      const before = found
      found = scan(srcDir)
      const iconsChanged = found.bundle.join() !== before.bundle.join()
      if (!iconsChanged && JSON.stringify(found.usage) === JSON.stringify(before.usage)) return
      await updateTemplates({ filter: t => t.filename === 'app-icons-usage.mjs' || (iconsChanged && t.filename === 'app-icons.mjs') })
    })
  }
})
