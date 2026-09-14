import { describe, expect, it } from 'vitest'
import { getAugmentIconUrl } from '../../src/renderer/service/cdn.js'

describe('getAugmentIconUrl', () => {
  it('resolves augment asset paths against the CommunityDragon game root', () => {
    expect(getAugmentIconUrl('assets/ux/cherry/augments/icons/jeweledgauntlet_large.png'))
      .toBe('https://raw.communitydragon.org/latest/game/assets/ux/cherry/augments/icons/jeweledgauntlet_large.png')
  })

  it('keeps absolute URLs unchanged', () => {
    expect(getAugmentIconUrl('https://example.com/icon.png')).toBe('https://example.com/icon.png')
  })
})
