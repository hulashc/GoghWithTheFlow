import { initViewer, EFFECTS } from './viewer.js'

let artworks = []
let featuresById = {}
let selectedId  = null
let currentEffect = 'image'
let viewer = null

// ── DOM refs ──
const sidebar       = document.getElementById('sidebar')
const analysis      = document.getElementById('analysis')
const headerMeta    = document.getElementById('headerMeta')
const artistFilter  = document.getElementById('artistFilter')
const effectBar     = document.getElementById('effectBar')
const canvas        = document.getElementById('viewerCanvas')
const viewerWrap    = document.getElementById('viewerWrap')

// ── Init viewer ──
viewer = initViewer(canvas, viewerWrap)

// ── Effect buttons ──
for (const e of EFFECTS) {
  const btn = document.createElement('button')
  btn.className = 'eff-btn' + (e.id === 'image' ? ' active' : '')
  btn.textContent = e.label
  btn.dataset.id = e.id
  btn.addEventListener('click', () => {
    currentEffect = e.id
    document.querySelectorAll('.eff-btn').forEach(b => b.classList.toggle('active', b.dataset.id === e.id))
    viewer.applyEffect(e.id)
  })
  effectBar.appendChild(btn)
}

// ── Load data ──
async function loadData() {
  const [aw, ft] = await Promise.all([
    fetch('./data/artworks.json').then(r => r.json()).catch(() => ({ artworks: [] })),
    fetch('./data/features.json').then(r => r.json()).catch(() => ({ featuresById: {} }))
  ])
  artworks = aw.artworks ?? []
  featuresById = ft.featuresById ?? {}

  // Populate artist filter
  const artists = [...new Set(artworks.map(a => a.artistDisplayName))].sort()
  for (const name of artists) {
    const o = document.createElement('option')
    o.value = name; o.textContent = name
    artistFilter.appendChild(o)
  }

  headerMeta.textContent = `${artworks.length} artworks — ${artists.length} artists`
  renderSidebar()
  if (artworks.length) selectArtwork(artworks[0].objectID)
}

// ── Sidebar ──
function renderSidebar() {
  sidebar.innerHTML = ''
  const filter = artistFilter.value

  // Group by artist
  const artists = [...new Set(artworks.map(a => a.artistDisplayName))].sort()
  for (const artist of artists) {
    if (filter !== 'all' && filter !== artist) continue

    const section = document.createElement('div')
    section.className = 'sidebar-section'
    section.textContent = artist
    sidebar.appendChild(section)

    const works = artworks.filter(a => a.artistDisplayName === artist)
    for (const w of works) {
      const card = document.createElement('div')
      card.className = 'thumb-card' + (w.objectID === selectedId ? ' active' : '')
      card.dataset.id = w.objectID

      const img = document.createElement('img')
      img.className = 'thumb-img'
      img.src = w.imageLocalSmall || w.primaryImageSmall || ''
      img.alt = w.title
      img.loading = 'lazy'

      const info = document.createElement('div')
      info.className = 'thumb-info'
      info.innerHTML = `<div class="thumb-title">${w.title}</div><div class="thumb-artist">${w.objectDate || ''}</div>`

      card.append(img, info)
      card.addEventListener('click', () => selectArtwork(w.objectID))
      sidebar.appendChild(card)
    }
  }
}

// ── Select artwork ──
async function selectArtwork(id) {
  selectedId = id
  const artwork = artworks.find(a => a.objectID === id)
  const feat    = featuresById[id]

  // Update sidebar active state
  document.querySelectorAll('.thumb-card').forEach(c => {
    c.classList.toggle('active', Number(c.dataset.id) === id)
  })

  // Load into viewer
  await viewer.setArtwork(artwork, feat, currentEffect)

  // Render analysis panel
  renderAnalysis(artwork, feat)

  // Scroll active card into view
  const activeCard = sidebar.querySelector('.thumb-card.active')
  activeCard?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

// ── Analysis panel ──
function renderAnalysis(artwork, feat) {
  if (!artwork) { analysis.innerHTML = '<p class="empty-state">No artwork selected.</p>'; return }

  const satPct = feat?.palette?.avgSaturation != null ? Math.round(feat.palette.avgSaturation * 100) : null
  const briPct = feat?.palette?.avgBrightness  != null ? Math.round(feat.palette.avgBrightness  * 100) : null
  const texPct = feat?.textureEnergy?.avgEdgeMagnitude != null ? Math.round(feat.textureEnergy.avgEdgeMagnitude * 100) : null
  const cohPct = feat?.strokeDirection?.coherence != null ? Math.round(feat.strokeDirection.coherence * 100) : null

  const swatches = (feat?.palette?.swatches || []).slice(0, 8)
  const hist     = feat?.strokeDirection?.hist || []

  const maxHist  = Math.max(...hist, 0.001)

  function bar(value, color = '#a78bfa', label = '') {
    const pct = value ?? 0
    return `
      <div class="metric">
        <div class="metric-row"><span>${label}</span><span>${value != null ? pct + '%' : 'n/a'}</span></div>
        <div class="metric-bar-bg"><div class="metric-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>`
  }

  // Auto-generated plain-English sentence
  function sentence() {
    if (satPct == null || texPct == null) return ''
    const colour = satPct > 55 ? 'highly saturated' : satPct > 35 ? 'moderately colourful' : 'muted'
    const texture = texPct > 45 ? 'heavy impasto brushwork' : texPct > 25 ? 'moderate texture' : 'smooth, fine technique'
    const direction = cohPct != null ? (cohPct > 55 ? 'strongly directional strokes' : cohPct > 30 ? 'varied stroke directions' : 'chaotic stroke energy') : ''
    return `This work shows <strong>${colour}</strong> palette with <strong>${texture}</strong>${direction ? ' and ' + direction : ''}.`
  }

  analysis.innerHTML = `
    <!-- Info -->
    <div>
      <div class="section-label">Artwork</div>
      <div class="art-title">${artwork.title}</div>
      <div class="art-artist">${artwork.artistDisplayName}</div>
      <div class="art-date-medium">${[artwork.objectDate, artwork.medium].filter(Boolean).join(' — ')}</div>
      ${artwork.objectURL ? `<a class="art-link" href="${artwork.objectURL}" target="_blank" rel="noreferrer">↗ View on The Met</a>` : ''}
    </div>

    <!-- Palette -->
    <div>
      <div class="section-label">Dominant Palette</div>
      <div class="palette-row">
        ${swatches.map(s => `<div class="swatch" style="background:${s.hex}" title="${s.hex}"></div>`).join('')}
        ${swatches.length === 0 ? '<span style="font-size:11px;color:var(--muted)">Run compute:features to see palette</span>' : ''}
      </div>
    </div>

    <!-- Colour metrics -->
    <div>
      <div class="section-label">Colour Metrics</div>
      ${bar(satPct, '#a78bfa', 'Avg Saturation')}
      ${bar(briPct, '#60a5fa', 'Avg Brightness')}
    </div>

    <!-- Texture -->
    <div>
      <div class="section-label">Texture Energy (Impasto Proxy)</div>
      ${bar(texPct, '#f59e0b', 'Edge Density')}
      <div style="font-size:10px;color:var(--muted);margin-top:4px">Higher = thicker, more energetic brushwork</div>
    </div>

    <!-- Stroke direction -->
    <div>
      <div class="section-label">Stroke Direction Histogram</div>
      ${hist.length ? `
        <div class="hist-wrap">
          ${hist.map(h => `<div class="hist-bar" style="height:${Math.round((h / maxHist) * 100)}%"></div>`).join('')}
        </div>
        <div style="font-size:10px;color:var(--muted);margin-top:4px">12 orientation bins (0–360°)</div>
        ${bar(cohPct, '#34d399', 'Stroke Coherence')}
        <div style="font-size:10px;color:var(--muted);margin-top:4px">Higher = strokes all point in similar direction (e.g. Van Gogh’s swirls)</div>
      ` : '<span style="font-size:11px;color:var(--muted)">Run compute:features to see histogram</span>'}
    </div>

    <!-- Analysis sentence -->
    ${sentence() ? `
    <div>
      <div class="section-label">Auto Analysis</div>
      <div style="font-size:12px;line-height:1.6">${sentence()}</div>
    </div>` : ''}
  `
}

// ── Event listeners ──
artistFilter.addEventListener('change', () => renderSidebar())

// ── Boot ──
loadData()
