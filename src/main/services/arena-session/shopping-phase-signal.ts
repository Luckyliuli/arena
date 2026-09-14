/**
 * Visual shopping-phase signal for Arena (斗魂竞技场)augment offers.
 *
 * LCU reports the whole Arena match as `InProgress`, so the only way to know
 * that the three augment cards are on screen is the picture. This module turns
 * one screenshot analysis result into a shopping-phase signal, and keeps the
 * last signal alive across animation frames with a time bound so a stale value
 * can never pin the session state shut.
 *
 * Two layers:
 *
 *   - `deriveShoppingPhaseSignal` is a pure per-frame gate.
 *   - `ShoppingPhaseSignalStore` accumulates frames into a signal with decay.
 *
 * Deliberately free of Electron / LCU / screenshot imports so both layers can
 * be unit-tested without a running game.
 */

import type { ArenaShoppingPhase } from '../../../shared/ipc-contract.ts'

/** The two phases the picture can actually prove. `unknowable` is an absence. */
export type ShoppingPhaseSignal = Exclude<ArenaShoppingPhase, 'unknowable'>

/** A signal older than this is dropped: the frame that proved it is gone. */
export const SHOPPING_SIGNAL_TTL_MS = 5000

/**
 * Consecutive "definitely not the shopping screen" frames required before the
 * store flips to `not-shopping`. Keeps a single HUD flash from clearing a live
 * overlay.
 */
export const NOT_SHOPPING_MISS_THRESHOLD = 3

/** OCR gate reasons that prove the frame is not the augment offer screen. */
const DEFINITIVE_NOT_SHOPPING_REASONS = new Set([
  'no-likely-title-activity',
  'no-visible-reroll-buttons',
])

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

const asInt = (value: unknown): number | null =>
  Number.isInteger(value) ? (value as number) : null

/**
 * True when the result carries three augment records that occupy the three
 * distinct card slots (left / middle / right). The slot set is the OCR-side
 * equivalent of the reference project's spacing check: names only land in a
 * slot when the card region matched, so a full set means the layout held.
 */
function hasCompleteCardSlots(augments: unknown[]): boolean {
  const slots = new Set<number>()
  for (const entry of augments) {
    const slot = asInt(asRecord(entry)?.detectedSlot)
    if (slot !== null && slot >= 0 && slot < 3) {
      slots.add(slot)
    }
  }
  return slots.size === 3
}

/**
 * Derive a shopping-phase signal from one screenshot analysis result.
 *
 *   - three complete cards in three slots -> 'shopping'
 *   - the pixel gate proved this is another screen -> 'not-shopping'
 *   - anything else (partial read, OCR error, empty input) -> undefined,
 *     i.e. no opinion. Callers must not read that as "not shopping".
 */
export function deriveShoppingPhaseSignal(analysisResult: unknown): ShoppingPhaseSignal | undefined {
  const root = asRecord(analysisResult)
  if (!root || root.success === false) return undefined

  const analysis = asRecord(root.analysis)
  if (!analysis) return undefined

  const augments = Array.isArray(analysis.augments) ? analysis.augments : []
  const isAugmentPhase = analysis.isAugmentPhase === true
  if (isAugmentPhase && augments.length === 3 && hasCompleteCardSlots(augments)) {
    return 'shopping'
  }

  const gate = asRecord(analysis.augmentGate)
  const reason = typeof gate?.ocrSkippedReason === 'string' ? gate.ocrSkippedReason : null
  if (reason && DEFINITIVE_NOT_SHOPPING_REASONS.has(reason)) {
    return 'not-shopping'
  }

  return undefined
}

/**
 * Same decision as deriveShoppingPhaseSignal, but for the cheap pixel-gate
 * frame produced by nalyzeScreenshotGate. The gate can prove a frame is
 * *not* the offer screen; it can never prove that it *is* — that needs full
 * OCR to read the three titles.
 */
export function deriveShoppingPhaseSignalFromGate(gateResult: unknown): ShoppingPhaseSignal | undefined {
  const root = asRecord(gateResult)
  if (!root || root.success === false) return undefined
  if (root.likely !== true) return 'not-shopping'
  if (root.rerollVisible !== true) return 'not-shopping'
  return undefined
}

export type ShoppingPhaseSignalSnapshot = {
  phase: ShoppingPhaseSignal
  at: number
}

/**
 * Accumulates per-frame signals into the value a session can read.
 *
 * `shopping` is taken immediately. `not-shopping` needs several consecutive
 * frames so a stray frame cannot clear a live overlay. Frames with no opinion
 * change nothing; they only let the time bound run out.
 */
export class ShoppingPhaseSignalStore {
  private phase: ShoppingPhaseSignal | null = null
  private at = 0
  private missStreak = 0

  record(analysisResult: unknown, now: number = Date.now()): void {
    this._apply(deriveShoppingPhaseSignal(analysisResult), now)
  }

  /** Record a cheap pixel-gate frame instead of a full OCR result. */
  recordGate(gateResult: unknown, now: number = Date.now()): void {
    this._apply(deriveShoppingPhaseSignalFromGate(gateResult), now)
  }

  private _apply(signal: ShoppingPhaseSignal | undefined, now: number): void {
    if (signal === 'shopping') {
      this.phase = 'shopping'
      this.at = now
      this.missStreak = 0
      return
    }

    if (signal === 'not-shopping') {
      this.missStreak += 1
      if (this.missStreak >= NOT_SHOPPING_MISS_THRESHOLD) {
        this.phase = 'not-shopping'
        this.at = now
      }
      return
    }

    // No opinion: keep whatever we had and let the TTL decide.
  }

  /** Latest signal if it is still fresh, otherwise `null` (no opinion). */
  read(now: number = Date.now()): ShoppingPhaseSignalSnapshot | null {
    if (this.phase === null) return null
    if (now - this.at > SHOPPING_SIGNAL_TTL_MS) return null
    return { phase: this.phase, at: this.at }
  }

  /** Drop everything, e.g. when the match ends or the client disconnects. */
  reset(): void {
    this.phase = null
    this.at = 0
    this.missStreak = 0
  }
}

/**
 * Process-wide store shared by the screenshot producer and the LCU session
 * reader. They live in different modules, so the instance is the seam.
 */
export const shoppingPhaseSignalStore = new ShoppingPhaseSignalStore()