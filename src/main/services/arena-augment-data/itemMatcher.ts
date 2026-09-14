import { matchAugmentTitleRecords } from '../../augment-title-matcher.ts'
import type { ArenaItemPerfStat, ArenaItemRef } from './itemTypes.ts'
import type { ArenaItemRecommendationCandidate } from './itemRecommendation.ts'

export function matchArenaItemNames(
  slotTexts: readonly string[],
  items: readonly ArenaItemRef[],
): ArenaItemRecommendationCandidate[] {
  const itemRecords = items
    .filter(item => Number.isInteger(item.itemId) && item.itemId > 0)
    .map(item => ({ id: item.itemId, name: item.name, iconPath: item.iconUrl ?? undefined }))
  const itemById = new Map(items.map(item => [item.itemId, item]))
  const seen = new Set<number>()
  const candidates: ArenaItemRecommendationCandidate[] = []

  slotTexts.slice(0, 3).forEach((text, detectedSlot) => {
    const match = matchAugmentTitleRecords(String(text || ''), itemRecords)[0]
    const itemId = Number(match?.id)
    if (!Number.isInteger(itemId) || itemId <= 0 || seen.has(itemId)) return
    const item = itemById.get(itemId)
    seen.add(itemId)
    candidates.push({
      itemId,
      name: String(item?.name || match?.name || ''),
      iconUrl: item?.iconUrl ?? null,
      detectedSlot,
    })
  })

  return candidates
}

export function matchArenaItemSlotTexts(
  slotTexts: readonly string[],
  rows: readonly ArenaItemPerfStat[],
): ArenaItemRecommendationCandidate[] {
  const items = rows
    .map(row => row.items?.[0])
    .filter((item): item is ArenaItemRef => Boolean(item && Number.isInteger(item.itemId) && item.itemId > 0))
  return matchArenaItemNames(slotTexts, items)
}
