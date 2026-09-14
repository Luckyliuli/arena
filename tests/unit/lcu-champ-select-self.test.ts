import { describe, expect, it } from 'vitest'
import { resolveSelfChampionId } from '../../src/main/services/lcu/champ-select-self.ts'
import type { ChampSelectSession } from '../../src/main/services/lcu/types.ts'

function session(actions: ChampSelectSession['actions'], championId = 0): ChampSelectSession {
  return {
    localPlayerCellId: 0,
    myTeam: [{ cellId: 0, championId }],
    theirTeam: [],
    actions,
  }
}

describe('resolveSelfChampionId', () => {
  it('ignores a local ban action and resolves the local pick action', () => {
    expect(resolveSelfChampionId(session([
      [{ actorCellId: 0, championId: 99, type: 'ban', completed: true }],
      [{ actorCellId: 0, championId: 22, type: 'pick', completed: false }],
    ]))).toBe(22)
  })

  it('does not open champion details for a ban-only snapshot', () => {
    expect(resolveSelfChampionId(session([
      [{ actorCellId: 0, championId: 99, type: 'ban', completed: true }],
    ]))).toBeNull()
  })

  it('prefers the locked champion on myTeam', () => {
    expect(resolveSelfChampionId(session([
      [{ actorCellId: 0, championId: 99, type: 'ban', completed: true }],
    ], 22))).toBe(22)
  })
})
