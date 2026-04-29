import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import {
  getCategoryColor,
  COLOR_SELECTED,
  COLOR_SEARCH_HIT,
  dimColor,
} from '../../lib/colorMaps'
import type { Point, SearchHit, CategoryKey } from '../../lib/types'

const VIEW_HEIGHT = 10
const CENTER_X = 9.27
const CENTER_Y = 3.44
const ZOOM_MIN = 0.3
const ZOOM_MAX = 80
const FLY_ZOOM_TARGET = 8

type AtlasMapProps = {
  points: Point[]
  searchHits: SearchHit[]
  selectedId: string | null
  focusTarget: { x: number; y: number } | null
  activeCategories: Set<CategoryKey>
  onHover: (point: Point | null) => void
  onPointClick: (point: Point) => void
}

// Soft glow circle shader — matches the "City Breathing" data portrait pattern
const vertexShader = /* glsl */`
attribute vec3 aColor;
attribute float aSize;
attribute float aOpacity;
varying vec3 vColor;
varying float vOpacity;
void main() {
  vColor = aColor;
  vOpacity = aOpacity;
  gl_PointSize = aSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = /* glsl */`
varying vec3 vColor;
varying float vOpacity;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.0, d) * vOpacity;
  gl_FragColor = vec4(vColor, alpha);
}
`

function makePointsMat(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

export function AtlasMap({
  points,
  searchHits,
  selectedId,
  focusTarget,
  activeCategories,
  onHover,
  onPointClick,
}: AtlasMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const composerRef = useRef<EffectComposer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const pointsMeshRef = useRef<THREE.Points | null>(null)
  const highlightMeshRef = useRef<THREE.Points | null>(null)
  const rafRef = useRef<number>(0)

  // Live refs — RAF callbacks always see current props without restarts
  const pointsRef = useRef<Point[]>(points)
  const searchHitsRef = useRef<SearchHit[]>(searchHits)
  const selectedIdRef = useRef<string | null>(selectedId)
  const activeCategoriesRef = useRef<Set<CategoryKey>>(activeCategories)
  const onHoverRef = useRef(onHover)
  const onPointClickRef = useRef(onPointClick)

  pointsRef.current = points
  searchHitsRef.current = searchHits
  selectedIdRef.current = selectedId
  activeCategoriesRef.current = activeCategories
  onHoverRef.current = onHover
  onPointClickRef.current = onPointClick

  const flyTargetRef = useRef<{ x: number; y: number; zoom: number } | null>(null)
  const hoveredIdxRef = useRef<number>(-1)
  const panRef = useRef({ active: false, moved: false, lastX: 0, lastY: 0 })

  // ── Helpers ────────────────────────────────────────────────────────────────

  const worldUnitsPerPixel = useCallback(() => {
    const camera = cameraRef.current
    const container = containerRef.current
    if (!camera || !container) return 0
    return VIEW_HEIGHT / (container.clientHeight * camera.zoom)
  }, [])

  const mouseToWorld = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current
    const camera = cameraRef.current
    if (!container || !camera) return new THREE.Vector3()
    const rect = container.getBoundingClientRect()
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1
    return new THREE.Vector3(ndcX, ndcY, 0).unproject(camera)
  }, [])

  const findNearestPoint = useCallback((wx: number, wy: number): number => {
    const pts = pointsRef.current
    if (!pts.length) return -1
    const threshold = 5 * worldUnitsPerPixel()
    let bestIdx = -1
    let bestDist = threshold
    for (let i = 0; i < pts.length; i++) {
      const dx = pts[i].x - wx
      const dy = pts[i].y - wy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
    return bestIdx
  }, [worldUnitsPerPixel])

  // ── Color / opacity buffer rebuild ─────────────────────────────────────────

  const rebuildColors = useCallback(() => {
    const mesh = pointsMeshRef.current
    if (!mesh) return
    const geo = mesh.geometry
    const colorAttr = geo.attributes['aColor'] as THREE.BufferAttribute | undefined
    const opacityAttr = geo.attributes['aOpacity'] as THREE.BufferAttribute | undefined
    if (!colorAttr || !opacityAttr) return

    const pts = pointsRef.current
    const hits = searchHitsRef.current
    const selId = selectedIdRef.current
    const cats = activeCategoriesRef.current
    const isSearchActive = hits.length > 0
    const hasFilter = cats.size > 0
    const hitIds = new Set(hits.map((h) => h.id))

    const colorArr = colorAttr.array as Float32Array
    const opacityArr = opacityAttr.array as Float32Array

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      let rgba: [number, number, number, number]
      let opacity = 1.0

      if (p.id === selId) {
        rgba = COLOR_SELECTED
      } else if (isSearchActive) {
        if (hitIds.has(p.id)) {
          rgba = COLOR_SEARCH_HIT
        } else {
          rgba = dimColor(getCategoryColor(p.categories), 40)
          opacity = 0.12
        }
      } else if (hasFilter && !cats.has(p.categories[0] as CategoryKey)) {
        rgba = dimColor(getCategoryColor(p.categories), 30)
        opacity = 0.10
      } else {
        rgba = getCategoryColor(p.categories)
      }

      colorArr[i * 3]     = rgba[0] / 255
      colorArr[i * 3 + 1] = rgba[1] / 255
      colorArr[i * 3 + 2] = rgba[2] / 255
      opacityArr[i] = opacity
    }
    colorAttr.needsUpdate = true
    opacityAttr.needsUpdate = true
  }, [])

  // ── Highlight overlay (selected + search hits rendered larger) ─────────────

  const rebuildHighlight = useCallback(() => {
    const scene = sceneRef.current
    if (!scene) return
    const pts = pointsRef.current
    const hits = searchHitsRef.current
    const selId = selectedIdRef.current

    if (highlightMeshRef.current) {
      scene.remove(highlightMeshRef.current)
      highlightMeshRef.current.geometry.dispose()
      ;(highlightMeshRef.current.material as THREE.Material).dispose()
      highlightMeshRef.current = null
    }

    type HL = { x: number; y: number; color: [number, number, number]; size: number }
    const highlighted: HL[] = []
    const hitIds = new Set(hits.map((h) => h.id))

    for (const p of pts) {
      if (p.id === selId) {
        highlighted.push({ x: p.x, y: p.y, color: [COLOR_SELECTED[0] / 255, COLOR_SELECTED[1] / 255, COLOR_SELECTED[2] / 255], size: 16 })
      } else if (hitIds.has(p.id)) {
        highlighted.push({ x: p.x, y: p.y, color: [COLOR_SEARCH_HIT[0] / 255, COLOR_SEARCH_HIT[1] / 255, COLOR_SEARCH_HIT[2] / 255], size: 10 })
      }
    }

    if (!highlighted.length) return

    const n = highlighted.length
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const sizes = new Float32Array(n)
    const opacities = new Float32Array(n)

    highlighted.forEach((h, i) => {
      pos[i * 3] = h.x; pos[i * 3 + 1] = h.y; pos[i * 3 + 2] = 0.001
      col[i * 3] = h.color[0]; col[i * 3 + 1] = h.color[1]; col[i * 3 + 2] = h.color[2]
      sizes[i] = h.size
      opacities[i] = 1.0
    })

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1))

    const mesh = new THREE.Points(geo, makePointsMat())
    scene.add(mesh)
    highlightMeshRef.current = mesh
  }, [])

  // ── Mount — scene / renderer / composer / events ───────────────────────────

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Use clientWidth/clientHeight with fallback for SSR / hidden frames
    const w = container.clientWidth || 800
    const h = container.clientHeight || 600

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(w, h, false)
    renderer.setClearColor(0x0a0a0f)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.cursor = 'grab'
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const aspect = w / h
    const halfH = VIEW_HEIGHT / 2
    const halfW = halfH * aspect
    const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, -10, 10)
    camera.position.set(CENTER_X, CENTER_Y, 0)
    camera.zoom = 1
    camera.updateProjectionMatrix()
    cameraRef.current = camera

    // Empty base points mesh — positions + colors filled in the [points] effect
    const mesh = new THREE.Points(new THREE.BufferGeometry(), makePointsMat())
    scene.add(mesh)
    pointsMeshRef.current = mesh

    // Bloom post-processing
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 1.0, 0.5, 0.1))
    composerRef.current = composer

    const ro = new ResizeObserver(() => {
      const cw = container.clientWidth
      const ch = container.clientHeight
      if (!cw || !ch) return
      const asp = cw / ch
      const hH = VIEW_HEIGHT / 2
      const hW = hH * asp
      camera.left = -hW; camera.right = hW
      camera.top = hH; camera.bottom = -hH
      camera.updateProjectionMatrix()
      renderer.setSize(cw, ch, false)
      composer.setSize(cw, ch)
    })
    ro.observe(container)

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)
      const fly = flyTargetRef.current
      if (fly) {
        const dx = fly.x - camera.position.x
        const dy = fly.y - camera.position.y
        const dz = fly.zoom - camera.zoom
        camera.position.x += dx * 0.1
        camera.position.y += dy * 0.1
        camera.zoom += dz * 0.1
        camera.updateProjectionMatrix()
        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001 && Math.abs(dz) < 0.01) {
          flyTargetRef.current = null
        }
      }
      composer.render()
    }
    animate()

    // ── Input events on the Three.js canvas ──────────────────────────────────

    const canvas = renderer.domElement

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const before = mouseToWorld(e.clientX, e.clientY)
      const factor = 1 - e.deltaY * 0.001
      camera.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, camera.zoom * factor))
      camera.updateProjectionMatrix()
      const after = mouseToWorld(e.clientX, e.clientY)
      camera.position.x += before.x - after.x
      camera.position.y += before.y - after.y
      flyTargetRef.current = null
    }

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId)
      panRef.current = { active: true, moved: false, lastX: e.clientX, lastY: e.clientY }
      canvas.style.cursor = 'grabbing'
      flyTargetRef.current = null
    }

    const onPointerMove = (e: PointerEvent) => {
      if (panRef.current.active) {
        const dx = e.clientX - panRef.current.lastX
        const dy = e.clientY - panRef.current.lastY
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panRef.current.moved = true
        const wup = VIEW_HEIGHT / (container.clientHeight * camera.zoom)
        camera.position.x -= dx * wup
        camera.position.y += dy * wup
        panRef.current.lastX = e.clientX
        panRef.current.lastY = e.clientY
      } else {
        const wv = mouseToWorld(e.clientX, e.clientY)
        const idx = findNearestPoint(wv.x, wv.y)
        if (idx !== hoveredIdxRef.current) {
          hoveredIdxRef.current = idx
          onHoverRef.current(idx >= 0 ? pointsRef.current[idx] : null)
        }
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      canvas.releasePointerCapture(e.pointerId)
      panRef.current.active = false
      canvas.style.cursor = 'grab'
    }

    const onClick = (e: MouseEvent) => {
      if (panRef.current.moved) return
      const wv = mouseToWorld(e.clientX, e.clientY)
      const idx = findNearestPoint(wv.x, wv.y)
      if (idx >= 0) onPointClickRef.current(pointsRef.current[idx])
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('click', onClick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('click', onClick)
      composer.dispose()
      renderer.dispose()
      if (container.contains(canvas)) container.removeChild(canvas)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Rebuild geometry when points load ──────────────────────────────────────

  useEffect(() => {
    const mesh = pointsMeshRef.current
    if (!mesh || !points.length) return

    const n = points.length
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const sizes = new Float32Array(n)
    const opacities = new Float32Array(n)

    for (let i = 0; i < n; i++) {
      pos[i * 3] = points[i].x
      pos[i * 3 + 1] = points[i].y
      pos[i * 3 + 2] = 0

      const rgba = getCategoryColor(points[i].categories)
      col[i * 3]     = rgba[0] / 255
      col[i * 3 + 1] = rgba[1] / 255
      col[i * 3 + 2] = rgba[2] / 255
      sizes[i] = 5
      opacities[i] = 1.0
    }

    const geo = mesh.geometry
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1))
    geo.computeBoundingSphere()
  }, [points])

  // ── Recolor when selection / search / filter changes ──────────────────────

  useEffect(() => {
    rebuildColors()
    rebuildHighlight()
  }, [selectedId, searchHits, activeCategories, points, rebuildColors, rebuildHighlight])

  // ── Fly-to ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (focusTarget) {
      flyTargetRef.current = {
        x: focusTarget.x,
        y: focusTarget.y,
        zoom: Math.max(cameraRef.current?.zoom ?? 1, FLY_ZOOM_TARGET),
      }
    }
  }, [focusTarget])

  return <div ref={containerRef} className="w-full h-full" />
}
