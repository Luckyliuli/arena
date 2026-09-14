import {
  loadArenaChampionMap,
  type ArenaChampionEntry,
} from '../../../../shared/champion-map.ts'
import type {
  ArenaCombinationLeaderboardRow,
  ArenaLeaderboardSnapshot,
} from '../../../../shared/arena-leaderboard-snapshot.ts'
import {
  parseArenaChampionStats,
  parseArenaChampionSynergies,
  parseArenaCombinations,
  type ArenaCombinationStats,
} from './leaderboardParser.ts'
import {
  onlineOpggArenaHomeHtmlFetcher,
  onlineOpggBuildHtmlFetcher,
  type OnlineOpggFetcherOptions,
} from './fetcher.ts'

export type ArenaLeaderboardBuildOptions = {
  patch: string
  champions: ArenaChampionEntry[]
  fetchHomepage: () => Promise<string>
  fetchChampionBuild: (champion: ArenaChampionEntry) => Promise<string>
  concurrency?: number
}

export type ArenaLeaderboardBuildResult = {
  snapshot: ArenaLeaderboardSnapshot
  warnings: string[]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function compareNullableDescending(left: number | null, right: number | null): number {
  if (left == null) return right == null ? 0 : 1
  if (right == null) return -1
  return right - left
}

function compareCombinations(left: ArenaCombinationStats, right: ArenaCombinationStats): number {
  const winRate = compareNullableDescending(left.winRate, right.winRate)
  if (winRate !== 0) return winRate
  const pickRate = compareNullableDescending(left.pickRate, right.pickRate)
  if (pickRate !== 0) return pickRate
  return left.championIds.join(',').localeCompare(right.championIds.join(','))
}

function selectCombinations(rows: ArenaCombinationStats[], size: number): ArenaCombinationLeaderboardRow[] {
  return rows
    .filter(row => row.championIds.length === size)
    .sort(compareCombinations)
}

function mergeDuoRows(
  homepageRows: ArenaCombinationStats[],
  championRows: ArenaCombinationStats[],
): ArenaCombinationStats[] {
  const byPair = new Map<string, ArenaCombinationStats>()
  const pairKey = (ids: number[]) => [...ids].sort((left, right) => left - right).join(':')
  const add = (row: ArenaCombinationStats) => {
    if (row.championIds.length !== 2) return
    const key = pairKey(row.championIds)
    const championIds = [...row.championIds].sort((left, right) => left - right)
    const current = byPair.get(key)
    if (!current || (row.sampleSize ?? -1) > (current.sampleSize ?? -1)) {
      byPair.set(key, { ...row, championIds })
    }
  }
  homepageRows.forEach(add)
  championRows.forEach(add)
  return [...byPair.values()].sort(compareCombinations)
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0
  const run = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await worker(items[index], index)
    }
  }
  const workerCount = Math.min(Math.max(1, concurrency), Math.max(1, items.length))
  await Promise.all(Array.from({ length: workerCount }, run))
  return results
}

export async function buildArenaLeaderboardSnapshot(
  options: ArenaLeaderboardBuildOptions,
): Promise<ArenaLeaderboardBuildResult> {
  const warnings: string[] = []
  let combinationRows = { trio: [] as ArenaCombinationStats[], duo: [] as ArenaCombinationStats[] }

  try {
    combinationRows = parseArenaCombinations(await options.fetchHomepage())
  } catch (error) {
    warnings.push('skipped combination leaderboard (' + errorMessage(error) + ')')
  }

  const championResults = await mapWithConcurrency(
    options.champions,
    options.concurrency ?? 6,
    async champion => {
      try {
        const html = await options.fetchChampionBuild(champion)
        const stats = parseArenaChampionStats(html)
        if (!stats) {
          warnings.push(`${champion.nameEn}: build page did not contain Arena stats`)
          return null
        }
        return {
          row: {
            championId: champion.id,
            slug: champion.slug,
            winRate: stats.winRate,
            pickRate: stats.pickRate,
          },
          synergies: parseArenaChampionSynergies(html).map(synergy => ({
            championIds: [champion.id, synergy.teammateChampionId],
            winRate: synergy.winRate,
            pickRate: synergy.pickRate,
            averagePlacement: synergy.averagePlacement,
            firstPlaceRate: synergy.firstPlaceRate,
            sampleSize: synergy.sampleSize,
          })),
        }
      } catch (error) {
        warnings.push(`${champion.nameEn}: skipped build page (${errorMessage(error)})`)
        return null
      }
    },
  )

  const championPages = championResults.filter((row): row is NonNullable<typeof row> => row != null)
  const champions = championPages
    .map(page => page.row)
    .sort((left, right) => {
      const winRate = compareNullableDescending(left.winRate, right.winRate)
      if (winRate !== 0) return winRate
      const pickRate = compareNullableDescending(left.pickRate, right.pickRate)
      if (pickRate !== 0) return pickRate
      return left.championId - right.championId
    })

  return {
    snapshot: {
      schemaVersion: 1,
      patch: options.patch,
      source: 'opgg',
      champions,
      combinations: {
        trio: selectCombinations(combinationRows.trio, 3),
        duo: mergeDuoRows(
          combinationRows.duo,
          championPages.flatMap(page => page.synergies),
        ),
      },
    },
    warnings,
  }
}

export async function fetchLiveArenaLeaderboardSnapshot(
  options: OnlineOpggFetcherOptions & { concurrency?: number } = {},
): Promise<ArenaLeaderboardBuildResult> {
  const map = loadArenaChampionMap()
  const fetchChampionBuild = onlineOpggBuildHtmlFetcher(options)
  return buildArenaLeaderboardSnapshot({
    patch: map.patch,
    champions: map.champions,
    fetchHomepage: onlineOpggArenaHomeHtmlFetcher(options),
    fetchChampionBuild: champion => fetchChampionBuild(champion.slug),
    concurrency: options.concurrency,
  })
}
