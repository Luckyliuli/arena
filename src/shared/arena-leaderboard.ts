export type ArenaAugmentSortKey = 'winRate' | 'pickRate'
export type ArenaLeaderboardSortDirection = 'asc' | 'desc'

type ArenaAugmentSortableRow = {
  augmentId?: unknown
  id?: unknown
  winRate?: unknown
  pickRate?: unknown
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function compareNullableValues(
  left: number | null,
  right: number | null,
  direction: ArenaLeaderboardSortDirection,
): number {
  if (left == null) return right == null ? 0 : 1
  if (right == null) return -1
  return direction === 'asc' ? left - right : right - left
}

function stableId(row: ArenaAugmentSortableRow): number {
  return nullableNumber(row.augmentId ?? row.id) ?? Number.MAX_SAFE_INTEGER
}

/**
 * Sort an augment leaderboard without mutating the source rows.
 * The selected metric is primary; win rate and pick rate always
 * cross-fill as the tie-breaker so a tie still has a stable meaning.
 */
export function sortArenaAugmentRows<T extends ArenaAugmentSortableRow>(
  rows: T[],
  sortKey: ArenaAugmentSortKey,
  direction: ArenaLeaderboardSortDirection,
): T[] {
  const secondaryKey: ArenaAugmentSortKey = sortKey === 'winRate' ? 'pickRate' : 'winRate'

  return [...rows].sort((left, right) => {
    const primary = compareNullableValues(
      nullableNumber(left[sortKey]),
      nullableNumber(right[sortKey]),
      direction,
    )
    if (primary !== 0) return primary

    const secondary = compareNullableValues(
      nullableNumber(left[secondaryKey]),
      nullableNumber(right[secondaryKey]),
      'desc',
    )
    if (secondary !== 0) return secondary

    return stableId(left) - stableId(right)
  })
}
