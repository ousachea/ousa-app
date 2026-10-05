// PDF compression in the browser. pdf.js (rendering) and pdf-lib (writing) are loaded only when a
// PDF is actually added, so the compressor page stays light for people who only use images.
//
// Two modes:
//  - keep-text: text and vector graphics are untouched; JPEG photos inside the PDF are re-encoded
//    (and optionally scaled down). Most of a PDF's weight is usually its photos.
//  - raster: every page is redrawn as a JPEG at the chosen resolution. Smallest for scans and photo
//    PDFs, but the text becomes part of the picture (not selectable or searchable).

export type PdfMode = 'keep-text' | 'raster'

export interface PdfResult {
  bytes: Uint8Array
  pages: number
  /** Photos re-encoded in keep-text mode */
  imagesChanged?: number
}

type PdfJs = typeof import('pdfjs-dist')
let pdfjsPromise: Promise<PdfJs> | undefined

async function loadPdfjs() {
  pdfjsPromise ??= (async () => {
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    return pdfjs
  })()
  return pdfjsPromise
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('Encoding failed'))
      resolve(new Uint8Array(await blob.arrayBuffer()))
    }, 'image/jpeg', quality)
  })
}

/** First page as a small picture for the file list, plus the page count */
export async function pdfThumbnail(bytes: Uint8Array, width = 480) {
  const pdfjs = await loadPdfjs()
  // pdf.js is closed through its loading task (the document itself has no destroy in v5)
  const task = pdfjs.getDocument({ data: bytes.slice() })
  const doc = await task.promise
  try {
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: width / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.8))
    return { blob, pages: doc.numPages, width: canvas.width, height: canvas.height }
  } finally {
    await task.destroy()
  }
}

/** Redraw every page as a JPEG; dpi controls sharpness (72 = 1 PDF point per pixel) */
async function rasterize(bytes: Uint8Array, quality: number, dpi: number, onProgress: (p: number) => void): Promise<PdfResult> {
  const [pdfjs, { PDFDocument }] = await Promise.all([loadPdfjs(), import('pdf-lib')])
  const task = pdfjs.getDocument({ data: bytes.slice() })
  const src = await task.promise
  const out = await PDFDocument.create()
  try {
    for (let i = 1; i <= src.numPages; i++) {
      const page = await src.getPage(i)
      const size = page.getViewport({ scale: 1 }) // in PDF points
      const viewport = page.getViewport({ scale: dpi / 72 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      const jpg = await out.embedJpg(await canvasToJpeg(canvas, quality))
      out.addPage([size.width, size.height]).drawImage(jpg, { x: 0, y: 0, width: size.width, height: size.height })
      page.cleanup()
      canvas.width = canvas.height = 0 // free the memory straight away on big documents
      onProgress(i / src.numPages)
    }
    return { bytes: await out.save({ useObjectStreams: true }), pages: src.numPages }
  } finally {
    await task.destroy()
  }
}

/** Re-encode the JPEG photos inside the PDF; everything else is copied as it is */
async function recompressImages(bytes: Uint8Array, quality: number, maxPx: number, onProgress: (p: number) => void): Promise<PdfResult> {
  const { PDFDocument, PDFName, PDFRawStream, PDFArray } = await import('pdf-lib')
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const N = (n: string) => PDFName.of(n)

  // Plain JPEG images in RGB or grey. CMYK, masks and chained filters are left alone:
  // browsers can't reliably decode them, and getting colours wrong is worse than a bigger file.
  const images = doc.context.enumerateIndirectObjects().filter(([, obj]) => {
    if (!(obj instanceof PDFRawStream)) return false
    const d = obj.dict
    if (d.get(N('Subtype')) !== N('Image') || d.get(N('ImageMask')) || d.get(N('Decode'))) return false
    const filter = d.get(N('Filter'))
    const isJpeg = filter === N('DCTDecode') || (filter instanceof PDFArray && filter.size() === 1 && filter.get(0) === N('DCTDecode'))
    const cs = d.get(N('ColorSpace'))
    return isJpeg && (cs === N('DeviceRGB') || cs === N('DeviceGray') || cs === undefined)
  }) as [import('pdf-lib').PDFRef, InstanceType<typeof PDFRawStream>][]

  let changed = 0
  for (const [i, [ref, stream]] of images.entries()) {
    try {
      const original = stream.getContents()
      const bitmap = await createImageBitmap(new Blob([original], { type: 'image/jpeg' }))
      const scale = maxPx && Math.max(bitmap.width, bitmap.height) > maxPx ? maxPx / Math.max(bitmap.width, bitmap.height) : 1
      const w = Math.max(1, Math.round(bitmap.width * scale))
      const h = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
      bitmap.close()
      const jpeg = await canvasToJpeg(canvas, quality)
      // Only swap it in when it's a real saving
      if (jpeg.length < original.length * 0.95) {
        const smask = stream.dict.get(N('SMask'))
        doc.context.assign(ref, doc.context.stream(jpeg, {
          Type: 'XObject',
          Subtype: 'Image',
          Width: w,
          Height: h,
          ColorSpace: 'DeviceRGB',
          BitsPerComponent: 8,
          Filter: 'DCTDecode',
          ...(smask ? { SMask: smask } : {})
        }))
        changed++
      }
    } catch {
      // An image the browser can't decode stays exactly as it was
    }
    onProgress((i + 1) / Math.max(images.length, 1))
  }

  return { bytes: await doc.save({ useObjectStreams: true }), pages: doc.getPageCount(), imagesChanged: changed }
}

export async function compressPdf(
  bytes: Uint8Array,
  opts: { mode: PdfMode, quality: number, dpi: number, maxPx: number },
  onProgress: (p: number) => void = () => {}
): Promise<PdfResult> {
  const result = opts.mode === 'raster'
    ? await rasterize(bytes, opts.quality, opts.dpi, onProgress)
    : await recompressImages(bytes, opts.quality, opts.maxPx, onProgress)
  // Never hand back a bigger file than the one you gave
  return result.bytes.length < bytes.length ? result : { ...result, bytes, imagesChanged: 0 }
}

export function isPdf(file: File) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}
