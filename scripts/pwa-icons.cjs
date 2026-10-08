// Renders the app icons for installing Ousa's Apps (PWA) from the cube in public/favicon.svg:
//   public/icons/icon-192.png, icon-512.png       rounded cube, transparent corners ("any")
//   public/icons/maskable-512.png                 full-bleed, cube inside the safe zone ("maskable")
//   public/icons/apple-touch-icon.png (180)       full-bleed; iOS rounds the corners itself
//
// Usage: npx -y -p playwright sh -c 'NODE_PATH=$(dirname $(which playwright))/../ node scripts/pwa-icons.cjs'
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const PUBLIC = path.join(__dirname, '..', 'public')
const OUT = path.join(PUBLIC, 'icons')
const cube = fs.readFileSync(path.join(PUBLIC, 'favicon.svg'), 'utf8')
const PLASTIC = '#1b1f2a'

// The nine stickers without the outer rounded square, for full-bleed icons
const stickers = cube.replace(/<rect width="32" height="32"[^>]*\/>/, '').replace(/<\/?svg[^>]*>/g, '')
const fullBleed = (inset) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${PLASTIC}"/><g transform="translate(${inset} ${inset}) scale(${(32 - inset * 2) / 32})">${stickers}</g></svg>`

const ICONS = [
  { file: 'icon-192.png', size: 192, svg: cube },
  { file: 'icon-512.png', size: 512, svg: cube },
  // Maskable icons can be cropped to a circle: keep the cube inside the middle 80%
  { file: 'maskable-512.png', size: 512, svg: fullBleed(5) },
  { file: 'apple-touch-icon.png', size: 180, svg: fullBleed(3) }
]

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {})
  const page = await browser.newPage()
  for (const icon of ICONS) {
    await page.setViewportSize({ width: icon.size, height: icon.size })
    await page.setContent(`<html><body style="margin:0;background:transparent">${icon.svg.replace('<svg ', `<svg width="${icon.size}" height="${icon.size}" `)}</body></html>`)
    await page.screenshot({ path: path.join(OUT, icon.file), omitBackground: true })
    console.log(`wrote public/icons/${icon.file}`)
  }
  await browser.close()
})()
