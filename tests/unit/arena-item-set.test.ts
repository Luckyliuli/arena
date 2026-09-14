import { describe, expect, it } from 'vitest'
import { buildArenaItemSet } from '../../src/main/services/arena-augment-data/arenaItemSet.ts'
import { emptyArenaItemCategories } from '../../src/main/services/arena-augment-data/itemTypes.ts'

function stat(itemIds: number[]) {
  return {
    items: itemIds.map(itemId => ({ itemId, name: String(itemId), iconUrl: null })),
    averagePlacement: 3,
    firstPlaceRate: 0.2,
    pickRate: 0.1,
    winRate: 0.5,
    sampleSize: 100,
  }
}

describe('Arena item set builder', () => {
  it('creates one managed set with ordered category blocks and unique items', () => {
    const categories = emptyArenaItemCategories()
    categories.prismatic = [stat([443054, 447114])]
    categories.core = [stat([223153, 223124]), stat([223153, 223302])]
    categories.boots = [stat([223006])]
    categories.final = [stat([223153, 443054, 223031])]

    expect(buildArenaItemSet({ championId: 429, championName: '卡莉丝塔', categories })).toEqual({
      uid: 'aramgg-arena-429',
      title: 'ARAMGG Arena - 卡莉丝塔',
      type: 'custom',
      map: 'any',
      mode: 'any',
      sortrank: 0,
      startedFrom: 'blank',
      associatedChampions: [429],
      associatedMaps: [],
      blocks: [
        { type: '棱彩装备', items: [{ id: 443054, count: 1 }, { id: 447114, count: 1 }] },
        { type: '核心装备', items: [{ id: 223153, count: 1 }, { id: 223124, count: 1 }, { id: 223302, count: 1 }] },
        { type: '鞋子', items: [{ id: 223006, count: 1 }] },
        { type: '最终装备', items: [{ id: 223153, count: 1 }, { id: 443054, count: 1 }, { id: 223031, count: 1 }] },
      ],
    })
  })

  it('does not create an empty managed set', () => {
    expect(buildArenaItemSet({ championId: 1, championName: '安妮', categories: emptyArenaItemCategories() })).toBeNull()
  })
})
