import { useMemo } from 'react'
import type { Country, SimulationState } from '../engine/escalationEngine'

interface SummaryScreenProps {
  simulation: SimulationState
  countries: Country[]
  onReset: () => void
}

const numberFormatter = new Intl.NumberFormat()

export default function SummaryScreen({ simulation, countries, onReset }: SummaryScreenProps) {
  const countriesById = useMemo(() => new Map(countries.map((country) => [country.id, country.name])), [countries])

  const waveCount = simulation.strikes.length > 0 ? Math.max(...simulation.strikes.map((strike) => strike.wave)) : 0
  const sideTotals = simulation.strikes.reduce(
    (totals, strike) => {
      if (strike.side === 'attacker') totals.firstStrikeSide += 1
      else totals.retaliatingSide += 1
      return totals
    },
    { firstStrikeSide: 0, retaliatingSide: 0 },
  )

  const launchesByCountry = simulation.strikes.reduce<Record<string, number>>((totals, strike) => {
    totals[strike.aggressorId] = (totals[strike.aggressorId] ?? 0) + 1
    return totals
  }, {})

  return (
    <section className="summary-screen">
      <div className="panel card summary-card">
        <p className="eyebrow">Simulation summary</p>
        <h1>Escalation outcome</h1>
        <p className="selection-copy">
          {simulation.modelLabel}. Even with simplified assumptions, city-level counterforce logic rapidly multiplies detonations and civilian losses.
        </p>

        <div className="summary-grid">
          <div className="summary-stat">
            <span>Total estimated killed</span>
            <strong>{numberFormatter.format(simulation.totalCasualties.killed)}</strong>
          </div>
          <div className="summary-stat">
            <span>Total estimated injured</span>
            <strong>{numberFormatter.format(simulation.totalCasualties.injured)}</strong>
          </div>
          <div className="summary-stat">
            <span>Initiating-side launches</span>
            <strong>{numberFormatter.format(sideTotals.firstStrikeSide)}</strong>
          </div>
          <div className="summary-stat">
            <span>Retaliating-side launches</span>
            <strong>{numberFormatter.format(sideTotals.retaliatingSide)}</strong>
          </div>
          <div className="summary-stat">
            <span>Escalation waves</span>
            <strong>{waveCount}</strong>
          </div>
          <div className="summary-stat">
            <span>Total detonations</span>
            <strong>{simulation.strikes.length}</strong>
          </div>
        </div>

        <div className="summary-list">
          <h2>Warheads launched by country</h2>
          {Object.keys(launchesByCountry).length === 0 ? (
            <p className="muted">No nuclear launches were modeled for this scenario.</p>
          ) : (
            Object.entries(launchesByCountry)
              .sort((left, right) => right[1] - left[1])
              .map(([countryId, count]) => (
                <div className="summary-row" key={countryId}>
                  <span>{countriesById.get(countryId) ?? countryId}</span>
                  <strong>{count}</strong>
                </div>
              ))
          )}
        </div>

        <div className="takeaway-box">
          <h2>Educational takeaway</h2>
          <p>
            This simulator visualizes a simplified educational model, but the pattern is consistent: once retaliatory salvos begin, the path to stopping them narrows almost immediately.
          </p>
        </div>

        <button className="btn-primary" onClick={onReset} type="button">
          Run another scenario
        </button>
      </div>
    </section>
  )
}
