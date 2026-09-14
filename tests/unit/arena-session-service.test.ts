import { describe, expect, it, vi } from 'vitest'
import { ARENA_QUEUE_ID } from '../../src/main/services/arena-session/arena-session-state.ts'
import {
  type ArenaSessionLcuReader,
  readArenaSessionState,
} from '../../src/main/services/arena-session/arena-session-service.ts'

function makeReader(overrides: Partial<ArenaSessionLcuReader> = {}): ArenaSessionLcuReader {
  return {
    isActive: () => true,
    getGameflowPhase: async () => 'ChampSelect',
    getGameflowSession: async () => ({
      gameData: { queue: { id: ARENA_QUEUE_ID, gameMode: 'CHERRY' } },
    }),
    getChampSelectSnapshot: async () => ({ selfChampionId: 103, champSelectSession: null }),
    ...overrides,
  }
}

describe('readArenaSessionState', () => {
  it('does not touch LCU once the client is inactive', async () => {
    const getGameflowPhase = vi.fn()
    const state = await readArenaSessionState({
      lcu: makeReader({ isActive: () => false, getGameflowPhase }),
      now: () => 5,
    })

    expect(getGameflowPhase).not.toHaveBeenCalled()
    expect(state.status).toBe('unavailable')
    expect(state.updatedAt).toBe(5)
  })

  it('derives an Arena champ select from the live LCU surfaces', async () => {
    const state = await readArenaSessionState({ lcu: makeReader(), now: () => 1 })

    expect(state.status).toBe('arena')
    expect(state.phase).toBe('ChampSelect')
    expect(state.championId).toBe(103)
    expect(state.championSource).toBe('champ-select')
    expect(state.shoppingPhase).toBe('not-shopping')
  })

  it('falls back to the remembered champion during an in-progress match', async () => {
    const state = await readArenaSessionState({
      lcu: makeReader({
        getGameflowPhase: async () => 'InProgress',
        getChampSelectSnapshot: async () => {
          throw new Error('champ select must not be read in progress')
        },
      }),
      getRememberedChampionId: () => 22,
    })

    expect(state.status).toBe('arena')
    expect(state.championId).toBe(22)
    expect(state.championSource).toBe('remembered')
    expect(state.shoppingPhase).toBe('unknowable')
  })

  it('passes a champ-select queue through as a hint', async () => {
    const state = await readArenaSessionState({
      lcu: makeReader({
        getGameflowSession: async () => ({ phase: 'ChampSelect' }),
        getChampSelectSnapshot: async () => ({
          selfChampionId: 103,
          champSelectSession: { queueId: ARENA_QUEUE_ID },
        }),
      }),
    })

    expect(state.status).toBe('arena')
    expect(state.queueEvidence).toBe('queue-id')
  })

  it('reports a non-Arena match instead of an Arena session', async () => {
    const state = await readArenaSessionState({
      lcu: makeReader({
        getGameflowPhase: async () => 'InProgress',
        getGameflowSession: async () => ({ gameData: { queue: { id: 450, gameMode: 'ARAM' } } }),
      }),
      getRememberedChampionId: () => 22,
    })

    expect(state.status).toBe('not-arena')
    expect(state.championId).toBeNull()
  })
})