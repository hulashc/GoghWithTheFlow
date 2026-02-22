import fs from 'node:fs'
import path from 'node:path'

const artworksPath = path.resolve('public/data/artworks.json')
const outDir = path.resolve('public/data/images')
fs.mkdirSync(outDir, { recursive: true })

const { artworks } = JSON.parse(fs.readFileSync(artworksPath, 'utf-8'))

async function download(url, outPath) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed ${r.status} ${url}`)
  const buf = Buffer.from(await r.arrayBuffer())
  fs.writeFileSync(outPath, buf)
}

for (const a of artworks) {
  const url = a.primaryImageSmall || a.primaryImage
  if (!url) continue
  const outPath = path.join(outDir, `${a.objectID}.jpg`)
  if (fs.existsSync(outPath)) continue
  await download(url, outPath)
  console.log(`Downloaded ${a.objectID}`)
}
