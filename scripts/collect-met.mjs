import { ARTISTS_V1 } from './artists-v1.mjs'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('public/data/artworks.json')
fs.mkdirSync(path.dirname(OUT), { recursive: true })

async function metSearch(q) {
  const url = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(q)}`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Search failed ${r.status}`)
  return r.json()
}

async function metObject(id) {
  const url = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`
  const r = await fetch(url)
  if (!r.ok) return null
  return r.json()
}

function isGood(obj) {
  return Boolean(
    obj &&
    obj.isPublicDomain === true &&
    (obj.primaryImageSmall || obj.primaryImage) &&
    obj.objectID &&
    obj.artistDisplayName
  )
}

const perArtist = 30
const artworks = []

for (const a of ARTISTS_V1) {
  const s = await metSearch(a.q)
  const ids = (s.objectIDs || []).slice(0, 400)
  let kept = 0

  for (const id of ids) {
    if (kept >= perArtist) break
    const obj = await metObject(id)
    if (!isGood(obj)) continue

    artworks.push({
      objectID: obj.objectID,
      title: obj.title,
      artistDisplayName: obj.artistDisplayName,
      objectDate: obj.objectDate,
      primaryImage: obj.primaryImage,
      primaryImageSmall: obj.primaryImageSmall,
      department: obj.department,
      culture: obj.culture,
      medium: obj.medium,
      objectURL: obj.objectURL
    })

    kept++
  }

  console.log(`${a.name}: kept ${kept}`)
}

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), artworks }, null, 2))
console.log(`Wrote ${artworks.length} artworks -> ${OUT}`)
