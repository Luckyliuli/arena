/**
 * Arena session orchestration: reads the raw LCU surfaces and hands them to the
 * pure derivation in arena-session-state.ts.
 *
 * The LCU reader is injected so this stays unit-testable without a running
 * League client, and so it never reaches for Electron globals itself.
 */

import type { ArenaSessionState } from '../../../shared/ipc-contract.ts'
import { deriveArenaSessionState } from './arena-session-state.ts'
import type { ShoppingPhaseSignalSnapshot } from './shopping-phase-signal.ts'

export interface ArenaChampSelectSnapshotLike {
  selfChampionId: number | null
  champSelectSession?: unknown
}

export interface ArenaSessionLcuReader {
  isActive(): boolean
  getGameflowPhase(): Promise<string | null>
  getGameflowSession(): Promise<unknown>
  /** Only invoked during ChampSelect. */
  getChampSelectSnapshot(): Promise<ArenaChampSelectSnapshotLike | null>
}

export interface ArenaSessionServiceDeps {
  lcu: ArenaSessionLcuReader
  /** Last champion remembered from champ select; used once LCU stops exposing it. */
  getRememberedChampionId?: () => number | null
  /**
   * Latest visual shopping-phase signal. Receives the same 
ow the derivation
   * uses so the signal's own time bound lines up with updatedAt. Returns
   * 
ull when the signal is missing or stale.
   */
  getShoppingPhaseSignal?: (now: number) => ShoppingPhaseSignalSnapshot | null
  now?: () => number
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

const readQueueId = (value: unknown): number | null => {
  const record = asRecord(value)
  const parsed = Number(record?.queueId)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const readGameMode = (value: unknown): string | null => {
  const record = asRecord(value)
  const mode = record?.gameMode
  return typeof mode === 'string' && mode.trim() ? mode.trim() : null
}

export async function readArenaSessionState(
  deps: ArenaSessionServiceDeps,
): Promise<ArenaSessionState> {
  const { lcu } = deps
  const now = deps.now?.() ?? Date.now()

  if (!lcu.isActive()) {
    return deriveArenaSessionState({ connected: false, now })
  }

  const gameflowPhase = await lcu.getGameflowPhase()
  const gameflowSession = await lcu.getGameflowSession()

  let champSelectChampionId: number | null = null
  let queueIdHint: number | null = null
  let gameModeHint: string | null = null

  if (gameflowPhase === 'ChampSelect') {
    const snapshot = await lcu.getChampSelectSnapshot()
    champSelectChampionId = snapshot?.selfChampionId ?? null
    // The champ-select session can carry the queue on some client versions,
    // which keeps Arena detection working before the gameflow session fills in.
    queueIdHint = readQueueId(snapshot?.champSelectSession)
    gameModeHint = readGameMode(snapshot?.champSelectSession)
  }

  return deriveArenaSessionState({
    connected: true,
    gameflowPhase,
    gameflowSession,
    champSelectChampionId,
    rememberedChampionId: deps.getRememberedChampionId?.() ?? null,
    queueIdHint,
    gameModeHint,
    shoppingPhaseSignal: deps.getShoppingPhaseSignal?.(now)?.phase,
    now,
  })
}