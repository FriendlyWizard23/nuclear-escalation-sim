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
        <p className="eyebrow">2D-ONLY · PLAN A STYLE EDUCATIONAL MODEL</p>
        <h1>Nuclear Escalation Simulator</h1>
        <p className="selection-copy">
          Pick an initiating state and target to see a simplified city-level escalation fan with persistent tracer arcs, named delivery systems, and humanitarian-impact estimates.
        </p>

        <div className="selection-alert">
          <strong>Bloc logic:</strong> West = US, UK, France, Germany, Italy, Poland, Turkey, Israel, Japan, South Korea. East = Russia, Belarus, China, North Korea. India and Pakistan stay regional unless directly selected.
        </div>

        <div className="selector-grid">
          <label className="field-label" htmlFor="aggressor-select">
            First mover
            <select id="aggressor-select" value={aggressorId ?? ''} onChange={(event) => onAggressorChange(event.target.value)}>
              <option value="">Select a country</option>
              {sortedCountries.map((country) => {
                const arsenal = arsenals[country.id]
                const hasNukes = Boolean(arsenal && typeof arsenal !== 'string' && arsenal.hasNukes)
                return (
                  <option key={country.id} value={country.id}>
                    {hasNukes ? '☢ ' : ''}
                    {country.name}
                  </option>
                )
              })}
            </select>
          </label>

          <label className="field-label" htmlFor="target-select">
            Initial target
            <select id="target-select" value={targetId ?? ''} onChange={(event) => onTargetChange(event.target.value)}>
              <option value="">Select a country</option>
              {sortedCountries.map((country) => {
                const arsenal = arsenals[country.id]
                const hasNukes = Boolean(arsenal && typeof arsenal !== 'string' && arsenal.hasNukes)
                return (
                  <option key={country.id} value={country.id}>
                    {hasNukes ? '☢ ' : ''}
                    {country.name}
                  </option>
                )
              })}
            </select>
          </label>
        </div>

        <div className="selection-legend">
          <span>☢ Nuclear-armed state</span>
          <span>City targets are simplified educational heuristics, not operational guidance.</span>
        </div>

        <button className="btn-primary" disabled={!canLaunch} onClick={onLaunch} type="button">
          Start 2D Simulation
        </button>
      </div>
    </section>
  )
}
