import { buildArenaItemSet, type ArenaItemSet } from './arenaItemSet.ts'
import type { ArenaItemCategories } from './itemTypes.ts'

export type ArenaItemSetSyncResult = { success: boolean; error?: string }

export async function injectArenaItemSet(options: {
  championId: number
  championName: string
  loadCategories: () => Promise<ArenaItemCategories>
  syncItemSet: (itemSet: ArenaItemSet) => Promise<ArenaItemSetSyncResult>
}): Promise<{ success: boolean; itemSet: ArenaItemSet | null; reason?: string; sync?: ArenaItemSetSyncResult }> {
  const categories = await options.loadCategories()
  const itemSet = buildArenaItemSet({
    championId: options.championId,
    championName: options.championName,
    categories,
  })
  if (!itemSet) return { success: false, itemSet: null, reason: 'no-items' }
  const sync = await options.syncItemSet(itemSet)
  return { success: sync.success, itemSet, sync }
}
