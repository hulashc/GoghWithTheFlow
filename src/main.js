import { initViewer, EFFECTS } from './viewer.js'

const DEFAULT_ARTISTS = [
  'Vincent van Gogh',
  'Pierre-Auguste Renoir',
  'Paul Cézanne'
]

const leftSel    = document.getElementById('leftArtist')
const rightSel   = document.getElementById('rightArtist')
const modeSel    = document.getElementById('mode')
const randomBtn  = document.getElementById('randomBtn')

// Populate artist dropdowns
for (const a of DEFAULT_ARTISTS) {
  for (const sel of [leftSel, rightSel]) {
    const o = document.createElement('option')
    o.value = a; o.textContent = a
    sel.appendChild(o)
  }
}
leftSel.value  = DEFAULT_ARTISTS[0]
rightSel.value = DEFAULT_ARTISTS[1]

// Populate effect dropdown
for (const e of EFFECTS) {
  const o = document.createElement('option')
  o.value = e.id; o.textContent = e.label
  modeSel.appendChild(o)
}
modeSel.value = 'image'

const leftMount  = document.getElementById('leftMount')
const rightMount = document.getElementById('rightMount')
const leftTitle  = document.getElementById('leftTitle')
const rightTitle = document.getElementById('rightTitle')
const leftMeta   = document.getElementById('leftMeta')
const rightMeta  = document.getElementById('rightMeta')

const leftViewer  = initViewer(leftMount)
const rightViewer = initViewer(rightMount)

async function loadData() {
  const [artworks, features] = await Promise.all([
    fetch('./data/artworks.json').then(r => r.json()).catch(() => ({ artworks: [] })),
    fetch('./data/features.json').then(r => r.json()).catch(() => ({ featuresById: {} }))
  ])
  const names = [...new Set((artworks.artworks ?? []).map(a => a.artistDisplayName))]
  console.log('[GoghWithTheFlow] Artist names in artworks.json:', names)
  return { artworks: artworks.artworks ?? [], featuresById: features.featuresById ?? {} }
}

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickForArtist(artworks, artist, exclude = null) {
  const target = normalize(artist)
  const targetWords = target.split(' ').filter(Boolean)
  const lastName = targetWords.slice(-1)[0]

  const pool = artworks.filter(a => {
    if (exclude && a.objectID === exclude) return false
    const stored = normalize(a.artistDisplayName)
    return stored === target ||
      targetWords.every(w => stored.includes(w)) ||
      stored.includes(lastName)
  })

  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

let cache = null
let leftWork  = null
let rightWork = null

async function rerender({ newArtworks = false } = {}) {
  if (!cache) cache = await loadData()

  const leftArtist  = leftSel.value
  const rightArtist = rightSel.value
  const mode = modeSel.value

  if (newArtworks || !leftWork  || normalize(leftWork.artistDisplayName).split(' ').pop() !== normalize(leftArtist).split(' ').pop()) {
    leftWork  = pickForArtist(cache.artworks, leftArtist)
  }
  if (newArtworks || !rightWork || normalize(rightWork.artistDisplayName).split(' ').pop() !== normalize(rightArtist).split(' ').pop()) {
    rightWork = pickForArtist(cache.artworks, rightArtist)
  }

  leftTitle.textContent  = leftArtist
  rightTitle.textContent = rightArtist
  if (leftMeta)  leftMeta.textContent  = leftWork  ? `${leftWork.title} — ${leftWork.objectDate  || ''}` : 'No artwork found'
  if (rightMeta) rightMeta.textContent = rightWork ? `${rightWork.title} — ${rightWork.objectDate || ''}` : 'No artwork found'

  await Promise.all([
    leftViewer.setArtwork(leftWork,  cache.featuresById[leftWork?.objectID],  { mode }),
    rightViewer.setArtwork(rightWork, cache.featuresById[rightWork?.objectID], { mode })
  ])
}

function randomize() {
  if (!cache) return
  // Pick random different artists for left and right
  const shuffled = [...DEFAULT_ARTISTS].sort(() => Math.random() - 0.5)
  leftSel.value  = shuffled[0]
  rightSel.value = shuffled[1]
  // Pick a random effect
  const randomEffect = EFFECTS[Math.floor(Math.random() * EFFECTS.length)]
  modeSel.value = randomEffect.id
  document.body.dataset.mode = randomEffect.id
  rerender({ newArtworks: true })
}

leftSel.addEventListener('change',  () => rerender({ newArtworks: true }))
rightSel.addEventListener('change', () => rerender({ newArtworks: true }))
modeSel.addEventListener('change',  () => {
  document.body.dataset.mode = modeSel.value
  if (leftWork)  leftViewer.applyEffect(modeSel.value)
  if (rightWork) rightViewer.applyEffect(modeSel.value)
})
randomBtn.addEventListener('click', randomize)

rerender()
