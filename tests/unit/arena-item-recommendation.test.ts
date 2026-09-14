import { describe, expect, it } from 'vitest'
import {
  orderArenaItemRecommendations,
  recommendArenaItemCandidates,
} from '../../src/main/services/arena-augment-data/itemRecommendation.ts'

const item = (itemId: number, averagePlacement: number | null, overrides: Record<string, unknown> = {}) => ({
  items: [{ itemId, name: `Item ${itemId}`, iconUrl: null }],
  averagePlacement,
  firstPlaceRate: 0.2,
  pickRate: 0.1,
  winRate: 0.5,
  sampleSize: 100,
  ...overrides,
})

describe('recommendArenaItemCandidates', () => {
  it('aligns items to the three detected slots', () => {
    const result = recommendArenaItemCandidates(
      [{ itemId: 303, detectedSlot: 2 }, { itemId: 101, detectedSlot: 0 }, { itemId: 202, detectedSlot: 1 }],
      [item(101, 3.2), item(202, 2.7), item(303, 3.8)],
    )

    expect(result.map(row => row.detectedSlot)).toEqual([0, 1, 2])
    expect(result.map(row => row.itemId)).toEqual([101, 202, 303])
    expect(result[1].isTopPick).toBe(true)
  })

  it('orders by average placement, first place, pick rate, then sample size', () => {
    const ordered = orderArenaItemRecommendations([
      item(101, 3.0, { firstPlaceRate: 0.2, pickRate: 0.3, sampleSize: 500 }),
      item(202, 2.5, { firstPlaceRate: 0.1, pickRate: 0.1, sampleSize: 500 }),
      item(303, 2.5, { firstPlaceRate: 0.3, pickRate: 0.1, sampleSize: 500 }),
      item(404, 2.5, { firstPlaceRate: 0.3, pickRate: 0.2, sampleSize: 500 }),
      item(505, 2.5, { firstPlaceRate: 0.3, pickRate: 0.2, sampleSize: 800 }),
    ])

    expect(ordered.map(row => row.items[0].itemId)).toEqual([505, 404, 303, 202, 101])
  })

  it('keeps a recognised item without stats visible but out of top-pick selection', () => {
    const result = recommendArenaItemCandidates(
      [{ itemId: 101, detectedSlot: 0 }, { itemId: 202, detectedSlot: 1 }],
      [item(101, 3.2)],
    )

    expect(result[0]).toMatchObject({ itemId: 101, dataAvailable: true, isTopPick: true })
    expect(result[1]).toMatchObject({ itemId: 202, dataAvailable: false, missing: false, isTopPick: false })
  })
})
