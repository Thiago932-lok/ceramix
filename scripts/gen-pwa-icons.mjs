import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const destino = resolve(raiz, 'apps/web/public')

const CORES = {
  fundoCentro: [27, 43, 36],
  fundoBorda: [18, 28, 23],
  marca: [182, 83, 38],
  azulejo: [255, 247, 238]
}

const TABELAS = (() => {
  const tabela = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabela[n] = c >>> 0
  }
  return tabela
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (let i = 0; i < buffer.length; i += 1) crc = TABELAS[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function bloco(tipo, dados) {
  const comprimento = Buffer.alloc(4)
  comprimento.writeUInt32BE(dados.length, 0)
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corpo), 0)
  return Buffer.concat([comprimento, corpo, crc])
}

function codificarPng(largura, altura, pixels) {
  const assinatura = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largura, 0)
  ihdr.writeUInt32BE(altura, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const linhas = Buffer.alloc((largura * 4 + 1) * altura)
  for (let y = 0; y < altura; y += 1) {
    const inicio = y * (largura * 4 + 1)
    linhas[inicio] = 0
    pixels.copy(linhas, inicio + 1, y * largura * 4, (y + 1) * largura * 4)
  }
  return Buffer.concat([
    assinatura,
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(linhas, { level: 9 })),
    bloco('IEND', Buffer.alloc(0))
  ])
}

function dentroRetanguloArredondado(x, y, x0, y0, x1, y1, raio) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + raio), x1 - raio)
  const cy = Math.min(Math.max(y, y0 + raio), y1 - raio)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= raio * raio
}

const AZULEJOS = [
  [8, 11.2, 15, 16.2],
  [17.3, 11.2, 24, 16.2],
  [8, 18.2, 17.2, 23.2],
  [19.5, 18.2, 24, 23.2]
]

function gerarIcone(tamanho, mascaravel) {
  const pixels = Buffer.alloc(tamanho * tamanho * 4)
  const amostras = 4
  const total = amostras * amostras
  const ladoMarca = mascaravel ? 0.56 : 0.68
  const x0 = 0.5 - ladoMarca / 2
  const x1 = 0.5 + ladoMarca / 2
  const y0 = x0
  const y1 = x1
  const raio = ladoMarca * 0.28
  const escala = ladoMarca / 32
  const raioAzulejo = 0.45 * escala

  const azulejos = AZULEJOS.map(([u0, v0, u1, v1]) => [
    x0 + u0 * escala,
    y0 + v0 * escala,
    x0 + u1 * escala,
    y0 + v1 * escala
  ])

  for (let y = 0; y < tamanho; y += 1) {
    for (let x = 0; x < tamanho; x += 1) {
      let r = 0
      let g = 0
      let b = 0

      for (let sy = 0; sy < amostras; sy += 1) {
        for (let sx = 0; sx < amostras; sx += 1) {
          const px = (x + (sx + 0.5) / amostras) / tamanho
          const py = (y + (sy + 0.5) / amostras) / tamanho

          let cor = null
          if (dentroRetanguloArredondado(px, py, x0, y0, x1, y1, raio)) {
            cor = CORES.marca
            for (const [ax0, ay0, ax1, ay1] of azulejos) {
              if (dentroRetanguloArredondado(px, py, ax0, ay0, ax1, ay1, raioAzulejo)) {
                cor = CORES.azulejo
                break
              }
            }
          } else {
            const dx = px - 0.5
            const dy = py - 0.5
            const distancia = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 0.72)
            const t = distancia * distancia
            cor = [
              CORES.fundoCentro[0] + (CORES.fundoBorda[0] - CORES.fundoCentro[0]) * t,
              CORES.fundoCentro[1] + (CORES.fundoBorda[1] - CORES.fundoCentro[1]) * t,
              CORES.fundoCentro[2] + (CORES.fundoBorda[2] - CORES.fundoCentro[2]) * t
            ]
          }

          r += cor[0]
          g += cor[1]
          b += cor[2]
        }
      }

      const indice = (y * tamanho + x) * 4
      pixels[indice] = Math.round(r / total)
      pixels[indice + 1] = Math.round(g / total)
      pixels[indice + 2] = Math.round(b / total)
      pixels[indice + 3] = 255
    }
  }

  return codificarPng(tamanho, tamanho, pixels)
}

mkdirSync(destino, { recursive: true })

for (const tamanho of [192, 512]) {
  writeFileSync(resolve(destino, `pwa-${tamanho}.png`), gerarIcone(tamanho, false))
}

writeFileSync(resolve(destino, 'pwa-maskable-512.png'), gerarIcone(512, true))
console.log('Ícones PWA gerados em apps/web/public')
