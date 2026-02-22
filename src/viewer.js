import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export const EFFECTS = [
  { id: 'image',     label: 'Flat' },
  { id: 'relief',    label: '3D Relief' },
  { id: 'ripple',    label: 'Ripple' },
  { id: 'crumple',   label: 'Crumple' },
  { id: 'posterise', label: 'Posterise' },
  { id: 'edge',      label: 'Edge Glow' },
]

const VERT = `
varying vec2 vUv;
uniform float uTime;
uniform int uEffect;
uniform sampler2D uDispMap;
uniform float uDisplace;
void main() {
  vUv = uv;
  vec3 pos = position;
  if (uEffect == 1) {
    float d = texture2D(uDispMap, uv).r;
    pos += normal * d * uDisplace;
  } else if (uEffect == 2) {
    pos += normal * (sin(pos.x * 8.0 + uTime * 2.0) * 0.04 + sin(pos.y * 6.0 + uTime * 1.6) * 0.03);
  } else if (uEffect == 4) {
    float nx = sin(pos.x * 20.0 + uTime * 0.3) * cos(pos.y * 18.0) * 0.025;
    pos += normal * nx;
  }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const FRAG = `
varying vec2 vUv;
uniform sampler2D uMap;
uniform float uTime;
uniform int uEffect;
void main() {
  vec4 col = texture2D(uMap, vUv);
  if (uEffect == 5) {
    float levels = 5.0;
    col.rgb = floor(col.rgb * levels) / levels;
  } else if (uEffect == 6) {
    float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
    float edge = clamp((abs(dFdx(lum)) + abs(dFdy(lum))) * 80.0, 0.0, 1.0);
    col.rgb = mix(col.rgb * 0.3, col.rgb, 1.0 - edge);
    col.rgb = mix(col.rgb, vec3(1.0, 0.85, 0.2), edge * 0.7);
  }
  gl_FragColor = col;
}
`

const EFFECT_IDX = { image: 0, relief: 1, ripple: 2, crumple: 4, posterise: 5, edge: 6 }
const EFFECT_SEGS = { relief: 256, ripple: 128, crumple: 128 }

export function initViewer(canvas, wrapEl) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#0b0b0b')

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100)
  camera.position.set(0, 0, 2.8)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))

  // OrbitControls for zoom + rotate
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.minDistance = 0.4
  controls.maxDistance = 8
  controls.enablePan = false

  const light = new THREE.DirectionalLight(0xffffff, 1.2)
  light.position.set(1.5, 1, 2)
  scene.add(light)
  scene.add(new THREE.AmbientLight(0xffffff, 0.45))

  const group = new THREE.Group()
  scene.add(group)

  let mesh = null
  let clock = new THREE.Clock()

  function resize() {
    const w = wrapEl.clientWidth
    const h = wrapEl.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(wrapEl)
  resize()

  function animate() {
    requestAnimationFrame(animate)
    controls.update()
    if (mesh?.material?.uniforms) {
      mesh.material.uniforms.uTime.value = clock.getElapsedTime()
    }
    renderer.render(scene, camera)
  }
  animate()

  let _colorTex = null
  let _dispTex  = null
  let _planeW   = 1.6
  let _planeH   = 1.2
  let _currentEffect = 'image'

  function fitCamera(pw, ph) {
    const fov = camera.fov * (Math.PI / 180)
    const dH  = (ph / 2) / Math.tan(fov / 2)
    const dW  = (pw / 2) / (Math.tan(fov / 2) * camera.aspect)
    const z   = Math.max(dH, dW) * 1.18
    camera.position.set(0, 0, z)
    controls.reset()
  }

  function buildMesh(effectId) {
    _currentEffect = effectId
    group.clear()
    mesh = null
    if (!_colorTex) return

    const idx  = EFFECT_IDX[effectId] ?? 0
    const segs = EFFECT_SEGS[effectId] ?? 1
    const disp = effectId === 'relief' ? 0.12 : 0

    const geo = new THREE.PlaneGeometry(_planeW, _planeH, segs, segs)
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap:     { value: _colorTex },
        uDispMap: { value: _dispTex || _colorTex },
        uTime:    { value: 0 },
        uDisplace:{ value: disp },
        uEffect:  { value: idx },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      extensions: { derivatives: true }
    })
    mesh = new THREE.Mesh(geo, mat)
    group.add(mesh)
  }

  async function setArtwork(artwork, feat, effectId = 'image') {
    group.clear()
    mesh = null
    _colorTex = null
    _dispTex  = null

    const imageUrl = artwork?.imageLocalSmall || artwork?.primaryImageSmall
    if (!imageUrl) return

    const loader = new THREE.TextureLoader()
    _colorTex = await loader.loadAsync(imageUrl)
    _colorTex.colorSpace = THREE.SRGBColorSpace
    _colorTex.anisotropy = renderer.capabilities.getMaxAnisotropy()

    const iw = _colorTex.image?.width  || 800
    const ih = _colorTex.image?.height || 600
    _planeH = 1.2
    _planeW = _planeH * (iw / ih)

    if (feat?.textureMapUrl) {
      _dispTex = await loader.loadAsync(feat.textureMapUrl).catch(() => null)
      if (_dispTex) _dispTex.colorSpace = THREE.NoColorSpace
    }

    buildMesh(effectId)
    fitCamera(_planeW, _planeH)
  }

  function applyEffect(effectId) {
    buildMesh(effectId)
  }

  return { setArtwork, applyEffect, getCurrentEffect: () => _currentEffect }
}
