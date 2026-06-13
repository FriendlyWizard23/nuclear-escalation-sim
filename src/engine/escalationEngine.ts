import { estimateCasualties } from './casualtyModel'

export interface Country {
  id: string
  name: string
  lat: number
  lng: number
  population: number
  populationDensity: number
}

export interface ArsenalEntry {
  warheads: number
  deployedWarheads: number
  yields_kt: number[]
  hasNukes: boolean
  note: string
}

export type ArsenalMap = Record<string, ArsenalEntry | string>

export interface AllianceDefinition {
  members: string[]
  nuclearMembers: string[]
  description: string
}

export interface AllianceMap {
  _comment?: string
  NATO?: AllianceDefinition
  CSTO?: AllianceDefinition
  bilateral?: Record<string, AllianceDefinition>
}

export interface Strike {
  id: string
  aggressorId: string
  targetId: string
  yield_kt: number
  launchTime: number
  flightTime: number
  impactTime: number
  wave: number
}

export interface EscalationEvent {
  time: number
  type: 'launch' | 'impact' | 'retaliation_decision' | 'simulation_end'
  strike?: Strike
  message: string
}

export interface SimulationState {
  events: EscalationEvent[]
  strikes: Strike[]
  totalCasualties: {
    killed: number
    injured: number
  }
  warpedClockSeconds: number
  isComplete: boolean
}

export const MAX_WAVES = 4
export const MAX_TOTAL_STRIKES = 30
export const FLIGHT_TIME_PER_KM = 0.005
export const CLOCK_SPEED = 2

const LAUNCH_STAGGER_SECONDS = 45
const DECISION_DELAY_SECONDS = 60

type Side = 'attackers' | 'defenders'

function getArsenal(countryId: string, arsenals: ArsenalMap): ArsenalEntry | null {
  const entry = arsenals[countryId]
  if (!entry || typeof entry === 'string') {
    return null
  }

  return entry
}

function getCoalition(countryId: string, alliances: AllianceMap, arsenals: ArsenalMap) {
  const members = new Set<string>([countryId])
  const nuclearMembers = new Set<string>()

  const allianceEntries = Object.entries(alliances).filter(
    ([key, value]) => key !== '_comment' && key !== 'bilateral' && value,
  ) as Array<[string, AllianceDefinition]>

  for (const [, alliance] of allianceEntries) {
    if (alliance.members.includes(countryId)) {
      alliance.members.forEach((member) => members.add(member))
      alliance.nuclearMembers.forEach((member) => nuclearMembers.add(member))
    }
  }

  for (const alliance of Object.values(alliances.bilateral ?? {})) {
    if (alliance.members.includes(countryId)) {
      alliance.members.forEach((member) => members.add(member))
      alliance.nuclearMembers.forEach((member) => nuclearMembers.add(member))
    }
  }

  if (getArsenal(countryId, arsenals)?.hasNukes) {
    nuclearMembers.add(countryId)
  }

  return {
    members: Array.from(members),
    nuclearMembers: Array.from(nuclearMembers),
  }
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function haversineKm(a: Country, b: Country) {
  const earthRadiusKm = 6371
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const aa = sinLat ** 2 + Math.cos(lat1) * Math.cos(lat2) * sinLng ** 2
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
  return earthRadiusKm * c
}

function getInitialStrikeCount(arsenal: ArsenalEntry | null) {
  if (!arsenal) {
    return 0
  }

  const available =
    arsenal.deployedWarheads > 0 ? arsenal.deployedWarheads : Math.max(1, Math.round(arsenal.warheads * 0.05))
  const scaled = Math.max(1, Math.round(available / 250))
  return Math.min(available, 8, scaled)
}

function getRetaliationStrikeCount(arsenal: ArsenalEntry | null) {
  if (!arsenal || !arsenal.hasNukes) {
    return 0
  }

  if (arsenal.deployedWarheads > 0) {
    return Math.max(1, Math.min(5, Math.round(arsenal.deployedWarheads / 20)))
  }

  return 1
}

function createStrike(
  aggressor: Country,
  target: Country,
  arsenal: ArsenalEntry,
  wave: number,
  launchTime: number,
  index: number,
): Strike {
  const flightTime = haversineKm(aggressor, target) * FLIGHT_TIME_PER_KM
  const yield_kt = arsenal.yields_kt[index % arsenal.yields_kt.length]

  return {
    id: `${wave}-${aggressor.id}-${target.id}-${index + 1}`,
    aggressorId: aggressor.id,
    targetId: target.id,
    yield_kt,
    launchTime,
    flightTime,
    impactTime: launchTime + flightTime,
    wave,
  }
}

function eventPriority(type: EscalationEvent['type']) {
  switch (type) {
    case 'retaliation_decision':
      return 0
    case 'launch':
      return 1
    case 'impact':
      return 2
    case 'simulation_end':
      return 3
  }
}

function buildWave(
  wave: number,
  side: Side,
  launchActors: string[],
  targetPool: string[],
  countriesById: Map<string, Country>,
  arsenals: ArsenalMap,
  remainingStrikeBudget: number,
  launchBaseTime: number,
) {
  const strikes: Strike[] = []
  const launchers: string[] = []
  const validTargets = targetPool.filter((targetId) => countriesById.has(targetId))

  if (validTargets.length === 0 || remainingStrikeBudget <= 0) {
    return { strikes, launchers }
  }

  for (const actorId of launchActors) {
    if (strikes.length >= remainingStrikeBudget) {
      break
    }

    const aggressor = countriesById.get(actorId)
    const arsenal = getArsenal(actorId, arsenals)
    if (!aggressor || !arsenal?.hasNukes) {
      continue
    }

    const requestedCount = wave === 1 ? getInitialStrikeCount(arsenal) : getRetaliationStrikeCount(arsenal)

    if (requestedCount <= 0) {
      continue
    }

    launchers.push(actorId)

    for (let i = 0; i < requestedCount && strikes.length < remainingStrikeBudget; i += 1) {
      const targetId = validTargets[(launchers.length + i - 1) % validTargets.length]
      const target = countriesById.get(targetId)
      if (!target) {
        continue
      }

      strikes.push(
        createStrike(
          aggressor,
          target,
          arsenal,
          wave,
          launchBaseTime + strikes.length * LAUNCH_STAGGER_SECONDS,
          i,
        ),
      )
    }
  }

  return { strikes, launchers, side }
}

export function buildSimulation(
  aggressorId: string,
  targetId: string,
  countries: Country[],
  arsenals: ArsenalMap,
  alliances: AllianceMap,
): SimulationState {
  const countriesById = new Map(countries.map((country) => [country.id, country]))
  const aggressor = countriesById.get(aggressorId)
  const target = countriesById.get(targetId)

  if (!aggressor || !target) {
    return {
      events: [
        {
          time: 0,
          type: 'simulation_end',
          message: 'Simulation could not start because one or both countries were missing.',
        },
      ],
      strikes: [],
      totalCasualties: { killed: 0, injured: 0 },
      warpedClockSeconds: 0,
      isComplete: true,
    }
  }

  const aggressorCoalition = getCoalition(aggressorId, alliances, arsenals)
  const targetCoalition = getCoalition(targetId, alliances, arsenals)
  const aggressorArsenal = getArsenal(aggressorId, arsenals)
  const strikes: Strike[] = []
  const events: EscalationEvent[] = []

  if (!aggressorArsenal?.hasNukes) {
    console.warn(
      `Non-nuclear aggressor selected (${aggressorId}). Modeling only defensive retaliation by nuclear-capable defenders.`,
    )
  }

  let remainingStrikeBudget = MAX_TOTAL_STRIKES
  let previousWaveImpactTime = 0
  let previousWaveLaunchers: string[] = []

  const firstWaveActors = aggressorArsenal?.hasNukes ? [aggressorId] : []
  const firstWave = buildWave(
    1,
    'attackers',
    firstWaveActors,
    [targetId],
    countriesById,
    arsenals,
    remainingStrikeBudget,
    0,
  )

  strikes.push(...firstWave.strikes)
  remainingStrikeBudget -= firstWave.strikes.length
  previousWaveLaunchers = firstWave.launchers
  previousWaveImpactTime = firstWave.strikes.length
    ? Math.max(...firstWave.strikes.map((strike) => strike.impactTime))
    : 0

  for (let wave = 2; wave <= MAX_WAVES && remainingStrikeBudget > 0; wave += 1) {
    const actingSide: Side = wave % 2 === 0 ? 'defenders' : 'attackers'
    const coalition = actingSide === 'defenders' ? targetCoalition : aggressorCoalition
    const actorCandidates = coalition.nuclearMembers.filter((memberId) => countriesById.has(memberId))

    if (actorCandidates.length === 0) {
      break
    }

    const targetPool =
      actingSide === 'defenders'
        ? [aggressorId]
        : previousWaveLaunchers.length > 0
          ? previousWaveLaunchers
          : [targetId]

    const decisionTime = previousWaveImpactTime + DECISION_DELAY_SECONDS
    events.push({
      time: decisionTime,
      type: 'retaliation_decision',
      message:
        actingSide === 'defenders'
          ? `Wave ${wave}: target coalition authorizes retaliatory launches.`
          : `Wave ${wave}: aggressor coalition prepares counter-retaliation.`,
    })

    const waveResult = buildWave(
      wave,
      actingSide,
      actorCandidates,
      targetPool,
      countriesById,
      arsenals,
      remainingStrikeBudget,
      decisionTime + 15,
    )

    if (waveResult.strikes.length === 0) {
      continue
    }

    strikes.push(...waveResult.strikes)
    remainingStrikeBudget -= waveResult.strikes.length
    previousWaveLaunchers = waveResult.launchers
    previousWaveImpactTime = Math.max(...waveResult.strikes.map((strike) => strike.impactTime))
  }

  for (const strike of strikes) {
    const aggressorCountry = countriesById.get(strike.aggressorId)
    const targetCountry = countriesById.get(strike.targetId)
    if (!aggressorCountry || !targetCountry) {
      continue
    }

    events.push({
      time: strike.launchTime,
      type: 'launch',
      strike,
      message: `${aggressorCountry.name} launches wave ${strike.wave} strike toward ${targetCountry.name}.`,
    })
    events.push({
      time: strike.impactTime,
      type: 'impact',
      strike,
      message: `${targetCountry.name} impact: estimated ${strike.yield_kt} kt detonation.`,
    })
  }

  const totalCasualties = strikes.reduce(
    (totals, strike) => {
      const targetCountry = countriesById.get(strike.targetId)
      if (!targetCountry) {
        return totals
      }

      const casualties = estimateCasualties(strike.yield_kt, targetCountry.populationDensity)
      return {
        killed: totals.killed + casualties.killed,
        injured: totals.injured + casualties.injured,
      }
    },
    { killed: 0, injured: 0 },
  )

  const lastStrikeImpact = strikes.length ? Math.max(...strikes.map((strike) => strike.impactTime)) : 0
  const simulationEndTime = Math.max(lastStrikeImpact, previousWaveImpactTime) + DECISION_DELAY_SECONDS

  events.push({
    time: simulationEndTime,
    type: 'simulation_end',
    message: 'Simulation complete. Educational takeaway: escalation rapidly multiplies harm for every side.',
  })

  events.sort((left, right) => {
    if (left.time === right.time) {
      return eventPriority(left.type) - eventPriority(right.type)
    }

    return left.time - right.time
  })

  return {
    events,
    strikes,
    totalCasualties,
    warpedClockSeconds: 0,
    isComplete: false,
  }
}
