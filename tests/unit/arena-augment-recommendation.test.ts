import { describe, expect, it } from 'vitest'
import {
  calculateArenaRecommendScore,
  getArenaRecommendationTier,
  recommendArenaAugmentCandidates,
  type ArenaRecommendationCandidate,
} from '../../src/main/services/arena-augment-data/recommendation.ts'
import type { AugmentStatsBundle } from '../../src/main/services/arena-augment-data/interface.ts'

const bundle = (
  records: AugmentStatsBundle['records'],
  overrides: Partial<AugmentStatsBundle> = {},
): AugmentStatsBundle => ({
  fetchedAt: '2026-09-13T00:00:00.000Z',
  source: 'opgg',
  mock: false,
  records,
  ...overrides,
})

const candidate = (
  augmentId: number | null,
  detectedSlot: number,
  rarity: 'silver' | 'gold' | 'prismatic' | 'unknown' = 'gold',
): ArenaRecommendationCandidate => ({
  augmentId,
  detectedSlot,
  rarity,
})

describe('arena augment recommendation score', () => {
  it('uses the agreed weighted formula', () => {
    const score = calculateArenaRecommendScore({
      augmentId: 1,
      averagePlacement: null,
      firstPlaceRate: null,
      pickRate: 0.2,
      winRate: 0.6,
      sampleSize: 500,
    })

    expect(score).toBeCloseTo(0.5)
  })

  it('caps the sample-size contribution at one', () => {
    const stat = {
      augmentId: 1,
      averagePlacement: null,
      firstPlaceRate: null,
      pickRate: 0.2,
      winRate: 0.6,
      sampleSize: 1000,
    }
    expect(calculateArenaRecommendScore(stat)).toBeCloseTo(0.6)
    expect(calculateArenaRecommendScore({ ...stat, sampleSize: 2000 })).toBeCloseTo(0.6)
  })

  it('keeps null distinct from zero', () => {
    const base = {
      augmentId: 1,
      averagePlacement: null,
      firstPlaceRate: null,
      pickRate: 0.2,
      winRate: 0.6,
      sampleSize: 500,
    }

    expect(calculateArenaRecommendScore({ ...base, winRate: null })).toBeNull()
    expect(calculateArenaRecommendScore({ ...base, pickRate: null })).toBeNull()
    expect(calculateArenaRecommendScore({ ...base, sampleSize: null })).toBeNull()
    expect(calculateArenaRecommendScore({ ...base, pickRate: 0, sampleSize: 0 })).toBeCloseTo(0.36)
  })

  it('maps score thresholds to recommendation tiers', () => {
    expect(getArenaRecommendationTier(0.6)).toBe('must-pick')
    expect(getArenaRecommendationTier(0.5)).toBe('strong')
    expect(getArenaRecommendationTier(0.4)).toBe('recommended')
    expect(getArenaRecommendationTier(0.3)).toBe('optional')
    expect(getArenaRecommendationTier(0.2999)).toBe('niche')
    expect(getArenaRecommendationTier(null)).toBeNull()
  })
})

describe('recommendArenaAugmentCandidates', () => {
  it('aligns shuffled candidates to left, center, and right slots', () => {
    const result = recommendArenaAugmentCandidates(
      [candidate(303, 2), candidate(101, 0), candidate(202, 1)],
      bundle([
        { augmentId: 101, averagePlacement: null, firstPlaceRate: null, pickRate: 0.1, winRate: 0.5, sampleSize: 100 },
        { augmentId: 202, averagePlacement: null, firstPlaceRate: null, pickRate: 0.2, winRate: 0.6, sampleSize: 1000 },
        { augmentId: 303, averagePlacement: null, firstPlaceRate: null, pickRate: 0.3, winRate: 0.4, sampleSize: 500 },
      ]),
    )

    expect(result.candidates.map(item => item.detectedSlot)).toEqual([0, 1, 2])
    expect(result.candidates.map(item => item.augmentId)).toEqual([101, 202, 303])
    expect(result.topPick?.detectedSlot).toBe(1)
    expect(result.topPick?.augmentId).toBe(202)
  })

  it('marks only the highest valid score as the priority, breaking ties by slot', () => {
    const result = recommendArenaAugmentCandidates(
      [candidate(101, 0), candidate(202, 1), candidate(303, 2)],
      bundle([
        { augmentId: 101, averagePlacement: null, firstPlaceRate: null, pickRate: 0.2, winRate: 0.5, sampleSize: 500 },
        { augmentId: 202, averagePlacement: null, firstPlaceRate: null, pickRate: 0.2, winRate: 0.5, sampleSize: 500 },
        { augmentId: 303, averagePlacement: null, firstPlaceRate: null, pickRate: 0.1, winRate: 0.4, sampleSize: 500 },
      ]),
    )

    expect(result.candidates.map(item => item.isTopPick)).toEqual([true, false, false])
    expect(result.topPick?.detectedSlot).toBe(0)
  })

  it('does not produce a score when any formula input is missing', () => {
    const result = recommendArenaAugmentCandidates(
      [candidate(101, 0), candidate(202, 1), candidate(303, 2)],
      bundle([
        { augmentId: 101, averagePlacement: null, firstPlaceRate: null, pickRate: null, winRate: 0.6, sampleSize: 500 },
        { augmentId: 202, averagePlacement: null, firstPlaceRate: null, pickRate: 0.2, winRate: 0.6, sampleSize: null },
        { augmentId: 303, averagePlacement: null, firstPlaceRate: null, pickRate: 0.2, winRate: null, sampleSize: 500 },
      ]),
    )

    expect(result.candidates.map(item => item.recommendScore)).toEqual([null, null, null])
    expect(result.candidates.every(item => !item.isTopPick)).toBe(true)
    expect(result.topPick).toBeNull()
    expect(result.scoredCount).toBe(0)
  })

  it('carries win rate, placement, and first-place fields without inventing values', () => {
    const result = recommendArenaAugmentCandidates(
      [candidate(101, 0), candidate(202, 1)],
      bundle([
        { augmentId: 101, averagePlacement: 3.42, firstPlaceRate: 0.13, pickRate: 0.2, winRate: 0.56, sampleSize: 800 },
        { augmentId: 202, averagePlacement: 0.9, firstPlaceRate: 1.2, pickRate: null, winRate: null, sampleSize: null },
      ]),
    )

    expect(result.candidates[0]).toMatchObject({
      winRate: 0.56,
      averagePlacement: 3.42,
      firstPlaceRate: 0.13,
    })
    expect(result.candidates[1]).toMatchObject({
      winRate: null,
      averagePlacement: null,
      firstPlaceRate: null,
    })
  })

  it('keeps empty slots empty and propagates bundle placeholder metadata', () => {
    const result = recommendArenaAugmentCandidates(
      [candidate(null, 0), candidate(202, 1)],
      bundle([], { source: 'mock', mock: true, reason: 'fixture' }),
    )

    expect(result.candidates).toHaveLength(2)
    expect(result.candidates[0]).toMatchObject({
      augmentId: null,
      detectedSlot: 0,
      recommendScore: null,
      recommendationTier: null,
      missing: true,
      mock: true,
    })
    expect(result.candidates[1]).toMatchObject({
      augmentId: 202,
      detectedSlot: 1,
      recommendScore: null,
      missing: false,
      mock: true,
    })
    expect(result.mock).toBe(true)
    expect(result.reason).toBe('fixture')
  })
})
describe('Arena augment availability and special offers', () => {
  it('marks a recognised augment absent from the champion list as not recommended without scoring it', () => {
    const result = recommendArenaAugmentCandidates(
      [candidate(310, 0, 'prismatic'), candidate(101, 1), candidate(202, 2)],
      bundle([
        { augmentId: 101, averagePlacement: null, firstPlaceRate: null, pickRate: 0.2, winRate: 0.5, sampleSize: 500 },
        { augmentId: 202, averagePlacement: null, firstPlaceRate: null, pickRate: 0.1, winRate: 0.4, sampleSize: 500 },
      ]),
    )

    expect(result.candidates[0]).toMatchObject({
      augmentId: 310,
      notRecommendedForChampion: true,
      recommendScore: null,
      isTopPick: false,
    })
    expect(result.topPick?.augmentId).toBe(101)
  })

  it('suppresses the popup when all candidates are special options', () => {
    const result = recommendArenaAugmentCandidates(
      [candidate(365, 0, 'unknown'), candidate(368, 1, 'unknown'), candidate(371, 2, 'unknown')],
      bundle([]),
    )

    expect(result.suppressAugmentPopup).toBe(true)
    expect(result.suppressionReason).toBe('special-options')
    expect(result.candidates.every(item => item.isSpecialOption)).toBe(true)
    expect(result.topPick).toBeNull()
  })

  it('does not suppress a mixed group and never scores the special candidate', () => {
    const result = recommendArenaAugmentCandidates(
      [candidate(365, 0, 'unknown'), candidate(101, 1), candidate(202, 2)],
      bundle([
        { augmentId: 101, averagePlacement: null, firstPlaceRate: null, pickRate: 0.2, winRate: 0.5, sampleSize: 500 },
        { augmentId: 202, averagePlacement: null, firstPlaceRate: null, pickRate: 0.1, winRate: 0.4, sampleSize: 500 },
      ]),
    )

    expect(result.suppressAugmentPopup).toBe(false)
    expect(result.candidates[0]).toMatchObject({ isSpecialOption: true, recommendScore: null })
    expect(result.topPick?.augmentId).toBe(101)
  })
})
