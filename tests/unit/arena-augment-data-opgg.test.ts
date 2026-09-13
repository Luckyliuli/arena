// T08: OP.GG Arena augment source — adapter side.
//
// These tests cover the pieces we can validate offline:
//  - OpggParser turns a fixture <script type="application/json"> into records
//  - OpggParser returns [] when no data island is present (the real-life
//    case today, because OP.GG renders the data client-side and the SSR
//    HTML fixture we saved has no island)
//  - the opggSource() builder accepts an optional fetcher override; we
//    hand it an in-memory fetcher that loads fixtures/opgg/ so the whole
//    chain is exercised with zero network traffic
//
// Going from "real OP.GG SSR HTML" to "parser actually finds the data"
// needs Playwright. That work is documented in
// docs/adr/0005-opgg-scraper-mvp.md and tracked separately.

import { describe, expect, it } from 'vitest'
import {
  parseOpggAugmentsHtml,
  offlineOpggHtmlFetcher,
  opggSource,
} from '../../src/main/services/arena-augment-data/opgg/index.ts'

// Hand-crafted fixture: arena-leona-augments.html. The parser
// recognizes the <script type="application/json" id="__OPGG_ARENA_AUGMENTS__">
// island and emits 4 records.
const FIXTURES = 'tests/fixtures/opgg'

describe('parseOpggAugmentsHtml', () => {
  it('returns [] when the HTML has no data island', async () => {
    const empty = `<!DOCTYPE html><html><body><h1>Empty OP.GG SSR</h1></body></html>`
    expect(parseOpggAugmentsHtml(empty)).toEqual([])
  })

  it('extracts records from a <script id="__OPGG_ARENA_AUGMENTS__"> island', async () => {
    const fs = await import('node:fs/promises')
    const html = await fs.readFile(`${FIXTURES}/arena-leona-augments.html`, 'utf8')
    const records = parseOpggAugmentsHtml(html)
    expect(records.length).toBe(4)
    const first = records[0]
    expect(first.name).toBe('曙光女神的觉醒')
    expect(first.rarityTier).toBe('prismatic')
    expect(first.tierRank).toBe(1)
    expect(first.pickRate).toBeCloseTo(0.182, 4)
    expect(first.winRate).toBeCloseTo(0.731, 4)
    expect(first.top4Rate).toBeCloseTo(0.812, 4)
    expect(first.playCount).toBe(48721)
    // pre-DPR-9001 augments: tierRank should be respected as-is (smaller = stronger).
    expect(records[3].tierRank).toBe(41)
  })

  it('prefers the json island over an RSC chunk containing empty augments', async () => {
    const fs = await import('node:fs/promises')
    const html = await fs.readFile(`${FIXTURES}/arena-leona-augments.html`, 'utf8')
    const records = parseOpggAugmentsHtml(html)
    expect(records.length).toBe(4)
  })

  it('resists malformed JSON in the island without throwing', () => {
    const html = `<script type="application/json" id="__OPGG_ARENA_AUGMENTS__">{"augments":[{"name":</script>`
    expect(() => parseOpggAugmentsHtml(html)).not.toThrow()
    expect(parseOpggAugmentsHtml(html)).toEqual([])
  })
})

describe('opggSource (offline fetcher)', () => {
  it('returns a bundle with source="opgg" and mock=false when the JSON island exists', async () => {
    const fetcher = offlineOpggHtmlFetcher(FIXTURES)
    const src = opggSource({ fetcher })
    const bundle = await src.getStatsForChampion(0, { patch: '16.18' })
    expect(src.id).toBe('opgg')
    expect(bundle.source).toBe('opgg')
    expect(bundle.mock).toBe(false)
    // The mock HTML does not include an OP.GG-champion id; the parser is
    // currently id-less so we expect records to flow through. Future id
    // mapping will be done when OP.GG exposes real API IDs.
    expect(bundle.records.length).toBe(4)
  })

  it('returns records=[] (without throwing) when the fetcher cannot read the HTML', async () => {
    const src = opggSource({ fetcher: offlineOpggHtmlFetcher('tests/fixtures/does-not-exist') })
    const bundle = await src.getStatsForChampion(0)
    expect(bundle.source).toBe('opgg')
    expect(bundle.records).toEqual([])
  })

  it('uses a default online fetcher when no fetcher is supplied', () => {
    const src = opggSource()
    expect(src.id).toBe('opgg')
    expect(typeof src.getStatsForChampion).toBe('function')
  })
})
