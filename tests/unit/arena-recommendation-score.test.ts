import { describe, expect, it } from 'vitest'
import {
  buildArenaRecommendationScoreMap,
  getArenaRecommendationTier,
} from '../../src/main/services/arena-augment-data/recommendationScore.ts'

describe('Arena percentile recommendation score', () => {
  it('spreads scores across the full range using win rate and pick rate percentiles', () => {
    const scores = buildArenaRecommendationScoreMap([
      { key: 1, winRate: 0.6, pickRate: 0.4, sampleSize: 1000 },
      { key: 2, winRate: 0.55, pickRate: 0.3, sampleSize: 1000 },
      { key: 3, winRate: 0.5, pickRate: 0.2, sampleSize: 1000 },
      { key: 4, winRate: 0.45, pickRate: 0.1, sampleSize: 1000 },
    ])

    expect(scores.get(1)).toBe(1)
    expect(scores.get(4)).toBe(0.1)
    expect(scores.get(1)! - scores.get(2)!).toBeGreaterThan(0.2)
    expect(scores.get(2)!).toBeGreaterThan(scores.get(3)!)
  })

  it('gives equal values the same percentile and excludes incomplete records', () => {
    const scores = buildArenaRecommendationScoreMap([
      { key: 1, winRate: 0.5, pickRate: 0.2, sampleSize: 500 },
      { key: 2, winRate: 0.5, pickRate: 0.2, sampleSize: 500 },
      { key: 3, winRate: null, pickRate: 0.2, sampleSize: 500 },
    ])

    expect(scores.get(1)).toBe(scores.get(2))
    expect(scores.has(3)).toBe(false)
  })

  it('maps the new score ranges to recommendation tiers', () => {
    expect(getArenaRecommendationTier(0.8)).toBe('must-pick')
    expect(getArenaRecommendationTier(0.6)).toBe('strong')
    expect(getArenaRecommendationTier(0.4)).toBe('recommended')
    expect(getArenaRecommendationTier(0.2)).toBe('optional')
    expect(getArenaRecommendationTier(0.1999)).toBe('niche')
  })
})
