import { initViewer } from './viewer.js'

const DEFAULT_ARTISTS = [
  'Vincent van Gogh',
  'Pierre-Auguste Renoir',
  'Paul Cézanne'
]

const leftSel = document.getElementById('leftArtist')
const rightSel = document.getElementById('rightArtist')
const modeSel = document.getElementById('mode')

for (const a of DEFAULT_ARTISTS) {
  const optL = document.createElement('option')
  optL.value = a
  optL.textContent = a
  leftSel.appendChild(optL)

  const optR = document.createElement('option')
  optR.value = a
  optR.textContent = a
  rightSel.appendChild(optR)
}

leftSel.value = DEFAULT_ARTISTS[0]
rightSel.value = DEFAULT_ARTISTS[1]

const leftMount = document.getElementById('leftMount')
const rightMount = document.getElementById('rightMount')
const leftTitle = document.getElementById('leftTitle')
const rightTitle = document.getElementById('rightTitle')
const leftMeta = document.getElementById('leftMeta')
const rightMeta = document.getElementById('rightMeta')

const leftViewer = initViewer(leftMount)
const rightViewer = initViewer(rightMount)

async function loadData() {
  const [artworks, features] = await Promise.all([
    fetch('./data/artworks.json').then(r => r.json()).catch(() => ({ artworks: [] })),
    fetch('./data/features.json').then(r => r.json()).catch(() => ({ featuresById: {} }))
  ])
  // Debug: log unique artist names from the JSON so we can verify matching
  const names = [...new Set((artworks.artworks ?? []).map(a => a.artistDisplayName))]
  console.log('[GoghWithTheFlow] Artist names in artworks.json:', names)
  return { artworks: artworks.artworks ?? [], featuresById: features.featuresById ?? {} }
}

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9 ]/g, ' ')     // strip punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

function pickFirstForArtist(artworks, artist) {
  const target = normalize(artist)
  // 1. Exact normalised match
  let found = artworks.find(a => normalize(a.artistDisplayName) === target)
  if (found) return found
  // 2. All words in the dropdown name appear in the stored name (handles "Renoir, Pierre-Auguste (French, 1841–1919)")
  const targetWords = target.split(' ').filter(Boolean)
  found = artworks.find(a => {
    const stored = normalize(a.artistDisplayName)
    return targetWords.every(w => stored.includes(w))
  })
  if (found) return found
  // 3. Last name only fallback
  const lastName = normalize(artist).split(' ').slice(-1)[0]
  return artworks.find(a => normalize(a.artistDisplayName).includes(lastName)) || null
}

let cache = null

async function rerender() {
  if (!cache) cache = await loadData()

  const leftArtist = leftSel.value
  const rightArtist = rightSel.value

  leftTitle.textContent = leftArtist
  rightTitle.textContent = rightArtist

  const leftWork = pickFirstForArtist(cache.artworks, leftArtist)
  const rightWork = pickFirstForArtist(cache.artworks, rightArtist)

  if (leftMeta) leftMeta.textContent = leftWork ? `${leftWork.title} — ${leftWork.objectDate || ''}` : ''
  if (rightMeta) rightMeta.textContent = rightWork ? `${rightWork.title} — ${rightWork.objectDate || ''}` : ''

  const mode = modeSel.value
  await leftViewer.setArtwork(leftWork, cache.featuresById[leftWork?.objectID], { mode })
  await rightViewer.setArtwork(rightWork, cache.featuresById[rightWork?.objectID], { mode })
}

leftSel.addEventListener('change', rerender)
rightSel.addEventListener('change', rerender)
modeSel.addEventListener('change', rerender)

rerender()
