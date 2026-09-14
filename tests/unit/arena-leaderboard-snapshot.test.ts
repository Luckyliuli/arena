import { describe, expect, it } from 'vitest'
import { loadArenaLeaderboardSnapshot } from '../../src/shared/arena-leaderboard-snapshot.ts'

describe('bundled Arena leaderboard snapshot', () => {
  it('contains champion and combination leaderboards for the current patch', () => {
    const snapshot = loadArenaLeaderboardSnapshot()
    expect(snapshot.patch).toMatch(/^\d+\.\d+/)
    expect(snapshot.champions.length).toBeGreaterThan(100)
    expect(snapshot.combinations.trio.length).toBeGreaterThan(10)
    expect(snapshot.combinations.duo.length).toBeGreaterThan(10)
    expect(snapshot.champions.every(row => row.winRate == null || (row.winRate >= 0 && row.winRate <= 1))).toBe(true)
  })
})
