import type { ArenaItemCategories, ArenaItemCategory } from './itemTypes.ts'

export type ArenaItemSet = {
  uid: string
  title: string
  type: 'custom'
  map: 'any'
  mode: 'any'
  preferredItemSlots: []
  sortrank: number
  sortRank: number
  startedFrom: 'blank'
  associatedChampions: number[]
  associatedMaps: number[]
  blocks: Array<{ type: string; items: Array<{ id: number; count: 1 }> }>
}

export const ARENA_MAP_ID = 30

const CATEGORY_ORDER: ArenaItemCategory[] = ['prismatic', 'core', 'boots', 'starting', 'final']
const CATEGORY_LABELS: Record<ArenaItemCategory, string> = {
  prismatic: '棱彩装备',
  core: '核心装备',
  boots: '鞋子',
  starting: '出门装',
  final: '最终装备',
}

export function buildArenaItemSet(options: {
  championId: number
  championName: string
  categories: ArenaItemCategories
}): ArenaItemSet | null {
  const blocks = CATEGORY_ORDER.flatMap(category => {
    const seen = new Set<number>()
    const items = options.categories[category]
      .flatMap(row => row.items)
      .flatMap(item => {
        const itemId = Number(item.itemId)
        if (!Number.isInteger(itemId) || itemId <= 0 || seen.has(itemId)) return []
        seen.add(itemId)
        return [{ id: itemId, count: 1 as const }]
      })
    return items.length > 0 ? [{ type: CATEGORY_LABELS[category], items }] : []
  })

  if (blocks.length === 0) return null

  return {
    uid: 'aramgg-arena-' + options.championId,
    title: 'ARAMGG Arena - ' + options.championName,
    type: 'custom',
    map: 'any',
    mode: 'any',
    preferredItemSlots: [],
    sortrank: 0,
    sortRank: 0,
    startedFrom: 'blank',
    associatedChampions: [options.championId],
    associatedMaps: [ARENA_MAP_ID],
    blocks,
  }
}
