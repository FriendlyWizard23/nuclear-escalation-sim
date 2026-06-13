import { useEffect, useMemo, useRef, useState } from 'react'
import { getBlastRings } from '../engine/casualtyModel'
import type { Country, Strike } from '../engine/escalationEngine'

interface FlatMapProps {
  aggressorId: string | null
  targetId: string | null
  launchedStrikes: Strike[]
  activeStrikes: Strike[]
  completedStrikes: Strike[]
  countries: Country[]
  currentTime: number
  clockSpeed: number
}

interface GeoFeature {
  geometry: {
    type: string
    coordinates: number[][][] | number[][][][]
  }
}

interface PanState {
  x: number
  y: number
}

const WORLD_WIDTH = 360
const WORLD_HEIGHT = 180
const BLAST_ANIMATION_SECONDS = 12
const ATTACKER_LINE = '#ff784a'
const DEFENDER_LINE = '#9bc4ff'
const COUNTRY_STROKE = 'rgba(119, 255, 176, 0.52)'
const COUNTRY_FILL = 'rgba(6, 20, 14, 0.84)'
const INCOMING_MARKER = '#fff170'

function project(lat: number, lng: number, width: number, height: number): [number, number] {
  const x = ((lng + 180) / 360) * width
  const y = ((90 - lat) / 180) * height
  return [x, y]
}

function ringToPath(ring: number[][], width: number, height: number) {
  return `${ring
    .map(([lng, lat], index) => {
      const [x, y] = project(lat, lng, width, height)
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')} Z`
}

function strikePalette(side: Strike['side']) {
  return side === 'attacker'
    ? { line: ATTACKER_LINE, glow: 'rgba(255, 120, 74, 0.25)' }
    : { line: DEFENDER_LINE, glow: 'rgba(155, 196, 255, 0.22)' }
}

function getArcGeometry(startX: number, startY: number, endX: number, endY: number, height: number) {
  const midX = (startX + endX) / 2
  const midY = (startY + endY) / 2
  const dx = endX - startX
  const dy = endY - startY
  const distance = Math.sqrt((dx ** 2) + (dy ** 2))
  const lift = Math.min(height * 0.36, Math.max(22, distance * 0.42))
  const controlX = midX
  const controlY = midY - lift

  return {
    controlX,
    controlY,
    path: `M ${startX.toFixed(2)},${startY.toFixed(2)} Q ${controlX.toFixed(2)},${controlY.toFixed(2)} ${endX.toFixed(2)},${endY.toFixed(2)}`,
  }
}

function getQuadraticPoint(
  startX: number,
  startY: number,
  controlX: number,
  controlY: number,
  endX: number,
  endY: number,
  t: number,
) {
  const inverse = 1 - t
  const x = (inverse ** 2 * startX) + (2 * inverse * t * controlX) + (t ** 2 * endX)
  const y = (inverse ** 2 * startY) + (2 * inverse * t * controlY) + (t ** 2 * endY)
  return { x, y }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function clampPan(pan: PanState, zoom: number, width: number, height: number) {
  const xLimit = Math.max(0, (width * (zoom - 1)) + (width * 0.12))
  const yLimit = Math.max(0, (height * (zoom - 1)) + (height * 0.12))

  return {
    x: clamp(pan.x, -xLimit, xLimit),
    y: clamp(pan.y, -yLimit, yLimit),
  }
}

export default function FlatMap({
  aggressorId,
  targetId,
  launchedStrikes,
  activeStrikes,
  completedStrikes,
  countries,
  currentTime,
  clockSpeed: _clockSpeed,
}: FlatMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: PanState } | null>(null)
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight })
  const [countryPaths, setCountryPaths] = useState<string[]>([])
  const [zoom, setZoom] = useState(1.2)
  const [pan, setPan] = useState<PanState>({ x: -window.innerWidth * 0.08, y: 0 })

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateSize = () => {
      const nextWidth = element.clientWidth
      const nextHeight = element.clientHeight
      setDimensions({ width: nextWidth, height: nextHeight })
      setPan((currentPan) => clampPan(currentPan, zoom, nextWidth, nextHeight))
    }

    updateSize()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateSize)
      observer.observe(element)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [zoom])

  const { width, height } = dimensions

  useEffect(() => {
    fetch('/world-countries.geojson')
      .then((response) => response.json())
      .then((data) => {
        const paths: string[] = []
        for (const feature of (data as { features?: GeoFeature[] }).features ?? []) {
          const { type, coordinates } = feature.geometry
          if (type === 'Polygon') {
            for (const ring of coordinates as number[][][]) paths.push(ringToPath(ring, width, height))
          }
          if (type === 'MultiPolygon') {
            for (const polygon of coordinates as number[][][][]) {
              for (const ring of polygon) paths.push(ringToPath(ring, width, height))
            }
          }
        }
        setCountryPaths(paths)
      })
      .catch(() => setCountryPaths([]))
  }, [width, height])

  const countriesById = useMemo(() => new Map(countries.map((country) => [country.id, country])), [countries])

  const launchedArcData = useMemo(
    () => launchedStrikes.map((strike) => {
      const [startX, startY] = project(strike.launchLat, strike.launchLng, width, height)
      const [endX, endY] = project(strike.targetLat, strike.targetLng, width, height)
      return {
        strike,
        startX,
        startY,
        endX,
        endY,
        ...getArcGeometry(startX, startY, endX, endY, height),
      }
    }),
    [height, launchedStrikes, width],
  )

  const activeMarkers = useMemo(
    () => activeStrikes.map((strike) => {
      const arc = launchedArcData.find((entry) => entry.strike.id === strike.id)
      if (!arc) return null

      const progress = clamp((currentTime - strike.launchTime) / Math.max(strike.flightTime, 0.001), 0, 1)
      const tailProgress = clamp(progress - 0.04, 0, 1)
      const point = getQuadraticPoint(arc.startX, arc.startY, arc.controlX, arc.controlY, arc.endX, arc.endY, progress)
      const tailPoint = getQuadraticPoint(arc.startX, arc.startY, arc.controlX, arc.controlY, arc.endX, arc.endY, tailProgress)
      return { strike, point, tailPoint }
    }).filter(Boolean) as Array<{ strike: Strike; point: { x: number; y: number }; tailPoint: { x: number; y: number } }>,
    [activeStrikes, currentTime, launchedArcData],
  )

  const impactBlooms = useMemo(
    () => completedStrikes.map((strike) => {
      const [cx, cy] = project(strike.targetLat, strike.targetLng, width, height)
      const rings = getBlastRings(strike.yield_kt)
      const pixelsPerKm = width / 40075
      const age = currentTime - strike.impactTime
      const animationProgress = clamp(age / BLAST_ANIMATION_SECONDS, 0, 1)
      return {
        strike,
        cx,
        cy,
        age,
        scorchRadius: Math.max(3, strike.blastRadiusKm * pixelsPerKm),
        animatedRings: rings.map((ring) => ({
          color: ring.color,
          opacity: ring.opacity,
          radius: Math.max(2, ring.radius_km * pixelsPerKm),
          animatedRadius: Math.max(2, ring.radius_km * pixelsPerKm * animationProgress),
        })),
      }
    }),
    [completedStrikes, currentTime, width],
  )

  const highlightedCountries = useMemo(() => {
    return [aggressorId, targetId]
      .map((countryId) => (countryId ? countriesById.get(countryId) : null))
      .filter(Boolean) as Country[]
  }, [aggressorId, countriesById, targetId])

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: pan,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return

    const nextPan = clampPan(
      {
        x: dragRef.current.origin.x + (event.clientX - dragRef.current.startX),
        y: dragRef.current.origin.y + (event.clientY - dragRef.current.startY),
      },
      zoom,
      width,
      height,
    )

    setPan(nextPan)
  }

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault()

    const rect = event.currentTarget.getBoundingClientRect()
    const cursorX = event.clientX - rect.left
    const cursorY = event.clientY - rect.top
    const nextZoom = clamp(zoom * (event.deltaY < 0 ? 1.12 : 0.9), 1, 7)

    const worldX = (cursorX - pan.x) / zoom
    const worldY = (cursorY - pan.y) / zoom
    const nextPan = clampPan(
      {
        x: cursorX - (worldX * nextZoom),
        y: cursorY - (worldY * nextZoom),
      },
      nextZoom,
      width,
      height,
    )

    setZoom(nextZoom)
    setPan(nextPan)
  }

  return (
    <div className="globe-container flatmap-container" ref={containerRef}>
      <svg
        aria-label="Flat world map showing persistent nuclear strike trajectories"
        height={height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        style={{ display: 'block', background: '#010204', cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        <rect width={width} height={height} fill="#010204" />

        <g transform={`translate(${pan.x.toFixed(2)} ${pan.y.toFixed(2)}) scale(${zoom.toFixed(3)})`}>
          <g opacity={0.92}>
            {countryPaths.map((path, index) => (
              <path
                key={index}
                d={path}
                fill={COUNTRY_FILL}
                stroke={COUNTRY_STROKE}
                strokeWidth={0.75}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>

          {launchedArcData.map(({ strike, path }) => {
            const palette = strikePalette(strike.side)
            return (
              <path
                key={`fan-${strike.id}`}
                d={path}
                fill="none"
                opacity={strike.impactTime <= currentTime ? 0.44 : 0.7}
                stroke={palette.line}
                strokeWidth={1.15}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}

          {launchedArcData.map(({ strike, path }) => {
            const palette = strikePalette(strike.side)
            return (
              <path
                key={`glow-${strike.id}`}
                d={path}
                fill="none"
                opacity={strike.impactTime <= currentTime ? 0.18 : 0.28}
                stroke={palette.glow}
                strokeWidth={3.2}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}

          {activeMarkers.map(({ strike, point, tailPoint }) => (
            <g key={`marker-${strike.id}`}>
              <line
                x1={tailPoint.x}
                x2={point.x}
                y1={tailPoint.y}
                y2={point.y}
                stroke={INCOMING_MARKER}
                strokeWidth={1.4}
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={point.x} cy={point.y} fill={INCOMING_MARKER} r={2.6} vectorEffect="non-scaling-stroke" />
            </g>
          ))}

          {impactBlooms.map(({ strike, cx, cy, scorchRadius, age, animatedRings }) => (
            <g key={`impact-${strike.id}`}>
              <circle
                cx={cx}
                cy={cy}
                fill="rgba(255, 245, 240, 0.88)"
                opacity={0.9}
                r={Math.max(2.6, scorchRadius * 0.24)}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={cx}
                cy={cy}
                fill="rgba(255, 102, 61, 0.2)"
                r={scorchRadius}
                stroke="rgba(255, 145, 110, 0.38)"
                strokeWidth={1.1}
                vectorEffect="non-scaling-stroke"
              />
              {age <= BLAST_ANIMATION_SECONDS && animatedRings.map((ring, index) => (
                <circle
                  key={`${strike.id}-ring-${index}`}
                  cx={cx}
                  cy={cy}
                  fill="none"
                  opacity={ring.opacity * (1 - (age / BLAST_ANIMATION_SECONDS))}
                  r={ring.animatedRadius}
                  stroke={ring.color}
                  strokeWidth={1.2}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          ))}

          {highlightedCountries.map((country) => {
            const [x, y] = project(country.lat, country.lng, width, height)
            const color = country.id === aggressorId ? ATTACKER_LINE : DEFENDER_LINE
            return (
              <g key={country.id}>
                <circle cx={x} cy={y} fill={color} opacity={0.9} r={4} vectorEffect="non-scaling-stroke" />
                <circle cx={x} cy={y} fill="none" opacity={0.65} r={8} stroke={color} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              </g>
            )
          })}
        </g>
      </svg>

      <div className="map-instructions hud-panel">
        <span>DRAG TO PAN</span>
        <span>SCROLL TO ZOOM</span>
        <span>YELLOW = INCOMING WARHEADS</span>
      </div>
    </div>
  )
}
