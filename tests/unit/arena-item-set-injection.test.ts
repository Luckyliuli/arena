import { describe, expect, it, vi } from 'vitest'
import { injectArenaItemSet } from '../../src/main/services/arena-augment-data/arenaItemSetInjection.ts'
import { emptyArenaItemCategories } from '../../src/main/services/arena-augment-data/itemTypes.ts'

describe('Arena item set injection', () => {
  it('builds and writes the OP.GG Arena item set for the champion', async () => {
    const categories = emptyArenaItemCategories()
    categories.core = [{
      items: [{ itemId: 223153, name: '破败王者之刃', iconUrl: null }],
      averagePlacement: 3,
      firstPlaceRate: 0.2,
      pickRate: 0.1,
      winRate: 0.5,
      sampleSize: 100,
    }]
    const syncItemSet = vi.fn(async () => ({ success: true }))

    const result = await injectArenaItemSet({
      championId: 429,
      championName: '卡莉丝塔',
      loadCategories: async () => categories,
      syncItemSet,
    })

    expect(result.success).toBe(true)
    expect(syncItemSet).toHaveBeenCalledWith(expect.objectContaining({
      uid: 'aramgg-arena-429',
      associatedChampions: [429],
      blocks: [expect.objectContaining({ type: '核心装备' })],
    }))
  })

  it('does not write an empty item set', async () => {
    const syncItemSet = vi.fn(async () => ({ success: true }))
    const result = await injectArenaItemSet({
      championId: 1,
      championName: '安妮',
      loadCategories: async () => emptyArenaItemCategories(),
      syncItemSet,
    })

    expect(result).toMatchObject({ success: false, reason: 'no-items', itemSet: null })
    expect(syncItemSet).not.toHaveBeenCalled()
  })
})
