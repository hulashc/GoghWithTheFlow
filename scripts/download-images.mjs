import fs from 'node:fs'
import path from 'node:path'

const artworksPath = path.resolve('public/data/artworks.json')
const outDir = path.resolve('public/data/images')
fs.mkdirSync(outDir, { recursive: true })

const json = JSON.parse(fs.readFileSync(artworksPath, 'utf-8'))
const artworks = json.artworks || []

async function download(url, outPath) {
  const r = await fetch(url, { headers: { 'User-Agent': 'GoghWithTheFlow/0.4 (contact: hulashc)' } })
  if (!r.ok) throw new Error(`Failed ${r.status} ${url}`)
  const buf = Buffer.from(await r.arrayBuffer())
  fs.writeFileSync(outPath, buf)
}

let changed = 0

for (const a of artworks) {
  const url = a.primaryImageSmall || a.primaryImage
  if (!url) continue

  const outPath = path.join(outDir, `${a.objectID}.jpg`)
  if (!fs.existsSync(outPath)) {
    await download(url, outPath)
    console.log(`Downloaded ${a.objectID}`)
  }

  // IMPORTANT: point the browser UI at the locally cached file to avoid CORS issues.
  const local = `./data/images/${a.objectID}.jpg`
  if (a.imageLocalSmall !== local) {
    a.imageLocalSmall = local
    changed++
  }
}

if (changed > 0) {
  fs.writeFileSync(artworksPath, JSON.stringify({ ...json, artworks }, null, 2))
  console.log(`Updated artworks.json with ${changed} local image paths`)
}
