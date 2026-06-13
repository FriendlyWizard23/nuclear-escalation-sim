export interface BlastRing {
  name: string
  radius_km: number
  color: string
  opacity: number
  fractionFatal: number
  fractionInjured: number
}

const ringDefinitions = [
  {
    name: 'Fireball',
    coefficient: 0.05,
    color: 'rgba(255, 89, 0, 0.8)',
    opacity: 0.8,
    fractionFatal: 0.98,
    fractionInjured: 0.02,
  },
  {
    name: 'Heavy blast (20 psi)',
    coefficient: 0.28,
    color: 'rgba(255, 140, 0, 0.55)',
    opacity: 0.55,
    fractionFatal: 0.72,
    fractionInjured: 0.2,
  },
  {
    name: 'Moderate blast (5 psi)',
    coefficient: 0.65,
    color: 'rgba(255, 196, 0, 0.4)',
    opacity: 0.4,
    fractionFatal: 0.3,
    fractionInjured: 0.45,
  },
  {
    name: 'Radiation lethal zone',
    coefficient: 0.75,
    color: 'rgba(121, 255, 214, 0.35)',
    opacity: 0.35,
    fractionFatal: 0.45,
    fractionInjured: 0.25,
  },
  {
    name: 'Thermal burns',
    coefficient: 1,
    color: 'rgba(255, 99, 71, 0.28)',
    opacity: 0.28,
    fractionFatal: 0.12,
    fractionInjured: 0.45,
  },
  {
    name: 'Light blast (1 psi)',
    coefficient: 1.4,
    color: 'rgba(255, 255, 255, 0.18)',
    opacity: 0.18,
    fractionFatal: 0.04,
    fractionInjured: 0.25,
  },
] as const

/**
 * Simplified damage rings derived from public-domain scaling laws in
 * Glasstone & Dolan's "The Effects of Nuclear Weapons".
 */
export function getBlastRings(yield_kt: number): BlastRing[] {
  const scaledYield = Math.max(yield_kt, 1)

  return ringDefinitions
    .map((ring) => ({
      name: ring.name,
      radius_km: ring.coefficient * Math.cbrt(scaledYield),
      color: ring.color,
      opacity: ring.opacity,
      fractionFatal: ring.fractionFatal,
      fractionInjured: ring.fractionInjured,
    }))
    .sort((a, b) => a.radius_km - b.radius_km)
}

/**
 * Estimates casualties by applying population density to concentric damage areas.
 * This is intentionally transparent and heuristic, not predictive.
 */
export function estimateCasualties(yield_kt: number, populationDensity: number) {
  const rings = getBlastRings(yield_kt)
  let previousRadius = 0
  let killed = 0
  let injured = 0

  for (const ring of rings) {
    const ringArea = Math.PI * (ring.radius_km ** 2 - previousRadius ** 2)
    const exposedPopulation = Math.max(0, populationDensity * ringArea)
    killed += exposedPopulation * ring.fractionFatal
    injured += exposedPopulation * ring.fractionInjured
    previousRadius = ring.radius_km
  }

  const roundedKilled = Math.round(killed)
  const roundedInjured = Math.round(injured)

  return {
    killed: roundedKilled,
    injured: roundedInjured,
    total: roundedKilled + roundedInjured,
  }
}
