import * as THREE from 'three'

// ── Shader chunks ──────────────────────────────────────────────────────────────

const VERT_BASE = `
varying vec2 vUv;
varying vec3 vNormal;
uniform float uTime;
uniform float uDisplace;
uniform sampler2D uDispMap;
uniform int uEffect;
void main() {
  vUv = uv;
  vNormal = normal;
  vec3 pos = position;

  if (uEffect == 1) {
    // 3D Relief – displacement from texture energy map
    float d = texture2D(uDispMap, uv).r;
    pos += normal * d * uDisplace;
  } else if (uEffect == 2) {
    // Ripple – animated sine wave
    float wave = sin(pos.x * 8.0 + uTime * 2.0) * 0.04
               + sin(pos.y * 6.0 + uTime * 1.6) * 0.03;
    pos += normal * wave;
  } else if (uEffect == 3) {
    // Breathe – gentle pulsing scale
    float pulse = 1.0 + sin(uTime * 0.9) * 0.025;
    pos.xy *= pulse;
  } else if (uEffect == 4) {
    // Crumple – random-ish noise displacement
    float nx = sin(pos.x * 20.0 + uTime * 0.3) * cos(pos.y * 18.0) * 0.03;
    float ny = cos(pos.y * 22.0 + uTime * 0.4) * sin(pos.x * 16.0) * 0.03;
    pos += normal * (nx + ny);
  }
  // effect 5 (Spin) handled by rotation in JS

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const FRAG_BASE = `
varying vec2 vUv;
varying vec3 vNormal;
uniform sampler2D uMap;
uniform float uTime;
uniform int uEffect;

void main() {
  vec4 col = texture2D(uMap, vUv);

  if (uEffect == 5) {
    // Palette posterise – reduce colour depth to expose dominant palette
    float levels = 5.0;
    col.rgb = floor(col.rgb * levels) / levels;
  } else if (uEffect == 6) {
    // Edge glow – crude luminance edge detect
    float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
    float edge = abs(dFdx(lum)) + abs(dFdy(lum));
    edge = clamp(edge * 80.0, 0.0, 1.0);
    vec3 base = mix(col.rgb * 0.3, col.rgb, 1.0 - edge);
    col.rgb = mix(base, vec3(1.0, 0.85, 0.2), edge * 0.7);
  }

  gl_FragColor = col;
}
`

// ── Effect registry ─────────────────────────────────────────────────────────
export const EFFECTS = [
  { id: 'image',      label: 'Image',              vertIdx: 0, fragIdx: 0, segs: 1,   displace: 0 },
  { id: 'relief',     label: '3D Relief',          vertIdx: 1, fragIdx: 0, segs: 256, displace: 0.12 },
  { id: 'ripple',     label: 'Ripple',             vertIdx: 2, fragIdx: 0, segs: 128, displace: 0 },
  { id: 'breathe',    label: 'Breathe',            vertIdx: 3, fragIdx: 0, segs: 1,   displace: 0 },
  { id: 'crumple',    label: 'Crumple',            vertIdx: 4, fragIdx: 0, segs: 128, displace: 0 },
  { id: 'posterise',  label: 'Palette Posterise',  vertIdx: 0, fragIdx: 5, segs: 1,   displace: 0 },
  { id: 'edge',       label: 'Edge Glow',          vertIdx: 0, fragIdx: 6, segs: 1,   displace: 0 },
  { id: 'spin',       label: 'Spin',               vertIdx: 0, fragIdx: 0, segs: 1,   displace: 0, spin: true },
]

// ── Viewer factory ───────────────────────────────────────────────────────────
export function initViewer(mountEl) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#0b0b0b')

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
  camera.position.set(0, 0, 2.4)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  mountEl.appendChild(renderer.domElement)

  const light = new THREE.DirectionalLight(0xffffff, 1.15)
  light.position.set(1.5, 1, 2)
  scene.add(light)
  scene.add(new THREE.AmbientLight(0xffffff, 0.4))

  const group = new THREE.Group()
  scene.add(group)

  let mesh = null
  let animId = null
  let currentEffect = EFFECTS[0]

  function resize() {
    const w = mountEl.clientWidth
    const h = mountEl.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(mountEl)
  resize()

  const clock = new THREE.Clock()

  function animate() {
    animId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    if (mesh) {
      if (mesh.material.uniforms) {
        mesh.material.uniforms.uTime.value = t
      }
      if (currentEffect.spin) {
        mesh.rotation.y = t * 0.6
      } else {
        mesh.rotation.y = Math.sin(t * 0.35) * 0.06
      }
    }
    renderer.render(scene, camera)
  }
  animate()

  function fitCamera(planeW, planeH) {
    const fov = camera.fov * (Math.PI / 180)
    const distH = (planeH / 2) / Math.tan(fov / 2)
    const distW = (planeW / 2) / (Math.tan(fov / 2) * camera.aspect)
    camera.position.z = Math.max(distH, distW) * 1.12
    camera.updateProjectionMatrix()
  }

  let _colorTex = null
  let _dispTex = null
  let _planeW = 1.6
  let _planeH = 1.2

  async function setArtwork(artwork, feat, { mode }) {
    group.clear()
    mesh = null

    const imageUrl = artwork?.imageLocalSmall || artwork?.primaryImageSmall
    if (!imageUrl) return

    const texLoader = new THREE.TextureLoader()
    _colorTex = await texLoader.loadAsync(imageUrl)
    _colorTex.colorSpace = THREE.SRGBColorSpace
    _colorTex.minFilter = THREE.LinearMipmapLinearFilter
    _colorTex.magFilter = THREE.LinearFilter
    _colorTex.anisotropy = renderer.capabilities.getMaxAnisotropy()

    const imgW = _colorTex.image?.width || 1600
    const imgH = _colorTex.image?.height || 1100
    _planeH = 1.2
    _planeW = _planeH * (imgW / imgH)

    _dispTex = null
    if (feat?.textureMapUrl) {
      _dispTex = await texLoader.loadAsync(feat.textureMapUrl)
      _dispTex.colorSpace = THREE.NoColorSpace
    }

    applyEffect(mode)
    fitCamera(_planeW, _planeH)
  }

  function applyEffect(effectId) {
    const eff = EFFECTS.find(e => e.id === effectId) || EFFECTS[0]
    currentEffect = eff

    group.clear()
    mesh = null
    if (!_colorTex) return

    const geo = new THREE.PlaneGeometry(_planeW, _planeH, eff.segs, eff.segs)

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap:     { value: _colorTex },
        uDispMap: { value: _dispTex || _colorTex },
        uTime:    { value: 0 },
        uDisplace:{ value: eff.displace },
        uEffect:  { value: eff.vertIdx || eff.fragIdx },
      },
      vertexShader: VERT_BASE.replace('uEffect == 5', `uEffect == ${eff.vertIdx}`)
                             .replace('uEffect == 6', `uEffect == ${eff.vertIdx}`),
      fragmentShader: FRAG_BASE.replace('uEffect == 5', `uEffect == ${eff.fragIdx}`)
                               .replace('uEffect == 6', `uEffect == ${eff.fragIdx}`),
      extensions: { derivatives: true }
    })
    // Fix: pass correct integer for whichever shader branch is needed
    mat.uniforms.uEffect.value = Math.max(eff.vertIdx, eff.fragIdx)

    mesh = new THREE.Mesh(geo, mat)
    group.add(mesh)
  }

  return {
    setArtwork,
    applyEffect,
    destroy() {
      if (animId) cancelAnimationFrame(animId)
      ro.disconnect()
      renderer.dispose()
    }
  }
}
