import { ARTISTS_V1 } from './artists-v1.mjs'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('public/data/artworks.json')
fs.mkdirSync(path.dirname(OUT), { recursive: true })

const UA = 'GoghWithTheFlow/0.2 (contact: hulashc)'

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchJson(url, { retries = 6 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const r = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json'
      }
    })

    // Met API sometimes enforces fair-use with 403 after many requests in short time.
    if (r.status === 403 || r.status === 429) {
      const backoff = Math.min(30_000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 250)
      console.warn(`Rate-limited (${r.status}) on ${url}. Backing off ${backoff}ms (attempt ${attempt + 1}/${retries + 1})`)
      await sleep(backoff)
      continue
    }

    if (!r.ok) throw new Error(`Request failed ${r.status} ${url}`)
    return r.json()
  }
  throw new Error(`Rate-limited too long: ${url}`)
}

async function metSearch(q) {
  const url = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(q)}`
  return fetchJson(url)
}

async function metObject(id) {
  const url = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`
  return fetchJson(url, { retries: 4 }).catch(() => null)
}

function isGood(obj, artistName) {
  return Boolean(
    obj &&
    obj.isPublicDomain === true &&
    (obj.primaryImageSmall || obj.primaryImage) &&
    obj.objectID &&
    obj.artistDisplayName &&
    // keep results tight to the target artist name to avoid search noise
    obj.artistDisplayName.toLowerCase().includes(artistName.toLowerCase().split(' ')[0])
  )
}

const perArtist = 30
const artworks = []

for (const a of ARTISTS_V1) {
  const s = await metSearch(a.q)
  const ids = (s.objectIDs || []).slice(0, 800)
  let kept = 0

  for (const id of ids) {
    if (kept >= perArtist) break
    const obj = await metObject(id)
    if (!isGood(obj, a.name)) continue

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
    // small pacing to avoid triggering fair-use blocks
    await sleep(120)
  }

  console.log(`${a.name}: kept ${kept}`)
  // extra pause between artists
  await sleep(1200)
}

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), artworks }, null, 2))
console.log(`Wrote ${artworks.length} artworks -> ${OUT}`)
