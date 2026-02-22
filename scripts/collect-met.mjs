import { ARTISTS_V1 } from './artists-v1.mjs'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('public/data/artworks.json')
const STATE_PATH = path.resolve('public/data/collect-state.json')
fs.mkdirSync(path.dirname(OUT), { recursive: true })

const UA = 'GoghWithTheFlow/0.4 (contact: hulashc)'

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return { byArtist: {} }
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'))
  } catch {
    return { byArtist: {} }
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

async function fetchJson(url, { retries = 8 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const r = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json'
      }
    })

    if (r.status === 403 || r.status === 429) {
      const backoff = Math.min(180_000, 2000 * 2 ** attempt) + Math.floor(Math.random() * 1000)
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
  const url = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&artistOrCulture=true&q=${encodeURIComponent(q)}`
  return fetchJson(url)
}

async function metObject(id) {
  const url = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`
  return fetchJson(url, { retries: 5 }).catch(() => null)
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function isTargetArtist(obj, targetName) {
  const a = normalize(obj?.artistDisplayName)
  const t = normalize(targetName)
  if (!a) return false
  const last = t.split(' ').slice(-1)[0]
  return a === t || a.includes(last)
}

function isGood(obj, targetName) {
  return Boolean(
    obj &&
    obj.isPublicDomain === true &&
    (obj.primaryImageSmall || obj.primaryImage) &&
    obj.objectID &&
    isTargetArtist(obj, targetName)
  )
}

const perArtist = 30
const maxIdsToScan = 5000

const state = loadState()
const artworks = []

for (const a of ARTISTS_V1) {
  const artistKey = a.name
  const prev = state.byArtist[artistKey] || { cursor: 0, kept: 0 }

  const s = await metSearch(a.q)
  const ids = (s.objectIDs || []).slice(0, maxIdsToScan)

  let kept = prev.kept
  let cursor = prev.cursor

  for (; cursor < ids.length; cursor++) {
    if (kept >= perArtist) break

    const id = ids[cursor]
    const obj = await metObject(id)
    if (!isGood(obj, a.name)) {
      await sleep(900)
      continue
    }

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

    state.byArtist[artistKey] = { cursor: cursor + 1, kept }
    saveState(state)

    await sleep(900)
  }

  console.log(`${a.name}: kept ${kept}`)
  state.byArtist[artistKey] = { cursor, kept }
  saveState(state)

  await sleep(10_000)
}

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), artworks }, null, 2))
console.log(`Wrote ${artworks.length} artworks -> ${OUT}`)
console.log(`Resume state saved -> ${STATE_PATH}`)
