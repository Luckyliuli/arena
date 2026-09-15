export const ARENA_ITEM_CATEGORIES = ['prismatic', 'core', 'boots', 'starting', 'final'] as const

export type ArenaItemCategory = (typeof ARENA_ITEM_CATEGORIES)[number]

export type ArenaItemRef = {
  itemId: number
  name: string
  iconUrl: string | null
}

export type ArenaItemPerfStat = {
  items: ArenaItemRef[]
  averagePlacement: number | null
  firstPlaceRate: number | null
  pickRate: number | null
  winRate: number | null
  sampleSize: number | null
}

export type ArenaItemCategories = Record<ArenaItemCategory, ArenaItemPerfStat[]>

export type ArenaItemStatsBundle = {
  fetchedAt: string
  patch?: string
  source: 'opgg'
  mock: false
  categories: ArenaItemCategories
  reason?: string | null
}

export function emptyArenaItemCategories(): ArenaItemCategories {
  return {
    prismatic: [],
    core: [],
    boots: [],
    starting: [],
    final: [],
  }
}

export function isArenaPrismaticItemId(itemId: unknown): boolean {
  const id = Number(itemId)
  return Number.isInteger(id) && id >= 443000 && id < 448000
}
