import { describe, expect, it } from 'vitest'
import { resolveChampionDetailMetric } from '../../src/shared/champion-detail-metric.ts'

describe('champion detail third metric', () => {
  it('prefers games when the local champion data provides them', () => {
    expect(resolveChampionDetailMetric(1234, 3.42)).toEqual({ kind: 'games', value: 1234 })
  })

  it('falls back to OP.GG average placement when games are unavailable', () => {
    expect(resolveChampionDetailMetric(null, 3.42)).toEqual({ kind: 'average-placement', value: 3.42 })
  })

  it('hides the metric when neither source has a value', () => {
    expect(resolveChampionDetailMetric(null, null)).toBeNull()
  })
})
