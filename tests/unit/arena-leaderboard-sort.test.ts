import { describe, expect, it } from 'vitest'
import { sortArenaAugmentRows } from '../../src/shared/arena-leaderboard.ts'

const rows = [
  { augmentId: 1, winRate: 0.5, pickRate: 0.2 },
  { augmentId: 2, winRate: 0.55, pickRate: 0.1 },
  { augmentId: 3, winRate: 0.55, pickRate: 0.3 },
  { augmentId: 4, winRate: null, pickRate: 0.4 },
  { augmentId: 5, winRate: 0.45, pickRate: null },
]

describe('Arena leaderboard sorting', () => {
  it('defaults to win rate descending with pick rate as the tie-breaker', () => {
    expect(sortArenaAugmentRows(rows, 'winRate', 'desc').map(row => row.augmentId))
      .toEqual([3, 2, 1, 5, 4])
  })

  it('uses win rate as the tie-breaker when sorting by pick rate', () => {
    const tiedPickRates = [
      { augmentId: 1, winRate: 0.48, pickRate: 0.2 },
      { augmentId: 2, winRate: 0.54, pickRate: 0.2 },
      { augmentId: 3, winRate: 0.51, pickRate: 0.2 },
    ]

    expect(sortArenaAugmentRows(tiedPickRates, 'pickRate', 'desc').map(row => row.augmentId))
      .toEqual([2, 3, 1])
  })

  it('toggles direction while always keeping unavailable values last', () => {
    expect(sortArenaAugmentRows(rows, 'winRate', 'asc').map(row => row.augmentId))
      .toEqual([5, 1, 3, 2, 4])
    expect(sortArenaAugmentRows(rows, 'pickRate', 'asc').map(row => row.augmentId))
      .toEqual([2, 1, 3, 4, 5])
  })

  it('does not mutate the source rows', () => {
    const source = [...rows]
    sortArenaAugmentRows(source, 'winRate', 'desc')
    expect(source).toEqual(rows)
  })
})
