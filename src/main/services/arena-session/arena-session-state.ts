/**
 * Pure derivation of the Arena (斗魂竞技场) session context from LCU gameflow
 * data. Answers three questions for M3:
 *
 *   1. Is the client currently in an Arena match? (queue 1700 / gameMode CHERRY)
 *   2. Which champion am I playing?
 *   3. Is it the shopping phase (采购阶段) where augments are offered?
 *
 * Deliberately free of Electron / axios / LCU imports so the decision logic can
 * be unit-tested without a running League client. The LCU service feeds it raw
 * gameflow payloads.
 */

import type {
  ArenaChampionSource,
  ArenaQueueEvidence,
  ArenaSessionState,
  ArenaSessionStatus,
  ArenaShoppingPhase,
} from '../../../shared/ipc-contract.ts'

export type {
  ArenaChampionSource,
  ArenaQueueEvidence,
  ArenaSessionState,
  ArenaSessionStatus,
  ArenaShoppingPhase,
} from '../../../shared/ipc-contract.ts'

/** Arena (斗魂竞技场) queue id. */
export const ARENA_QUEUE_ID = 1700

/** Arena game mode codename used by the gameflow session. */
export const ARENA_GAME_MODE = 'CHERRY'

export interface DeriveArenaSessionInput {
  connected: boolean
  gameflowPhase?: string | null
  gameflowSession?: unknown
  /** Champion from the champ-select snapshot (ChampSelect only). */
  champSelectChampionId?: number | null
  /** Last champion remembered from champ select, used once LCU stops exposing it. */
  rememberedChampionId?: number | null
  /**
   * Queue hints from other LCU surfaces (e.g. the champ-select session), used
   * only when the gameflow session has not populated queue fields yet.
   */
  queueIdHint?: number | null
  gameModeHint?: string | null
  /**
   * Shopping-phase signal from the visual/OCR gate. When present it wins over
   * the LCU fallback, because the picture — not gameflow — knows about augments.
   */
  shoppingPhaseSignal?: ArenaShoppingPhase
  now?: number
}

export interface ArenaGameflowIdentity {
  queueId: number | null
  gameMode: string | null
}

const toPositiveInteger = (value: unknown): number | null => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/**
 * Pull queue id / game mode out of an LCU gameflow session without assuming a
 * fixed shape. Older clients nest fields differently, so several paths are
 * checked before giving up.
 */
export function readArenaGameflowIdentity(session: unknown): ArenaGameflowIdentity {
  const root = asRecord(session)
  const gameData = asRecord(root?.gameData)
  const queue = asRecord(gameData?.queue)

  const queueId =
    toPositiveInteger(queue?.id) ??
    toPositiveInteger(queue?.queueId) ??
    toPositiveInteger(gameData?.queueId)

  const gameMode =
    asNonEmptyString(queue?.gameMode) ??
    asNonEmptyString(queue?.type) ??
    asNonEmptyString(gameData?.gameMode) ??
    asNonEmptyString(root?.gameMode)

  return { queueId, gameMode }
}

export function isArenaGameflowSession(session: unknown): boolean {
  const identity = readArenaGameflowIdentity(session)
  return identity.queueId === ARENA_QUEUE_ID
    || identity.gameMode?.toUpperCase() === ARENA_GAME_MODE
}

function resolveQueueEvidence(
  queueId: number | null,
  gameMode: string | null,
): ArenaQueueEvidence {
  if (queueId === ARENA_QUEUE_ID) return 'queue-id'
  if (gameMode?.toUpperCase() === ARENA_GAME_MODE) return 'game-mode'
  return null
}

function resolveShoppingPhase(params: {
  isArena: boolean | null
  phase: string | null
  signal: ArenaShoppingPhase | undefined
}): ArenaShoppingPhase {
  if (params.signal) return params.signal
  if (params.isArena === false) return 'not-shopping'
  if (params.isArena === null) return 'unknowable'

  // In an Arena match. Only the shopping phase can offer augments, and LCU has
  // no field for it — the whole match reads as `InProgress`, so stay explicit.
  // A missing phase is also not evidence of shopping; report it as unknowable.
  if (!params.phase || params.phase === 'InProgress') return 'unknowable'
  return 'not-shopping'
}

function resolveStatus(connected: boolean, isArena: boolean | null): ArenaSessionStatus {
  if (isArena === true) return 'arena'
  if (isArena === false) return 'not-arena'
  return connected ? 'unknown' : 'unavailable'
}

function resolveReason(params: {
  status: ArenaSessionStatus
  queueId: number | null
  gameMode: string | null
}): string | null {
  switch (params.status) {
    case 'unavailable':
      return 'lcu-unavailable'
    case 'unknown':
      return 'queue-unknown'
    case 'not-arena':
      return params.queueId !== null ? `queue-${params.queueId}` : `mode-${params.gameMode}`
    case 'arena':
      return null
  }
}

export function deriveArenaSessionState(input: DeriveArenaSessionInput): ArenaSessionState {
  const at = input.now ?? Date.now()
  const session = asRecord(input.gameflowSession)
  const phase = asNonEmptyString(input.gameflowPhase) ?? asNonEmptyString(session?.phase)
  const identity = readArenaGameflowIdentity(input.gameflowSession)
  const queueId = identity.queueId ?? toPositiveInteger(input.queueIdHint)
  const gameMode = identity.gameMode ?? asNonEmptyString(input.gameModeHint)

  const queueEvidence = resolveQueueEvidence(queueId, gameMode)
  const queueIdentified = queueId !== null || gameMode !== null
  const isArena = queueEvidence ? true : queueIdentified ? false : null

  // A known non-Arena queue is not an Arena session, so it carries no champion.
  const arenaContext = isArena !== false
  const champSelectChampionId = arenaContext ? toPositiveInteger(input.champSelectChampionId) : null
  const rememberedChampionId = arenaContext ? toPositiveInteger(input.rememberedChampionId) : null
  const championId = champSelectChampionId ?? rememberedChampionId
  const championSource: ArenaChampionSource = champSelectChampionId
    ? 'champ-select'
    : rememberedChampionId
      ? 'remembered'
      : null

  const status = resolveStatus(input.connected, isArena)

  return {
    connected: input.connected,
    phase,
    status,
    isArena,
    queueEvidence,
    queueId,
    gameMode,
    championId,
    championSource,
    shoppingPhase: resolveShoppingPhase({
      isArena,
      phase,
      signal: input.shoppingPhaseSignal,
    }),
    reason: resolveReason({ status, queueId, gameMode }),
    updatedAt: at,
  }
}