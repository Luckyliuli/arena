import { extractRscJsonPayloads } from './rscParser.ts'

export type ArenaChampionStats = {
  winRate: number
  pickRate: number
  banRate: number | null
  firstPlaceRate: number | null
  averagePlacement: number | null
}

export type ArenaCombinationStats = {
  championIds: number[]
  winRate: number | null
  pickRate: number | null
  averagePlacement: number | null
  firstPlaceRate: number | null
  sampleSize: number | null
}

export type ArenaCombinationStatsBundle = {
  trio: ArenaCombinationStats[]
  duo: ArenaCombinationStats[]
}

export type ArenaChampionSynergy = Omit<ArenaCombinationStats, 'championIds'> & {
  teammateChampionId: number
}

function walkObjects(value: unknown, visit: (object: Record<string, unknown>) => boolean, depth = 0): boolean {
  if (value == null || typeof value !== 'object' || depth > 12) return false
  if (Array.isArray(value)) {
    for (const child of value) {
      if (walkObjects(child, visit, depth + 1)) return true
    }
    return false
  }

  const object = value as Record<string, unknown>
  if (visit(object)) return true
  for (const child of Object.values(object)) {
    if (walkObjects(child, visit, depth + 1)) return true
  }
  return false
}

function finiteNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(number) ? number : null
}

function probability(value: unknown): number | null {
  const number = finiteNumber(value)
  if (number == null) return null
  return Number(Math.max(0, Math.min(1, number / 100)).toFixed(6))
}

function positivePlacement(value: unknown): number | null {
  const number = finiteNumber(value)
  return number != null && number >= 1 ? number : null
}

function positiveInteger(value: unknown): number | null {
  const number = finiteNumber(value)
  return number != null && number >= 0 ? Math.round(number) : null
}

function championIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => Number(item))
    .filter(id => Number.isInteger(id) && id > 0)
}

function normaliseChampionStats(stats: Record<string, unknown>): ArenaChampionStats | null {
  const winRate = probability(stats.win_rate)
  const pickRate = probability(stats.pick_rate)
  if (winRate == null || pickRate == null) return null

  return {
    winRate,
    pickRate,
    banRate: probability(stats.ban_rate),
    firstPlaceRate: probability(stats.first_place),
    averagePlacement: positivePlacement(stats.avg_place),
  }
}

function normaliseCombination(row: Record<string, unknown>): ArenaCombinationStats | null {
  const ids = championIds(row.champion_ids)
  if (ids.length < 2) return null

  return {
    championIds: ids,
    winRate: probability(row.win_rate),
    pickRate: probability(row.pick_rate),
    averagePlacement: positivePlacement(row.avg_place ?? row.average_place),
    firstPlaceRate: probability(row.first_place_rate ?? row.first_place),
    sampleSize: positiveInteger(row.play),
  }
}

function normaliseCombinationRows(value: unknown): ArenaCombinationStats[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object' && !Array.isArray(row))
    .map(normaliseCombination)
    .filter((row): row is ArenaCombinationStats => row != null)
}

function normaliseSynergy(row: Record<string, unknown>): ArenaChampionSynergy | null {
  const teammateChampionId = Number(row.champion_id)
  if (!Number.isInteger(teammateChampionId) || teammateChampionId <= 0) return null

  return {
    teammateChampionId,
    winRate: probability(row.win_rate),
    pickRate: probability(row.pick_rate),
    averagePlacement: positivePlacement(row.avg_place ?? row.average_place),
    firstPlaceRate: probability(row.first_place_rate ?? row.first_place),
    sampleSize: positiveInteger(row.play),
  }
}

export function parseArenaChampionStats(html: string): ArenaChampionStats | null {
  for (const payload of extractRscJsonPayloads(html)) {
    let parsed: ArenaChampionStats | null = null
    walkObjects(payload, object => {
      const champion = object.champion
      if (champion == null || typeof champion !== 'object' || Array.isArray(champion)) return false
      const averageStats = (champion as Record<string, unknown>).average_stats
      if (averageStats == null || typeof averageStats !== 'object' || Array.isArray(averageStats)) return false
      parsed = normaliseChampionStats(averageStats as Record<string, unknown>)
      return parsed != null
    })
    if (parsed) return parsed
  }
  return null
}

export function parseArenaCombinations(html: string): ArenaCombinationStatsBundle {
  for (const payload of extractRscJsonPayloads(html)) {
    let parsed: ArenaCombinationStatsBundle | null = null
    walkObjects(payload, object => {
      if (!('teamData' in object) && !('duoData' in object)) return false
      const trio = normaliseCombinationRows(object.teamData)
      const duo = normaliseCombinationRows(object.duoData)
      if (trio.length === 0 && duo.length === 0) return false
      parsed = { trio, duo }
      return true
    })
    if (parsed) return parsed
  }
  return { trio: [], duo: [] }
}

export function parseArenaChampionSynergies(html: string): ArenaChampionSynergy[] {
  for (const payload of extractRscJsonPayloads(html)) {
    let parsed: ArenaChampionSynergy[] | null = null
    walkObjects(payload, object => {
      if (!Array.isArray(object.synergies)) return false
      parsed = object.synergies
        .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object' && !Array.isArray(row))
        .map(normaliseSynergy)
        .filter((row): row is ArenaChampionSynergy => row != null)
      return parsed.length > 0
    })
    if (parsed) return parsed
  }
  return []
}
