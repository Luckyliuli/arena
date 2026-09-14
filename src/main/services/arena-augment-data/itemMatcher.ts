import { matchAugmentTitleRecords } from '../../augment-title-matcher.ts'
import type { ArenaItemPerfStat } from './itemTypes.ts'
import type { ArenaItemRecommendationCandidate } from './itemRecommendation.ts'

export function matchArenaItemSlotTexts(
  slotTexts: readonly string[],
  rows: readonly ArenaItemPerfStat[],
): ArenaItemRecommendationCandidate[] {
  const itemRecords = rows
    .map(row => row.items?.[0])
    .filter((item): item is NonNullable<typeof item> => Boolean(item && Number.isInteger(item.itemId) && item.itemId > 0))
    .map(item => ({ id: item.itemId, name: item.name, iconPath: item.iconUrl ?? undefined }))
  const rowById = new Map(itemRecords.map(record => [Number(record.id), rows.find(row => row.items?.[0]?.itemId === record.id)]))
  const seen = new Set<number>()
  const candidates: ArenaItemRecommendationCandidate[] = []

  slotTexts.slice(0, 3).forEach((text, detectedSlot) => {
    const match = matchAugmentTitleRecords(String(text || ''), itemRecords)[0]
    const itemId = Number(match?.id)
    if (!Number.isInteger(itemId) || itemId <= 0 || seen.has(itemId)) return
    const row = rowById.get(itemId)
    seen.add(itemId)
    candidates.push({
      itemId,
      name: String(match?.name || row?.items?.[0]?.name || ''),
      iconUrl: row?.items?.[0]?.iconUrl ?? null,
      detectedSlot,
    })
  })

  return candidates
}
