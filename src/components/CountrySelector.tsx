import type { ArsenalMap, Country } from '../engine/escalationEngine'

interface CountrySelectorProps {
  countries: Country[]
  arsenals: ArsenalMap
  aggressorId: string | null
  targetId: string | null
  onAggressorChange: (countryId: string) => void
  onTargetChange: (countryId: string) => void
  onLaunch: () => void
}

export default function CountrySelector({
  countries,
  arsenals,
  aggressorId,
  targetId,
  onAggressorChange,
  onTargetChange,
  onLaunch,
}: CountrySelectorProps) {
  const sortedCountries = [...countries].sort((left, right) => left.name.localeCompare(right.name))
  const canLaunch = Boolean(aggressorId && targetId && aggressorId !== targetId)

  return (
    <section className="selection-screen">
      <div className="panel card selection-card">
        <p className="eyebrow">Phase 1 · Heuristic escalation visualizer</p>
        <h1>Nuclear Escalation Simulator</h1>
        <p className="selection-copy">
          Choose a first mover and target to visualize how alliance chains and simplified public-data models can rapidly amplify humanitarian harm.
        </p>

        <div className="selector-grid">
          <label className="field-label" htmlFor="aggressor-select">
            Aggressor
            <select
              id="aggressor-select"
              value={aggressorId ?? ''}
              onChange={(event) => onAggressorChange(event.target.value)}
            >
              <option value="">Select a country</option>
              {sortedCountries.map((country) => {
                const arsenal = arsenals[country.id]
                const hasNukes = Boolean(arsenal && typeof arsenal !== 'string' && arsenal.hasNukes)
                return (
                  <option key={country.id} value={country.id}>
                    {hasNukes ? '☢️ ' : ''}
                    {country.name}
                  </option>
                )
              })}
            </select>
          </label>

          <label className="field-label" htmlFor="target-select">
            Target
            <select id="target-select" value={targetId ?? ''} onChange={(event) => onTargetChange(event.target.value)}>
              <option value="">Select a country</option>
              {sortedCountries.map((country) => {
                const arsenal = arsenals[country.id]
                const hasNukes = Boolean(arsenal && typeof arsenal !== 'string' && arsenal.hasNukes)
                return (
                  <option key={country.id} value={country.id}>
                    {hasNukes ? '☢️ ' : ''}
                    {country.name}
                  </option>
                )
              })}
            </select>
          </label>
        </div>

        <div className="selection-legend">
          <span>☢️ Nuclear-armed state</span>
          <span>All models are simplified educational heuristics.</span>
        </div>

        <button className="btn-primary" disabled={!canLaunch} onClick={onLaunch} type="button">
          Launch Simulation
        </button>
      </div>
    </section>
  )
}
