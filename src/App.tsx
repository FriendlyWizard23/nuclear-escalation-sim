import { useEffect, useMemo, useRef, useState } from 'react'
import CasualtyReadout from './components/CasualtyReadout'
import CountrySelector from './components/CountrySelector'
import DisclaimerBanner from './components/DisclaimerBanner'
import Globe from './components/Globe'
import SummaryScreen from './components/SummaryScreen'
import Timeline from './components/Timeline'
import alliancesData from './data/alliances.json'
import arsenalsData from './data/arsenals.json'
import countriesData from './data/countries.json'
import {
  CLOCK_SPEED,
  MAX_WAVES,
  buildSimulation,
  type AllianceMap,
  type ArsenalMap,
  type Country,
  type SimulationState,
  type Strike,
} from './engine/escalationEngine'

const countries = countriesData as Country[]
const arsenals = arsenalsData as ArsenalMap
const alliances = alliancesData as AllianceMap
const TICK_SECONDS = 0.1 * CLOCK_SPEED

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatClock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  return new Date(whole * 1000).toISOString().slice(11, 19)
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [phase, setPhase] = useState<'selection' | 'simulation' | 'summary'>('selection')
  const [aggressorId, setAggressorId] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [simulation, setSimulation] = useState<SimulationState | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const intervalRef = useRef<number | null>(null)

  const totalDuration = simulation ? (simulation.events[simulation.events.length - 1]?.time ?? 0) : 0

  // ── Tick loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'simulation' || !simulation || !isPlaying) return

    intervalRef.current = window.setInterval(() => {
      setCurrentTime((prev) => Math.min(totalDuration, Number((prev + TICK_SECONDS).toFixed(1))))
    }, 100)

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isPlaying, phase, simulation, totalDuration])

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [])

  // Advance to summary when simulation finishes
  useEffect(() => {
    if (phase === 'simulation' && simulation && totalDuration > 0 && currentTime >= totalDuration) {
      setIsPlaying(false)
      setPhase('summary')
    }
  }, [currentTime, phase, simulation, totalDuration])

  // ── Stabilised strike references ─────────────────────────────────────────
  // The Globe component must NOT re-render on every 100ms clock tick — only
  // when a strike actually launches or impacts.  We achieve this by returning
  // the previous array reference whenever the set of strike IDs hasn't
  // changed, so React's props comparison marks them as equal.
  const prevActiveRef = useRef<{ ids: Set<string>; items: Strike[] }>({ ids: new Set(), items: [] })

  const activeStrikes = useMemo<Strike[]>(() => {
    const next = simulation?.strikes.filter(
      (s) => s.launchTime <= currentTime && s.impactTime > currentTime,
    ) ?? []

    const nextIds = new Set(next.map((s) => s.id))
    const { ids: prevIds, items: prevItems } = prevActiveRef.current

    // Return the SAME reference if the set is unchanged (avoids Globe re-render)
    const sameSet =
      nextIds.size === prevIds.size && [...nextIds].every((id) => prevIds.has(id))
    if (sameSet) return prevItems

    prevActiveRef.current = { ids: nextIds, items: next }
    return next
  }, [currentTime, simulation])

  const prevCompletedRef = useRef<{ count: number; items: Strike[] }>({ count: 0, items: [] })

  const completedStrikes = useMemo<Strike[]>(() => {
    const next = simulation?.strikes.filter((s) => s.impactTime <= currentTime) ?? []

    if (next.length === prevCompletedRef.current.count) return prevCompletedRef.current.items

    prevCompletedRef.current = { count: next.length, items: next }
    return next
  }, [currentTime, simulation])

  // ── Scenario metadata ─────────────────────────────────────────────────────
  const scenarioTitle = useMemo(() => {
    if (!aggressorId || !targetId) return 'Select a scenario'
    const agg = countries.find((c) => c.id === aggressorId)?.name ?? aggressorId
    const tgt = countries.find((c) => c.id === targetId)?.name ?? targetId
    return `${agg.toUpperCase()} → ${tgt.toUpperCase()}`
  }, [aggressorId, targetId])

  // Current wave (for DEFCON display in the status bar)
  const currentWave = useMemo(() => {
    const all = [...activeStrikes, ...completedStrikes]
    return all.length === 0 ? 1 : Math.max(...all.map((s) => s.wave))
  }, [activeStrikes, completedStrikes])

  // ── Controls ──────────────────────────────────────────────────────────────
  const launchSimulation = () => {
    if (!aggressorId || !targetId || aggressorId === targetId) return
    const nextSim = buildSimulation(aggressorId, targetId, countries, arsenals, alliances)
    setSimulation(nextSim)
    setCurrentTime(0)
    setIsPlaying(true)
    setPhase('simulation')
    // Reset stable-ref caches for the new run
    prevActiveRef.current = { ids: new Set(), items: [] }
    prevCompletedRef.current = { count: 0, items: [] }
  }

  const resetSimulation = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setSimulation(null)
    setCurrentTime(0)
    setIsPlaying(false)
    setPhase('selection')
    prevActiveRef.current = { ids: new Set(), items: [] }
    prevCompletedRef.current = { count: 0, items: [] }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* Always-visible educational disclaimer */}
      <DisclaimerBanner />

      {phase === 'selection' && (
        <main className="app-content">
          <CountrySelector
            countries={countries}
            arsenals={arsenals}
            aggressorId={aggressorId}
            targetId={targetId}
            onAggressorChange={setAggressorId}
            onTargetChange={setTargetId}
            onLaunch={launchSimulation}
          />
        </main>
      )}

      {phase === 'simulation' && simulation && (
        // Full-bleed simulation view: globe fills the viewport, HUD panels
        // float as translucent overlays on top.
        <div className="simulation-fullbleed">
          {/* ── Globe ── */}
          <Globe
            aggressorId={aggressorId}
            targetId={targetId}
            activeStrikes={activeStrikes}
            completedStrikes={completedStrikes}
            countries={countries}
          />

          {/* ── Top-left HUD: scenario label + abort button ── */}
          <header className="hud-header hud-panel">
            <div>
              <p className="eyebrow">LIVE SIMULATION</p>
              <h1 className="hud-title">{scenarioTitle}</h1>
            </div>
            <button className="btn-secondary" onClick={resetSimulation} type="button">
              ◼ ABORT
            </button>
          </header>

          {/* ── Right sidebar: Timeline + Casualty readout ── */}
          <aside className="hud-sidebar">
            <Timeline
              currentTime={currentTime}
              totalDuration={totalDuration}
              isPlaying={isPlaying}
              onToggle={() => setIsPlaying((p) => !p)}
              events={simulation.events}
            />
            <CasualtyReadout completedStrikes={completedStrikes} countries={countries} />
          </aside>

          {/* ── Bottom status bar ── */}
          <footer className="hud-statusbar">
            <span className={`status-item status-defcon status-defcon--${currentWave >= 2 ? '1' : '2'}`}>
              ◈ DEFCON {currentWave >= 2 ? '1' : '2'}
            </span>
            <span className="status-item status-divider">|</span>
            <span className="status-item">WAVE {currentWave} / {MAX_WAVES}</span>
            <span className="status-item status-divider">|</span>
            <span className="status-item">
              LAUNCHES: {(activeStrikes.length + completedStrikes.length).toString().padStart(3, '0')}
            </span>
            <span className="status-item status-divider">|</span>
            <span className="status-item status-impacts">
              IMPACTS: {completedStrikes.length.toString().padStart(3, '0')}
            </span>
            <span className="status-item status-divider">|</span>
            <span className="status-item status-clock">T+ {formatClock(currentTime)}</span>
            <span className="status-item status-divider status-right">|</span>
            <span className="status-item status-right">2× CLOCK SPEED</span>
          </footer>
        </div>
      )}

      {phase === 'summary' && simulation && (
        <main className="app-content">
          <SummaryScreen countries={countries} onReset={resetSimulation} simulation={simulation} />
        </main>
      )}
    </div>
  )
}
