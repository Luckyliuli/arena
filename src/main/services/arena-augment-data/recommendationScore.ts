import type { ArenaRecommendationTier } from '../../../shared/ipc-contract.ts'

export type ArenaRecommendationScoreRecord = {
  key: number
  winRate: number | null
  pickRate: number | null
  sampleSize: number | null
}

function validProbability(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value >= 0 && value <= 1
}

function validSample(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value >= 0
}

function percentileFor(value: number, sorted: number[]): number {
  if (sorted.length <= 1) return 1
  const first = sorted.indexOf(value)
  let last = first
  while (last + 1 < sorted.length && sorted[last + 1] === value) last += 1
  return ((first + last) / 2) / (sorted.length - 1)
}

export function buildArenaRecommendationScoreMap(
  records: readonly ArenaRecommendationScoreRecord[],
): Map<number, number> {
  const valid = records.filter(record =>
    Number.isInteger(record.key) && record.key > 0
    && validProbability(record.winRate)
    && validProbability(record.pickRate)
    && validSample(record.sampleSize),
  )
  const winRates = valid.map(record => record.winRate as number).sort((a, b) => a - b)
  const pickRates = valid.map(record => record.pickRate as number).sort((a, b) => a - b)
  return new Map(valid.map(record => {
    const winPercentile = percentileFor(record.winRate as number, winRates)
    const pickPercentile = percentileFor(record.pickRate as number, pickRates)
    const sampleConfidence = Math.min((record.sampleSize as number) / 1000, 1)
    const score = winPercentile * 0.7 + pickPercentile * 0.2 + sampleConfidence * 0.1
    return [record.key, Number(score.toFixed(6))]
  }))
}

export function getArenaRecommendationTier(score: number | null): ArenaRecommendationTier | null {
  if (score == null || !Number.isFinite(score)) return null
  if (score >= 0.8) return 'must-pick'
  if (score >= 0.6) return 'strong'
  if (score >= 0.4) return 'recommended'
  if (score >= 0.2) return 'optional'
  return 'niche'
}
