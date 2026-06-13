import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react'
import { getBlastRings } from '../engine/casualtyModel'
import { CLOCK_SPEED, type Country, type Strike } from '../engine/escalationEngine'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** 1 km ≈ 1/111 degrees of latitude */
const KM_TO_GLOBE_DEGREES = 1 / 111

/**
 * How long (in simulation-seconds) blast rings remain on the globe before
 * being cleaned up.  At 2× clock speed this is 10 real seconds.
 * Prevents rings from accumulating forever and thrashing the GPU.
 */
const RING_LIFETIME_SIM_SECONDS = 20

/** Fraction of the arc length occupied by the "warhead head" trail */
const ARC_DASH_LENGTH = 0.04
const ARC_DASH_GAP = 1 - ARC_DASH_LENGTH

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface GlobeProps {
  aggressorId: string | null
  targetId: string | null
  /** Strikes that have launched but not yet impacted (pre-filtered by App) */
  activeStrikes: Strike[]
  /** Strikes that have already impacted (pre-filtered by App) */
  completedStrikes: Strike[]
  countries: Country[]
  // Note: currentTime is intentionally NOT passed here.
  // Arc animation is driven by react-globe.gl's built-in CSS animation
  // (arcDashAnimateTime), and ring cleanup is managed via setTimeout.
  // This decouples Globe from the 100ms tick loop, preventing unnecessary
  // re-renders and keeping arc animations smooth.
}

interface ArcDatum {
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  color: string
  altitude: number
  dashLength: number
  dashGap: number
  dashAnimateTime: number
}

interface RingDatum {
  lat: number
  lng: number
  color: string
  maxRadius: number
}

interface PointDatum {
  lat: number
  lng: number
  color: string
  altitude: number
  size: number
}

interface LabelDatum {
  lat: number
  lng: number
  text: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a small deterministic positional jitter for a strike's launch or
 * impact point.  Without this, multiple warheads from the same country all
 * stack on the exact same coordinate and "z-fight" (flicker/overlap).
 *
 * The hash is derived from the strike id so it is consistent across re-renders.
 * Maximum offset: ±0.75° ≈ ±83 km — enough to visually fan arcs apart.
 */
function computeJitter(strikeId: string, which: 'launch' | 'impact'): [number, number] {
  let hash = 0
  const seed = strikeId + which
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0 // coerce to 32-bit integer
  }
  const latOffset = ((hash & 0xff) - 128) / 128 * 0.75
  const lngOffset = (((hash >> 8) & 0xff) - 128) / 128 * 0.75
  return [latOffset, lngOffset]
}

/**
 * Computes an arc altitude that scales with great-circle distance.
 * Short-range strikes arc low; transcontinental ICBMs sweep dramatically high.
 * Range: 0.2 (regional) → 0.55 (antipodal), giving a realistic ICBM profile.
 */
function computeArcAltitude(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
): number {
  const dLat = endLat - startLat
  // Normalise longitude difference to the −180…180 range
  const dLng = ((endLng - startLng + 540) % 360) - 180
  const distDeg = Math.sqrt(dLat * dLat + dLng * dLng)
  return Math.min(0.55, Math.max(0.2, distDeg / 160))
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function Globe({
  aggressorId,
  targetId,
  activeStrikes,
  completedStrikes,
  countries,
}: GlobeProps) {
  // Lazy-loaded because react-globe.gl is large and contains top-level await
  const [GlobeRenderer, setGlobeRenderer] = useState<ComponentType<any> | null>(null)
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight })
  // GeoJSON features for the thin military-green country border overlay
  const [countryFeatures, setCountryFeatures] = useState<object[]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const globeRef = useRef<any>(null)

  // ── Module loading ─────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    import('react-globe.gl').then((mod) => {
      if (mounted) setGlobeRenderer(() => mod.default)
    })
    return () => {
      mounted = false
    }
  }, [])

  // Load low-res country polygons for the tactical border overlay.
  // Gracefully falls back to no overlay if the fetch fails.
  useEffect(() => {
    fetch(
      'https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson',
    )
      .then((r) => r.json())
      .then((data) => setCountryFeatures((data as any).features ?? []))
      .catch(() => {
        // No borders — the dark earth texture still looks tactical without them
      })
  }, [])

  // ── Responsive sizing ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const update = () => setDimensions({ width: el.clientWidth, height: el.clientHeight })
    update()

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => ro.disconnect()
    }

    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // ── Camera setup: slow auto-rotate, disable pan ───────────────────────────
  useEffect(() => {
    if (!globeRef.current || typeof globeRef.current.controls !== 'function') return
    const controls = globeRef.current.controls()
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.25
    controls.enablePan = false
  }, [GlobeRenderer])

  // ── Lookup map ─────────────────────────────────────────────────────────────
  const countriesById = useMemo(
    () => new Map(countries.map((c) => [c.id, c])),
    [countries],
  )

  // ── ARC CACHE ─────────────────────────────────────────────────────────────
  // Each arc datum object is created ONCE and never mutated.  This matters
  // because react-globe.gl drives arc animation via a CSS animation that
  // restarts whenever the datum object reference changes.  By preserving the
  // same object for the lifetime of the strike, the animated warhead head
  // continues its flight smoothly across re-renders.
  const arcCacheRef = useRef<Map<string, ArcDatum>>(new Map())

  const arcsData: ArcDatum[] = useMemo(() => {
    const activeIds = new Set(activeStrikes.map((s) => s.id))

    // Prune arcs for strikes that have landed or been cancelled
    for (const id of arcCacheRef.current.keys()) {
      if (!activeIds.has(id)) arcCacheRef.current.delete(id)
    }

    // Create arc datums for newly launched strikes (skip existing ones)
    for (const strike of activeStrikes) {
      if (arcCacheRef.current.has(strike.id)) continue // preserve to keep animation

      const launch = countriesById.get(strike.aggressorId)
      const target = countriesById.get(strike.targetId)
      if (!launch || !target) continue

      // Fan-out jitter prevents z-fighting when multiple warheads share the
      // same source/target centroid
      const [jLLat, jLLng] = computeJitter(strike.id, 'launch')
      const [jILat, jILng] = computeJitter(strike.id, 'impact')

      const sLat = launch.lat + jLLat
      const sLng = launch.lng + jLLng
      const eLat = target.lat + jILat
      const eLng = target.lng + jILng

      // Odd waves = aggressor (alert red); even waves = retaliating side (phosphor green)
      const color = strike.wave % 2 === 1 ? '#ff4b3e' : '#3dff9a'

      // The dash animates along the full arc in exactly one flight time
      // (converted from sim-seconds to real milliseconds at the 2× clock rate)
      const dashAnimateTime = (strike.flightTime / CLOCK_SPEED) * 1000

      arcCacheRef.current.set(strike.id, {
        startLat: sLat,
        startLng: sLng,
        endLat: eLat,
        endLng: eLng,
        color,
        altitude: computeArcAltitude(sLat, sLng, eLat, eLng),
        dashLength: ARC_DASH_LENGTH,
        dashGap: ARC_DASH_GAP,
        dashAnimateTime,
      })
    }

    return Array.from(arcCacheRef.current.values())
  }, [activeStrikes, countriesById])

  // ── RING LIFECYCLE ────────────────────────────────────────────────────────
  // Blast rings are added when a strike completes and automatically removed
  // after RING_LIFETIME_SIM_SECONDS of sim-time (RING_LIFETIME_SIM_SECONDS /
  // CLOCK_SPEED real seconds).  This prevents the rings from accumulating
  // indefinitely and thrashing the GPU.
  const ringMapRef = useRef<Map<string, RingDatum[]>>(new Map())
  const ringTimersRef = useRef<Map<string, number>>(new Map())
  const [ringsData, setRingsData] = useState<RingDatum[]>([])

  useEffect(() => {
    const lifetimeMs = (RING_LIFETIME_SIM_SECONDS / CLOCK_SPEED) * 1000
    let addedNew = false

    for (const strike of completedStrikes) {
      if (ringMapRef.current.has(strike.id)) continue // already registered

      const target = countriesById.get(strike.targetId)
      if (!target) continue

      // Rings share the same jitter offset as the arc's end-point so they
      // appear exactly where the warhead "landed"
      const [jLat, jLng] = computeJitter(strike.id, 'impact')

      const rings: RingDatum[] = getBlastRings(strike.yield_kt).map((ring) => ({
        lat: target.lat + jLat,
        lng: target.lng + jLng,
        color: ring.color,
        maxRadius: ring.radius_km * KM_TO_GLOBE_DEGREES,
      }))

      ringMapRef.current.set(strike.id, rings)
      addedNew = true

      // Schedule automatic cleanup — prevents infinite accumulation
      const timerId = window.setTimeout(() => {
        ringMapRef.current.delete(strike.id)
        ringTimersRef.current.delete(strike.id)
        setRingsData(Array.from(ringMapRef.current.values()).flat())
      }, lifetimeMs)

      ringTimersRef.current.set(strike.id, timerId)
    }

    if (addedNew) {
      setRingsData(Array.from(ringMapRef.current.values()).flat())
    }
  }, [completedStrikes, countriesById])

  // Clear all ring timers when Globe unmounts (e.g. on reset)
  useEffect(() => {
    return () => {
      ringTimersRef.current.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  // ── COUNTRY MARKERS ───────────────────────────────────────────────────────
  const pointsData: PointDatum[] = useMemo(() => {
    const pts: PointDatum[] = []
    const aggressor = aggressorId ? countriesById.get(aggressorId) : null
    const tgt = targetId ? countriesById.get(targetId) : null

    if (aggressor) {
      pts.push({ lat: aggressor.lat, lng: aggressor.lng, color: '#ff4b3e', altitude: 0.15, size: 0.55 })
    }
    if (tgt) {
      pts.push({ lat: tgt.lat, lng: tgt.lng, color: '#4eddff', altitude: 0.15, size: 0.55 })
    }
    return pts
  }, [aggressorId, countriesById, targetId])

  // ── COUNTRY LABELS ────────────────────────────────────────────────────────
  // Small phosphor-green labels floating near each country centroid give the
  // globe a tactical intelligence-display feel.
  const labelsData: LabelDatum[] = useMemo(
    () => countries.map((c) => ({ lat: c.lat, lng: c.lng, text: c.name.toUpperCase() })),
    [countries],
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="globe-container" ref={containerRef}>
      {GlobeRenderer ? (
        <GlobeRenderer
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          // ── Earth texture: dark tactical landmasses ────────────────────
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          // ── Country borders: thin glowing green lines ─────────────────
          polygonsData={countryFeatures}
          polygonCapColor={() => 'rgba(0,0,0,0)'}              // transparent fill
          polygonSideColor={() => 'rgba(0,0,0,0)'}             // transparent sides
          polygonStrokeColor={() => 'rgba(61,255,154,0.3)'}    // phosphor-green border
          polygonsTransitionDuration={0}                       // instant (no morph on load)
          // ── Country name labels ───────────────────────────────────────
          labelsData={labelsData}
          labelLat="lat"
          labelLng="lng"
          labelText="text"
          labelColor={() => 'rgba(94,255,166,0.55)'}
          labelSize={0.6}
          labelDotRadius={0}
          labelAltitude={0.005}
          labelResolution={1}
          // ── Missile trajectory arcs ───────────────────────────────────
          //
          // Each arc uses react-globe.gl's built-in CSS animation
          // (arcDashAnimateTime) so the moving "warhead head" runs at a
          // smooth 60 fps rather than being jerked forward every 100ms by
          // React state updates.
          //
          // The arc datum object is created once (see arcCacheRef above) and
          // never re-created while the strike is in flight, so the animation
          // starts at the launch point and never restarts mid-flight.
          arcsData={arcsData}
          arcColor="color"
          arcAltitude="altitude"
          arcDashLength="dashLength"
          arcDashGap="dashGap"
          arcDashAnimateTime="dashAnimateTime"
          arcDashInitialGap={0}
          arcStroke={null}   // null = render as 3D tube (default; looks more cinematic)
          // ── Blast rings ───────────────────────────────────────────────
          //
          // ringRepeatPeriod is set very high so each ring expands only once
          // and then sits invisible.  The setTimeout in the ring effect above
          // removes the datum before the second cycle could ever play.
          ringsData={ringsData}
          ringColor="color"
          ringMaxRadius="maxRadius"
          ringPropagationSpeed={2.0}
          ringRepeatPeriod={99000}
          // ── Country markers ───────────────────────────────────────────
          pointsData={pointsData}
          pointColor="color"
          pointAltitude="altitude"
          pointRadius="size"
        />
      ) : (
        <div className="globe-loading">
          <span className="globe-loading-text">INITIALISING TACTICAL DISPLAY…</span>
        </div>
      )}
    </div>
  )
}
