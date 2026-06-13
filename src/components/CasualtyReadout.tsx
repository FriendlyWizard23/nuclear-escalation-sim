import { useMemo } from 'react'
import type { Country, Strike } from '../engine/escalationEngine'

interface CasualtyReadoutProps {
  completedStrikes: Strike[]
  countries: Country[]
}

const numberFormatter = new Intl.NumberFormat()

export default function CasualtyReadout({ completedStrikes, countries }: CasualtyReadoutProps) {
  const countriesById = useMemo(() => new Map(countries.map((country) => [country.id, country.name])), [countries])

  const totals = useMemo(
    () => completedStrikes.reduce(
      (accumulator, strike) => ({
        killed: accumulator.killed + strike.estimatedKilled,
        injured: accumulator.injured + strike.estimatedInjured,
      }),
      { killed: 0, injured: 0 },
    ),
    [completedStrikes],
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
        {completedStrikes.length === 0 ? (
          <p className="muted">Impacts will appear after detonations occur.</p>
        ) : (
          [...completedStrikes].reverse().map((strike) => (
            <div className="impact-item" key={strike.id}>
              <div>
                <strong>
                  {countriesById.get(strike.aggressorId) ?? strike.aggressorId} → {strike.targetCityName}
                </strong>
                <p>
                  {strike.weaponName} {strike.weaponType} · {strike.yieldLabel} · blast radius ~{strike.blastRadiusKm.toFixed(1)} km
                </p>
              </div>
              <div className="impact-stats">
                <span>{numberFormatter.format(strike.estimatedKilled)} killed</span>
                <span>{numberFormatter.format(strike.estimatedInjured)} injured</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
