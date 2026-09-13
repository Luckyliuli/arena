import { describe, expect, it } from 'vitest'
import { isLikelyTitleSlotText, matchAugmentTitleRecords } from '../../src/main/augment-title-matcher.ts'

describe('isLikelyTitleSlotText', () => {
  it('accepts title text with a short trait label', () => {
    expect(isLikelyTitleSlotText('速度恶魔 速度', { name: '速度恶魔' })).toBe(true)
    expect(isLikelyTitleSlotText('海克斯科技龙魂 复原力', { name: '海克斯科技龙魂' })).toBe(true)
  })

  it('rejects description text that merely contains an augment name', () => {
    expect(isLikelyTitleSlotText('裁决红包会每24（） 持续3秒的100移', { name: '红包' })).toBe(false)
  })

  it('matches a known OCR alias when a title drops its first character', () => {
    const matches = matchAugmentTitleRecords('板一眼 伤告', [
      { id: 123, name: '一板一眼', rarity: 'gold', iconPath: 'augment.png' },
    ])

    expect(matches[0]?.name).toBe('一板一眼')
  })
})

describe('matchAugmentTitleRecords - window tolerance', () => {
  const record = (id, name) => ({ id, name, rarity: 'gold', iconPath: 'a.png' })

  it('matches when transcript is one char shorter than the name with edit-distance 1', () => {
    // Real-world case: 4-char Chinese title, OCR drops the trailing character.
    // editDistance('裁决王', '裁决王者') = 1 (insertion of 者)
    // maxDistance = floor(4/3) = 1
    const matches = matchAugmentTitleRecords('裁决王', [record(1, '裁决王者')])
    expect(matches).toHaveLength(1)
    expect(matches[0]?.id).toBe(1)
  })

  it('matches when transcript is one char longer than the name with edit-distance 1', () => {
    // Real-world case: OCR picks up a stray character adjacent to the title.
    const matches = matchAugmentTitleRecords('裁决王者!', [record(1, '裁决王者')])
    expect(matches).toHaveLength(1)
    expect(matches[0]?.id).toBe(1)
  })

  it('returns no match when transcript is two or more characters shorter', () => {
    const matches = matchAugmentTitleRecords('裁决', [record(1, '裁决王者')])
    expect(matches).toHaveLength(0)
  })

  it('still matches in the standard equal-length case (regression)', () => {
    const matches = matchAugmentTitleRecords('裁决王者', [record(1, '裁决王者')])
    expect(matches[0]?.id).toBe(1)
  })
})
