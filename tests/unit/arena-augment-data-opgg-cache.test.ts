// T08c: OP.GG fetch cache + empty-result diagnostics.
//
// Two things are covered here:
//
//  1. The cache. Without it every leaderboard refresh cost 1–2s and hit
//     OP.GG again for identical data. The important behaviours are that a
//     hit short-circuits the fetcher, that an EMPTY result is never
//     cached (a transient failure must not be pinned for the whole TTL),
//     and that an expired entry reads as a miss.
//
//  2. The `reason` codes on an empty bundle. Before this, a page whose
//     layout had changed was indistinguishable from "this champion has no
//     data" — the UI showed a generic empty message and nobody knew the
//     scraper was broken.

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { promises as fsp } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  fileOpggCache,
  memoryOpggCache,
  offlineOpggHtmlFetcher,
  opggSource,
} from '../../src/main/services/arena-augment-data/opgg/index.ts'

const FIXTURES = 'tests/fixtures/opgg'

// A fetcher that counts calls and can be told to fail, so we can prove the
// cache actually short-circuits the network path.
function countingFetcher(impl: (slug: string) => Promise<string>) {
  const state = { calls: 0 }
  const fn = async (slug: string) => {
    state.calls++
    return impl(slug)
  }
  return { fn, state }
}

describe('memoryOpggCache', () => {
  it('stores and returns a non-empty bundle', async () => {
    const c = memoryOpggCache()
    const bundle = { fetchedAt: new Date().toISOString(), source: 'opgg', mock: false, records: [{ augmentId: 1, averagePlacement: null, firstPlaceRate: null, pickRate: 0.1, winRate: 0.5, sampleSize: 10 }] } as never
    await c.set(1, bundle)
    expect(await c.get(1)).toEqual(bundle)
  })

  it('never stores an empty bundle', async () => {
    const c = memoryOpggCache()
    const empty = { fetchedAt: new Date().toISOString(), source: 'opgg', mock: false, records: [] } as never
    await c.set(1, empty)
    expect(await c.get(1)).toBeNull()
    expect(c.size()).toBe(0)
  })

  it('treats an entry older than the TTL as a miss', async () => {
    const c = memoryOpggCache({ ttlMs: 1000 })
    const stale = {
      fetchedAt: new Date(Date.now() - 5000).toISOString(),
      source: 'opgg',
      mock: false,
      records: [{ augmentId: 1, averagePlacement: null, firstPlaceRate: null, pickRate: 0.1, winRate: 0.5, sampleSize: 10 }],
    } as never
    await c.set(1, stale)
    expect(await c.get(1)).toBeNull()
  })

  it('clear() drops an entry', async () => {
    const c = memoryOpggCache()
    const bundle = { fetchedAt: new Date().toISOString(), source: 'opgg', mock: false, records: [{ augmentId: 1, averagePlacement: null, firstPlaceRate: null, pickRate: 0.1, winRate: 0.5, sampleSize: 10 }] } as never
    await c.set(1, bundle)
    await c.clear(1)
    expect(await c.get(1)).toBeNull()
  })
})

describe('fileOpggCache', () => {
  let dir: string
  const goodRecords = [{ augmentId: 1, averagePlacement: null, firstPlaceRate: null, pickRate: 0.1, winRate: 0.5, sampleSize: 10 }]

  beforeEach(async () => {
    dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'opgg-cache-'))
  })
  afterEach(async () => {
    await fsp.rm(dir, { recursive: true, force: true })
  })

  it('round-trips a bundle through disk', async () => {
    const c = fileOpggCache(dir)
    const bundle = { fetchedAt: new Date().toISOString(), source: 'opgg', mock: false, records: goodRecords } as never
    await c.set(64, bundle)
    expect(await c.get(64)).toEqual(bundle)
  })

  it('does not write a file for an empty bundle', async () => {
    const c = fileOpggCache(dir)
    await c.set(64, { fetchedAt: new Date().toISOString(), source: 'opgg', mock: false, records: [] } as never)
    const entries = await fsp.readdir(dir)
    expect(entries).toEqual([])
  })

  it('returns null for a missing entry instead of throwing', async () => {
    const c = fileOpggCache(dir)
    expect(await c.get(999999)).toBeNull()
  })

  it('returns null for a corrupt entry instead of throwing', async () => {
    const c = fileOpggCache(dir)
    await fsp.writeFile(path.join(dir, 'champion-v2-7.json'), '{ not json', 'utf8')
    expect(await c.get(7)).toBeNull()
  })

  it('ignores legacy augment cache files that lack display metadata', async () => {
    const c = fileOpggCache(dir)
    await fsp.writeFile(
      path.join(dir, 'champion-7.json'),
      JSON.stringify({
        fetchedAt: new Date().toISOString(),
        source: 'opgg',
        mock: false,
        records: goodRecords,
      }),
      'utf8',
    )
    expect(await c.get(7)).toBeNull()
  })

  it('treats an entry older than the TTL as a miss', async () => {
    const c = fileOpggCache(dir, { ttlMs: 1000 })
    await fsp.writeFile(
      path.join(dir, 'champion-v2-7.json'),
      JSON.stringify({ fetchedAt: new Date(Date.now() - 60_000).toISOString(), source: 'opgg', mock: false, records: goodRecords }),
      'utf8',
    )
    expect(await c.get(7)).toBeNull()
  })

  it('survives an unwritable directory without throwing', async () => {
    // A path whose parent is a file, so mkdir fails.
    const bogus = path.join(dir, 'champion-7.json', 'nested')
    const c = fileOpggCache(bogus)
    await expect(c.set(7, { fetchedAt: new Date().toISOString(), source: 'opgg', mock: false, records: goodRecords } as never)).resolves.toBeUndefined()
  })
})

describe('opggSource cache integration', () => {
  it('serves the second request from cache without calling the fetcher again', async () => {
    const { fn, state } = countingFetcher(offlineOpggHtmlFetcher(FIXTURES))
    const cache = memoryOpggCache()
    const src = opggSource({ fetcher: fn, cache })

    const first = await src.getStatsForChampion(1)
    const second = await src.getStatsForChampion(1)

    expect(first.records.length).toBeGreaterThan(0)
    expect(second).toEqual(first)
    expect(state.calls).toBe(1)
    expect(cache.size()).toBe(1)
  })

  it('does not cache a failed fetch, so the next call retries', async () => {
    let fail = true
    const { fn, state } = countingFetcher(async (slug) => {
      if (fail) throw new Error('offline')
      return offlineOpggHtmlFetcher(FIXTURES)(slug)
    })
    const cache = memoryOpggCache()
    const src = opggSource({ fetcher: fn, cache })

    const failed = await src.getStatsForChampion(1)
    expect(failed.records).toEqual([])
    expect(failed.reason).toBe('fetch-failed')
    expect(cache.size()).toBe(0)

    fail = false
    const ok = await src.getStatsForChampion(1)
    expect(ok.records.length).toBeGreaterThan(0)
    expect(state.calls).toBe(2)
  })
})

describe('opggSource empty-result reasons', () => {
  it('reports unknown-champion when the champion id has no slug', async () => {
    const src = opggSource({ fetcher: offlineOpggHtmlFetcher(FIXTURES), cache: memoryOpggCache() })
    const bundle = await src.getStatsForChampion(999999)
    expect(bundle.records).toEqual([])
    expect(bundle.reason).toBe('unknown-champion')
  })

  it('reports fetch-failed when the fetcher throws', async () => {
    const src = opggSource({
      fetcher: async () => { throw new Error('network down') },
      cache: memoryOpggCache(),
    })
    const bundle = await src.getStatsForChampion(1)
    expect(bundle.records).toEqual([])
    expect(bundle.reason).toBe('fetch-failed')
  })

  it('reports page-shape-changed when the page carries no augment payload', async () => {
    // This is the alarm that fires if OP.GG moves their markup: the HTML
    // arrives, but the RSC chunk we depend on is gone.
    const src = opggSource({
      fetcher: async () => '<!DOCTYPE html><html><body>totally different page</body></html>',
      cache: memoryOpggCache(),
    })
    const bundle = await src.getStatsForChampion(1)
    expect(bundle.records).toEqual([])
    expect(bundle.reason).toBe('page-shape-changed')
  })

  it('keeps parsed records when they are absent from the catalog', async () => {
    // Same shape as the real payload, but every id is bogus.
    const html = await buildSingleRecordPage()
    const src = opggSource({ fetcher: async () => html, cache: memoryOpggCache() })
    const bundle = await src.getStatsForChampion(1)
    expect(bundle.records).toEqual([expect.objectContaining({ augmentId: 888888, displayName: { en: '幽灵符文', zh: '幽灵符文' } })])
    expect(bundle.reason).toBeUndefined()
  })

  it('omits reason entirely on a successful fetch', async () => {
    const src = opggSource({ fetcher: offlineOpggHtmlFetcher(FIXTURES), cache: memoryOpggCache() })
    const bundle = await src.getStatsForChampion(1)
    expect(bundle.records.length).toBeGreaterThan(0)
    expect(bundle.reason).toBeUndefined()
  })
})

/** Synthetic RSC page whose only record has an id absent from the catalog. */
async function buildSingleRecordPage(): Promise<string> {
  const records = {
    '1': [{ id: 888888, name: '幽灵符文', rareity: 1, image_url: null, pick_rate: 1, win_rate: 50, play: '1', desc: '' }],
  }
  const payloadJson = JSON.stringify(['$', '$L5a', null, { data: records }])
  const literal = JSON.stringify('59:' + payloadJson)
  return '<!DOCTYPE html><html><body><script>self.__next_f.push([1,' + literal + '])</script></body></html>'
}
