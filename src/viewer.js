import * as THREE from 'three'

export function initViewer(mountEl) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#0b0b0b')

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
  camera.position.set(0, 0, 2.4)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  mountEl.appendChild(renderer.domElement)

  const light = new THREE.DirectionalLight(0xffffff, 1.15)
  light.position.set(1, 1, 2)
  scene.add(light)
  scene.add(new THREE.AmbientLight(0xffffff, 0.4))

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

  function fitCameraToMesh(planeW, planeH) {
    // Fit plane into view with a small margin.
    const fov = camera.fov * (Math.PI / 180)
    const margin = 1.12
    const distH = (planeH / 2) / Math.tan(fov / 2)
    const distW = (planeW / 2) / (Math.tan(fov / 2) * camera.aspect)
    camera.position.z = Math.max(distH, distW) * margin
    camera.updateProjectionMatrix()
  }

  async function setArtwork(artwork, feat, { mode }) {
    group.clear()
    mesh = null

    const imageUrl = artwork?.imageLocalSmall || artwork?.primaryImageSmall
    if (!imageUrl) return

    const texLoader = new THREE.TextureLoader()
    const colorTex = await texLoader.loadAsync(imageUrl)
    colorTex.colorSpace = THREE.SRGBColorSpace
    colorTex.minFilter = THREE.LinearMipmapLinearFilter
    colorTex.magFilter = THREE.LinearFilter
    colorTex.anisotropy = renderer.capabilities.getMaxAnisotropy()

    // Plane aspect should match the image aspect so it fills the panel correctly.
    const imgW = colorTex.image?.width || 1600
    const imgH = colorTex.image?.height || 1100
    const aspect = imgW / imgH

    const planeH = 1.2
    const planeW = planeH * aspect

    let dispTex = null
    if (mode === 'relief' && feat?.textureMapUrl) {
      dispTex = await texLoader.loadAsync(feat.textureMapUrl)
      dispTex.colorSpace = THREE.NoColorSpace
      dispTex.minFilter = THREE.LinearFilter
      dispTex.magFilter = THREE.LinearFilter
    }

    const segs = mode === 'relief' ? 256 : 1
    const geo = new THREE.PlaneGeometry(planeW, planeH, segs, segs)
    const mat = new THREE.MeshStandardMaterial({
      map: colorTex,
      displacementMap: dispTex || null,
      displacementScale: mode === 'relief' ? 0.12 : 0,
      roughness: 0.92,
      metalness: 0.0
    })

    mesh = new THREE.Mesh(geo, mat)
    group.add(mesh)

    fitCameraToMesh(planeW, planeH)
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
