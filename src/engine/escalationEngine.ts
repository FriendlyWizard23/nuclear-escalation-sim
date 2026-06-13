import { estimateCasualties, getBlastRings } from './casualtyModel'
import {
  COUNTRY_PROFILES,
  EDUCATIONAL_ALIGNMENT_LABELS,
  type Alignment,
  type CityProfile,
  type WeaponProfile,
} from '../data/cityProfiles'

// ── Types ─────────────────────────────────────────────────────────────────────

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
  _comment?: string
}

export interface AllianceMap {
  _comment?: string
  NATO?: AllianceDefinition
  CSTO?: AllianceDefinition
  WesternBloc?: AllianceDefinition
  EasternBloc?: AllianceDefinition
  bilateral?: Record<string, AllianceDefinition>
}

export interface Strike {
  id: string
  aggressorId: string
  targetId: string
  targetCityId: string
  targetCityName: string
  targetCountryName: string
  launchLat: number
  launchLng: number
  targetLat: number
  targetLng: number
  yield_kt: number
  yieldLabel: string
  weaponName: string
  weaponType: WeaponProfile['deliveryType']
  blastRadiusKm: number
  estimatedKilled: number
  estimatedInjured: number
  launchTime: number
  flightTime: number
  impactTime: number
  wave: number
  side: 'attacker' | 'defender'
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
  modelLabel: string
  attackerLabel: string
  defenderLabel: string
}

interface EngagedSide {
  alignment: Alignment
  label: string
  members: string[]
  nuclearMembers: string[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const MAX_WAVES = 4
export const MAX_TOTAL_STRIKES = 180
export const FLIGHT_TIME_PER_KM = 0.0048
export const CLOCK_SPEED = 2

const DECISION_DELAY_SECONDS = 42
const LAUNCH_STAGGER_SECONDS = 0.32
const WAVE_SHARES = [0.42, 0.28, 0.18, 0.12] as const

const WEST_MEMBERS = ['US', 'UK', 'France', 'Germany', 'Italy', 'Poland', 'Turkey', 'Israel', 'Japan', 'SouthKorea']
const EAST_MEMBERS = ['Russia', 'Belarus', 'China', 'NorthKorea']

const DEFAULT_TARGETS_BY_ALIGNMENT: Record<Alignment, string[]> = {
  west: WEST_MEMBERS,
  east: EAST_MEMBERS,
  wildcard: ['India', 'Pakistan'],
  independent: [],
}

const TARGET_PRIORITY_BY_ACTOR: Record<string, string[]> = {
  US: ['Russia', 'China', 'NorthKorea', 'Belarus'],
  UK: ['Russia', 'China', 'NorthKorea', 'Belarus'],
  France: ['Russia', 'China', 'NorthKorea', 'Belarus'],
  Israel: ['Russia', 'China', 'NorthKorea'],
  Russia: ['US', 'UK', 'France', 'Germany', 'Italy', 'Poland', 'Turkey', 'Japan', 'SouthKorea', 'Israel'],
  China: ['US', 'Japan', 'SouthKorea', 'UK', 'France', 'Germany', 'Italy', 'Poland', 'Turkey', 'Israel'],
  NorthKorea: ['SouthKorea', 'Japan', 'US'],
  India: ['Pakistan'],
  Pakistan: ['India'],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getArsenal(countryId: string, arsenals: ArsenalMap): ArsenalEntry | null {
  const entry = arsenals[countryId]
  if (!entry || typeof entry === 'string') return null
  return entry
}

function formatYield(yieldKt: number) {
  return yieldKt >= 1000 ? `${(yieldKt / 1000).toFixed(yieldKt % 1000 === 0 ? 0 : 1)} Mt` : `${yieldKt} kt`
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function haversineKm(startLat: number, startLng: number, endLat: number, endLng: number) {
  const earthRadiusKm = 6371
  const dLat = toRadians(endLat - startLat)
  const dLng = toRadians(endLng - startLng)
  const lat1 = toRadians(startLat)
  const lat2 = toRadians(endLat)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const aa = sinLat ** 2 + Math.cos(lat1) * Math.cos(lat2) * sinLng ** 2
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
  return earthRadiusKm * c
}

function getCountryCities(countryId: string) {
  const profile = COUNTRY_PROFILES[countryId]
  if (!profile) return []

  const [capital, others] = profile.cities.reduce<[CityProfile[], CityProfile[]]>(
    (groups, city) => {
      if (city.isCapital) groups[0].push(city)
      else groups[1].push(city)
      return groups
    },
    [[], []],
  )

  return [
    ...capital,
    ...others.sort((left, right) => right.population - left.population),
  ]
}

function getAlignment(countryId: string): Alignment {
  return COUNTRY_PROFILES[countryId]?.alignment ?? 'independent'
}

function getSideForCountry(countryId: string, arsenals: ArsenalMap): EngagedSide {
  const alignment = getAlignment(countryId)
  const members = alignment === 'west'
    ? WEST_MEMBERS
    : alignment === 'east'
      ? EAST_MEMBERS
      : [countryId]

  const nuclearMembers = members.filter((memberId) => getArsenal(memberId, arsenals)?.hasNukes)

  return {
    alignment,
    label: EDUCATIONAL_ALIGNMENT_LABELS[alignment],
    members,
    nuclearMembers,
  }
}

function getCountryStrikeBudget(countryId: string, arsenals: ArsenalMap) {
  const arsenal = getArsenal(countryId, arsenals)
  if (!arsenal?.hasNukes) return 0

  const readyWarheads = arsenal.deployedWarheads > 0
    ? arsenal.deployedWarheads
    : Math.max(arsenal.warheads * 0.35, arsenal.warheads * 0.18)

  return Math.max(2, Math.min(44, Math.round(readyWarheads / 38)))
}

function getTargetCountryOrder(actorId: string, opposingSide: EngagedSide, primaryTargetId: string) {
  const override = TARGET_PRIORITY_BY_ACTOR[actorId] ?? []
  const defaultOrder = opposingSide.members.length > 0 ? opposingSide.members : [primaryTargetId]
  const merged = [...override, primaryTargetId, ...defaultOrder]
  return merged.filter((countryId, index) => merged.indexOf(countryId) === index)
}

function getTargetCityQueue(actorId: string, opposingSide: EngagedSide, primaryTargetId: string) {
  return getTargetCountryOrder(actorId, opposingSide, primaryTargetId)
    .flatMap((countryId) => getCountryCities(countryId))
}

function buildStrike(
  aggressor: Country,
  targetCountry: Country,
  targetCity: CityProfile,
  weapon: WeaponProfile,
  wave: number,
  launchTime: number,
  actorShotIndex: number,
  side: 'attacker' | 'defender',
): Strike {
  const flightTime = haversineKm(aggressor.lat, aggressor.lng, targetCity.lat, targetCity.lng) * FLIGHT_TIME_PER_KM
  const blastRings = getBlastRings(weapon.yield_kt)
  const blastRadiusKm = blastRings[blastRings.length - 1]?.radius_km ?? Math.cbrt(weapon.yield_kt)
  const casualties = estimateCasualties(weapon.yield_kt, targetCity.populationDensity, targetCity.population)

  return {
    id: `${wave}-${aggressor.id}-${targetCity.id}-${actorShotIndex + 1}`,
    aggressorId: aggressor.id,
    targetId: targetCountry.id,
    targetCityId: targetCity.id,
    targetCityName: targetCity.name,
    targetCountryName: targetCountry.name,
    launchLat: aggressor.lat,
    launchLng: aggressor.lng,
    targetLat: targetCity.lat,
    targetLng: targetCity.lng,
    yield_kt: weapon.yield_kt,
    yieldLabel: formatYield(weapon.yield_kt),
    weaponName: weapon.name,
    weaponType: weapon.deliveryType,
    blastRadiusKm,
    estimatedKilled: casualties.killed,
    estimatedInjured: casualties.injured,
    launchTime,
    flightTime,
    impactTime: launchTime + flightTime,
    wave,
    side,
  }
}

function buildWave(
  wave: number,
  launchActors: string[],
  opposingSide: EngagedSide,
  primaryTargetId: string,
  countriesById: Map<string, Country>,
  arsenals: ArsenalMap,
  remainingByActor: Map<string, number>,
  targetCursorByActor: Map<string, number>,
  launchBaseTime: number,
  remainingStrikeBudget: number,
  strikeSide: 'attacker' | 'defender',
) {
  const strikes: Strike[] = []

  for (const [actorIndex, actorId] of launchActors.entries()) {
    if (strikes.length >= remainingStrikeBudget) break

    const aggressor = countriesById.get(actorId)
    const arsenal = getArsenal(actorId, arsenals)
    const profile = COUNTRY_PROFILES[actorId]
    const actorRemaining = remainingByActor.get(actorId) ?? 0
    if (!aggressor || !arsenal?.hasNukes || !profile || actorRemaining <= 0 || profile.weapons.length === 0) continue

    const requestedShots = Math.max(1, Math.ceil(getCountryStrikeBudget(actorId, arsenals) * WAVE_SHARES[wave - 1]))
    const shotsThisWave = Math.min(actorRemaining, requestedShots, remainingStrikeBudget - strikes.length)
    const targetQueue = getTargetCityQueue(actorId, opposingSide, primaryTargetId)
    if (shotsThisWave <= 0 || targetQueue.length === 0) continue

    const startCursor = targetCursorByActor.get(actorId) ?? 0

    for (let shot = 0; shot < shotsThisWave; shot += 1) {
      const targetCity = targetQueue[(startCursor + shot) % targetQueue.length]
      const targetCountry = countriesById.get(targetCity.countryId)
      if (!targetCountry) continue

      const weapon = profile.weapons[(startCursor + shot) % profile.weapons.length]
      const launchTime = launchBaseTime + (actorIndex * 0.75) + (shot * LAUNCH_STAGGER_SECONDS)

      strikes.push(
        buildStrike(
          aggressor,
          targetCountry,
          targetCity,
          weapon,
          wave,
          launchTime,
          startCursor + shot,
          strikeSide,
        ),
      )
    }

    targetCursorByActor.set(actorId, startCursor + shotsThisWave)
    remainingByActor.set(actorId, actorRemaining - shotsThisWave)
  }

  return strikes
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

function isRegionalIndiaPakistanScenario(aggressorId: string, targetId: string) {
  return (aggressorId === 'India' && targetId === 'Pakistan') || (aggressorId === 'Pakistan' && targetId === 'India')
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildSimulation(
  aggressorId: string,
  targetId: string,
  countries: Country[],
  arsenals: ArsenalMap,
  _alliances: AllianceMap,
): SimulationState {
  const countriesById = new Map(countries.map((country) => [country.id, country]))
  const aggressor = countriesById.get(aggressorId)
  const target = countriesById.get(targetId)

  if (!aggressor || !target) {
    return {
      events: [{ time: 0, type: 'simulation_end', message: 'Simulation could not start because one or both countries were missing.' }],
      strikes: [],
      totalCasualties: { killed: 0, injured: 0 },
      warpedClockSeconds: 0,
      isComplete: true,
      modelLabel: 'Unavailable',
      attackerLabel: 'Unavailable',
      defenderLabel: 'Unavailable',
    }
  }

  const regionalScenario = isRegionalIndiaPakistanScenario(aggressorId, targetId)
  const attackerSide = regionalScenario ? getSideForCountry(aggressorId, arsenals) : getSideForCountry(aggressorId, arsenals)
  const defenderSide = regionalScenario ? getSideForCountry(targetId, arsenals) : getSideForCountry(targetId, arsenals)

  const attackerActors = [aggressorId]
  const attackerCoalitionActors = regionalScenario
    ? [aggressorId]
    : attackerSide.nuclearMembers.length > 0
      ? attackerSide.nuclearMembers
      : attackerActors
  const defenderActors = regionalScenario
    ? [targetId]
    : defenderSide.nuclearMembers

  const remainingByActor = new Map<string, number>()
  const targetCursorByActor = new Map<string, number>()

  for (const actorId of new Set([...attackerCoalitionActors, ...defenderActors])) {
    remainingByActor.set(actorId, getCountryStrikeBudget(actorId, arsenals))
    targetCursorByActor.set(actorId, 0)
  }

  const strikes: Strike[] = []
  const events: EscalationEvent[] = [
    {
      time: 0,
      type: 'retaliation_decision',
      message: regionalScenario
        ? 'Regional containment model active: India and Pakistan exchange strikes without automatic superpower spillover.'
        : `Simplified educational alignment model active: ${attackerSide.label} vs ${defenderSide.label}.`,
    },
  ]

  let remainingStrikeBudget = MAX_TOTAL_STRIKES
  let previousWaveImpactTime = 0

  const firstWave = buildWave(
    1,
    attackerActors,
    defenderSide,
    targetId,
    countriesById,
    arsenals,
    remainingByActor,
    targetCursorByActor,
    0,
    remainingStrikeBudget,
    'attacker',
  )

  strikes.push(...firstWave)
  remainingStrikeBudget -= firstWave.length
  previousWaveImpactTime = firstWave.length > 0 ? Math.max(...firstWave.map((strike) => strike.impactTime)) : 0

  const waveActors: Array<{ actors: string[]; side: 'attacker' | 'defender'; targetSide: EngagedSide; primaryTargetId: string; label: string }> = [
    {
      actors: defenderActors,
      side: 'defender',
      targetSide: attackerSide,
      primaryTargetId: aggressorId,
      label: regionalScenario ? `${target.name} orders retaliation.` : `${defenderSide.label} authorizes retaliatory salvos.`,
    },
    {
      actors: regionalScenario ? attackerActors : attackerCoalitionActors,
      side: 'attacker',
      targetSide: defenderSide,
      primaryTargetId: targetId,
      label: regionalScenario ? `${aggressor.name} conducts follow-on strikes.` : `${attackerSide.label} broadens counterforce targeting.`,
    },
    {
      actors: defenderActors,
      side: 'defender',
      targetSide: attackerSide,
      primaryTargetId: aggressorId,
      label: regionalScenario ? `${target.name} launches final wave.` : `${defenderSide.label} empties remaining ready arsenals.`,
    },
  ]

  for (let wave = 2; wave <= MAX_WAVES && remainingStrikeBudget > 0; wave += 1) {
    const wavePlan = waveActors[wave - 2]
    if (!wavePlan || wavePlan.actors.length === 0) continue

    const decisionTime = previousWaveImpactTime + DECISION_DELAY_SECONDS
    events.push({ time: decisionTime, type: 'retaliation_decision', message: `Wave ${wave}: ${wavePlan.label}` })

    const waveStrikes = buildWave(
      wave,
      wavePlan.actors,
      wavePlan.targetSide,
      wavePlan.primaryTargetId,
      countriesById,
      arsenals,
      remainingByActor,
      targetCursorByActor,
      decisionTime + 9,
      remainingStrikeBudget,
      wavePlan.side,
    )

    if (waveStrikes.length === 0) continue

    strikes.push(...waveStrikes)
    remainingStrikeBudget -= waveStrikes.length
    previousWaveImpactTime = Math.max(...waveStrikes.map((strike) => strike.impactTime))
  }

  for (const strike of strikes) {
    const aggressorCountry = countriesById.get(strike.aggressorId)
    if (!aggressorCountry) continue

    events.push({
      time: strike.launchTime,
      type: 'launch',
      strike,
      message: `${aggressorCountry.name} launches ${strike.weaponName} ${strike.weaponType} toward ${strike.targetCityName}, ${strike.targetCountryName} (${strike.yieldLabel}).`,
    })
    events.push({
      time: strike.impactTime,
      type: 'impact',
      strike,
      message: `${strike.targetCityName} hit by ${strike.weaponName} ${strike.weaponType} (${strike.yieldLabel}); visible blast radius ~${strike.blastRadiusKm.toFixed(1)} km.`,
    })
  }

  const totalCasualties = strikes.reduce(
    (totals, strike) => ({
      killed: totals.killed + strike.estimatedKilled,
      injured: totals.injured + strike.estimatedInjured,
    }),
    { killed: 0, injured: 0 },
  )

  const lastStrikeImpact = strikes.length > 0 ? Math.max(...strikes.map((strike) => strike.impactTime)) : 0
  const simulationEndTime = Math.max(lastStrikeImpact, previousWaveImpactTime) + DECISION_DELAY_SECONDS

  events.push({
    time: simulationEndTime,
    type: 'simulation_end',
    message: 'Simulation complete. Educational takeaway: city-level retaliation logic still escalates faster than any side can control.',
  })

  events.sort((left, right) => {
    if (left.time === right.time) return eventPriority(left.type) - eventPriority(right.type)
    return left.time - right.time
  })

  return {
    events,
    strikes,
    totalCasualties,
    warpedClockSeconds: 0,
    isComplete: false,
    modelLabel: regionalScenario ? 'Contained India–Pakistan regional exchange' : 'Plan A–style West vs East educational model',
    attackerLabel: attackerSide.label,
    defenderLabel: defenderSide.label,
  }
}
