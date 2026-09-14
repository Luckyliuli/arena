import { getArenaAugmentCacheDir } from '../../modules/app-paths.ts'
import { selectAugmentSource, type ArenaAugmentSource, type AugmentStatsBundle } from './interface.ts'
import { fileOpggCache } from './opgg/cache.ts'
import { fileOpggItemCache, opggItemSource } from './opgg/itemsSource.ts'
import type { ArenaItemStatsBundle } from './itemTypes.ts'

export type ArenaRecommendationRuntime = {
  getAugmentStats(championId: number, options?: { patch?: string }): Promise<AugmentStatsBundle>
  getItemStats(championId: number): Promise<ArenaItemStatsBundle>
}

type ArenaRuntimeAdapters = {
  augmentSource: ArenaAugmentSource
  itemSource: ArenaItemSource
}

export type ArenaItemSource = {
  getItemsForChampion(championId: number): Promise<ArenaItemStatsBundle>
}

export function createArenaRecommendationRuntime(adapters: ArenaRuntimeAdapters): ArenaRecommendationRuntime {
  return {
    getAugmentStats: (championId, options) => adapters.augmentSource.getStatsForChampion(championId, options),
    getItemStats: championId => adapters.itemSource.getItemsForChampion(championId),
  }
}

function createDefaultRuntime(): ArenaRecommendationRuntime {
  const cacheDir = getArenaAugmentCacheDir()
  const augmentSource = selectAugmentSource({ opgg: { cache: fileOpggCache(cacheDir) } })
  const itemSource = opggItemSource({ cache: fileOpggItemCache(cacheDir) })
  return createArenaRecommendationRuntime({ augmentSource, itemSource })
}

let defaultRuntime: ArenaRecommendationRuntime | null = null

export function getArenaRecommendationRuntime(): ArenaRecommendationRuntime {
  defaultRuntime ??= createDefaultRuntime()
  return defaultRuntime
}
