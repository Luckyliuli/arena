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

// Public data shape ------------------------------------------------------

export type RarityTier = ArenaAugmentRecord['rarity']

export type AugmentPerfStat = {
  augmentId: number
  averagePlacement: number | null  // 1..8, lower is better
  firstPlaceRate: number | null    // 0..1
  pickRate: number | null          // 0..1
  sampleSize: number | null        // raw game count
}

export type AugmentStatsBundle = {
  fetchedAt: string
  source: 'mock' | 'communitydragon' | 'opgg' | 'riot-api'
  records: AugmentPerfStat[]
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

export function selectAugmentSource(): ArenaAugmentSource {
  const wanted = (process.env[SOURCE_ENV] || 'mock').toLowerCase()
  switch (wanted) {
    case 'communitydragon':
      return communityDragonSource()
    case 'mock':
    default:
      return mockSource()
  }
}

// Backing implementations ----------------------------------------------

/**
 * The default source for now: returns an empty stats bundle but with the
 * full augment catalog embedded in metadata so downstream consumers can
 * still iterate the catalog. This is the seam M1's first iteration will
 * fill in without touching the rest of the app.
 */
function mockSource(): ArenaAugmentSource {
  return {
    id: 'mock',
    label: 'Mock (no stats)',
    async getStatsForChampion(_championId, _opts) {
      return {
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        records: [],
      }
    },
  }
}

/**
 * Builds a source that derives whatever it can from the local
 * CommunityDragon-derived dictionary. The CDR file exposes names, ids,
 * rarity, icons — not placement stats — so for the M0/M1 boundary this
 * source is effectively the catalog. It is wired up here so that when
 * real placement data lands (later ticket) only this function's body
 * changes, not the call sites.
 */
function communityDragonSource(): ArenaAugmentSource {
  const catalog = loadAugmentArenaDictionary()
  return {
    id: 'communitydragon',
    label: 'CommunityDragon catalog',
    async getStatsForChampion(_championId, _opts) {
      // Placement/perf data is not in CommunityDragon today. The M1
      // adapter is responsible for that aggregation; this branch just
      // declares that CDR is the chosen source.
      return {
        fetchedAt: new Date().toISOString(),
        source: 'communitydragon',
        records: catalog.map(r => ({
          augmentId: r.id,
          averagePlacement: null,
          firstPlaceRate: null,
          pickRate: null,
          sampleSize: null,
        })),
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
