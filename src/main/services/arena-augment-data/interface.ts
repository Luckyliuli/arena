// M1 adapter skeleton — public interface contract.
//
// This file is the seam from ADR-0004. The rest of the app depends ONLY
// on what's exported here. Today's backing source is the local
// CommunityDragon-derived dictionary (augments-arena.json). M1's actual
// data layer (hero × augment × placement/perf stats) is what future
// tickets will populate behind this same seam.

import {
  loadAugmentArenaDictionary,
  findAugmentById,
  type ArenaAugmentRecord,
} from '../../../shared/augment-dictionary.ts'
import { opggSource, type OpggSourceOptions } from './opgg/source.ts'

// Public data shape ------------------------------------------------------

export type RarityTier = ArenaAugmentRecord['rarity']

export type AugmentPerfStat = {
  augmentId: number
  averagePlacement: number | null  // 1..8, lower is better
  firstPlaceRate: number | null    // 0..1
  pickRate: number | null          // 0..1
  /**
   * Third-party (OP.GG) arena "win rate", carried verbatim — NOT one of
   * our own metrics.
   *
   * OP.GG's arena pages expose only `pick_rate` / `win_rate` / `play`
   * per augment; they do not publish an average placement or a
   * first-place rate. Observed values sit in 45–58%, and in an 8-team
   * lobby the median finish rate is 50%, so this figure is consistent
   * with a *top-4 finish rate*. That is an inference, not a definition:
   * we therefore never fold it into `averagePlacement` or
   * `firstPlaceRate`, and the UI must attribute it to OP.GG rather than
   * present it as a domain metric. See CONTEXT.md (`胜率` is deliberately
   * not a domain term in this project).
   */
  winRate: number | null
  sampleSize: number | null        // raw game count
}

export type AugmentStatsBundle = {
  fetchedAt: string
  source: 'mock' | 'communitydragon' | 'opgg' | 'riot-api'
  /** True when records are seeded from the augment id rather than real
   *  gameplay data. UI layers should suppress precision and label these
   *  records as placeholders. */
  mock: boolean
  records: AugmentPerfStat[]
  /**
   * Present only when the source could not produce records, explaining
   * why. Callers should log this rather than silently showing "no data".
   *
   * Known values from the OP.GG source:
   *   'unknown-champion'    — no slug for this champion id
   *   'fetch-failed'        — HTTP error / timeout / offline
   *   'page-shape-changed'  — page fetched but carried no augment payload,
   *                           i.e. OP.GG changed their markup. This one
   *                           deserves an operator-visible warning.
   *   'no-records-after-join' — payload parsed but nothing matched the catalog
   */
  reason?: string | null
}

// Source pluggability ----------------------------------------------------

export type ArenaAugmentSource = {
  /** Stable identifier, used in logs and to gate source-specific quirks. */
  readonly id: 'mock' | 'communitydragon' | 'opgg' | 'riot-api'
  /** Human-readable name shown in diagnostics. */
  readonly label: string
  /**
   * Return stats for one champion at one patch.
   * Implementations may be async (network) or sync (in-memory).
   */
  getStatsForChampion(championId: number, opts?: { patch?: string }): Promise<AugmentStatsBundle>
}

// Defaults and overrides -----------------------------------------------

const SOURCE_ENV = 'ARENA_AUGMENT_SOURCE'

/**
 * Real OP.GG stats are the default. Placeholder sources must be asked for
 * explicitly via `ARENA_AUGMENT_SOURCE` — an unset or unrecognised value
 * must never silently serve fabricated numbers to the UI.
 */
export function selectAugmentSource(opts?: { opgg?: OpggSourceOptions }): ArenaAugmentSource {
  const wanted = (process.env[SOURCE_ENV] || '').toLowerCase()
  switch (wanted) {
    case 'mock':
      return mockSource()
    case 'communitydragon':
      return communityDragonSource()
    case 'opgg':
    default:
      return opggSource(opts?.opgg)
  }
}

// Deterministic stat generation ----------------------------------------

/**
 * FNV-1a 32-bit hash over a non-negative integer. Stable across runs and
 * platforms; lets us seed mock numerical stats from an augment id without
 * pulling in a dependency.
 */
function fnv1a32(n: number): number {
  let h = 2166136261
  let v = n >>> 0
  while (v > 0) {
    h ^= v & 0xff
    h = Math.imul(h, 16777619) >>> 0
    v = v >>> 8
  }
  return h >>> 0
}

/**
 * Map a hash bucket onto [lo, hi) with `decimals` fractional digits.
 * Used for both probabilities and placement scores.
 */
function inRange(hash: number, lo: number, hi: number, decimals: number): number {
  const buckets = Math.pow(10, decimals)
  const span = (hi - lo) * buckets
  const v = lo + (hash % span) / buckets
  return Math.round(v * buckets) / buckets
}

/**
 * Derive a deterministic AugmentPerfStat for an augment id. Same id →
 * same numbers across calls and processes. Champions in arena pull augments
 * from the same catalog; we deliberately don't vary stats per champion
 * because that's an M1 limiter that should fail loudly rather than
 * silently spread fake data.
 */
function deterministicStatsFor(augmentId: number, slot: 'mock' | 'cdr'): AugmentPerfStat {
  const a = fnv1a32(augmentId ^ 0xa11ce)
  const b = fnv1a32(augmentId ^ 0xb0b)
  const c = fnv1a32(augmentId ^ 0xc0ffee)
  const d = fnv1a32(augmentId ^ 0xdeadbeef)
  const e = fnv1a32(augmentId ^ 0x5eed)
  return {
    augmentId,
    // placement lower-is-better, cover [1.5, 4.5]
    averagePlacement: inRange(a, 1.5, 4.5, 2),
    // first place rate, [0.05, 0.30]
    firstPlaceRate: inRange(b, 0.05, 0.30, 4),
    // pick rate, [0.005, 0.30]
    pickRate: inRange(c, 0.005, 0.30, 4),
    // third-party win rate, [0.40, 0.60] to mirror OP.GG's observed band
    winRate: inRange(e, 0.4, 0.6, 4),
    // sample size [100, 50000]
    sampleSize: Math.round(inRange(d, 100, 50000, 0)),
    // slot is internal — leaks only into tests/diagnostics
    ...(slot === 'mock' ? {} : {}),
  }
}

// Backing implementations ----------------------------------------------

/**
 * Explicit opt-in placeholder: returns deterministic mock stats based on
 * the augment id. Same id → same numeric output across calls and runs.
 */
function mockSource(): ArenaAugmentSource {
  return {
    id: 'mock',
    label: 'Mock (deterministic stats, no real gameplay data)',
    async getStatsForChampion(_championId, _opts) {
      const catalog = loadAugmentArenaDictionary()
      return {
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        mock: true,
        records: catalog.map(r => deterministicStatsFor(r.id, 'mock')),
      }
    },
  }
}

/**
 * Same shape as mock today, but labelled communitydragon so the UI knows
 * to show "CDR catalog" until we attach real placement data. The seam is
 * identical; only `source` and `mock` change. When T07+ attaches real
 * stats only this function's body changes.
 */
function communityDragonSource(): ArenaAugmentSource {
  return {
    id: 'communitydragon',
    label: 'CommunityDragon catalog (stats are placeholders)',
    async getStatsForChampion(_championId, _opts) {
      const catalog = loadAugmentArenaDictionary()
      return {
        fetchedAt: new Date().toISOString(),
        source: 'communitydragon',
        mock: true,
        records: catalog.map(r => deterministicStatsFor(r.id, 'cdr')),
      }
    },
  }
}

// Convenience API used by the coldstart harness and the upcoming M1
// UI. Always synchronous for the catalog side; sources that need async
// may still return promises.

export function catalogAugmentIds(): number[] {
  return loadAugmentArenaDictionary().map(r => r.id)
}

export function describeAugment(id: number): ArenaAugmentRecord | undefined {
  return findAugmentById(id)
}

// Ranking helpers --------------------------------------------------------

export type RankOrder = 'placement' | 'firstplace' | 'picks' | 'winrate'

const RANK_FIELD: Record<
  RankOrder,
  keyof Pick<AugmentPerfStat, 'averagePlacement' | 'firstPlaceRate' | 'pickRate' | 'winRate'>
> = {
  placement: 'averagePlacement',
  firstplace: 'firstPlaceRate',
  picks: 'pickRate',
  winrate: 'winRate',
}

/**
 * Sort a copy of `records` by the chosen ranking dimension. Tie-breaks
 * by augmentId ascending. The input array is left untouched.
 *
 * - 'placement' sorts ascending (lower average placement is better).
 * - 'firstplace' / 'picks' / 'winrate' sort descending (higher is
 *   better).
 */
export function rankAugmentStats(records: AugmentPerfStat[], by: RankOrder): AugmentPerfStat[] {
  const field = RANK_FIELD[by]
  const dir = by === 'placement' ? 1 : -1
  return records.slice().sort((a, b) => {
    const av = a[field] as number | null
    const bv = b[field] as number | null
    // Nulls always sort last regardless of direction.
    if (av === null && bv === null) return a.augmentId - b.augmentId
    if (av === null) return 1
    if (bv === null) return -1
    if (av === bv) return a.augmentId - b.augmentId
    return dir * (av - bv)
  })
}
