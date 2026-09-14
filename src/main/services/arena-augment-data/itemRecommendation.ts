import type { ArenaItemPerfStat, ArenaItemRef } from './itemTypes.ts'

export type ArenaItemRecommendationCandidate = {
  itemId: number | null
  detectedSlot: number
  name?: string
  iconUrl?: string | null
}

export type ArenaItemRecommendation = {
  itemId: number | null
  detectedSlot: number
  name: string
  iconUrl: string | null
  averagePlacement: number | null
  firstPlaceRate: number | null
  pickRate: number | null
  sampleSize: number | null
  winRate: number | null
  isTopPick: boolean
  dataAvailable: boolean
  missing: boolean
}

function finite(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function compareNullableAscending(left: number | null, right: number | null): number {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  return left - right
}

function compareNullableDescending(left: number | null, right: number | null): number {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  return right - left
}

function itemIdOf(row: ArenaItemPerfStat): number | null {
  const id = finite(row.items?.[0]?.itemId)
  return id != null && id > 0 ? Math.trunc(id) : null
}

export function compareArenaItemStats(left: ArenaItemPerfStat, right: ArenaItemPerfStat): number {
  return compareNullableAscending(left.averagePlacement, right.averagePlacement)
    || compareNullableDescending(left.firstPlaceRate, right.firstPlaceRate)
    || compareNullableDescending(left.pickRate, right.pickRate)
    || compareNullableDescending(left.sampleSize, right.sampleSize)
    || (itemIdOf(left) ?? Number.MAX_SAFE_INTEGER) - (itemIdOf(right) ?? Number.MAX_SAFE_INTEGER)
}

export function orderArenaItemRecommendations(rows: readonly ArenaItemPerfStat[]): ArenaItemPerfStat[] {
  return rows.slice().sort(compareArenaItemStats)
}

export function recommendArenaItemCandidates(
  candidates: readonly ArenaItemRecommendationCandidate[],
  rows: readonly ArenaItemPerfStat[],
): ArenaItemRecommendation[] {
  const orderedCandidates = candidates
    .map((candidate, inputIndex) => ({ candidate, inputIndex }))
    .sort((left, right) => left.candidate.detectedSlot - right.candidate.detectedSlot || left.inputIndex - right.inputIndex)
  const rowById = new Map<number, ArenaItemPerfStat>()
  for (const row of rows) {
    const itemId = itemIdOf(row)
    if (itemId != null && !rowById.has(itemId)) rowById.set(itemId, row)
  }

  const recommendations: ArenaItemRecommendation[] = orderedCandidates.map(({ candidate }) => {
    const rawId = finite(candidate.itemId)
    const itemId = rawId != null && rawId > 0 && Number.isInteger(rawId) ? rawId : null
    const row = itemId == null ? null : rowById.get(itemId) ?? null
    const statItem = row?.items?.[0] as ArenaItemRef | undefined
    const averagePlacement = row ? finite(row.averagePlacement) : null
    return {
      itemId,
      detectedSlot: candidate.detectedSlot,
      name: String(statItem?.name || candidate.name || ''),
      iconUrl: statItem?.iconUrl ?? candidate.iconUrl ?? null,
      averagePlacement,
      firstPlaceRate: row ? finite(row.firstPlaceRate) : null,
      pickRate: row ? finite(row.pickRate) : null,
      sampleSize: row ? finite(row.sampleSize) : null,
      winRate: row ? finite(row.winRate) : null,
      isTopPick: false,
      dataAvailable: averagePlacement != null,
      missing: itemId == null,
    }
  })

  const topCandidate = recommendations
    .filter(row => !row.missing && row.averagePlacement != null)
    .sort((left, right) => compareArenaItemStats(
      {
        items: [{ itemId: left.itemId ?? 0, name: left.name, iconUrl: left.iconUrl }],
        averagePlacement: left.averagePlacement,
        firstPlaceRate: left.firstPlaceRate,
        pickRate: left.pickRate,
        winRate: left.winRate,
        sampleSize: left.sampleSize,
      },
      {
        items: [{ itemId: right.itemId ?? 0, name: right.name, iconUrl: right.iconUrl }],
        averagePlacement: right.averagePlacement,
        firstPlaceRate: right.firstPlaceRate,
        pickRate: right.pickRate,
        winRate: right.winRate,
        sampleSize: right.sampleSize,
      },
    ))[0]

  if (topCandidate) topCandidate.isTopPick = true
  return recommendations
}
