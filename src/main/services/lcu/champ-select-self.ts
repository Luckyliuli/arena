import type { ChampSelectAction, ChampSelectSession } from './types.ts'

function positiveInteger(value: unknown): number | null {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function isPickAction(action: ChampSelectAction): boolean {
  return String(action?.type || '').trim().toLowerCase() === 'pick'
}

export function resolveSelfChampionId(session: ChampSelectSession): number | null {
  const localPlayerCellId = Number.isInteger(session.localPlayerCellId)
    ? session.localPlayerCellId
    : null

  if (localPlayerCellId == null) return null

  const localPlayer = Array.isArray(session.myTeam)
    ? session.myTeam.find(member => member.cellId === localPlayerCellId)
    : null
  const teamChampionId = positiveInteger(localPlayer?.championId)
  if (teamChampionId) return teamChampionId

  const actionGroups = Array.isArray(session.actions) ? session.actions : []
  for (const actionGroup of actionGroups) {
    if (!Array.isArray(actionGroup)) continue
    for (const action of actionGroup) {
      if (action?.actorCellId !== localPlayerCellId || !isPickAction(action)) continue
      const championId = positiveInteger(action.championId)
      if (championId) return championId
    }
  }

  return null
}
