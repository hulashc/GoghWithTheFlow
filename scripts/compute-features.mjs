import fs from 'node:fs'
import path from 'node:path'

// v1 placeholder implementation.
// Writes minimal feature objects so the UI can load.
// Next step: implement palette (k-means), texture energy (edge density), stroke direction (orientation histogram).

const artworksPath = path.resolve('public/data/artworks.json')
const outFeatures = path.resolve('public/data/features.json')
const overlaysDir = path.resolve('public/data/overlays')
fs.mkdirSync(path.dirname(outFeatures), { recursive: true })
fs.mkdirSync(overlaysDir, { recursive: true })

const { artworks } = JSON.parse(fs.readFileSync(artworksPath, 'utf-8'))

const featuresById = {}
for (const a of artworks) {
  // These URLs are what the viewer expects for relief mode.
  // In the real implementation you’ll generate an actual grayscale displacement map per image.
  const textureMapUrl = `./data/overlays/${a.objectID}-texture.png`

  featuresById[a.objectID] = {
    objectID: a.objectID,
    palette: null,
    textureEnergy: null,
    strokeDirection: null,
    textureMapUrl
  }

  // Create a 1x1 transparent PNG placeholder if it doesn’t exist.
  const p = path.join(overlaysDir, `${a.objectID}-texture.png`)
  if (!fs.existsSync(p)) {
    const png1x1 = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0Y2XcAAAAASUVORK5CYII=',
      'base64'
    )
    fs.writeFileSync(p, png1x1)
  }
}

fs.writeFileSync(outFeatures, JSON.stringify({ generatedAt: new Date().toISOString(), featuresById }, null, 2))
console.log(`Wrote features -> ${outFeatures}`)
