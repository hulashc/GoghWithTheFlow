import * as THREE from 'three'

export function initViewer(mountEl) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#0b0b0b')

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
  camera.position.set(0, 0, 2.4)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  mountEl.appendChild(renderer.domElement)

  const light = new THREE.DirectionalLight(0xffffff, 1.2)
  light.position.set(1, 1, 2)
  scene.add(light)
  scene.add(new THREE.AmbientLight(0xffffff, 0.35))

  const group = new THREE.Group()
  scene.add(group)

  let mesh = null
  let animId = null

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

  function animate() {
    animId = requestAnimationFrame(animate)
    if (mesh) mesh.rotation.y = Math.sin(Date.now() * 0.00035) * 0.06
    renderer.render(scene, camera)
  }
  animate()

  async function setArtwork(artwork, feat, { mode }) {
    group.clear()
    mesh = null

    const imageUrl = artwork?.imageLocalSmall || artwork?.primaryImageSmall
    if (!imageUrl) return

    const texLoader = new THREE.TextureLoader()
    const colorTex = await texLoader.loadAsync(imageUrl)
    colorTex.colorSpace = THREE.SRGBColorSpace

    let dispTex = null
    if (mode === 'relief' && feat?.textureMapUrl) {
      dispTex = await texLoader.loadAsync(feat.textureMapUrl)
      dispTex.colorSpace = THREE.NoColorSpace
    }

    const geo = new THREE.PlaneGeometry(1.6, 1.1, mode === 'relief' ? 256 : 1, mode === 'relief' ? 256 : 1)
    const mat = new THREE.MeshStandardMaterial({
      map: colorTex,
      displacementMap: dispTex || null,
      displacementScale: mode === 'relief' ? 0.12 : 0,
      roughness: 0.9,
      metalness: 0.0
    })

    mesh = new THREE.Mesh(geo, mat)
    group.add(mesh)
  }

  return {
    setArtwork,
    destroy() {
      if (animId) cancelAnimationFrame(animId)
      ro.disconnect()
      renderer.dispose()
    }
  }
}
