import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import zlib from 'zlib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../public')

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x++) {
      const brick = (Math.floor(y / (size / 4)) + Math.floor(x / (size / 4))) % 2 === 0
      const i = row + 1 + x * 4
      if (brick) {
        raw[i] = 196
        raw[i + 1] = 92
        raw[i + 2] = 38
      } else {
        raw[i] = 232
        raw[i + 1] = 224
        raw[i + 2] = 213
      }
      raw[i + 3] = 255
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

fs.writeFileSync(path.join(outDir, 'pwa-192.png'), png(192))
fs.writeFileSync(path.join(outDir, 'pwa-512.png'), png(512))
console.log('Ícones PWA gerados')
