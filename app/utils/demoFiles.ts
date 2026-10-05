// Demo files for the compressor, drawn in the browser on demand: nothing to download or store.
// A grainy photo (JPEG), an app screenshot (PNG) and a two-page brochure (PDF with text and a photo).

// Seeded random so every visitor gets exactly the same demo files (and the same savings)
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Encoding failed'))), type, quality))
}

/** A sunset over temple towers, with film grain so it compresses like a real photo */
function drawPhoto(w = 2400, h = 1600) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const c = canvas.getContext('2d')!
  const horizon = h * 0.62

  const sky = c.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, '#2b1e5c')
  sky.addColorStop(0.45, '#b4416b')
  sky.addColorStop(0.8, '#f08a3c')
  sky.addColorStop(1, '#ffd27a')
  c.fillStyle = sky
  c.fillRect(0, 0, w, horizon)

  // Sun with a soft glow
  const sun = c.createRadialGradient(w * 0.62, horizon - 40, 10, w * 0.62, horizon - 40, 420)
  sun.addColorStop(0, 'rgb(255 244 200 / 1)')
  sun.addColorStop(0.18, 'rgb(255 214 120 / 0.9)')
  sun.addColorStop(1, 'rgb(255 160 80 / 0)')
  c.fillStyle = sun
  c.fillRect(0, 0, w, horizon)

  // Five stepped towers in silhouette, the middle one tallest
  c.fillStyle = '#1b1226'
  const towers = [[0.3, 0.26], [0.4, 0.34], [0.5, 0.44], [0.6, 0.34], [0.7, 0.26]] as const
  for (const [x, tall] of towers) {
    const cx = w * x
    const top = horizon - h * tall
    for (let step = 0; step < 6; step++) {
      const y = top + (step / 6) * (horizon - top)
      const half = 30 + step * 26
      c.fillRect(cx - half, y, half * 2, (horizon - top) / 6 + 2)
    }
    c.beginPath()
    c.moveTo(cx - 24, top + 4)
    c.lineTo(cx, top - 60)
    c.lineTo(cx + 24, top + 4)
    c.fill()
  }
  c.fillRect(w * 0.22, horizon - 70, w * 0.56, 70)

  // Water: the sky flipped and darkened, with ripples
  c.save()
  c.translate(0, horizon * 2)
  c.scale(1, -1)
  c.globalAlpha = 0.55
  c.drawImage(canvas, 0, 0, w, horizon, 0, 0, w, horizon)
  c.restore()
  c.fillStyle = 'rgb(20 10 40 / 0.45)'
  c.fillRect(0, horizon, w, h - horizon)
  const rand = seeded(7)
  c.strokeStyle = 'rgb(255 210 140 / 0.35)'
  for (let i = 0; i < 260; i++) {
    const y = horizon + 8 + rand() * (h - horizon)
    const x = rand() * w
    c.lineWidth = 1 + rand() * 2
    c.beginPath()
    c.moveTo(x, y)
    c.lineTo(x + 40 + rand() * 160, y)
    c.stroke()
  }

  // Film grain
  const img = c.getImageData(0, 0, w, h)
  const noise = seeded(42)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (noise() - 0.5) * 34
    img.data[i]! += n
    img.data[i + 1]! += n
    img.data[i + 2]! += n
  }
  c.putImageData(img, 0, 0)
  return canvas
}

/** A flat app screenshot: big areas of one colour, which PNG stores inefficiently */
function drawScreenshot(w = 1800, h = 1200) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const c = canvas.getContext('2d')!
  const rand = seeded(3)
  c.fillStyle = '#eef1f6'
  c.fillRect(0, 0, w, h)
  c.fillStyle = '#1b1f2a'
  c.fillRect(0, 0, w, 90)
  c.fillStyle = '#ffffff'
  c.font = '600 34px system-ui, sans-serif'
  c.fillText('Monthly overview', 48, 58)

  const card = (x: number, y: number, cw: number, ch: number) => {
    c.fillStyle = '#ffffff'
    c.beginPath()
    c.roundRect(x, y, cw, ch, 24)
    c.fill()
  }
  const colors = ['#1f5bd8', '#179a54', '#ef7d16', '#d43d78']
  colors.forEach((color, i) => {
    const x = 48 + i * 432
    card(x, 130, 400, 200)
    c.fillStyle = color
    c.beginPath()
    c.roundRect(x + 32, 162, 56, 56, 14)
    c.fill()
    c.fillStyle = '#1b1f2a'
    c.font = '700 52px system-ui, sans-serif'
    c.fillText(`$${(1200 + rand() * 8000).toFixed(0)}`, x + 32, 290)
  })

  // A line chart
  card(48, 370, 1080, 780)
  c.strokeStyle = '#d6dbe3'
  c.lineWidth = 2
  for (let i = 0; i < 6; i++) {
    c.beginPath()
    c.moveTo(96, 450 + i * 120)
    c.lineTo(1080, 450 + i * 120)
    c.stroke()
  }
  c.strokeStyle = '#1f5bd8'
  c.lineWidth = 6
  c.lineJoin = 'round'
  c.beginPath()
  let y = 900
  for (let i = 0; i <= 24; i++) {
    y = Math.min(1080, Math.max(470, y + (rand() - 0.55) * 120))
    i ? c.lineTo(96 + i * 41, y) : c.moveTo(96, y)
  }
  c.stroke()

  // A list of rows
  card(1160, 370, 592, 780)
  for (let i = 0; i < 8; i++) {
    const ry = 410 + i * 92
    c.fillStyle = colors[i % 4]!
    c.beginPath()
    c.arc(1214, ry + 30, 22, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#c4cad6'
    c.beginPath()
    c.roundRect(1256, ry + 14, 200 + rand() * 200, 16, 8)
    c.roundRect(1256, ry + 40, 120 + rand() * 120, 12, 6)
    c.fill()
  }
  return canvas
}

/** Two A4 pages of real text (stays selectable) around a large photo */
async function makeBrochure(photo: Blob) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  doc.setTitle('Demo brochure')
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const image = await doc.embedJpg(new Uint8Array(await photo.arrayBuffer()))
  const ink = rgb(0.11, 0.12, 0.16)
  const body = 'This is a demo PDF made in your browser. The text on this page is real text, so it stays sharp and selectable when you choose Keep text sharp, while the large photo below is what makes the file heavy.'

  for (let n = 1; n <= 2; n++) {
    const page = doc.addPage([595, 842])
    page.drawText(n === 1 ? 'Sunset tours' : 'What to bring', { x: 50, y: 770, size: 30, font: bold, color: ink })
    page.drawText(body, { x: 50, y: 735, size: 11, font, color: ink, maxWidth: 495, lineHeight: 16 })
    page.drawImage(image, { x: 50, y: 330, width: 495, height: 330 })
    page.drawText(`Page ${n} of 2`, { x: 50, y: 50, size: 9, font, color: rgb(0.45, 0.48, 0.55) })
  }
  return new Blob([await doc.save()], { type: 'application/pdf' })
}

export async function makeDemoFiles(): Promise<File[]> {
  const photo = await toBlob(drawPhoto(), 'image/jpeg', 0.95)
  const screenshot = await toBlob(drawScreenshot(), 'image/png')
  const brochure = await makeBrochure(photo)
  return [
    new File([photo], 'demo-sunset-photo.jpg', { type: 'image/jpeg' }),
    new File([screenshot], 'demo-app-screenshot.png', { type: 'image/png' }),
    new File([brochure], 'demo-brochure.pdf', { type: 'application/pdf' })
  ]
}
