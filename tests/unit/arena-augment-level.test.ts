import { describe, expect, it } from 'vitest'
import { parseArenaAugmentLevel } from '../../src/main/services/arena-augment-data/augment-level.ts'

describe('parseArenaAugmentLevel', () => {
  it('reads Chinese and English level labels emitted by Arena UI OCR', () => {
    expect(parseArenaAugmentLevel('2级')).toBe(2)
    expect(parseArenaAugmentLevel('Lv.2')).toBe(2)
    expect(parseArenaAugmentLevel('等级 3')).toBe(3)
    expect(parseArenaAugmentLevel('LEVEL:2')).toBe(2)
    expect(parseArenaAugmentLevel('2')).toBe(2)
  })

  it('rejects unrelated numbers and invalid levels', () => {
    expect(parseArenaAugmentLevel('2个')).toBeNull()
    expect(parseArenaAugmentLevel('伤害 25')).toBeNull()
    expect(parseArenaAugmentLevel('Lv.9')).toBeNull()
    expect(parseArenaAugmentLevel('')).toBeNull()
  })
})
