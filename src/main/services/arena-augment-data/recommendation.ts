import type { ArenaRecommendationTier } from '../../../shared/ipc-contract.ts'
import type { AugmentPerfStat, AugmentStatsBundle } from './interface.ts'
import {
  buildArenaRecommendationScoreMap,
  getArenaRecommendationTier,
} from './recommendationScore.ts'

// The tier vocabulary travels to the renderer inside the IPC payload, so the
// contract owns the single definition and this module re-exports it.
export type { ArenaRecommendationTier }

export type ArenaRecommendationCandidate = {
  augmentId: number | null
  detectedSlot: number
  /** Arena catalog rarity; `unknown` identifies special offers. */
  rarity?: 'silver' | 'gold' | 'prismatic' | 'unknown'
}

export type ArenaAugmentRecommendation = {
  augmentId: number | null
  detectedSlot: number
  recommendScore: number | null
  recommendationTier: ArenaRecommendationTier | null
  isTopPick: boolean
  pickRate: number | null
  /**
   * Third-party (OP.GG) rate, carried verbatim so the popup can show the
   * number behind the score. Null when the source has no record for this
   * augment — never substitute 0.
   */
  winRate: number | null
  sampleSize: number | null
  averagePlacement: number | null
  firstPlaceRate: number | null
  missing: boolean
  /** Recognised standard augment that OP.GG does not recommend for this champion. */
  notRecommendedForChampion: boolean
  /** CommunityDragon special option (anvil/economy/crafting), not a normal augment. */
  isSpecialOption: boolean
  mock: boolean
}

export type ArenaAugmentRecommendationSet = {
  candidates: ArenaAugmentRecommendation[]
  topPick: {
    augmentId: number
    detectedSlot: number
    recommendScore: number
  } | null
  scoredCount: number
  mock: boolean
  source: AugmentStatsBundle['source']
  fetchedAt: string
  reason: string | null
  suppressAugmentPopup: boolean
  suppressionReason: 'special-options' | null
}

function isProbability(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value >= 0 && value <= 1
}

function isPlacement(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value >= 1
}

function isSampleSize(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value >= 0
}

export function calculateArenaRecommendScore(
  stat: AugmentPerfStat | null | undefined,
  pool: readonly AugmentPerfStat[] = stat ? [stat] : [],
): number | null {
  if (!stat || !Number.isInteger(stat.augmentId) || stat.augmentId <= 0) return null
  if (!isProbability(stat.winRate) || !isProbability(stat.pickRate) || !isSampleSize(stat.sampleSize)) return null
  const scoreMap = buildArenaRecommendationScoreMap(pool.map(record => ({
    key: record.augmentId,
    winRate: record.winRate,
    pickRate: record.pickRate,
    sampleSize: record.sampleSize,
  })))
  return scoreMap.get(stat.augmentId) ?? null
}

export { getArenaRecommendationTier }

export function recommendArenaAugmentCandidates(
  candidates: readonly ArenaRecommendationCandidate[],
  bundle: AugmentStatsBundle,
): ArenaAugmentRecommendationSet {
  const statById = new Map(bundle.records.map(record => [record.augmentId, record]))
  const scoreByAugmentId = buildArenaRecommendationScoreMap(bundle.records.map(record => ({
    key: record.augmentId,
    winRate: record.winRate,
    pickRate: record.pickRate,
    sampleSize: record.sampleSize,
  })))
  const orderedCandidates = candidates
    .map((candidate, inputIndex) => ({ candidate, inputIndex }))
    .sort((left, right) => {
      const slotDifference = left.candidate.detectedSlot - right.candidate.detectedSlot
      return slotDifference !== 0 ? slotDifference : left.inputIndex - right.inputIndex
    })

  const normalized: ArenaAugmentRecommendation[] = orderedCandidates.map(({ candidate }) => {
    const augmentId = Number.isInteger(candidate.augmentId) && Number(candidate.augmentId) > 0
      ? Number(candidate.augmentId)
      : null
    const isSpecialOption = augmentId != null && candidate.rarity === 'unknown'
    const stat = augmentId == null || isSpecialOption ? null : statById.get(augmentId) ?? null
    const notRecommendedForChampion = augmentId != null && !isSpecialOption && stat == null
    const recommendScore = stat ? scoreByAugmentId.get(stat.augmentId) ?? null : null

    return {
      augmentId,
      detectedSlot: candidate.detectedSlot,
      recommendScore,
      recommendationTier: getArenaRecommendationTier(recommendScore),
      isTopPick: false,
      pickRate: stat && isProbability(stat.pickRate) ? stat.pickRate : null,
      winRate: stat && isProbability(stat.winRate) ? stat.winRate : null,
      sampleSize: stat && isSampleSize(stat.sampleSize) ? stat.sampleSize : null,
      averagePlacement: stat && isPlacement(stat.averagePlacement) ? stat.averagePlacement : null,
      firstPlaceRate: stat && isProbability(stat.firstPlaceRate) ? stat.firstPlaceRate : null,
      missing: augmentId == null,
      notRecommendedForChampion,
      isSpecialOption,
      mock: bundle.mock,
    } satisfies ArenaAugmentRecommendation
  })

  let topPick: ArenaAugmentRecommendationSet['topPick'] = null
  for (const item of normalized) {
    if (item.augmentId == null || item.isSpecialOption || item.notRecommendedForChampion || item.recommendScore == null) {
      continue
    }
    if (topPick == null || item.recommendScore > topPick.recommendScore) {
      topPick = {
        augmentId: item.augmentId,
        detectedSlot: item.detectedSlot,
        recommendScore: item.recommendScore,
      }
    }
  }

  if (topPick) {
    const top = normalized.find(item =>
      item.augmentId === topPick?.augmentId && item.detectedSlot === topPick.detectedSlot
    )
    if (top) top.isTopPick = true
  }

  const allSpecialOptions = normalized.length > 0 && normalized.every(item => item.isSpecialOption)

  return {
    candidates: normalized,
    topPick,
    scoredCount: normalized.filter(item => item.recommendScore != null).length,
    mock: bundle.mock,
    source: bundle.source,
    fetchedAt: bundle.fetchedAt,
    reason: bundle.reason ?? null,
    suppressAugmentPopup: allSpecialOptions,
    suppressionReason: allSpecialOptions ? 'special-options' : null,
  }
}
