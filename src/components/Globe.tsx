import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react'
import { getBlastRings } from '../engine/casualtyModel'
import { type Country, type Strike } from '../engine/escalationEngine'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** 1 km ≈ 1/111 degrees of latitude */
const KM_TO_GLOBE_DEGREES = 1 / 111

/**
 * How long (in real milliseconds) blast rings stay visible before being removed.
 * Prevents rings from accumulating forever and thrashing the GPU.
 */
const RING_LIFETIME_MS = 18000

/**
 * How long (in real milliseconds) persistent tracer trails stay visible after
 * a missile impacts.  Trails accumulate on screen creating the dense Plan-A
 * blue-vs-red spray, then slowly fade out.
 */
const TRAIL_LIFETIME_MS = 55000

/**
 * Maximum number of missiles that get the expensive animated "warhead head"
 * effect at any one time.  Beyond this cap, additional in-flight missiles
 * show only a static trail (cheap to render) so frame rate stays smooth even
 * with hundreds of simultaneous trajectories.
 */
const MAX_ANIMATED_HEADS = 40

/** Fraction of the arc length occupied by the animated "warhead head" dash */
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
  /** Current playback speed multiplier (2 / 4 / 8 / 16) */
  clockSpeed: number
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

/**
 * Returns the display color for a strike based on which side launched it.
 * Attacker (first-strike) = alert red/orange; Defender (retaliating) = blue/cyan.
 * This mirrors the Plan A reference: red spray vs. blue spray.
 */
function strikeColor(side: Strike['side']): string {
  return side === 'attacker' ? '#ff4b3e' : '#5db4ff'
}

/**
 * Dimmed trail variant of the same color, used for the persistent glow lines.
 */
function trailColor(side: Strike['side']): string {
  return side === 'attacker'
    ? 'rgba(255, 75, 62, 0.38)'
    : 'rgba(93, 180, 255, 0.38)'
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
  clockSpeed,
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

  // ── ARC CACHE (animated "warhead heads") ──────────────────────────────────
  // Each arc datum object is created ONCE and never mutated while the strike
  // is in flight, so the CSS animation continues smoothly across re-renders.
  // The cache is cleared when clockSpeed changes because dashAnimateTime is
  // baked in — at a new speed, animations restart from scratch which is the
  // correct behaviour (the user changed speed deliberately).
  const arcCacheRef = useRef<Map<string, ArcDatum>>(new Map())
  const prevClockSpeedRef = useRef(clockSpeed)

  const arcsData: ArcDatum[] = useMemo(() => {
    // If speed changed, clear the cache so all arcs are recreated with the new
    // dashAnimateTime (i.e. animations restart at the new rate).
    if (prevClockSpeedRef.current !== clockSpeed) {
      arcCacheRef.current.clear()
      prevClockSpeedRef.current = clockSpeed
    }

    const activeIds = new Set(activeStrikes.map((s) => s.id))

    // Prune arcs for strikes that have landed or been cancelled
    for (const id of arcCacheRef.current.keys()) {
      if (!activeIds.has(id)) arcCacheRef.current.delete(id)
    }

    // The newest MAX_ANIMATED_HEADS active strikes get the moving warhead head.
    // Older in-flight strikes (beyond the cap) are handled by the trail layer
    // instead, keeping the renderer load bounded even during large salvos.
    const animatedIds = new Set(
      [...activeStrikes]
        .sort((a, b) => b.launchTime - a.launchTime)
        .slice(0, MAX_ANIMATED_HEADS)
        .map((s) => s.id),
    )

    // Create arc datums for newly launched strikes (skip existing ones)
    for (const strike of activeStrikes) {
      if (!animatedIds.has(strike.id)) continue  // beyond cap — handled by trail layer
      if (arcCacheRef.current.has(strike.id)) continue // preserve to keep animation

      const launch = countriesById.get(strike.aggressorId)
      const target = countriesById.get(strike.targetId)
      if (!launch || !target) continue

      const [jLLat, jLLng] = computeJitter(strike.id, 'launch')
      const [jILat, jILng] = computeJitter(strike.id, 'impact')

      const sLat = launch.lat + jLLat
      const sLng = launch.lng + jLLng
      const eLat = target.lat + jILat
      const eLng = target.lng + jILng

      // The dash animates along the full arc in exactly one flight time
      // (converted from sim-seconds to real milliseconds at the current speed)
      const dashAnimateTime = (strike.flightTime / clockSpeed) * 1000

      arcCacheRef.current.set(strike.id, {
        startLat: sLat,
        startLng: sLng,
        endLat: eLat,
        endLng: eLng,
        color: strikeColor(strike.side),
        altitude: computeArcAltitude(sLat, sLng, eLat, eLng),
        dashLength: ARC_DASH_LENGTH,
        dashGap: ARC_DASH_GAP,
        dashAnimateTime,
      })
    }

    // Remove arcs for strikes that are no longer animated (gone from activeIds or cap)
    for (const id of arcCacheRef.current.keys()) {
      if (!animatedIds.has(id)) arcCacheRef.current.delete(id)
    }

    return Array.from(arcCacheRef.current.values())
  }, [activeStrikes, countriesById, clockSpeed])

  // ── TRAIL ARCS (persistent full-arc lines) ────────────────────────────────
  // Completed strikes leave a static glowing tracer that remains visible for
  // TRAIL_LIFETIME_MS so the screen accumulates the dense Plan-A spray.
  // Active strikes beyond MAX_ANIMATED_HEADS also show as static trails
  // (performance fallback so 200+ in-flight missiles don't thrash the GPU).
  const trailMapRef = useRef<Map<string, ArcDatum>>(new Map())
  const trailTimersRef = useRef<Map<string, number>>(new Map())
  const [trailsData, setTrailsData] = useState<ArcDatum[]>([])

  useEffect(() => {
    // Strikes to show as static trails:
    //   1. Completed strikes (all of them)
    //   2. Active strikes whose animated head is capped out
    const activeIds = new Set(activeStrikes.map((s) => s.id))
    const animatedIds = new Set(
      [...activeStrikes]
        .sort((a, b) => b.launchTime - a.launchTime)
        .slice(0, MAX_ANIMATED_HEADS)
        .map((s) => s.id),
    )
    const trailCandidates = [
      ...completedStrikes,
      ...activeStrikes.filter((s) => !animatedIds.has(s.id)),
    ]

    let changed = false

    for (const strike of trailCandidates) {
      if (trailMapRef.current.has(strike.id)) continue // already registered

      const launch = countriesById.get(strike.aggressorId)
      const target = countriesById.get(strike.targetId)
      if (!launch || !target) continue

      const [jLLat, jLLng] = computeJitter(strike.id, 'launch')
      const [jILat, jILng] = computeJitter(strike.id, 'impact')

      const sLat = launch.lat + jLLat
      const sLng = launch.lng + jLLng
      const eLat = target.lat + jILat
      const eLng = target.lng + jILng

      // Static full arc — dashLength=1 means the whole arc is always visible
      trailMapRef.current.set(strike.id, {
        startLat: sLat,
        startLng: sLng,
        endLat: eLat,
        endLng: eLng,
        color: trailColor(strike.side),
        altitude: computeArcAltitude(sLat, sLng, eLat, eLng),
        dashLength: 1,
        dashGap: 0,
        dashAnimateTime: 0, // no animation — static line
      })
      changed = true

      // Schedule cleanup so trails fade away and don't accumulate forever.
      // Trails for still-active strikes get restarted if the strike completes.
      const timerId = window.setTimeout(() => {
        trailMapRef.current.delete(strike.id)
        trailTimersRef.current.delete(strike.id)
        setTrailsData(Array.from(trailMapRef.current.values()))
      }, TRAIL_LIFETIME_MS)

      trailTimersRef.current.set(strike.id, timerId)
    }

    // Clean up trail entries for strikes that are no longer in either list
    // (shouldn't normally happen, but keeps the map tidy)
    for (const id of trailMapRef.current.keys()) {
      const isCompleted = completedStrikes.some((s) => s.id === id)
      const isActiveTrail = activeIds.has(id) && !animatedIds.has(id)
      if (!isCompleted && !isActiveTrail) {
        const timer = trailTimersRef.current.get(id)
        if (timer) {
          window.clearTimeout(timer)
          trailTimersRef.current.delete(id)
        }
        trailMapRef.current.delete(id)
        changed = true
      }
    }

    if (changed) {
      setTrailsData(Array.from(trailMapRef.current.values()))
    }
  }, [activeStrikes, completedStrikes, countriesById])

  // ── RING LIFECYCLE ────────────────────────────────────────────────────────
  // Blast rings are added when a strike completes and automatically removed
  // after RING_LIFETIME_MS of real time.
  const ringMapRef = useRef<Map<string, RingDatum[]>>(new Map())
  const ringTimersRef = useRef<Map<string, number>>(new Map())
  const [ringsData, setRingsData] = useState<RingDatum[]>([])

  useEffect(() => {
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
      }, RING_LIFETIME_MS)

      ringTimersRef.current.set(strike.id, timerId)
    }

    if (addedNew) {
      setRingsData(Array.from(ringMapRef.current.values()).flat())
    }
  }, [completedStrikes, countriesById])

  // Clear all timers when Globe unmounts (e.g. on reset).
  // Placed after both timer refs are declared so there's no TDZ issue.
  useEffect(() => {
    return () => {
      trailTimersRef.current.forEach((id) => window.clearTimeout(id))
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
  const labelsData: LabelDatum[] = useMemo(
    () => countries.map((c) => ({ lat: c.lat, lng: c.lng, text: c.name.toUpperCase() })),
    [countries],
  )

  // ── Combined arcs: animated heads + static trails ─────────────────────────
  // react-globe.gl renders a single arcsData array; we merge both layers here.
  // Trail arcs come first (drawn underneath), animated heads on top.
  const allArcsData = useMemo(
    () => [...trailsData, ...arcsData],
    [trailsData, arcsData],
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
          // Combined layer: dim static trails (completed/capped) + bright
          // animated warhead heads (newest in-flight strikes, up to
          // MAX_ANIMATED_HEADS).  Trail arcs use dashLength=1/dashGap=0
          // so they are always fully visible.  Animated head arcs use
          // dashLength=0.04 and are driven by arcDashAnimateTime.
          arcsData={allArcsData}
          arcColor="color"
          arcAltitude="altitude"
          arcDashLength="dashLength"
          arcDashGap="dashGap"
          arcDashAnimateTime="dashAnimateTime"
          arcDashInitialGap={0}
          arcStroke={null}   // null = render as 3D tube (cinematic look)
          // ── Blast rings ───────────────────────────────────────────────
          //
          // ringRepeatPeriod is set very high so each ring expands only once.
          // The setTimeout in the ring effect removes the datum before the
          // second cycle could ever play.
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
