import { describe, expect, it } from 'vitest'
import {
  ARENA_GAME_MODE,
  ARENA_QUEUE_ID,
  deriveArenaSessionState,
  isArenaGameflowSession,
  readArenaGameflowIdentity,
} from '../../src/main/services/arena-session/arena-session-state.ts'

const arenaSession = (overrides: Record<string, unknown> = {}) => ({
  gameData: {
    queue: { id: ARENA_QUEUE_ID, gameMode: ARENA_GAME_MODE },
    gameMode: ARENA_GAME_MODE,
    ...overrides,
  },
})

describe('readArenaGameflowIdentity', () => {
  it('reads queue id and game mode from the gameflow session', () => {
    expect(readArenaGameflowIdentity(arenaSession())).toEqual({
      queueId: ARENA_QUEUE_ID,
      gameMode: ARENA_GAME_MODE,
    })
  })

  it('does not throw on malformed sessions', () => {
    expect(readArenaGameflowIdentity(null)).toEqual({ queueId: null, gameMode: null })
    expect(readArenaGameflowIdentity('nope')).toEqual({ queueId: null, gameMode: null })
    expect(readArenaGameflowIdentity({ gameData: { queue: {} } })).toEqual({
      queueId: null,
      gameMode: null,
    })
  })
})

describe('deriveArenaSessionState', () => {
  it('identifies an Arena champ select and takes the champion from the snapshot', () => {
    const state = deriveArenaSessionState({
      connected: true,
      gameflowPhase: 'ChampSelect',
      gameflowSession: arenaSession(),
      champSelectChampionId: 103,
      now: 10,
    })

    expect(state.status).toBe('arena')
    expect(state.isArena).toBe(true)
    expect(state.queueEvidence).toBe('queue-id')
    expect(state.championId).toBe(103)
    expect(state.championSource).toBe('champ-select')
    expect(state.shoppingPhase).toBe('not-shopping')
    expect(state.reason).toBeNull()
    expect(state.updatedAt).toBe(10)
  })

  it('recognizes Arena by game mode alone and falls back to the remembered champion', () => {
    const state = deriveArenaSessionState({
      connected: true,
      gameflowPhase: 'InProgress',
      gameflowSession: { gameData: { gameMode: 'cherry' } },
      rememberedChampionId: 22,
    })

    expect(state.isArena).toBe(true)
    expect(state.queueEvidence).toBe('game-mode')
    expect(state.queueId).toBeNull()
    expect(state.championId).toBe(22)
    expect(state.championSource).toBe('remembered')
  })

  it('accepts a queue hint when the gameflow session has not populated yet', () => {
    const state = deriveArenaSessionState({
      connected: true,
      gameflowPhase: 'ChampSelect',
      gameflowSession: { phase: 'ChampSelect' },
      queueIdHint: ARENA_QUEUE_ID,
      champSelectChampionId: 103,
    })

    expect(state.status).toBe('arena')
    expect(state.queueEvidence).toBe('queue-id')
    expect(state.queueId).toBe(ARENA_QUEUE_ID)
    expect(state.championId).toBe(103)
  })

  it('stays explicit that an in-progress Arena shopping phase is unknowable from LCU', () => {
    const state = deriveArenaSessionState({
      connected: true,
      gameflowPhase: 'InProgress',
      gameflowSession: arenaSession(),
      rememberedChampionId: 22,
    })

    expect(state.shoppingPhase).toBe('unknowable')
  })

  it('stays unknowable when the Arena queue is known but the phase is missing', () => {
    const state = deriveArenaSessionState({
      connected: true,
      gameflowSession: arenaSession(),
      rememberedChampionId: 22,
    })

    expect(state.status).toBe('arena')
    expect(state.phase).toBeNull()
    expect(state.shoppingPhase).toBe('unknowable')
  })

  it('lets a visual shopping-phase signal win over the LCU fallback', () => {
    const shopping = deriveArenaSessionState({
      connected: true,
      gameflowPhase: 'InProgress',
      gameflowSession: arenaSession(),
      shoppingPhaseSignal: 'shopping',
    })
    const notShopping = deriveArenaSessionState({
      connected: true,
      gameflowPhase: 'InProgress',
      gameflowSession: arenaSession(),
      shoppingPhaseSignal: 'not-shopping',
    })

    expect(shopping.shoppingPhase).toBe('shopping')
    expect(notShopping.shoppingPhase).toBe('not-shopping')
  })

  it('reports a non-Arena queue without pretending to know the champion', () => {
    const state = deriveArenaSessionState({
      connected: true,
      gameflowPhase: 'InProgress',
      gameflowSession: { gameData: { queue: { id: 450, gameMode: 'ARAM' } } },
      rememberedChampionId: 22,
    })

    expect(state.status).toBe('not-arena')
    expect(state.isArena).toBe(false)
    expect(state.queueId).toBe(450)
    expect(state.championId).toBeNull()
    expect(state.championSource).toBeNull()
    expect(state.shoppingPhase).toBe('not-shopping')
    expect(state.reason).toBe('queue-450')
  })

  it('reports LCU as unavailable when the client is down', () => {
    const state = deriveArenaSessionState({ connected: false })

    expect(state.status).toBe('unavailable')
    expect(state.isArena).toBeNull()
    expect(state.shoppingPhase).toBe('unknowable')
    expect(state.reason).toBe('lcu-unavailable')
  })

  it('reports unknown when connected but the queue cannot be identified', () => {
    const state = deriveArenaSessionState({
      connected: true,
      gameflowPhase: 'Lobby',
      gameflowSession: null,
    })

    expect(state.status).toBe('unknown')
    expect(state.isArena).toBeNull()
    expect(state.queueId).toBeNull()
    expect(state.reason).toBe('queue-unknown')
  })

  it('ignores the remembered champion outside an identified Arena queue', () => {
    const state = deriveArenaSessionState({
      connected: true,
      gameflowPhase: 'ChampSelect',
      gameflowSession: { gameData: { queue: { id: 420 } } },
      rememberedChampionId: 99,
    })

    expect(state.status).toBe('not-arena')
    expect(state.championId).toBeNull()
  })
})
describe('isArenaGameflowSession', () => {
  it('recognises queue id 1700 and CHERRY game mode', () => {
    expect(isArenaGameflowSession({ gameData: { queue: { id: 1700 } } })).toBe(true)
    expect(isArenaGameflowSession({ gameData: { queue: { gameMode: 'CHERRY' } } })).toBe(true)
    expect(isArenaGameflowSession({ gameData: { queue: { id: 450 } } })).toBe(false)
  })
})
