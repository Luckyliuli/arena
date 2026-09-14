// Public entry point for the arena-augment-data adapter. Anything that
// needs placement stats, the catalog, or augment metadata imports from
// here. Internal layout (interface.ts / opgg/* / ...) can be
// reorganized without ripple.

export {
  ARENA_ITEM_CATEGORIES,
  emptyArenaItemCategories,
  type ArenaItemCategory,
  type ArenaItemCategories,
  type ArenaItemPerfStat,
  type ArenaItemRef,
  type ArenaItemStatsBundle,
} from './itemTypes.ts'

export {
  fileOpggItemCache,
  memoryOpggItemCache,
  opggItemSource,
  type OpggItemCache,
  type OpggItemSourceOptions,
} from './opgg/itemsSource.ts'

export {
  type ArenaAugmentSource,
  type AugmentPerfStat,
  type AugmentStatsBundle,
  type RankOrder,
  type RarityTier,
  selectAugmentSource,
  catalogAugmentIds,
  describeAugment,
  rankAugmentStats,
} from './interface.ts'

export {
  type ArenaAugmentRecommendation,
  type ArenaAugmentRecommendationSet,
  type ArenaRecommendationCandidate,
  type ArenaRecommendationTier,
  calculateArenaRecommendScore,
  getArenaRecommendationTier,
  recommendArenaAugmentCandidates,
} from './recommendation.ts'

// Cache wiring. The IPC layer constructs a file-backed cache under the
// app data dir and hands it to selectAugmentSource(); the adapter itself
// stays free of Electron path knowledge.
export {
  fileOpggCache,
  memoryOpggCache,
  type OpggCache,
  type FileOpggCacheOptions,
} from './opgg/cache.ts'

export {
  compareArenaItemStats,
  orderArenaItemRecommendations,
  recommendArenaItemCandidates,
  type ArenaItemRecommendation,
  type ArenaItemRecommendationCandidate,
} from './itemRecommendation.ts'

export { matchArenaItemSlotTexts } from './itemMatcher.ts'
