import { useEffect, useMemo, useRef, useState } from 'react'
import CasualtyReadout from './components/CasualtyReadout'
import CountrySelector from './components/CountrySelector'
import DisclaimerBanner from './components/DisclaimerBanner'
import FlatMap from './components/FlatMap'
import SummaryScreen from './components/SummaryScreen'
import Timeline from './components/Timeline'
import arsenalsData from './data/arsenals.json'
import countriesData from './data/countries.json'
import {
  MAX_WAVES,
  buildSimulation,
  type ArsenalMap,
  type Country,
  type SimulationState,
  type Strike,
} from './engine/escalationEngine'

const countries = countriesData as Country[]
const arsenals = arsenalsData as ArsenalMap

function formatClock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  return new Date(whole * 1000).toISOString().slice(11, 19)
}

export default function App() {
  const [phase, setPhase] = useState<'selection' | 'simulation' | 'summary'>('selection')
  const [aggressorId, setAggressorId] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [simulation, setSimulation] = useState<SimulationState | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [clockSpeed, setClockSpeed] = useState(2)
  const intervalRef = useRef<number | null>(null)

  const totalDuration = simulation ? (simulation.events[simulation.events.length - 1]?.time ?? 0) : 0

  useEffect(() => {
    if (phase !== 'simulation' || !simulation || !isPlaying) return

    const tickSeconds = 0.1 * clockSpeed
    intervalRef.current = window.setInterval(() => {
      setCurrentTime((previousTime) => Math.min(totalDuration, Number((previousTime + tickSeconds).toFixed(1))))
    }, 100)

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [clockSpeed, isPlaying, phase, simulation, totalDuration])

  useEffect(() => () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current)
  }, [])

  useEffect(() => {
    if (phase === 'simulation' && simulation && totalDuration > 0 && currentTime >= totalDuration) {
      setIsPlaying(false)
      setPhase('summary')
    }
  }, [currentTime, phase, simulation, totalDuration])

  const launchedStrikes = useMemo<Strike[]>(
    () => simulation?.strikes.filter((strike) => strike.launchTime <= currentTime) ?? [],
    [currentTime, simulation],
  )

  const activeStrikes = useMemo<Strike[]>(
    () => simulation?.strikes.filter((strike) => strike.launchTime <= currentTime && strike.impactTime > currentTime) ?? [],
    [currentTime, simulation],
  )

  const completedStrikes = useMemo<Strike[]>(
    () => simulation?.strikes.filter((strike) => strike.impactTime <= currentTime) ?? [],
    [currentTime, simulation],
  )

  const scenarioTitle = useMemo(() => {
    if (!aggressorId || !targetId) return 'Select a scenario'
    const agg = countries.find((country) => country.id === aggressorId)?.name ?? aggressorId
    const tgt = countries.find((country) => country.id === targetId)?.name ?? targetId
    return `${agg.toUpperCase()} → ${tgt.toUpperCase()}`
  }, [aggressorId, targetId])

  const currentWave = useMemo(() => {
    const allStrikes = [...activeStrikes, ...completedStrikes]
    return allStrikes.length === 0 ? 1 : Math.max(...allStrikes.map((strike) => strike.wave))
  }, [activeStrikes, completedStrikes])

  const launchSimulation = () => {
    if (!aggressorId || !targetId || aggressorId === targetId) return
    const nextSimulation = buildSimulation(aggressorId, targetId, countries, arsenals, {})
    setSimulation(nextSimulation)
    setCurrentTime(0)
    setIsPlaying(true)
    setPhase('simulation')
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
  }

  return (
    <div className="app">
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
        <div className="simulation-fullbleed">
          <FlatMap
            activeStrikes={activeStrikes}
            aggressorId={aggressorId}
            clockSpeed={clockSpeed}
            completedStrikes={completedStrikes}
            countries={countries}
            currentTime={currentTime}
            launchedStrikes={launchedStrikes}
            targetId={targetId}
          />

          <header className="hud-header hud-panel">
            <div>
              <p className="eyebrow">PLAN A STYLE VISUALIZATION</p>
              <h1 className="hud-title">{scenarioTitle}</h1>
              <p className="hud-subtitle">{simulation.modelLabel}</p>
            </div>
            <div className="hud-header-controls">
              <span className="defcon-box">DEFCON {currentWave >= 2 ? '1' : '2'}</span>
              <button className="btn-secondary btn-abort" onClick={resetSimulation} type="button">
                ABORT DISPLAY
              </button>
            </div>
          </header>

          <aside className="hud-sidebar">
            <Timeline
              clockSpeed={clockSpeed}
              currentTime={currentTime}
              events={simulation.events}
              isPlaying={isPlaying}
              onSpeedChange={setClockSpeed}
              onToggle={() => setIsPlaying((playing) => !playing)}
              totalDuration={totalDuration}
            />
            <CasualtyReadout completedStrikes={completedStrikes} countries={countries} />
          </aside>

          <footer className="hud-statusbar">
            <span className={`status-item status-defcon status-defcon--${currentWave >= 2 ? '1' : '2'}`}>
              KLAXON {currentWave >= 2 ? 'CONTINUOUS' : 'ARMED'}
            </span>
            <span className="status-item status-divider">|</span>
            <span className="status-item">WAVE {currentWave}/{MAX_WAVES}</span>
            <span className="status-item status-divider">|</span>
            <span className="status-item">TRACE FAN {launchedStrikes.length.toString().padStart(3, '0')}</span>
            <span className="status-item status-divider">|</span>
            <span className="status-item status-impacts">CITY IMPACTS {completedStrikes.length.toString().padStart(3, '0')}</span>
            <span className="status-item status-divider">|</span>
            <span className="status-item status-clock">T+ {formatClock(currentTime)}</span>
            <span className="status-item status-divider status-right">|</span>
            <span className="status-item status-right">{clockSpeed}× SPEED · NO RECALL</span>
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
