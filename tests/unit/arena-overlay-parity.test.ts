import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Arena overlay visual parity', () => {
  it('renders augment and prismatic item overlays through the same recommendation card', async () => {
    const [augment, item] = await Promise.all([
      readFile(new URL('../../src/renderer/components/AugmentFloatingOverlay.vue', import.meta.url), 'utf8'),
      readFile(new URL('../../src/renderer/components/ArenaItemFloatingOverlay.vue', import.meta.url), 'utf8'),
    ])
    expect(augment).toContain("import ArenaRecommendationCard from './ArenaRecommendationCard.vue'")
    expect(item).toContain("import ArenaRecommendationCard from './ArenaRecommendationCard.vue'")
    expect(augment).toContain('<ArenaRecommendationCard')
    expect(item).toContain('<ArenaRecommendationCard')
  })
})
