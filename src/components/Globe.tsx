import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react'
import { getBlastRings } from '../engine/casualtyModel'
import type { Country, Strike } from '../engine/escalationEngine'

interface GlobeProps {
  aggressorId: string | null
  targetId: string | null
  activeStrikes: Strike[]
  completedStrikes: Strike[]
  countries: Country[]
  currentTime: number
}

const KM_TO_GLOBE_DEGREES = 1 / 111

export default function Globe({
  aggressorId,
  targetId,
  activeStrikes,
  completedStrikes,
  countries,
  currentTime,
}: GlobeProps) {
  const [GlobeRenderer, setGlobeRenderer] = useState<ComponentType<any> | null>(null)
  const [dimensions, setDimensions] = useState({ width: 900, height: 620 })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const globeRef = useRef<any>(null)

  useEffect(() => {
    let isMounted = true

    import('react-globe.gl').then((module) => {
      if (isMounted) {
        setGlobeRenderer(() => module.default)
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }

    const updateSize = () => {
      setDimensions({
        width: Math.max(320, element.clientWidth),
        height: Math.max(360, element.clientHeight),
      })
    }

    updateSize()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize)
      return () => window.removeEventListener('resize', updateSize)
    }

    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!globeRef.current || typeof globeRef.current.controls !== 'function') {
      return
    }

    const controls = globeRef.current.controls()
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.35
    controls.enablePan = false
  }, [GlobeRenderer])

  const countriesById = useMemo(
    () => new Map(countries.map((country) => [country.id, country])),
    [countries],
  )

  const arcs = useMemo(
    () =>
      activeStrikes
        .filter((strike) => strike.launchTime <= currentTime && strike.impactTime > currentTime)
        .map((strike) => {
          const launchCountry = countriesById.get(strike.aggressorId)
          const targetCountry = countriesById.get(strike.targetId)
          if (!launchCountry || !targetCountry) {
            return null
          }

          return {
            startLat: launchCountry.lat,
            startLng: launchCountry.lng,
            endLat: targetCountry.lat,
            endLng: targetCountry.lng,
            color: strike.wave % 2 === 1 ? '#ff5f56' : '#4ecdc4',
          }
        })
        .filter(Boolean),
    [activeStrikes, countriesById, currentTime],
  )

  const rings = useMemo(
    () =>
      completedStrikes
        .filter((strike) => strike.impactTime <= currentTime)
        .flatMap((strike) => {
          const targetCountry = countriesById.get(strike.targetId)
          if (!targetCountry) {
            return []
          }

          return getBlastRings(strike.yield_kt).map((ring) => ({
            lat: targetCountry.lat,
            lng: targetCountry.lng,
            color: ring.color,
            maxRadius: ring.radius_km * KM_TO_GLOBE_DEGREES,
          }))
        }),
    [completedStrikes, countriesById, currentTime],
  )

  const points = useMemo(() => {
    const pointData: Array<{ lat: number; lng: number; color: string; altitude: number; size: number }> = []
    const aggressor = aggressorId ? countriesById.get(aggressorId) : null
    const target = targetId ? countriesById.get(targetId) : null

    if (aggressor) {
      pointData.push({ lat: aggressor.lat, lng: aggressor.lng, color: '#ff5f56', altitude: 0.12, size: 0.45 })
    }

    if (target) {
      pointData.push({ lat: target.lat, lng: target.lng, color: '#51a8ff', altitude: 0.12, size: 0.45 })
    }

    return pointData
  }, [aggressorId, countriesById, targetId])

  return (
    <section className="panel globe-panel card" ref={containerRef}>
      <div className="globe-title-row">
        <div>
          <p className="eyebrow">3D globe view</p>
          <h2>Strike paths and impact rings</h2>
        </div>
      </div>

      {GlobeRenderer ? (
        <GlobeRenderer
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          arcsData={arcs}
          arcColor="color"
          arcDashLength={0.4}
          arcDashGap={0.2}
          arcDashAnimateTime={1500}
          ringsData={rings}
          ringColor="color"
          ringMaxRadius="maxRadius"
          ringPropagationSpeed={3}
          ringRepeatPeriod={800}
          pointsData={points}
          pointColor="color"
          pointAltitude="altitude"
          pointRadius="size"
        />
      ) : (
        <div className="globe-loading">Loading globe renderer…</div>
      )}
    </section>
  )
}
