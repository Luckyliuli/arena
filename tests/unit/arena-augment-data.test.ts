// Smoke test for the M1 adapter seam. Ensures the public surface wired
// up in src/main/services/arena-augment-data/ resolves the catalog and
// reports back through the same shape the coldstart script consumed
// directly from src/shared/augment-dictionary. Also covers T06: both
// sources must return deterministic numeric stats and rankAugmentStats
// must sort by a chosen field.

import { describe, expect, it } from 'vitest'
import {
  catalogAugmentIds,
  describeAugment,
  rankAugmentStats,
  selectAugmentSource,
} from '../../src/main/services/arena-augment-data/index.ts'

function isStatFilled(stat: { averagePlacement: unknown, firstPlaceRate: unknown, pickRate: unknown, winRate: unknown, sampleSize: unknown }): boolean {
  return stat.averagePlacement !== null
    && stat.firstPlaceRate !== null
    && stat.pickRate !== null
    && stat.winRate !== null
    && stat.sampleSize !== null
}

describe('arena augment data adapter', () => {
  it('returns the mock source by default; every record carries numeric stats', async () => {
    process.env.ARENA_AUGMENT_SOURCE = 'mock'
    const src = selectAugmentSource()
    expect(src.id).toBe('mock')
    const bundle = await src.getStatsForChampion(1)
    expect(bundle.source).toBe('mock')
    expect(bundle.records.length).toBeGreaterThan(0)
    expect(bundle.records.every(isStatFilled)).toBe(true)
    expect(typeof bundle.fetchedAt).toBe('string')
  })

  it('returns the communitydragon source when explicitly requested; stats are also numeric', async () => {
    process.env.ARENA_AUGMENT_SOURCE = 'communitydragon'
    try {
      const src = selectAugmentSource()
      expect(src.id).toBe('communitydragon')
      const bundle = await src.getStatsForChampion(1)
      expect(bundle.source).toBe('communitydragon')
      expect(bundle.records.length).toBeGreaterThan(100)
      expect(bundle.records.every(isStatFilled)).toBe(true)
      expect(bundle.records[0].augmentId).toBeGreaterThan(0)
    } finally {
      delete process.env.ARENA_AUGMENT_SOURCE
    }
  })

  it('produces deterministic stats for the same augment id across calls', async () => {
    process.env.ARENA_AUGMENT_SOURCE = 'mock'
    const src = selectAugmentSource()
    const a = await src.getStatsForChampion(7)
    const b = await src.getStatsForChampion(7)
    const recA = a.records.find(r => r.augmentId === 7) ?? a.records[0]
    const recB = b.records.find(r => r.augmentId === 7) ?? b.records[0]
    expect(recA).toEqual(recB)
  })

  it('exposes the catalog through catalogAugmentIds and describeAugment', () => {
    const ids = catalogAugmentIds()
    expect(ids.length).toBeGreaterThan(100)
    const sample = describeAugment(ids[0])
    expect(sample).toBeDefined()
    expect(sample?.id).toBe(ids[0])
    expect(typeof sample?.displayName.en).toBe('string')
    expect(typeof sample?.displayName.zh).toBe('string')
  })
})

describe('rankAugmentStats', () => {
  const sample = [
    { augmentId: 1, averagePlacement: 4.0, firstPlaceRate: 0.10, pickRate: 0.20, winRate: 0.48, sampleSize: 1000 },
    { augmentId: 2, averagePlacement: 2.0, firstPlaceRate: 0.30, pickRate: 0.05, winRate: 0.58, sampleSize: 500 },
    { augmentId: 3, averagePlacement: 3.0, firstPlaceRate: 0.20, pickRate: 0.10, winRate: 0.53, sampleSize: 800 },
  ]

  it('sorts ascending by averagePlacement by default', () => {
    const ranked = rankAugmentStats(sample as never, 'placement')
    expect(ranked.map(r => r.augmentId)).toEqual([2, 3, 1])
  })

  it('sorts descending by firstPlaceRate when asked', () => {
    const ranked = rankAugmentStats(sample as never, 'firstplace')
    expect(ranked.map(r => r.augmentId)).toEqual([2, 3, 1])
  })

  it('sorts descending by pickRate when asked', () => {
    const ranked = rankAugmentStats(sample as never, 'picks')
    expect(ranked.map(r => r.augmentId)).toEqual([1, 3, 2])
  })

  it('sorts descending by the third-party winRate when asked', () => {
    const ranked = rankAugmentStats(sample as never, 'winrate')
    expect(ranked.map(r => r.augmentId)).toEqual([2, 3, 1])
  })

  it('sorts null metrics last regardless of direction', () => {
    const withNulls = [
      { augmentId: 1, averagePlacement: null, firstPlaceRate: null, pickRate: 0.10, winRate: null, sampleSize: null },
      { augmentId: 2, averagePlacement: 3.0, firstPlaceRate: null, pickRate: null, winRate: 0.55, sampleSize: null },
    ]
    expect(rankAugmentStats(withNulls as never, 'placement').map(r => r.augmentId)).toEqual([2, 1])
    expect(rankAugmentStats(withNulls as never, 'winrate').map(r => r.augmentId)).toEqual([2, 1])
  })

  it('does not mutate the input array', () => {
    const original = sample.map(r => r.augmentId)
    rankAugmentStats(sample as never, 'placement')
    expect(sample.map(r => r.augmentId)).toEqual(original)
  })

  it('breaks ties by augmentId ascending', () => {
    const tied = [
      { augmentId: 30, averagePlacement: 3.0, firstPlaceRate: 0.15, pickRate: 0.10, winRate: 0.5, sampleSize: 100 },
      { augmentId: 10, averagePlacement: 3.0, firstPlaceRate: 0.15, pickRate: 0.10, winRate: 0.5, sampleSize: 100 },
      { augmentId: 20, averagePlacement: 3.0, firstPlaceRate: 0.15, pickRate: 0.10, winRate: 0.5, sampleSize: 100 },
    ]
    const ranked = rankAugmentStats(tied as never, 'placement')
    expect(ranked.map(r => r.augmentId)).toEqual([10, 20, 30])
  })
})
