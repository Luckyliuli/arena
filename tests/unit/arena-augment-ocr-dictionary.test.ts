// T13: the OCR name table must come from the Arena (斗魂竞技场) augment
// dictionary, not the legacy ARAM `augments.json` path. These tests pin the
// conversion contract and prove the names seen on real 1080p screenshots
// resolve back to dictionary ids.

import { describe, expect, it } from 'vitest'
import { matchAugmentTitleRecords } from '../../src/main/augment-title-matcher.ts'
import {
  loadArenaAugmentsForOcr,
  loadArenaOcrLocaleData,
  resolveArenaOcrLocaleName,
} from '../../src/main/services/arena-augment-data/ocr-dictionary.ts'
import {
  findAugmentByName,
  loadAugmentArenaDictionary,
} from '../../src/shared/augment-dictionary.ts'

describe('arena augment OCR dictionary', () => {
  it('emits one OCR record per dictionary entry', () => {
    const dict = loadAugmentArenaDictionary()
    const records = loadArenaAugmentsForOcr('zh-CN')

    expect(records.length).toBe(dict.length)
    for (const record of records) {
      expect(Number.isInteger(record.id)).toBe(true)
      expect(record.name.trim().length).toBeGreaterThan(0)
      expect(['silver', 'gold', 'prismatic', 'unknown']).toContain(record.rarity)
    }
  })

  it('keeps ids stable against the arena dictionary', () => {
    const byId = new Map(loadAugmentArenaDictionary().map(r => [r.id, r]))
    for (const record of loadArenaAugmentsForOcr('zh-CN')) {
      const source = byId.get(record.id)
      expect(source).toBeDefined()
      expect(record.name).toBe(source?.displayName.zh)
      expect(record.rarity).toBe(source?.rarity)
      expect(record.iconPath).toBe(source?.iconLarge ?? source?.iconSmall ?? null)
    }
  })

  it('serves English names for en locales and Chinese otherwise', () => {
    const zh = loadArenaAugmentsForOcr('zh-CN')
    const en = loadArenaAugmentsForOcr('en-US')
    const tw = loadArenaAugmentsForOcr('zh-TW')

    expect(zh).toEqual(tw)
    expect(en.length).toBe(zh.length)
    expect(en).not.toEqual(zh)

    const zhSample = zh.find(r => r.name === '遁入暗影')
    expect(zhSample).toBeDefined()
    const enSample = en.find(r => r.id === zhSample?.id)
    expect(enSample?.name).toBe('Vanish')
  })

  it('normalizes unknown locales to the default Chinese names', () => {
    expect(resolveArenaOcrLocaleName('pt-BR', { en: 'Vanish', zh: '遁入暗影' })).toBe('遁入暗影')
    expect(resolveArenaOcrLocaleName('en-GB', { en: 'Vanish', zh: '遁入暗影' })).toBe('Vanish')
  })

  it('reports locale, source and version for the OCR loader', () => {
    const data = loadArenaOcrLocaleData('zh-CN')
    expect(data.locale).toBe('zh-CN')
    expect(data.source).toBe('arena-dictionary')
    expect(data.augments.length).toBeGreaterThan(100)
    expect(typeof data.dataVersion).toBe('string')
    expect(data.dataVersion.length).toBeGreaterThan(0)
  })

  it('resolves the names seen on the spike screenshots', () => {
    const records = loadArenaAugmentsForOcr('zh-CN')
    const cases = ['遁入暗影', '召唤师革新', '无休回复', '坦克引擎']

    for (const transcript of cases) {
      const matches = matchAugmentTitleRecords(transcript, records)
      expect(matches.length).toBeGreaterThan(0)
      expect(matches[0].id).toBe(findAugmentByName(transcript, 'zh')?.id)
    }
  })
})