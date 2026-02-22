import { initViewer } from './viewer.js'

const DEFAULT_ARTISTS = [
  'Vincent van Gogh',
  'Claude Monet',
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

const leftViewer = initViewer(leftMount)
const rightViewer = initViewer(rightMount)

async function loadData() {
  // These are produced by the pipeline scripts into public/data/
  const [artworks, features] = await Promise.all([
    fetch('./data/artworks.json').then(r => r.json()).catch(() => ({ artworks: [] })),
    fetch('./data/features.json').then(r => r.json()).catch(() => ({ featuresById: {} }))
  ])
  return { artworks: artworks.artworks ?? [], featuresById: features.featuresById ?? {} }
}

function pickFirstForArtist(artworks, artist) {
  return artworks.find(a => a.artistDisplayName === artist) || null
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

  const mode = modeSel.value

  await leftViewer.setArtwork(leftWork, cache.featuresById[leftWork?.objectID], { mode })
  await rightViewer.setArtwork(rightWork, cache.featuresById[rightWork?.objectID], { mode })
}

leftSel.addEventListener('change', rerender)
rightSel.addEventListener('change', rerender)
modeSel.addEventListener('change', rerender)

rerender()
