import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseOpggItems } from '../../src/main/services/arena-augment-data/opgg/itemsParser.ts'
import { memoryOpggItemCache, opggItemSource } from '../../src/main/services/arena-augment-data/opgg/itemsSource.ts'

const fixture = readFileSync(
  fileURLToPath(new URL('../fixtures/opgg/arena-kalista-items.html', import.meta.url)),
  'utf8',
)

describe('OP.GG Arena item parser', () => {
  it('parses all five champion item sections in display order', () => {
    const result = parseOpggItems(fixture)

    expect(Object.keys(result)).toEqual(['prismatic', 'core', 'boots', 'starting', 'final'])
    expect(result.prismatic.length).toBeGreaterThan(0)
    expect(result.core.length).toBeGreaterThan(0)
    expect(result.boots.length).toBeGreaterThan(0)
    expect(Array.isArray(result.starting)).toBe(true)
    expect(result.final.length).toBeGreaterThan(0)
  })

  it('normalizes prismatic item stats and keeps icon metadata', () => {
    const first = parseOpggItems(fixture).prismatic[0]

    expect(first.items).toEqual([
      {
        itemId: 443090,
        name: '收割者的过路费',
        iconUrl: expect.stringContaining('/item/443090.png'),
      },
    ])
    expect(first.averagePlacement).toBeCloseTo(3.09)
    expect(first.firstPlaceRate).toBeCloseTo(0.2315)
    expect(first.pickRate).toBeCloseTo(0.2273)
    expect(first.sampleSize).toBe(6376)
    expect(first.winRate).toBeCloseTo(0.607)
  })

  it('returns empty sections for a page without the Arena item tables', () => {
    expect(parseOpggItems('<html><body>not OP.GG</body></html>')).toEqual({
      prismatic: [],
      core: [],
      boots: [],
      starting: [],
      final: [],
    })
  })
})

describe('OP.GG Arena item source', () => {
  it('returns a cached bundle for a mapped champion', async () => {
    const cache = memoryOpggItemCache()
    const source = opggItemSource({
      fetcher: async () => fixture,
      cache,
      defaultChampionSlug: 'Kalista',
    })

    const first = await source.getItemsForChampion(429)
    const second = await source.getItemsForChampion(429)

    expect(first.reason).toBeUndefined()
    expect(first.categories.prismatic[0].items[0].itemId).toBe(443090)
    expect(second).toEqual(first)
  })

  it('reports an unknown champion without fetching', async () => {
    let fetched = false
    const source = opggItemSource({
      fetcher: async () => {
        fetched = true
        return fixture
      },
    })

    const result = await source.getItemsForChampion(999999)

    expect(fetched).toBe(false)
    expect(result.categories.prismatic).toEqual([])
    expect(result.reason).toBe('unknown-champion')
  })

  it('reports an OP.GG shape change instead of caching an empty bundle', async () => {
    const cache = memoryOpggItemCache()
    const source = opggItemSource({
      fetcher: async () => '<html></html>',
      cache,
      defaultChampionSlug: 'Kalista',
    })

    const result = await source.getItemsForChampion(429)

    expect(result.reason).toBe('page-shape-changed')
    expect(cache.size()).toBe(0)
  })
})
