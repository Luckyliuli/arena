import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { findChampionSlug } from '../../../../shared/champion-map.ts'
import { emptyArenaItemCategories, type ArenaItemStatsBundle } from '../itemTypes.ts'
import { extractOpggPagePatch, onlineOpggItemsHtmlFetcher, type ArenaAugmentHtmlFetcher } from './fetcher.ts'
import { parseOpggItems } from './itemsParser.ts'

export interface OpggItemCache {
  get(championId: number, patch?: string): Promise<ArenaItemStatsBundle | null>
  set(championId: number, bundle: ArenaItemStatsBundle, patch?: string): Promise<void>
  clear(championId: number, patch?: string): Promise<void>
}

export interface OpggItemSourceOptions {
  fetcher?: ArenaAugmentHtmlFetcher
  cache?: OpggItemCache
  defaultChampionSlug?: string
}

export function opggItemSource(opts: OpggItemSourceOptions = {}) {
  const fetcher = opts.fetcher ?? onlineOpggItemsHtmlFetcher()
  const cache = opts.cache ?? null
  const fallbackSlug = opts.defaultChampionSlug ?? null

  return {
    id: 'opgg' as const,
    label: opts.fetcher ? 'OP.GG Arena items (custom fetcher)' : 'OP.GG Arena items (live HTTPS)',
    async getItemsForChampion(championId: number, options: { patch?: string } = {}): Promise<ArenaItemStatsBundle> {
      const patch = options.patch
      if (cache) {
        const hit = await cache.get(championId, patch)
        if (hit) return hit
      }

      const slug = findChampionSlug(championId) ?? fallbackSlug
      if (!slug) return emptyBundle('unknown-champion')

      let html: string
      try {
        html = await fetcher(slug, { patch })
      } catch {
        return emptyBundle('fetch-failed')
      }

      const pagePatch = extractOpggPagePatch(html)
      if (patch && pagePatch && pagePatch !== patch) return emptyBundle('patch-unavailable', pagePatch)

      const categories = parseOpggItems(html)
      const recordCount = Object.values(categories).reduce((count, rows) => count + rows.length, 0)
      if (recordCount === 0) return emptyBundle('page-shape-changed')

      const bundle: ArenaItemStatsBundle = {
        fetchedAt: new Date().toISOString(),
        patch: pagePatch || patch,
        source: 'opgg',
        mock: false,
        categories,
      }
      if (cache) await cache.set(championId, bundle, patch)
      return bundle
    },
  }
}

function emptyBundle(reason: string, patch?: string): ArenaItemStatsBundle {
  return {
    fetchedAt: new Date().toISOString(),
    patch,
    source: 'opgg',
    mock: false,
    categories: emptyArenaItemCategories(),
    reason,
  }
}

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000

function cachePatch(patch?: string): string {
  return patch && /^\d{1,2}\.\d{1,2}$/.test(patch) ? patch : 'current'
}

export function fileOpggItemCache(dir: string, opts: { ttlMs?: number } = {}): OpggItemCache {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS
  const fileFor = (championId: number, patch?: string) =>
    path.join(dir, `items-v2-${cachePatch(patch)}-${championId}.json`)
  return {
    async get(championId, patch) {
      try {
        const parsed = JSON.parse(await fs.readFile(fileFor(championId, patch), 'utf8')) as ArenaItemStatsBundle
        const fetchedAt = Date.parse(parsed?.fetchedAt)
        const count = Object.values(parsed?.categories ?? {}).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0)
        if (!parsed || count === 0 || !Number.isFinite(fetchedAt) || Date.now() - fetchedAt > ttlMs) return null
        return parsed
      } catch {
        return null
      }
    },
    async set(championId, bundle, patch) {
      const count = Object.values(bundle.categories).reduce((sum, rows) => sum + rows.length, 0)
      if (count === 0) return
      try {
        await fs.mkdir(dir, { recursive: true })
        const target = fileFor(championId, patch)
        const tmp = target + '.tmp'
        await fs.writeFile(tmp, JSON.stringify(bundle), 'utf8')
        await fs.rename(tmp, target)
      } catch {
        // Cache is best-effort only.
      }
    },
    async clear(championId, patch) {
      try { await fs.rm(fileFor(championId, patch), { force: true }) } catch {
      // Cache clearing is best-effort only.
    }
    },
  }
}

export function memoryOpggItemCache(opts: { ttlMs?: number } = {}): OpggItemCache & { size(): number } {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS
  const store = new Map<string, ArenaItemStatsBundle>()
  const keyFor = (championId: number, patch?: string) => `${cachePatch(patch)}:${championId}`
  return {
    async get(championId, patch) {
      const hit = store.get(keyFor(championId, patch))
      if (!hit) return null
      const fetchedAt = Date.parse(hit.fetchedAt)
      if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > ttlMs) return null
      return hit
    },
    async set(championId, bundle, patch) {
      const count = Object.values(bundle.categories).reduce((sum, rows) => sum + rows.length, 0)
      if (count > 0) store.set(keyFor(championId, patch), bundle)
    },
    async clear(championId, patch) { store.delete(keyFor(championId, patch)) },
    size() { return store.size },
  }
}
