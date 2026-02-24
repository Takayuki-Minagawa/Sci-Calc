import fs from 'fs'
import path from 'path'
import { deflateSync } from 'zlib'

const outDir = path.resolve('public')
const sizes = {
  'favicon-16.png': 16,
  'favicon-32.png': 32,
  'apple-touch-icon.png': 180,
  'android-chrome-192.png': 192,
  'android-chrome-512.png': 512
}

// Background gradient: #3a2268 → #1c1040
const bgColor1 = [58, 34, 104]
const bgColor2 = [28, 16, 64]
// Gold gradient: #f0b850 → #d08828
const goldColor1 = [240, 184, 80]
const goldColor2 = [208, 136, 40]
// Panel overlay color (white at low alpha)
const panelColor = [255, 255, 255]

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function mixColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]
}

// Signed distance function for a rounded rectangle
// cx,cy = center; hw,hh = half-width/half-height; r = corner radius
function roundedRectSDF(px, py, cx, cy, hw, hh, r) {
  const dx = Math.max(Math.abs(px - cx) - (hw - r), 0)
  const dy = Math.max(Math.abs(py - cy) - (hh - r), 0)
  return Math.sqrt(dx * dx + dy * dy) - r
}

// Background gradient: linear from top-left toward bottom-right (direction 0.4, 1)
function bgGradientAt(px, py) {
  const dirLen = Math.sqrt(0.4 * 0.4 + 1)
  const proj = (px * 0.4 + py) / (dirLen * 64 * dirLen)
  return mixColor(bgColor1, bgColor2, clamp(proj, 0, 1))
}

// Gold gradient: vertical
function goldGradientAt(py) {
  return mixColor(goldColor1, goldColor2, clamp(py / 64, 0, 1))
}

function render(size) {
  const data = new Uint8Array(size * size * 4)
  const scale = 64 / size
  const soft = Math.max(scale * 0.6, 0.5)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) * scale
      const py = (y + 0.5) * scale

      let pr = 0
      let pg = 0
      let pb = 0
      let pa = 0

      const blend = (color, alpha) => {
        if (alpha <= 0) return
        const a = clamp(alpha, 0, 1)
        const inv = 1 - a
        pr = (color[0] / 255) * a + pr * inv
        pg = (color[1] / 255) * a + pg * inv
        pb = (color[2] / 255) * a + pb * inv
        pa = a + pa * inv
      }

      // 1) Background rounded rect: x=4 y=4 w=56 h=56 rx=14
      //    center=(32,32) half=(28,28) r=14
      const bgDist = roundedRectSDF(px, py, 32, 32, 28, 28, 14)
      blend(bgGradientAt(px, py), smoothstep(soft, -soft, bgDist))

      // 2) Screen rect: x=11 y=10 w=42 h=14 rx=4.5
      //    center=(32,17) half=(21,7) r=4.5
      const screenDist = roundedRectSDF(px, py, 32, 17, 21, 7, 4.5)
      blend(panelColor, smoothstep(soft, -soft, screenDist) * 0.1)

      // 3) Keypad rect: x=11 y=29 w=30 h=27 rx=4.5
      //    center=(26,42.5) half=(15,13.5) r=4.5
      const keypadDist = roundedRectSDF(px, py, 26, 42.5, 15, 13.5, 4.5)
      blend(panelColor, smoothstep(soft, -soft, keypadDist) * 0.1)

      // 4) Gold operator column: x=44 y=29 w=9 h=27 rx=4.5
      //    center=(48.5,42.5) half=(4.5,13.5) r=4.5
      const goldDist = roundedRectSDF(px, py, 48.5, 42.5, 4.5, 13.5, 4.5)
      blend(goldGradientAt(py), smoothstep(soft, -soft, goldDist) * 0.75)

      // Write pixel
      let r = 0
      let g = 0
      let b = 0
      if (pa > 0) {
        r = pr / pa
        g = pg / pa
        b = pb / pa
      }
      const idx = (y * size + x) * 4
      data[idx] = Math.round(clamp(r, 0, 1) * 255)
      data[idx + 1] = Math.round(clamp(g, 0, 1) * 255)
      data[idx + 2] = Math.round(clamp(b, 0, 1) * 255)
      data[idx + 3] = Math.round(clamp(pa, 0, 1) * 255)
    }
  }

  return data
}

// --- PNG / ICO encoding (unchanged) ---

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const name = Buffer.from(type)
  const crc = Buffer.alloc(4)
  const crcValue = crc32(Buffer.concat([name, data]))
  crc.writeUInt32BE(crcValue, 0)
  return Buffer.concat([len, name, data, crc])
}

function writePng(filePath, width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1)
    raw[rowStart] = 0
    rgba.copy(raw, rowStart + 1, y * stride, y * stride + stride)
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const idat = deflateSync(raw)
  const chunks = [pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]
  const png = Buffer.concat([signature, ...chunks])
  fs.writeFileSync(filePath, png)
  return png
}

function writeIco(filePath, entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)

  const dir = Buffer.alloc(entries.length * 16)
  let offset = 6 + entries.length * 16
  entries.forEach((entry, index) => {
    const base = index * 16
    dir[base] = entry.size === 256 ? 0 : entry.size
    dir[base + 1] = entry.size === 256 ? 0 : entry.size
    dir[base + 2] = 0
    dir[base + 3] = 0
    dir.writeUInt16LE(1, base + 4)
    dir.writeUInt16LE(32, base + 6)
    dir.writeUInt32LE(entry.data.length, base + 8)
    dir.writeUInt32LE(offset, base + 12)
    offset += entry.data.length
  })

  const images = Buffer.concat(entries.map((entry) => entry.data))
  const ico = Buffer.concat([header, dir, images])
  fs.writeFileSync(filePath, ico)
}

// --- Generate ---

fs.mkdirSync(outDir, { recursive: true })

const pngBuffers = {}
for (const [filename, size] of Object.entries(sizes)) {
  const rgba = render(size)
  const png = writePng(path.join(outDir, filename), size, size, Buffer.from(rgba))
  pngBuffers[filename] = png
}

writeIco(path.join(outDir, 'favicon.ico'), [
  { size: 16, data: pngBuffers['favicon-16.png'] },
  { size: 32, data: pngBuffers['favicon-32.png'] }
])

console.log('Favicons generated in', outDir)
