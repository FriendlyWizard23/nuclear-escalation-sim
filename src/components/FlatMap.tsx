import { useEffect, useMemo, useRef, useState } from 'react'
import { getBlastRings } from '../engine/casualtyModel'
import type { Country, Strike } from '../engine/escalationEngine'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const KM_TO_DEGREES = 1 / 111

/** How long (ms) blast rings stay before being removed */
const RING_LIFETIME_MS = 18000

/** How long (ms) completed-strike trail lines stay visible */
const TRAIL_LIFETIME_MS = 55000

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface FlatMapProps {
  aggressorId: string | null
  targetId: string | null
  activeStrikes: Strike[]
  completedStrikes: Strike[]
  countries: Country[]
  clockSpeed: number
}

interface GeoFeature {
  type: string
  geometry: {
    type: string
    coordinates: number[][][] | number[][][][]
  }
}

interface TrailEntry {
  strike: Strike
  startX: number
  startY: number
  endX: number
  endY: number
}

interface RingEntry {
  id: string
  cx: number
  cy: number
  maxR: number // in SVG px
  rings: Array<{ color: string; maxR: number }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Simple equirectangular projection: maps lat/lng to SVG coordinates */
function project(lat: number, lng: number, width: number, height: number): [number, number] {
  const x = ((lng + 180) / 360) * width
  const y = ((90 - lat) / 180) * height
  return [x, y]
}

/**
 * Deterministic jitter (same as Globe.tsx) so arc endpoints match the 3D view.
 */
function computeJitter(strikeId: string, which: 'launch' | 'impact'): [number, number] {
  let hash = 0
  const seed = strikeId + which
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  const latOffset = ((hash & 0xff) - 128) / 128 * 0.75
  const lngOffset = (((hash >> 8) & 0xff) - 128) / 128 * 0.75
  return [latOffset, lngOffset]
}

/**
 * Converts a GeoJSON polygon ring (array of [lng, lat]) to an SVG path string.
 */
function ringToPath(ring: number[][], width: number, height: number): string {
  return ring
    .map(([lng, lat], i) => {
      const [x, y] = project(lat, lng, width, height)
      return i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ') + ' Z'
}

/**
 * Returns the SVG quadratic Bézier path string for a missile arc.
 * The control point is lifted proportionally to the distance so long-range
 * ICBMs arc visibly higher than regional missiles.
 */
function arcPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  svgHeight: number,
): string {
  const midX = (startX + endX) / 2
  const midY = (startY + endY) / 2
  const dx = endX - startX
  const dy = endY - startY
  const dist = Math.sqrt(dx * dx + dy * dy)
  // Lift proportional to distance, capped at 25% of SVG height
  const lift = Math.min(svgHeight * 0.25, dist * 0.35)
  const cx = midX
  const cy = midY - lift
  return `M ${startX.toFixed(1)},${startY.toFixed(1)} Q ${cx.toFixed(1)},${cy.toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`
}

function strikeColor(side: Strike['side']): string {
  return side === 'attacker' ? '#ff4b3e' : '#5db4ff'
}

function trailStrokeColor(side: Strike['side']): string {
  return side === 'attacker' ? 'rgba(255,75,62,0.45)' : 'rgba(93,180,255,0.45)'
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function FlatMap({
  aggressorId,
  targetId,
  activeStrikes,
  completedStrikes,
  countries,
  clockSpeed: _clockSpeed, // available for future use (e.g. animation timing)
}: FlatMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight })
  const [countryPaths, setCountryPaths] = useState<string[]>([])

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

  const { width, height } = dimensions

  // ── Load GeoJSON country borders ───────────────────────────────────────────
  useEffect(() => {
    fetch(
      'https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson',
    )
      .then((r) => r.json())
      .then((data) => {
        const paths: string[] = []
        for (const feature of (data as any).features ?? []) {
          const { type, coordinates } = feature.geometry as GeoFeature['geometry']
          if (type === 'Polygon') {
            for (const ring of coordinates as number[][][]) {
              paths.push(ringToPath(ring, width, height))
            }
          } else if (type === 'MultiPolygon') {
            for (const polygon of coordinates as number[][][][]) {
              for (const ring of polygon) {
                paths.push(ringToPath(ring, width, height))
              }
            }
          }
        }
        setCountryPaths(paths)
      })
      .catch(() => { /* no borders — map still works */ })
  // Re-project when dimensions change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height])

  // ── Country lookup map ─────────────────────────────────────────────────────
  const countriesById = useMemo(
    () => new Map(countries.map((c) => [c.id, c])),
    [countries],
  )

  // ── Active arc paths ───────────────────────────────────────────────────────
  const activeArcPaths = useMemo(() => {
    return activeStrikes.map((strike) => {
      const launch = countriesById.get(strike.aggressorId)
      const target = countriesById.get(strike.targetId)
      if (!launch || !target) return null

      const [jLLat, jLLng] = computeJitter(strike.id, 'launch')
      const [jILat, jILng] = computeJitter(strike.id, 'impact')

      const [sx, sy] = project(launch.lat + jLLat, launch.lng + jLLng, width, height)
      const [ex, ey] = project(target.lat + jILat, target.lng + jILng, width, height)

      return {
        id: strike.id,
        d: arcPath(sx, sy, ex, ey, height),
        color: strikeColor(strike.side),
      }
    }).filter(Boolean) as Array<{ id: string; d: string; color: string }>
  }, [activeStrikes, countriesById, width, height])

  // ── Persistent trail lines (completed strikes) ────────────────────────────
  const trailMapRef = useRef<Map<string, TrailEntry>>(new Map())
  const trailTimersRef = useRef<Map<string, number>>(new Map())
  const [trails, setTrails] = useState<TrailEntry[]>([])

  useEffect(() => {
    let changed = false
    for (const strike of completedStrikes) {
      if (trailMapRef.current.has(strike.id)) continue

      const launch = countriesById.get(strike.aggressorId)
      const target = countriesById.get(strike.targetId)
      if (!launch || !target) continue

      const [jLLat, jLLng] = computeJitter(strike.id, 'launch')
      const [jILat, jILng] = computeJitter(strike.id, 'impact')

      const [sx, sy] = project(launch.lat + jLLat, launch.lng + jLLng, width, height)
      const [ex, ey] = project(target.lat + jILat, target.lng + jILng, width, height)

      trailMapRef.current.set(strike.id, { strike, startX: sx, startY: sy, endX: ex, endY: ey })
      changed = true

      const timerId = window.setTimeout(() => {
        trailMapRef.current.delete(strike.id)
        trailTimersRef.current.delete(strike.id)
        setTrails(Array.from(trailMapRef.current.values()))
      }, TRAIL_LIFETIME_MS)

      trailTimersRef.current.set(strike.id, timerId)
    }
    if (changed) setTrails(Array.from(trailMapRef.current.values()))
  }, [completedStrikes, countriesById, width, height])

  // ── Blast rings ────────────────────────────────────────────────────────────
  // Convert km radius to SVG pixels using a rough scale factor
  const kmToPixels = (width / 360) * KM_TO_DEGREES * 111

  const ringMapRef = useRef<Map<string, RingEntry>>(new Map())
  const ringTimersRef = useRef<Map<string, number>>(new Map())
  const [ringEntries, setRingEntries] = useState<RingEntry[]>([])

  useEffect(() => {
    let addedNew = false
    for (const strike of completedStrikes) {
      if (ringMapRef.current.has(strike.id)) continue

      const target = countriesById.get(strike.targetId)
      if (!target) continue

      const [jLat, jLng] = computeJitter(strike.id, 'impact')
      const [cx, cy] = project(target.lat + jLat, target.lng + jLng, width, height)

      const blastRings = getBlastRings(strike.yield_kt)
      const maxRingKm = blastRings[blastRings.length - 1]?.radius_km ?? 10

      ringMapRef.current.set(strike.id, {
        id: strike.id,
        cx,
        cy,
        maxR: maxRingKm * kmToPixels,
        rings: blastRings.map((r) => ({ color: r.color, maxR: r.radius_km * kmToPixels })),
      })
      addedNew = true

      const timerId = window.setTimeout(() => {
        ringMapRef.current.delete(strike.id)
        ringTimersRef.current.delete(strike.id)
        setRingEntries(Array.from(ringMapRef.current.values()))
      }, RING_LIFETIME_MS)

      ringTimersRef.current.set(strike.id, timerId)
    }
    if (addedNew) setRingEntries(Array.from(ringMapRef.current.values()))
  }, [completedStrikes, countriesById, width, height, kmToPixels])

  // Clear all timers on unmount
  useEffect(() => {
    return () => {
      trailTimersRef.current.forEach((id) => window.clearTimeout(id))
      ringTimersRef.current.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  // ── Country marker positions ───────────────────────────────────────────────
  const aggressorPos = aggressorId ? countriesById.get(aggressorId) : null
  const targetPos = targetId ? countriesById.get(targetId) : null

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="globe-container flatmap-container" ref={containerRef}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', background: '#020509' }}
        aria-label="Flat 2D world map showing nuclear strike trajectories"
      >
        {/* ── Ocean fill ─────────────────────────────────────────────────── */}
        <rect width={width} height={height} fill="#030c1a" />

        {/* ── Country borders ─────────────────────────────────────────────── */}
        <g opacity={0.6}>
          {countryPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="rgba(20,40,30,0.85)"
              stroke="rgba(61,255,154,0.35)"
              strokeWidth={0.5}
            />
          ))}
        </g>

        {/* ── Country labels ──────────────────────────────────────────────── */}
        {countries.map((c) => {
          const [x, y] = project(c.lat, c.lng, width, height)
          return (
            <text
              key={c.id}
              x={x}
              y={y}
              textAnchor="middle"
              fontSize={width > 1000 ? 8 : 6}
              fill="rgba(94,255,166,0.55)"
              fontFamily="'JetBrains Mono', monospace"
              pointerEvents="none"
            >
              {c.name.toUpperCase()}
            </text>
          )
        })}

        {/* ── Persistent trail lines (completed strikes) ─────────────────── */}
        {trails.map((t) => (
          <path
            key={`trail-${t.strike.id}`}
            d={arcPath(t.startX, t.startY, t.endX, t.endY, height)}
            fill="none"
            stroke={trailStrokeColor(t.strike.side)}
            strokeWidth={1.2}
          />
        ))}

        {/* ── Active in-flight arcs ────────────────────────────────────────── */}
        {activeArcPaths.map((arc) => (
          <path
            key={`arc-${arc.id}`}
            d={arc.d}
            fill="none"
            stroke={arc.color}
            strokeWidth={1.5}
            opacity={0.85}
          />
        ))}

        {/* ── Blast rings (animated expand) ───────────────────────────────── */}
        {ringEntries.map((entry) =>
          entry.rings.map((ring, i) => (
            <circle
              key={`${entry.id}-ring-${i}`}
              cx={entry.cx}
              cy={entry.cy}
              r={0}
              fill="none"
              stroke={ring.color}
              strokeWidth={1.5}
            >
              <animate
                attributeName="r"
                from={0}
                to={ring.maxR}
                dur={`${RING_LIFETIME_MS / 1000}s`}
                fill="freeze"
              />
              <animate
                attributeName="opacity"
                values="0.8;0.4;0"
                keyTimes="0;0.5;1"
                dur={`${RING_LIFETIME_MS / 1000}s`}
                fill="freeze"
              />
            </circle>
          )),
        )}

        {/* ── Country markers ──────────────────────────────────────────────── */}
        {aggressorPos && (() => {
          const [x, y] = project(aggressorPos.lat, aggressorPos.lng, width, height)
          return <circle key="agg" cx={x} cy={y} r={5} fill="#ff4b3e" opacity={0.9} />
        })()}
        {targetPos && (() => {
          const [x, y] = project(targetPos.lat, targetPos.lng, width, height)
          return <circle key="tgt" cx={x} cy={y} r={5} fill="#4eddff" opacity={0.9} />
        })()}
      </svg>
    </div>
  )
}
