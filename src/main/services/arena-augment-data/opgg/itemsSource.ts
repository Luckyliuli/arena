import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { findChampionSlug } from '../../../../shared/champion-map.ts'
import { emptyArenaItemCategories, type ArenaItemStatsBundle } from '../itemTypes.ts'
import { onlineOpggItemsHtmlFetcher, type ArenaAugmentHtmlFetcher } from './fetcher.ts'
import { parseOpggItems } from './itemsParser.ts'

export interface OpggItemCache {
  get(championId: number): Promise<ArenaItemStatsBundle | null>
  set(championId: number, bundle: ArenaItemStatsBundle): Promise<void>
  clear(championId: number): Promise<void>
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
    async getItemsForChampion(championId: number): Promise<ArenaItemStatsBundle> {
      if (cache) {
        const hit = await cache.get(championId)
        if (hit) return hit
      }

      const slug = findChampionSlug(championId) ?? fallbackSlug
      if (!slug) return emptyBundle('unknown-champion')

      let html: string
      try {
        html = await fetcher(slug)
      } catch {
        return emptyBundle('fetch-failed')
      }

      const categories = parseOpggItems(html)
      const recordCount = Object.values(categories).reduce((count, rows) => count + rows.length, 0)
      if (recordCount === 0) return emptyBundle('page-shape-changed')

      const bundle: ArenaItemStatsBundle = {
        fetchedAt: new Date().toISOString(),
        source: 'opgg',
        mock: false,
        categories,
      }
      if (cache) await cache.set(championId, bundle)
      return bundle
    },
  }
}

function emptyBundle(reason: string): ArenaItemStatsBundle {
  return {
    fetchedAt: new Date().toISOString(),
    source: 'opgg',
    mock: false,
    categories: emptyArenaItemCategories(),
    reason,
  }
}

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000

export function fileOpggItemCache(dir: string, opts: { ttlMs?: number } = {}): OpggItemCache {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS
  const fileFor = (championId: number) => path.join(dir, `items-champion-${championId}.json`)
  return {
    async get(championId) {
      try {
        const parsed = JSON.parse(await fs.readFile(fileFor(championId), 'utf8')) as ArenaItemStatsBundle
        const fetchedAt = Date.parse(parsed?.fetchedAt)
        const count = Object.values(parsed?.categories ?? {}).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0)
        if (!parsed || count === 0 || !Number.isFinite(fetchedAt) || Date.now() - fetchedAt > ttlMs) return null
        return parsed
      } catch {
        return null
      }
    },
    async set(championId, bundle) {
      const count = Object.values(bundle.categories).reduce((sum, rows) => sum + rows.length, 0)
      if (count === 0) return
      try {
        await fs.mkdir(dir, { recursive: true })
        const target = fileFor(championId)
        const tmp = target + '.tmp'
        await fs.writeFile(tmp, JSON.stringify(bundle), 'utf8')
        await fs.rename(tmp, target)
      } catch {
        // Cache is best-effort only.
      }
    },
    async clear(championId) {
      try { await fs.rm(fileFor(championId), { force: true }) } catch {
      // Cache clearing is best-effort only.
    }
    },
  }
}

export function memoryOpggItemCache(opts: { ttlMs?: number } = {}): OpggItemCache & { size(): number } {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS
  const store = new Map<number, ArenaItemStatsBundle>()
  return {
    async get(championId) {
      const hit = store.get(championId)
      if (!hit) return null
      const fetchedAt = Date.parse(hit.fetchedAt)
      if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > ttlMs) return null
      return hit
    },
    async set(championId, bundle) {
      const count = Object.values(bundle.categories).reduce((sum, rows) => sum + rows.length, 0)
      if (count > 0) store.set(championId, bundle)
    },
    async clear(championId) { store.delete(championId) },
    size() { return store.size },
  }
}
