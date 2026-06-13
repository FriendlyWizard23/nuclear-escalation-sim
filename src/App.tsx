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
  buildSimulation,
  type AllianceMap,
  type ArsenalMap,
  type Country,
  type SimulationState,
} from './engine/escalationEngine'

const countries = countriesData as Country[]
const arsenals = arsenalsData as ArsenalMap
const alliances = alliancesData as AllianceMap
const TICK_SECONDS = 0.1 * CLOCK_SPEED

export default function App() {
  const [phase, setPhase] = useState<'selection' | 'simulation' | 'summary'>('selection')
  const [aggressorId, setAggressorId] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [simulation, setSimulation] = useState<SimulationState | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const intervalRef = useRef<number | null>(null)

  const totalDuration = simulation ? simulation.events[simulation.events.length - 1]?.time ?? 0 : 0

  useEffect(() => {
    if (phase !== 'simulation' || !simulation || !isPlaying) {
      return
    }

    intervalRef.current = window.setInterval(() => {
      setCurrentTime((previousTime) => Math.min(totalDuration, Number((previousTime + TICK_SECONDS).toFixed(1))))
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
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (phase === 'simulation' && simulation && totalDuration > 0 && currentTime >= totalDuration) {
      setIsPlaying(false)
      setPhase('summary')
    }
  }, [currentTime, phase, simulation, totalDuration])

  const activeStrikes = useMemo(
    () => simulation?.strikes.filter((strike) => strike.launchTime <= currentTime && strike.impactTime > currentTime) ?? [],
    [currentTime, simulation],
  )

  const completedStrikes = useMemo(
    () => simulation?.strikes.filter((strike) => strike.impactTime <= currentTime) ?? [],
    [currentTime, simulation],
  )

  const scenarioTitle = useMemo(() => {
    if (!aggressorId || !targetId) {
      return 'Select a scenario'
    }

    const aggressor = countries.find((country) => country.id === aggressorId)?.name ?? aggressorId
    const target = countries.find((country) => country.id === targetId)?.name ?? targetId
    return `${aggressor} → ${target}`
  }, [aggressorId, targetId])

  const launchSimulation = () => {
    if (!aggressorId || !targetId || aggressorId === targetId) {
      return
    }

    const nextSimulation = buildSimulation(aggressorId, targetId, countries, arsenals, alliances)
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

      <main className="app-content">
        {phase === 'selection' && (
          <CountrySelector
            countries={countries}
            arsenals={arsenals}
            aggressorId={aggressorId}
            targetId={targetId}
            onAggressorChange={setAggressorId}
            onTargetChange={setTargetId}
            onLaunch={launchSimulation}
          />
        )}

        {phase === 'simulation' && simulation && (
          <section className="simulation-shell">
            <header className="simulation-header card panel">
              <div>
                <p className="eyebrow">Live simulation</p>
                <h1>{scenarioTitle}</h1>
              </div>
              <button className="btn-secondary" onClick={resetSimulation} type="button">
                Reset
              </button>
            </header>

            <section className="simulation-screen">
              <Globe
                aggressorId={aggressorId}
                targetId={targetId}
                activeStrikes={activeStrikes}
                completedStrikes={completedStrikes}
                countries={countries}
                currentTime={currentTime}
              />
              <div className="side-column">
                <Timeline
                  currentTime={currentTime}
                  totalDuration={totalDuration}
                  isPlaying={isPlaying}
                  onToggle={() => setIsPlaying((playing) => !playing)}
                  events={simulation.events}
                />
                <CasualtyReadout completedStrikes={completedStrikes} countries={countries} />
              </div>
            </section>
          </section>
        )}

        {phase === 'summary' && simulation && (
          <SummaryScreen countries={countries} onReset={resetSimulation} simulation={simulation} />
        )}
      </main>
    </div>
  )
}
