// Smoke test for the M1 adapter seam. Ensures the public surface wired
// up in src/main/services/arena-augment-data/ resolves the catalog and
// reports back through the same shape the coldstart script consumed
// directly from src/shared/augment-dictionary.

import { describe, expect, it } from 'vitest'
import {
  catalogAugmentIds,
  describeAugment,
  selectAugmentSource,
} from '../../src/main/services/arena-augment-data/index.ts'

describe('arena augment data adapter', () => {
  it('returns the mock source by default and produces an empty stats bundle', async () => {
    process.env.ARENA_AUGMENT_SOURCE = 'mock'
    const src = selectAugmentSource()
    expect(src.id).toBe('mock')
    const bundle = await src.getStatsForChampion(1)
    expect(bundle.source).toBe('mock')
    expect(bundle.records).toEqual([])
    expect(typeof bundle.fetchedAt).toBe('string')
  })

  it('returns the communitydragon source when explicitly requested', async () => {
    process.env.ARENA_AUGMENT_SOURCE = 'communitydragon'
    try {
      const src = selectAugmentSource()
      expect(src.id).toBe('communitydragon')
      const bundle = await src.getStatsForChampion(1)
      expect(bundle.source).toBe('communitydragon')
      expect(bundle.records.length).toBeGreaterThan(100)
      expect(bundle.records[0].augmentId).toBeGreaterThan(0)
    } finally {
      delete process.env.ARENA_AUGMENT_SOURCE
    }
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
