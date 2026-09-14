import { describe, expect, it } from 'vitest'
import { findArenaItemById, findArenaItemByName, loadArenaItemDictionary } from '../../src/shared/item-dictionary.ts'

describe('Arena item dictionary', () => {
  it('contains ordinary and prismatic item names used by item anvil OCR', () => {
    expect(findArenaItemByName('暗钢利爪')?.id).toBe(443054)
    expect(findArenaItemByName('混响之刃')?.id).toBe(447114)
    expect(findArenaItemByName('飞升护符')?.id).toBe(443064)
    expect(findArenaItemByName('神圣分离者')?.id).toBe(6632)
    expect(findArenaItemById(443054)?.displayName.en).toBe('Darksteel Talons')
  })

  it('loads a non-trivial dictionary', () => {
    expect(loadArenaItemDictionary().length).toBeGreaterThan(500)
  })
})
