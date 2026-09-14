import type {
  ArenaOverlayAugmentPayload,
  ArenaRecommendationTier,
} from '../../shared/ipc-contract.ts'

export type ArenaOverlayAugment = ArenaOverlayAugmentPayload

export type ArenaOverlayRecommendationTier = ArenaRecommendationTier

export const ARENA_OVERLAY_SLOT_COUNT = 3

const RECOMMENDATION_TIERS = new Set<ArenaOverlayRecommendationTier>([
  'must-pick',
  'strong',
  'recommended',
  'optional',
  'niche',
])

function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function isMissingAugment(augment: ArenaOverlayAugment | null | undefined): boolean {
  return augment?.missing === true
}

function resolveDetectedSlot(augment: ArenaOverlayAugment, fallbackIndex: number): number {
  const slot = Number(augment?.detectedSlot)
  return Number.isInteger(slot) && slot >= 0 && slot < ARENA_OVERLAY_SLOT_COUNT
    ? slot
    : fallbackIndex
}

function createEmptyAugment(detectedSlot: number): ArenaOverlayAugment {
  return {
    augmentId: null,
    id: null,
    name: '',
    iconPath: null,
    iconUrl: null,
    detectedSlot,
    missing: true,
    recommendScore: null,
    recommendationTier: null,
    pickRate: null,
    mock: false,
  }
}

export function getArenaOverlayRecommendationScore(
  augment: ArenaOverlayAugment | null | undefined,
): number | null {
  if (!augment || isMissingAugment(augment) || augment.notRecommendedForChampion === true) return null
  return toFiniteNumber(augment.recommendScore)
}

export function getArenaOverlayRecommendationTier(
  augment: ArenaOverlayAugment | null | undefined,
): ArenaOverlayRecommendationTier | null {
  if (!augment || isMissingAugment(augment) || augment.notRecommendedForChampion === true) return null

  const declaredTier = augment.recommendationTier
  if (typeof declaredTier === 'string' && RECOMMENDATION_TIERS.has(declaredTier as ArenaOverlayRecommendationTier)) {
    return declaredTier as ArenaOverlayRecommendationTier
  }

  const score = getArenaOverlayRecommendationScore(augment)
  if (score == null) return null
  if (score >= 0.6) return 'must-pick'
  if (score >= 0.5) return 'strong'
  if (score >= 0.4) return 'recommended'
  if (score >= 0.3) return 'optional'
  return 'niche'
}

export function orderArenaOverlayAugments(
  augments: readonly ArenaOverlayAugment[] = [],
): ArenaOverlayAugment[] {
  const slots = Array<ArenaOverlayAugment | null>(ARENA_OVERLAY_SLOT_COUNT).fill(null)
  const ordered = augments
    .map((augment, index) => ({
      augment,
      index,
      detectedSlot: resolveDetectedSlot(augment, index),
    }))
    .sort((left, right) => (
      left.detectedSlot - right.detectedSlot || left.index - right.index
    ))

  for (const { augment, detectedSlot } of ordered) {
    let targetSlot = detectedSlot
    if (slots[targetSlot] != null) {
      targetSlot = slots.findIndex(item => item == null)
    }
    if (targetSlot < 0) continue
    slots[targetSlot] = augment
  }

  return slots.map((augment, detectedSlot) => (
    augment
      ? { ...augment, detectedSlot, missing: isMissingAugment(augment) }
      : createEmptyAugment(detectedSlot)
  ))
}

export function findArenaOverlayTopPickIndex(
  augments: readonly ArenaOverlayAugment[] = [],
): number {
  const explicitTopPick = augments.findIndex(augment => (
    !isMissingAugment(augment) && augment?.notRecommendedForChampion !== true && augment?.isTopPick === true
  ))
  if (explicitTopPick >= 0) return explicitTopPick

  let bestIndex = -1
  let bestScore = Number.NEGATIVE_INFINITY
  augments.forEach((augment, index) => {
    const score = getArenaOverlayRecommendationScore(augment)
    if (score != null && score > bestScore) {
      bestIndex = index
      bestScore = score
    }
  })

  return bestIndex
}

export function hasArenaOverlayMockData(
  augments: readonly ArenaOverlayAugment[] = [],
  recommendationMock = false,
): boolean {
  return recommendationMock || augments.some(augment => augment?.mock === true)
}
