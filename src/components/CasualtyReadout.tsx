import { useMemo } from 'react'
import { estimateCasualties } from '../engine/casualtyModel'
import type { Country, Strike } from '../engine/escalationEngine'

interface CasualtyReadoutProps {
  completedStrikes: Strike[]
  countries: Country[]
}

const numberFormatter = new Intl.NumberFormat()

export default function CasualtyReadout({ completedStrikes, countries }: CasualtyReadoutProps) {
  const countriesById = useMemo(
    () => new Map(countries.map((country) => [country.id, country])),
    [countries],
  )

  const strikeImpacts = useMemo(
    () =>
      completedStrikes.map((strike) => {
        const target = countriesById.get(strike.targetId)
        const casualties = estimateCasualties(strike.yield_kt, target?.populationDensity ?? 0)
        return {
          strike,
          targetName: target?.name ?? strike.targetId,
          casualties,
        }
      }),
    [completedStrikes, countriesById],
  )

  const totals = useMemo(
    () =>
      strikeImpacts.reduce(
        (accumulator, impact) => ({
          killed: accumulator.killed + impact.casualties.killed,
          injured: accumulator.injured + impact.casualties.injured,
        }),
        { killed: 0, injured: 0 },
      ),
    [strikeImpacts],
  )

  return (
    <section className="panel casualty-panel card">
      <p className="eyebrow">Estimated humanitarian impact</p>
      <div className="casualty-totals">
        <div>
          <span className="stat-label">Killed</span>
          <strong>{numberFormatter.format(totals.killed)}</strong>
        </div>
        <div>
          <span className="stat-label">Injured</span>
          <strong>{numberFormatter.format(totals.injured)}</strong>
        </div>
      </div>

      <div className="impact-list">
        {strikeImpacts.length === 0 ? (
          <p className="muted">Impacts will appear here after detonations occur.</p>
        ) : (
          [...strikeImpacts].reverse().map(({ strike, targetName, casualties }) => (
            <div className="impact-item" key={strike.id}>
              <div>
                <strong>
                  {strike.aggressorId} → {targetName}
                </strong>
                <p>
                  Wave {strike.wave} · {strike.yield_kt} kt heuristic estimate
                </p>
              </div>
              <div className="impact-stats">
                <span>{numberFormatter.format(casualties.killed)} killed</span>
                <span>{numberFormatter.format(casualties.injured)} injured</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
