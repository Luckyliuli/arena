import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createArenaLeaderboardService } from '../../src/main/services/arena-augment-data/opgg/leaderboardService.ts'
import type { ArenaLeaderboardSnapshot } from '../../src/shared/arena-leaderboard-snapshot.ts'

function snapshot(patch: string, winRate: number): ArenaLeaderboardSnapshot {
  return {
    schemaVersion: 2,
    patch,
    source: 'opgg',
    champions: [{ championId: 1, slug: 'Annie', winRate, pickRate: 0.1, averagePlacement: 3.2 }],
    combinations: { trio: [], duo: [] },
  }
}

describe('Arena leaderboard snapshot service', () => {
  let dir: string
  let cacheFile: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'arena-leaderboard-service-'))
    cacheFile = path.join(dir, 'snapshot.json')
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('returns the stale cached snapshot immediately and refreshes in the background', async () => {
    const stale = snapshot('16.17', 0.5)
    const fresh = snapshot('16.18', 0.55)
    await fs.writeFile(cacheFile, JSON.stringify(stale), 'utf8')
    await fs.utimes(cacheFile, new Date(0), new Date(0))

    const refreshed = vi.fn()
    const refresh = vi.fn(async () => fresh)
    const service = createArenaLeaderboardService({
      bundled: snapshot('16.16', 0.49),
      cacheFile,
      refresh,
      ttlMs: 1000,
      now: () => 10_000,
      onUpdated: refreshed,
    })

    expect(await service.getSnapshot()).toEqual(stale)
    await service.refreshNow()
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refreshed).toHaveBeenCalledWith(fresh)
    expect(JSON.parse(await fs.readFile(cacheFile, 'utf8')).patch).toBe('16.18')
  })

  it('does not refresh a cache entry that is still fresh', async () => {
    const fresh = snapshot('16.18', 0.55)
    await fs.writeFile(cacheFile, JSON.stringify(fresh), 'utf8')
    await fs.utimes(cacheFile, new Date(9000), new Date(9000))

    const refresh = vi.fn(async () => snapshot('next', 0.6))
    const service = createArenaLeaderboardService({
      bundled: snapshot('16.17', 0.5),
      cacheFile,
      refresh,
      ttlMs: 2000,
      now: () => 10_000,
    })

    expect(await service.getSnapshot()).toEqual(fresh)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('returns the bundled snapshot immediately when there is no cache', async () => {
    const bundled = snapshot('16.18', 0.52)
    let resolveRefresh!: (value: ArenaLeaderboardSnapshot) => void
    const refresh = vi.fn(() => new Promise<ArenaLeaderboardSnapshot>(resolve => {
      resolveRefresh = resolve
    }))
    const service = createArenaLeaderboardService({ bundled, cacheFile, refresh })

    expect(await service.getSnapshot()).toEqual(bundled)
    resolveRefresh(snapshot('16.18', 0.53))
    await service.refreshNow()
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
