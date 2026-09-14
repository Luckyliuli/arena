// OP.GG fetch cache.
//
// Fetching OP.GG costs 1–2s per champion and hammers a third-party site
// that never asked for us. Both problems go away with a small on-disk
// cache keyed by champion id.
//
// Two rules matter:
//
//  1. **Never cache an empty result.** A transient network failure or an
//     OP.GG layout change would otherwise be pinned for the whole TTL and
//     the UI would look permanently broken with no way to recover short
//     of deleting files by hand.
//  2. **Cache failures must never break the app.** A read-only disk, a
//     corrupt JSON file, a missing directory — all of these degrade to
//     "no cache" rather than throwing into the IPC handler.

import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import type { AugmentStatsBundle } from '../interface.ts'

export interface OpggCache {
  /** Return a still-fresh bundle for this champion, or null. */
  get(championId: number): Promise<AugmentStatsBundle | null>
  /** Persist a bundle. Implementations may no-op. */
  set(championId: number, bundle: AugmentStatsBundle): Promise<void>
  /** Drop one entry. Used by diagnostics / tests. */
  clear(championId: number): Promise<void>
}

export interface FileOpggCacheOptions {
  /** TTL in ms. Default 12h — OP.GG's arena aggregates move on a daily cadence. */
  ttlMs?: number
}

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000

// v2 records carry display metadata and icon URLs. Keeping a distinct
// filename makes every pre-v2 entry a clean miss, so users do not keep
// seeing nameless / icon-less augments until the old TTL expires.
const CACHE_SCHEMA_VERSION = 'v2'

/**
 * On-disk cache. One JSON file per champion under `dir`.
 * All operations are best-effort: errors are swallowed and reported as
 * cache misses.
 */
export function fileOpggCache(dir: string, opts: FileOpggCacheOptions = {}): OpggCache {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS

  const fileFor = (championId: number) => path.join(dir, `champion-${CACHE_SCHEMA_VERSION}-${championId}.json`)

  return {
    async get(championId) {
      try {
        const raw = await fs.readFile(fileFor(championId), 'utf8')
        const parsed = JSON.parse(raw) as AugmentStatsBundle
        if (!parsed || typeof parsed !== 'object') return null
        if (!Array.isArray(parsed.records) || parsed.records.length === 0) return null
        const fetchedAt = Date.parse(parsed.fetchedAt)
        if (!Number.isFinite(fetchedAt)) return null
        if (Date.now() - fetchedAt > ttlMs) return null
        return parsed
      } catch {
        return null
      }
    },

    async set(championId, bundle) {
      // Rule 1: an empty bundle is a failure symptom, not a result.
      if (!bundle || bundle.records.length === 0) return
      try {
        await fs.mkdir(dir, { recursive: true })
        // Write to a sibling temp file then rename, so a crash mid-write
        // cannot leave a half-parsed JSON behind.
        const target = fileFor(championId)
        const tmp = target + '.tmp'
        await fs.writeFile(tmp, JSON.stringify(bundle), 'utf8')
        await fs.rename(tmp, target)
      } catch {
        // Cache is an optimisation; never surface its failures.
      }
    },

    async clear(championId) {
      try {
        await fs.rm(fileFor(championId), { force: true })
      } catch {
        // ignore
      }
    },
  }
}

/** In-memory cache for tests and for callers that want a per-process memo. */
export function memoryOpggCache(opts: FileOpggCacheOptions = {}): OpggCache & { size(): number } {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS
  const store = new Map<number, AugmentStatsBundle>()
  return {
    async get(championId) {
      const hit = store.get(championId)
      if (!hit || hit.records.length === 0) return null
      const fetchedAt = Date.parse(hit.fetchedAt)
      if (!Number.isFinite(fetchedAt)) return null
      if (Date.now() - fetchedAt > ttlMs) return null
      return hit
    },
    async set(championId, bundle) {
      if (!bundle || bundle.records.length === 0) return
      store.set(championId, bundle)
    },
    async clear(championId) {
      store.delete(championId)
    },
    size() {
      return store.size
    },
  }
}
