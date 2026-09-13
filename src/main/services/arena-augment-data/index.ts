// Public entry point for the arena-augment-data adapter. Anything that
// needs placement stats, the catalog, or augment metadata imports from
// here. Internal layout (interface.ts / communitydragon.ts / mock.ts /
// ...) can be reorganized without ripple.

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
