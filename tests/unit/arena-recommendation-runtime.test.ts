import { describe, expect, it, vi } from 'vitest'
import { createArenaRecommendationRuntime, getArenaRecommendationRuntime } from '../../src/main/services/arena-augment-data/runtime.ts'

describe('Arena recommendation runtime', () => {
  it('reuses one runtime with a small recommendation-data interface', () => {
    const first = getArenaRecommendationRuntime()
    const second = getArenaRecommendationRuntime()

    expect(second).toBe(first)
    expect(Object.keys(first).sort()).toEqual(['getAugmentStats', 'getItemStats'])
  })

  it('queries through explicitly supplied adapters', async () => {
    const augmentBundle = { source: 'opgg' as const, fetchedAt: '2026-09-15', mock: false, records: [] }
    const itemBundle = { source: 'opgg' as const, fetchedAt: '2026-09-15', mock: false, categories: {} as never }
    const getStatsForChampion = vi.fn(async () => augmentBundle)
    const getItemsForChampion = vi.fn(async () => itemBundle)
    const runtime = createArenaRecommendationRuntime({
      augmentSource: { id: 'opgg', label: 'OP.GG', getStatsForChampion },
      itemSource: { id: 'opgg', label: 'OP.GG', getItemsForChampion },
      patchProvider: async () => '16.18',
    })

    await expect(runtime.getAugmentStats(22, { patch: '16.18' })).resolves.toBe(augmentBundle)
    await expect(runtime.getItemStats(22)).resolves.toBe(itemBundle)
    expect(getStatsForChampion).toHaveBeenCalledWith(22, { patch: '16.18' })
    expect(getItemsForChampion).toHaveBeenCalledWith(22, { patch: '16.18' })
  })
})
