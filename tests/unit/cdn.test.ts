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

  it('rewrites OP.GG augment icons to the public icon mirror that serves the desktop client', () => {
    expect(getAugmentIconUrl('https://opgg-static.akamaized.net/meta/images/lol/latest/augment/criticalrhythm_large.png'))
      .toBe('https://cdn.dtodo.cn/hextech/augment-icons/criticalrhythm_large.png')
  })
})
