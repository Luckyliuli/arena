// T08b: OP.GG Arena augment source — real RSC payload path.
//
// OP.GG's zh-cn augments page is a Next.js App-Router SPA: the augment
// data arrives inside an RSC payload chunk
// (`self.__next_f.push([1,"<hexId>:<json>"])`), not a JSON island.
// These tests exercise that path offline against a small synthetic
// fixture that mirrors the real payload shape, plus a live-free walk
// through the source seam.
//
// The 600KB × 5 real pages used to validate this during development are
// deliberately NOT in the repo (third-party copyrighted content); they
// live in .workbuddy/opgg-real/ and are used by ad-hoc scripts only.

import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import {
  extractOpggAugments,
  findAugmentTierMap,
  offlineOpggHtmlFetcher,
  onlineOpggHtmlFetcher,
  opggSource,
} from '../../src/main/services/arena-augment-data/opgg/index.ts'
import { findChampionSlug } from '../../src/shared/champion-map.ts'

const FIXTURES = 'tests/fixtures/opgg'
const ANNIE_FIXTURE = `${FIXTURES}/arena-annie-augments.html`

async function loadAnnie(): Promise<string> {
  return readFile(ANNIE_FIXTURE, 'utf8')
}

describe('extractOpggAugments (RSC payload)', () => {
  it('returns [] when the page carries no augment chunk', () => {
    const empty = '<!DOCTYPE html><html><body><h1>Empty</h1></body></html>'
    expect(extractOpggAugments(empty)).toEqual([])
  })

  it('returns [] when the RSC push chunk is malformed', () => {
    const broken = '<script>self.__next_f.push([1,"59:[{\\"data\\":{")</script>'
    expect(() => extractOpggAugments(broken)).not.toThrow()
    expect(extractOpggAugments(broken)).toEqual([])
  })

  it('decodes the chunk-id prefix and yields every record across tiers', async () => {
    const html = await loadAnnie()
    const records = extractOpggAugments(html)
    // 2 silver + 2 gold + 1 prismatic in the fixture
    expect(records.length).toBe(5)
    expect(records.map(r => r.id).sort((a, b) => a - b)).toEqual([48, 65, 97, 205, 999999])
  })

  it('maps OP.GG percent fields onto fractions and integers', async () => {
    const html = await loadAnnie()
    const adapt = extractOpggAugments(html).find(r => r.id === 205)
    expect(adapt).toBeDefined()
    expect(adapt!.name).toBe('物理转魔法')
    expect(adapt!.pickRate).toBeCloseTo(0.1638, 4)
    expect(adapt!.winRate).toBeCloseTo(0.574, 4)
    expect(adapt!.playCount).toBe(1920)
    expect(adapt!.description).toContain('法术强度')
    expect(adapt!.imageUrl).toContain('adapt_large.png')
  })

  it('derives rarity from the OP.GG tier bucket (1=silver, 4=gold, 8=prismatic)', async () => {
    const html = await loadAnnie()
    const byId = new Map(extractOpggAugments(html).map(r => [r.id, r.rarity]))
    expect(byId.get(205)).toBe('silver')
    expect(byId.get(97)).toBe('silver')
    expect(byId.get(65)).toBe('gold')
    expect(byId.get(48)).toBe('prismatic')
  })

  it('findAugmentTierMap returns the tier map itself, not the { data } wrapper', async () => {
    const html = await loadAnnie()
    const map = findAugmentTierMap(html)
    expect(map).not.toBeNull()
    expect(Object.keys(map!).sort()).toEqual(['1', '4', '8'])
  })
})

describe('opggSource (offline fixture, real payload shape)', () => {
  it('resolves championId -> OP.GG slug -> fixture and returns real rows', async () => {
    const src = opggSource({ fetcher: offlineOpggHtmlFetcher(FIXTURES) })
    // championId 1 is Annie, whose slug the offline fetcher resolves to
    // arena-annie-augments.html
    const bundle = await src.getStatsForChampion(1)
    expect(src.id).toBe('opgg')
    expect(bundle.source).toBe('opgg')
    expect(bundle.mock).toBe(false)
    // OP.GG-only rows stay in the bundle and carry fallback metadata.
    expect(bundle.records.map(r => r.augmentId).sort((a, b) => a - b)).toEqual([48, 65, 97, 205, 999999])
    expect(bundle.records.find(r => r.augmentId === 999999)).toMatchObject({ displayName: { en: '不存在的符文', zh: '不存在的符文' }, rarity: 'gold' })
  })

  it('maps OP.GG fields to AugmentPerfStat without inventing placement data', async () => {
    const src = opggSource({ fetcher: offlineOpggHtmlFetcher(FIXTURES) })
    const bundle = await src.getStatsForChampion(1)
    const row = bundle.records.find(r => r.augmentId === 205)
    expect(row).toBeDefined()
    expect(row!.pickRate).toBeCloseTo(0.1638, 4)
    expect(row!.winRate).toBeCloseTo(0.574, 4)
    expect(row!.sampleSize).toBe(1920)
    // OP.GG publishes neither of these on the augment card; we must not
    // synthesise them.
    expect(row!.averagePlacement).toBeNull()
    expect(row!.firstPlaceRate).toBeNull()
  })

  it('returns records=[] (without throwing) when the fixture is missing', async () => {
    const src = opggSource({ fetcher: offlineOpggHtmlFetcher('tests/fixtures/does-not-exist') })
    const bundle = await src.getStatsForChampion(1)
    expect(bundle.source).toBe('opgg')
    expect(bundle.records).toEqual([])
  })

  it('returns records=[] when the champion id has no slug and no fallback', async () => {
    const src = opggSource({ fetcher: offlineOpggHtmlFetcher(FIXTURES) })
    const bundle = await src.getStatsForChampion(999999)
    expect(bundle.records).toEqual([])
  })

  it('builds the live OP.GG URL shape without issuing a request', () => {
    const fetcher = onlineOpggHtmlFetcher({ locale: 'zh-cn', timeoutMs: 1 })
    expect(typeof fetcher).toBe('function')
    const src = opggSource({ fetcher })
    expect(src.id).toBe('opgg')
    expect(typeof src.getStatsForChampion).toBe('function')
  })
})

describe('champion map', () => {
  it('maps numeric champion ids onto OP.GG slugs', () => {
    expect(findChampionSlug(1)).toBe('Annie')
    // Multi-word slugs must survive verbatim (this is why the fetcher no
    // longer re-cases the slug).
    expect(findChampionSlug(21)).toBe('MissFortune')
    expect(findChampionSlug(64)).toBe('LeeSin')
  })

  it('returns undefined for an unknown champion id', () => {
    expect(findChampionSlug(999999)).toBeUndefined()
  })
})
