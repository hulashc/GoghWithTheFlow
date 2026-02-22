import fs from 'node:fs'
import path from 'node:path'
import { Image } from 'image-js'
import { Vibrant } from 'node-vibrant/node'

// v1 metrics (real implementation):
// - Palette: prominent swatches + saturation/brightness summary
// - Texture energy: edge-density / high-frequency proxy; also saved as grayscale displacement map
// - Stroke direction: orientation histogram from Sobel gradients + coherence score

const artworksPath = path.resolve('public/data/artworks.json')
const imagesDir = path.resolve('public/data/images')
const outFeatures = path.resolve('public/data/features.json')
const overlaysDir = path.resolve('public/data/overlays')

fs.mkdirSync(path.dirname(outFeatures), { recursive: true })
fs.mkdirSync(overlaysDir, { recursive: true })

const { artworks } = JSON.parse(fs.readFileSync(artworksPath, 'utf-8'))

function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  const v = max
  return { h, s, v }
}

async function paletteMetrics(imagePath) {
  const v = await Vibrant.from(imagePath).maxColorCount(8).getPalette()
  const swatches = Object.values(v).filter(Boolean).map(s => ({
    hex: s.hex,
    population: s.population
  }))

  const img = await Image.load(imagePath)
  const small = img.resize({ width: 128 })
  const data = small.getRGBAData()
  let sSum = 0, vSum = 0, n = 0
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a === 0) continue
    const { s, v } = rgbToHsv(data[i], data[i + 1], data[i + 2])
    sSum += s
    vSum += v
    n++
  }
  return {
    swatches,
    avgSaturation: n ? sSum / n : null,
    avgBrightness: n ? vSum / n : null
  }
}

async function textureEnergyAndMap(imagePath, outPngPath) {
  const img = await Image.load(imagePath)
  const gray = img.grey()
  const small = gray.resize({ width: 512 })

  const sobel = small.sobelFilter()
  const data = sobel.data

  let max = 1
  for (let i = 0; i < data.length; i++) max = Math.max(max, data[i])

  const out = Image.createFrom(small, { kind: 'GREY' })
  const outData = out.data
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    const v = Math.round(clamp01(data[i] / max) * 255)
    outData[i] = v
    sum += v
  }

  await out.save(outPngPath)

  return {
    avgEdgeMagnitude: data.length ? (sum / data.length) / 255 : null,
    width: out.width,
    height: out.height
  }
}

async function strokeDirectionMetrics(imagePath) {
  const img = await Image.load(imagePath)
  const gray = img.grey().resize({ width: 256 })

  // Use image-js built-in Sobel to avoid kernel format issues.
  const gx = gray.sobelFilter({ direction: 'x' })
  const gy = gray.sobelFilter({ direction: 'y' })

  const dx = gx.data
  const dy = gy.data

  const bins = 12
  const hist = new Array(bins).fill(0)
  let magSum = 0
  let vx = 0, vy = 0

  for (let i = 0; i < dx.length; i++) {
    const x = dx[i]
    const y = dy[i]
    const mag = Math.hypot(x, y)
    if (mag < 8) continue

    const ang = (Math.atan2(y, x) + Math.PI) // 0..2pi
    const bin = Math.min(bins - 1, Math.floor((ang / (2 * Math.PI)) * bins))
    hist[bin] += mag
    magSum += mag

    vx += Math.cos(ang) * mag
    vy += Math.sin(ang) * mag
  }

  const normHist = magSum ? hist.map(h => h / magSum) : hist
  const coherence = magSum ? (Math.hypot(vx, vy) / magSum) : null

  return { bins, hist: normHist, coherence }
}

const featuresById = {}

for (const a of artworks) {
  const imgPath = path.join(imagesDir, `${a.objectID}.jpg`)
  if (!fs.existsSync(imgPath)) continue

  const texturePng = path.join(overlaysDir, `${a.objectID}-texture.png`)

  const [pal, tex, dir] = await Promise.all([
    paletteMetrics(imgPath),
    textureEnergyAndMap(imgPath, texturePng),
    strokeDirectionMetrics(imgPath)
  ])

  featuresById[a.objectID] = {
    objectID: a.objectID,
    palette: pal,
    textureEnergy: tex,
    strokeDirection: dir,
    textureMapUrl: `./data/overlays/${a.objectID}-texture.png`
  }

  console.log(`Features ${a.objectID}`)
}

fs.writeFileSync(outFeatures, JSON.stringify({ generatedAt: new Date().toISOString(), featuresById }, null, 2))
console.log(`Wrote features -> ${outFeatures}`)
