import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import {
  parseArenaLeaderboardSnapshot,
  type ArenaLeaderboardSnapshot,
} from '../../../../shared/arena-leaderboard-snapshot.ts'

export type ArenaLeaderboardServiceOptions = {
  bundled: ArenaLeaderboardSnapshot
  cacheFile: string
  refresh: () => Promise<ArenaLeaderboardSnapshot>
  ttlMs?: number
  now?: () => number
  onUpdated?: (snapshot: ArenaLeaderboardSnapshot) => void
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

export function createArenaLeaderboardService(options: ArenaLeaderboardServiceOptions) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  const now = options.now ?? Date.now
  let current = options.bundled
  let refreshPromise: Promise<ArenaLeaderboardSnapshot> | null = null

  async function readCache(): Promise<{ snapshot: ArenaLeaderboardSnapshot; fresh: boolean } | null> {
    try {
      const [raw, stat] = await Promise.all([
        fs.readFile(options.cacheFile, 'utf8'),
        fs.stat(options.cacheFile),
      ])
      return {
        snapshot: parseArenaLeaderboardSnapshot(raw),
        fresh: now() - stat.mtimeMs < ttlMs,
      }
    } catch {
      return null
    }
  }

  async function writeCache(snapshot: ArenaLeaderboardSnapshot): Promise<void> {
    try {
      await fs.mkdir(path.dirname(options.cacheFile), { recursive: true })
      const temporary = options.cacheFile + '.tmp'
      await fs.writeFile(temporary, JSON.stringify(snapshot), 'utf8')
      await fs.rename(temporary, options.cacheFile)
    } catch {
      // The packaged snapshot remains usable if the cache is unwritable.
    }
  }

  function refreshNow(): Promise<ArenaLeaderboardSnapshot> {
    if (!refreshPromise) {
      refreshPromise = options.refresh()
        .then(async snapshot => {
          current = snapshot
          await writeCache(snapshot)
          options.onUpdated?.(snapshot)
          return snapshot
        })
        .catch(() => current)
        .finally(() => {
          refreshPromise = null
        })
    }
    return refreshPromise
  }

  return {
    async getSnapshot(): Promise<ArenaLeaderboardSnapshot> {
      const cached = await readCache()
      if (cached) {
        current = cached.snapshot
        if (!cached.fresh) void refreshNow()
        return current
      }

      void refreshNow()
      return current
    },
    refreshNow,
  }
}
