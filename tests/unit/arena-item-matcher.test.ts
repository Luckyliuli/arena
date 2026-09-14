import { describe, expect, it } from 'vitest'
import { matchArenaItemNames, matchArenaItemSlotTexts } from '../../src/main/services/arena-augment-data/itemMatcher.ts'

const rows = [
  { items: [{ itemId: 443090, name: '收割者的过路费', iconUrl: 'a.png' }], averagePlacement: 3.1, firstPlaceRate: 0.2, pickRate: 0.1, winRate: 0.6, sampleSize: 100 },
  { items: [{ itemId: 443069, name: '断筋者', iconUrl: 'b.png' }], averagePlacement: 3.2, firstPlaceRate: 0.2, pickRate: 0.1, winRate: 0.6, sampleSize: 100 },
  { items: [{ itemId: 447114, name: '混响之刃', iconUrl: 'c.png' }], averagePlacement: 3.3, firstPlaceRate: 0.2, pickRate: 0.1, winRate: 0.6, sampleSize: 100 },
]

describe('matchArenaItemSlotTexts', () => {
  it('maps three OCR slot texts back to prismatic item ids', () => {
    const candidates = matchArenaItemSlotTexts(['收割者的过路费 3.10', '断筋者', '混响之刃'], rows)
    expect(candidates).toEqual([
      { itemId: 443090, name: '收割者的过路费', iconUrl: 'a.png', detectedSlot: 0 },
      { itemId: 443069, name: '断筋者', iconUrl: 'b.png', detectedSlot: 1 },
      { itemId: 447114, name: '混响之刃', iconUrl: 'c.png', detectedSlot: 2 },
    ])
  })

  it('does not duplicate the same item across slots', () => {
    const candidates = matchArenaItemSlotTexts(['断筋者', '断筋者', ''], rows)
    expect(candidates.map(candidate => candidate.detectedSlot)).toEqual([0])
  })
})


describe('matchArenaItemNames', () => {
  it('matches a mixed item offer against the full item dictionary', () => {
    const dictionary = [
      { itemId: 443054, name: '暗钢利爪', iconUrl: null },
      { itemId: 3163, name: '神圣分离者', iconUrl: null },
      { itemId: 3733, name: '石像鬼石板甲', iconUrl: null },
    ]
    const candidates = matchArenaItemNames(['暗钢利爪 政费附保坦克', '神圣分离者 温克克星', '石像鬼石板甲 团城耐久力'], dictionary)
    expect(candidates.map(candidate => candidate.itemId)).toEqual([443054, 3163, 3733])
  })
})
