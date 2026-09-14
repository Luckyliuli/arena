import { describe, expect, it } from 'vitest'
import { ARENA_QUEUE_ID } from '../../src/main/services/arena-session/arena-session-state.ts'
import {
  type ArenaSessionLcuReader,
  readArenaSessionState,
} from '../../src/main/services/arena-session/arena-session-service.ts'
import {
  NOT_SHOPPING_MISS_THRESHOLD,
  SHOPPING_SIGNAL_TTL_MS,
  ShoppingPhaseSignalStore,
  deriveShoppingPhaseSignal,
  deriveShoppingPhaseSignalFromGate,
} from '../../src/main/services/arena-session/shopping-phase-signal.ts'

function completeResult() {
  return {
    success: true,
    analysis: {
      augments: [
        { id: 101, detectedSlot: 0 },
        { id: 202, detectedSlot: 1 },
        { id: 303, detectedSlot: 2 },
      ],
      cardCount: 3,
      isAugmentPhase: true,
      augmentGate: {
        titleActivity: { likely: true },
        rerollButtons: { visible: true },
        ocrSkippedReason: null,
      },
    },
  }
}

function readerOn(overrides: Partial<ArenaSessionLcuReader> = {}): ArenaSessionLcuReader {
  return {
    isActive: () => true,
    getGameflowPhase: async () => 'InProgress',
    getGameflowSession: async () => ({
      gameData: { queue: { id: ARENA_QUEUE_ID, gameMode: 'CHERRY' } },
    }),
    getChampSelectSnapshot: async () => null,
    ...overrides,
  }
}

describe('deriveShoppingPhaseSignal', () => {
  it('reports shopping for three complete cards in three slots', () => {
    expect(deriveShoppingPhaseSignal(completeResult())).toBe('shopping')
  })

  it('stays silent when only part of the cards were read', () => {
    const partial = completeResult()
    partial.analysis.augments = [{ id: 101, detectedSlot: 0 }]
    partial.analysis.cardCount = 1
    partial.analysis.isAugmentPhase = false

    expect(deriveShoppingPhaseSignal(partial)).toBeUndefined()
  })

  it('stays silent when three cards have no usable slot layout', () => {
    const noSlots = completeResult()
    noSlots.analysis.augments = [{ id: 1 }, { id: 2 }, { id: 3 }]

    expect(deriveShoppingPhaseSignal(noSlots)).toBeUndefined()
  })

  it('reports not-shopping when the pixel gate rejects the frame', () => {
    const otherScreen = {
      success: true,
      analysis: {
        augments: [],
        cardCount: 0,
        isAugmentPhase: false,
        augmentGate: { ocrSkippedReason: 'no-likely-title-activity' },
      },
    }

    expect(deriveShoppingPhaseSignal(otherScreen)).toBe('not-shopping')
  })

  it('reports not-shopping when the reroll buttons are absent', () => {
    const otherScreen = {
      success: true,
      analysis: {
        augments: [],
        cardCount: 0,
        isAugmentPhase: false,
        augmentGate: { ocrSkippedReason: 'no-visible-reroll-buttons' },
      },
    }

    expect(deriveShoppingPhaseSignal(otherScreen)).toBe('not-shopping')
  })

  it('stays silent on an OCR error rather than guessing', () => {
    const failed = {
      success: true,
      analysis: {
        augments: [],
        cardCount: 0,
        isAugmentPhase: false,
        augmentGate: { ocrSkippedReason: 'ocr-error' },
      },
    }

    expect(deriveShoppingPhaseSignal(failed)).toBeUndefined()
  })

  it('stays silent for empty or failed input', () => {
    expect(deriveShoppingPhaseSignal(null)).toBeUndefined()
    expect(deriveShoppingPhaseSignal(undefined)).toBeUndefined()
    expect(deriveShoppingPhaseSignal({})).toBeUndefined()
    expect(deriveShoppingPhaseSignal({ success: false })).toBeUndefined()
    expect(deriveShoppingPhaseSignal({ success: true, analysis: null })).toBeUndefined()
  })
})

describe('ShoppingPhaseSignalStore', () => {
  it('exposes a fresh shopping signal', () => {
    const store = new ShoppingPhaseSignalStore()
    store.record(completeResult(), 1000)

    expect(store.read(1000)).toEqual({ phase: 'shopping', at: 1000 })
  })

  it('drops a shopping signal once it goes stale', () => {
    const store = new ShoppingPhaseSignalStore()
    store.record(completeResult(), 1000)

    expect(store.read(1000 + SHOPPING_SIGNAL_TTL_MS)).not.toBeNull()
    expect(store.read(1000 + SHOPPING_SIGNAL_TTL_MS + 1)).toBeNull()
  })

  it('does not clear shopping on a single rejected frame', () => {
    const store = new ShoppingPhaseSignalStore()
    store.record(completeResult(), 1000)
    store.record(
      { success: true, analysis: { augmentGate: { ocrSkippedReason: 'no-likely-title-activity' } } },
      1100,
    )

    expect(store.read(1100)?.phase).toBe('shopping')
  })

  it('clears to not-shopping after consecutive rejected frames', () => {
    const store = new ShoppingPhaseSignalStore()
    store.record(completeResult(), 1000)

    const rejected = {
      success: true,
      analysis: { augmentGate: { ocrSkippedReason: 'no-likely-title-activity' } },
    }
    for (let i = 0; i < NOT_SHOPPING_MISS_THRESHOLD; i += 1) {
      store.record(rejected, 1100 + i)
    }

    expect(store.read(1100 + NOT_SHOPPING_MISS_THRESHOLD)?.phase).toBe('not-shopping')
  })

  it('lets no-opinion frames run the clock out instead of pinning the state', () => {
    const store = new ShoppingPhaseSignalStore()
    store.record(completeResult(), 1000)
    store.record({}, 2000)

    expect(store.read(1000 + SHOPPING_SIGNAL_TTL_MS + 1)).toBeNull()
  })

  it('forgets everything on reset', () => {
    const store = new ShoppingPhaseSignalStore()
    store.record(completeResult(), 1000)
    store.reset()

    expect(store.read(1000)).toBeNull()
  })

  it('never lets a gate frame alone assert shopping', () => {
    const store = new ShoppingPhaseSignalStore()
    store.recordGate({ success: true, likely: true, rerollVisible: true }, 1000)

    expect(store.read(1000)).toBeNull()
  })

  it('clears to not-shopping from consecutive gate frames', () => {
    const store = new ShoppingPhaseSignalStore()
    store.record(completeResult(), 1000)

    const gateMiss = { success: true, likely: false, rerollVisible: false }
    for (let i = 0; i < NOT_SHOPPING_MISS_THRESHOLD; i += 1) {
      store.recordGate(gateMiss, 1100 + i)
    }

    expect(store.read(1100 + NOT_SHOPPING_MISS_THRESHOLD)?.phase).toBe('not-shopping')
  })
})

describe('deriveShoppingPhaseSignalFromGate', () => {
  it('reports not-shopping when the gate sees no title activity', () => {
    expect(deriveShoppingPhaseSignalFromGate({ success: true, likely: false, rerollVisible: false }))
      .toBe('not-shopping')
  })

  it('reports not-shopping when the reroll buttons are missing', () => {
    expect(deriveShoppingPhaseSignalFromGate({ success: true, likely: true, rerollVisible: false }))
      .toBe('not-shopping')
  })

  it('stays silent on a promising frame so only full OCR can confirm', () => {
    expect(deriveShoppingPhaseSignalFromGate({ success: true, likely: true, rerollVisible: true }))
      .toBeUndefined()
    expect(deriveShoppingPhaseSignalFromGate({ success: false })).toBeUndefined()
    expect(deriveShoppingPhaseSignalFromGate(null)).toBeUndefined()
  })
})

describe('readArenaSessionState with a visual signal', () => {
  it('reports the shopping phase from the signal during an Arena match', async () => {
    const store = new ShoppingPhaseSignalStore()
    store.record(completeResult(), 500)

    const state = await readArenaSessionState({
      lcu: readerOn(),
      getShoppingPhaseSignal: now => store.read(now),
      now: () => 500,
    })

    expect(state.status).toBe('arena')
    expect(state.shoppingPhase).toBe('shopping')
  })

  it('falls back to unknowable when the signal is stale', async () => {
    const store = new ShoppingPhaseSignalStore()
    store.record(completeResult(), 500)

    const state = await readArenaSessionState({
      lcu: readerOn(),
      getShoppingPhaseSignal: now => store.read(now),
      now: () => 500 + SHOPPING_SIGNAL_TTL_MS + 1,
    })

    expect(state.shoppingPhase).toBe('unknowable')
  })

  it('reports not-shopping once the store has cleared', async () => {
    const store = new ShoppingPhaseSignalStore()
    const rejected = {
      success: true,
      analysis: { augmentGate: { ocrSkippedReason: 'no-likely-title-activity' } },
    }
    for (let i = 0; i < NOT_SHOPPING_MISS_THRESHOLD; i += 1) {
      store.record(rejected, 700 + i)
    }

    const state = await readArenaSessionState({
      lcu: readerOn(),
      getShoppingPhaseSignal: now => store.read(now),
      now: () => 700 + NOT_SHOPPING_MISS_THRESHOLD - 1,
    })

    expect(state.shoppingPhase).toBe('not-shopping')
  })
})