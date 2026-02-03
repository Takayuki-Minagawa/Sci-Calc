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

const gradientStops = [
  { t: 0, color: [255, 179, 107] },
  { t: 0.55, color: [255, 122, 89] },
  { t: 1, color: [31, 138, 112] }
]

const lineColor = [31, 34, 30]

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
  return [
    lerp(c1[0], c2[0], t),
    lerp(c1[1], c2[1], t),
    lerp(c1[2], c2[2], t)
  ]
}

function gradientColor(x, y) {
  const t = clamp((x + y) / 128, 0, 1)
  if (t <= gradientStops[1].t) {
    const tt = t / gradientStops[1].t
    return mixColor(gradientStops[0].color, gradientStops[1].color, tt)
  }
  const tt = (t - gradientStops[1].t) / (gradientStops[2].t - gradientStops[1].t)
  return mixColor(gradientStops[1].color, gradientStops[2].color, tt)
}

function dist(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2)
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return dist(px, py, x1, y1)
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1)
  const sx = x1 + t * dx
  const sy = y1 + t * dy
  return dist(px, py, sx, sy)
}

function minDistanceToPolyline(px, py, points) {
  let min = Infinity
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]
    const d = distToSegment(px, py, p1.x, p1.y, p2.x, p2.y)
    if (d < min) min = d
  }
  return min
}

function cubicPoint(t, p0, p1, p2, p3) {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t
  const x = p0.x * mt2 * mt + 3 * p1.x * mt2 * t + 3 * p2.x * mt * t2 + p3.x * t2 * t
  const y = p0.y * mt2 * mt + 3 * p1.y * mt2 * t + 3 * p2.y * mt * t2 + p3.y * t2 * t
  return { x, y }
}

function buildBezierPolyline(steps) {
  const p0 = { x: 20, y: 38 }
  const p1 = { x: 26.2, y: 42.6 }
  const p2 = { x: 35.8, y: 42.6 }
  const p3 = { x: 42, y: 38 }
  const points = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    points.push(cubicPoint(t, p0, p1, p2, p3))
  }
  return points
}

const bezierPoints = buildBezierPolyline(80)
const vShapePoints = [
  { x: 24, y: 26 },
  { x: 32, y: 40 },
  { x: 40, y: 26 }
]

function render(size) {
  const data = new Uint8Array(size * size * 4)
  const scale = 64 / size
  const soft = Math.max(scale * 0.5, 0.5)

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
        pr = color[0] / 255 * a + pr * inv
        pg = color[1] / 255 * a + pg * inv
        pb = color[2] / 255 * a + pb * inv
        pa = a + pa * inv
      }

      const baseColor = gradientColor(px, py)
      const distCenter = dist(px, py, 32, 32)
      const fillAlpha = smoothstep(22 + soft, 22 - soft, distCenter) * 0.18
      blend(baseColor, fillAlpha)

      const ringDist = Math.abs(distCenter - 18)
      const ringAlpha = smoothstep(1.5 + soft, 1.5 - soft, ringDist)
      blend(baseColor, ringAlpha)

      const curveDist = minDistanceToPolyline(px, py, bezierPoints)
      const curveAlpha = smoothstep(1.5 + soft, 1.5 - soft, curveDist)
      blend(lineColor, curveAlpha)

      const vShapeDist = minDistanceToPolyline(px, py, vShapePoints)
      const vShapeAlpha = smoothstep(1.5 + soft, 1.5 - soft, vShapeDist)
      blend(lineColor, vShapeAlpha)

      const dotDist = dist(px, py, 32, 26)
      const dotAlpha = smoothstep(3.5 + soft, 3.5 - soft, dotDist)
      blend(lineColor, dotAlpha)

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

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
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
  const chunks = [
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ]
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
