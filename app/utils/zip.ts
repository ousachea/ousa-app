// A small .zip reader and writer for Notes' Markdown export and import: one .md file per note, in
// folders, the way Obsidian, Bear and other notes apps hand them over. Writing stores files as they are
// (Markdown is small, so there's no compressing); reading also takes compressed ("deflated") files,
// unpacked with the browser's own DecompressionStream. Everything stays in the browser.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array) {
  let c = 0xFFFFFFFF
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xFF]! ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

// Zip keeps times in MS-DOS format: local time, two-second steps, from 1980
function dosTime(d: Date) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)
  const date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { time, date }
}

export interface ZipEntry {
  /** Path inside the zip, with / between folders */
  path: string
  content: string
  modified?: Date
}

/** Files into a .zip, ready to download */
export function makeZip(entries: ZipEntry[]): Blob {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const e of entries) {
    const name = enc.encode(e.path)
    const data = enc.encode(e.content)
    const crc = crc32(data)
    const { time, date } = dosTime(e.modified ?? new Date())
    // Bit 11: the names are UTF-8, so Khmer and emoji file names survive
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034B50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true)
    local.setUint16(8, 0, true)
    local.setUint16(10, time, true)
    local.setUint16(12, date, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, data.length, true)
    local.setUint32(22, data.length, true)
    local.setUint16(26, name.length, true)
    parts.push(new Uint8Array(local.buffer), name, data)

    const dir = new DataView(new ArrayBuffer(46))
    dir.setUint32(0, 0x02014B50, true)
    dir.setUint16(4, 20, true)
    dir.setUint16(6, 20, true)
    dir.setUint16(8, 0x0800, true)
    dir.setUint16(10, 0, true)
    dir.setUint16(12, time, true)
    dir.setUint16(14, date, true)
    dir.setUint32(16, crc, true)
    dir.setUint32(20, data.length, true)
    dir.setUint32(24, data.length, true)
    dir.setUint16(28, name.length, true)
    dir.setUint32(42, offset, true)
    central.push(new Uint8Array(dir.buffer), name)
    offset += 30 + name.length + data.length
  }
  const size = central.reduce((n, p) => n + p.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054B50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, size, true)
  end.setUint32(16, offset, true)
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[], { type: 'application/zip' })
}

async function inflate(data: Uint8Array) {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** The text files in a .zip (folders and anything that isn't stored or deflated are skipped) */
export async function readZip(file: Blob): Promise<{ path: string, content: string, modified?: Date }[]> {
  const buf = new Uint8Array(await file.arrayBuffer())
  const view = new DataView(buf.buffer)
  // The directory at the end lists every file; look for its last record
  let end = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054B50) {
      end = i
      break
    }
  }
  if (end < 0) throw new Error('Not a zip file')
  const count = view.getUint16(end + 10, true)
  let p = view.getUint32(end + 16, true)
  const utf8 = new TextDecoder()
  const out: { path: string, content: string, modified?: Date }[] = []
  for (let n = 0; n < count && view.getUint32(p, true) === 0x02014B50; n++) {
    const method = view.getUint16(p + 10, true)
    const time = view.getUint16(p + 12, true)
    const date = view.getUint16(p + 14, true)
    const packed = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const at = view.getUint32(p + 42, true)
    const path = utf8.decode(buf.subarray(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + extraLen + commentLen
    if (path.endsWith('/') || path.startsWith('__MACOSX/') || (method !== 0 && method !== 8)) continue
    const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true)
    const raw = buf.subarray(start, start + packed)
    const bytes = method === 8 ? await inflate(raw) : raw
    const modified = new Date(1980 + (date >> 9), ((date >> 5) & 15) - 1, date & 31, time >> 11, (time >> 5) & 63, (time & 31) * 2)
    out.push({ path, content: utf8.decode(bytes), modified: Number.isNaN(modified.getTime()) ? undefined : modified })
  }
  return out
}
