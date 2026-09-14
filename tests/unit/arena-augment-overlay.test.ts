import { describe, expect, it } from 'vitest'
import {
  ARENA_OVERLAY_SLOT_COUNT,
  findArenaOverlayTopPickIndex,
  getArenaOverlayRecommendationScore,
  getArenaOverlayRecommendationTier,
  hasArenaOverlayMockData,
  orderArenaOverlayAugments,
} from '../../src/renderer/service/arena-augment-overlay.ts'

const augment = (overrides: Record<string, unknown> = {}) => ({
  augmentId: 1,
  name: 'Test augment',
  detectedSlot: 0,
  missing: false,
  mock: false,
  ...overrides,
})

describe('orderArenaOverlayAugments', () => {
  it('always returns three slots in left, center, right order', () => {
    const ordered = orderArenaOverlayAugments([
      augment({ augmentId: 303, detectedSlot: 2 }),
      augment({ augmentId: 101, detectedSlot: 0 }),
      augment({ augmentId: 202, detectedSlot: 1 }),
    ])

    expect(ordered).toHaveLength(ARENA_OVERLAY_SLOT_COUNT)
    expect(ordered.map(item => item.augmentId)).toEqual([101, 202, 303])
    expect(ordered.map(item => item.detectedSlot)).toEqual([0, 1, 2])
  })

  it('keeps an unrecognized slot as an empty placeholder instead of collapsing', () => {
    const ordered = orderArenaOverlayAugments([
      augment({ augmentId: 101, detectedSlot: 0 }),
      augment({ augmentId: 303, detectedSlot: 2 }),
    ])

    expect(ordered).toHaveLength(ARENA_OVERLAY_SLOT_COUNT)
    expect(ordered[0]).toMatchObject({ augmentId: 101, missing: false })
    expect(ordered[1]).toMatchObject({ missing: true, detectedSlot: 1 })
    expect(ordered[2]).toMatchObject({ augmentId: 303, missing: false })
  })

  it('spills duplicate slots into the next empty slot', () => {
    const ordered = orderArenaOverlayAugments([
      augment({ augmentId: 101, detectedSlot: 1 }),
      augment({ augmentId: 202, detectedSlot: 1 }),
    ])

    expect(ordered.map(item => item.augmentId)).toEqual([202, 101, null])
    expect(ordered.map(item => item.missing)).toEqual([false, false, true])
  })

  it('falls back to input order when detectedSlot is missing', () => {
    const ordered = orderArenaOverlayAugments([
      augment({ augmentId: 101, detectedSlot: undefined }),
      augment({ augmentId: 202, detectedSlot: undefined }),
    ])

    expect(ordered.map(item => item.augmentId)).toEqual([101, 202, null])
  })
})

describe('findArenaOverlayTopPickIndex', () => {
  it('prefers the explicit isTopPick flag over the highest score', () => {
    const ordered = orderArenaOverlayAugments([
      augment({ augmentId: 101, detectedSlot: 0, recommendScore: 0.9 }),
      augment({ augmentId: 202, detectedSlot: 1, recommendScore: 0.4, isTopPick: true }),
      augment({ augmentId: 303, detectedSlot: 2, recommendScore: 0.5 }),
    ])

    expect(findArenaOverlayTopPickIndex(ordered)).toBe(1)
  })

  it('falls back to the highest score, breaking ties toward the left slot', () => {
    const ordered = orderArenaOverlayAugments([
      augment({ augmentId: 101, detectedSlot: 0, recommendScore: 0.55 }),
      augment({ augmentId: 202, detectedSlot: 1, recommendScore: 0.55 }),
      augment({ augmentId: 303, detectedSlot: 2, recommendScore: 0.2 }),
    ])

    expect(findArenaOverlayTopPickIndex(ordered)).toBe(0)
  })

  it('returns no priority when no slot carries a score', () => {
    const ordered = orderArenaOverlayAugments([
      augment({ augmentId: 101, detectedSlot: 0, recommendScore: null }),
      augment({ augmentId: 202, detectedSlot: 1, recommendScore: null }),
    ])

    expect(findArenaOverlayTopPickIndex(ordered)).toBe(-1)
  })
})

describe('arena overlay recommendation helpers', () => {
  it('reads the score without inventing a value for empty slots', () => {
    expect(getArenaOverlayRecommendationScore({ recommendScore: 0.42 })).toBeCloseTo(0.42)
    expect(getArenaOverlayRecommendationScore({ recommendScore: null })).toBeNull()
    expect(getArenaOverlayRecommendationScore({ missing: true, recommendScore: 0.9 })).toBeNull()
    expect(getArenaOverlayRecommendationScore({ notRecommendedForChampion: true, recommendScore: 0.9 })).toBeNull()
  })

  it('uses the declared tier and falls back to score bands', () => {
    expect(getArenaOverlayRecommendationTier({ recommendationTier: 'must-pick', recommendScore: 0.1 })).toBe('must-pick')
    expect(getArenaOverlayRecommendationTier({ recommendScore: 0.62 })).toBe('must-pick')
    expect(getArenaOverlayRecommendationTier({ recommendScore: 0.52 })).toBe('strong')
    expect(getArenaOverlayRecommendationTier({ recommendScore: 0.42 })).toBe('recommended')
    expect(getArenaOverlayRecommendationTier({ recommendScore: 0.32 })).toBe('optional')
    expect(getArenaOverlayRecommendationTier({ recommendScore: 0.12 })).toBe('niche')
    expect(getArenaOverlayRecommendationTier({ recommendScore: null })).toBeNull()
  })

  it('flags placeholder data from either candidate or bundle metadata', () => {
    expect(hasArenaOverlayMockData([augment({ mock: true })], false)).toBe(true)
    expect(hasArenaOverlayMockData([augment({ mock: false })], true)).toBe(true)
    expect(hasArenaOverlayMockData([augment({ mock: false })], false)).toBe(false)
  })
})
  it('never marks a champion-incompatible augment as priority', () => {
    const ordered = orderArenaOverlayAugments([
      augment({ augmentId: 310, detectedSlot: 0, recommendScore: null, notRecommendedForChampion: true }),
      augment({ augmentId: 202, detectedSlot: 1, recommendScore: 0.4 }),
    ])

    expect(getArenaOverlayRecommendationTier(ordered[0])).toBeNull()
    expect(findArenaOverlayTopPickIndex(ordered)).toBe(1)
  })
