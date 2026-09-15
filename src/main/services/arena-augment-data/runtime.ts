import { getArenaAugmentCacheDir } from '../../modules/app-paths.ts'
import { selectAugmentSource, type ArenaAugmentSource, type AugmentStatsBundle } from './interface.ts'
import { fileOpggCache } from './opgg/cache.ts'
import { fileOpggItemCache, opggItemSource } from './opgg/itemsSource.ts'
import type { ArenaItemStatsBundle } from './itemTypes.ts'
import { readLeagueClientVersion } from '../lcu/league-client-version.ts'

export type ArenaRecommendationRuntime = {
  getAugmentStats(championId: number, options?: { patch?: string }): Promise<AugmentStatsBundle>
  getItemStats(championId: number, options?: { patch?: string }): Promise<ArenaItemStatsBundle>
}

type ArenaRuntimeAdapters = {
  augmentSource: ArenaAugmentSource
  itemSource: ArenaItemSource
  patchProvider?: () => Promise<string>
}

export type ArenaItemSource = {
  getItemsForChampion(championId: number, options?: { patch?: string }): Promise<ArenaItemStatsBundle>
}

export function createArenaRecommendationRuntime(adapters: ArenaRuntimeAdapters): ArenaRecommendationRuntime {
  const resolvePatch = async (requested?: string) =>
    requested || await adapters.patchProvider?.() || undefined
  return {
    getAugmentStats: async (championId, options) => adapters.augmentSource.getStatsForChampion(
      championId,
      { patch: await resolvePatch(options?.patch) },
    ),
    getItemStats: async (championId, options) => adapters.itemSource.getItemsForChampion(
      championId,
      { patch: await resolvePatch(options?.patch) },
    ),
  }
}

function createDefaultRuntime(): ArenaRecommendationRuntime {
  const cacheDir = getArenaAugmentCacheDir()
  const augmentSource = selectAugmentSource({ opgg: { cache: fileOpggCache(cacheDir) } })
  const itemSource = opggItemSource({ cache: fileOpggItemCache(cacheDir) })
  return createArenaRecommendationRuntime({
    augmentSource,
    itemSource,
    patchProvider: async () => (await readLeagueClientVersion())?.patch || '',
  })
}

let defaultRuntime: ArenaRecommendationRuntime | null = null

export function getArenaRecommendationRuntime(): ArenaRecommendationRuntime {
  defaultRuntime ??= createDefaultRuntime()
  return defaultRuntime
}
