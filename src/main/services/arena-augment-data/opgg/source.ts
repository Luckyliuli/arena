// OP.GG Arena source — implements the ArenaAugmentSource seam.
//
//   championId (LCU/Riot numeric id)
//     -> shared/champion-map  -> OP.GG URL slug (`Annie`, `MissFortune`)
//     -> OpggCache            -> hit: return immediately (no request)
//     -> ArenaAugmentHtmlFetcher (offline fixture or live HTTPS)
//     -> extractOpggAugments (RSC payload parser)
//     -> keep only rows whose id exists in the CDR dictionary
//     -> AugmentPerfStat[]
//
// Field mapping (OP.GG -> us):
//   pick_rate -> pickRate            (percent -> fraction)
//   win_rate  -> winRate             (third-party figure; see interface.ts)
//   play      -> sampleSize
//   averagePlacement / firstPlaceRate stay null — OP.GG does not publish
//   either on the augment card, and we do not synthesise them.
//
// OP.GG's numeric augment `id` equals the CommunityDragon id (verified
// 41/41 on the Annie page by both id and zh name), so the join is exact;
// name lookup is only a defensive fallback for unfamiliar spellings.

import {
  loadAugmentArenaDictionary,
  type ArenaAugmentRecord,
} from '../../../../shared/augment-dictionary.ts'
import { findChampionSlug } from '../../../../shared/champion-map.ts'
import type { ArenaAugmentSource, AugmentPerfStat, AugmentStatsBundle } from '../interface.ts'
import { extractOpggAugments, type OpggAugmentRecord } from './rscParser.ts'
import { extractOpggPagePatch, onlineOpggHtmlFetcher, type ArenaAugmentHtmlFetcher } from './fetcher.ts'
import type { OpggCache } from './cache.ts'

export interface OpggSourceOptions {
  fetcher?: ArenaAugmentHtmlFetcher
  /** Optional fetch cache. Without one every call hits OP.GG (1–2s). */
  cache?: OpggCache
  /** Used only when no championId is supplied (ad-hoc runs / tests). */
  defaultChampionSlug?: string
}

export function opggSource(opts: OpggSourceOptions = {}): ArenaAugmentSource {
  const fetcher = opts.fetcher ?? onlineOpggHtmlFetcher()
  const cache = opts.cache ?? null
  const fallbackSlug = opts.defaultChampionSlug ?? null
  const label = opts.fetcher ? 'OP.GG Arena (custom fetcher)' : 'OP.GG Arena (live HTTPS)'

  return {
    id: 'opgg',
    label,
    async getStatsForChampion(championId: number, options = {}): Promise<AugmentStatsBundle> {
      const patch = options.patch
      if (cache) {
        const hit = await cache.get(championId, patch)
        if (hit) return hit
      }

      const slug = findChampionSlug(championId) ?? fallbackSlug
      if (!slug) return emptyBundle('unknown-champion')

      let html: string
      try {
        html = await fetcher(slug, { patch })
      } catch {
        return emptyBundle('fetch-failed')
      }

      const pagePatch = extractOpggPagePatch(html)
      if (patch && pagePatch && pagePatch !== patch) return emptyBundle('patch-unavailable', pagePatch)

      const parsed = extractOpggAugments(html)
      if (parsed.length === 0) return emptyBundle('page-shape-changed')

      const dict = loadAugmentArenaDictionary()
      const records = parsed
        .map((r) => toPerfStat(r, dict))
        .filter((r): r is AugmentPerfStat => r !== null && r.augmentId !== 0)

      if (records.length === 0) return emptyBundle('no-records-after-join')

      const bundle: AugmentStatsBundle = {
        fetchedAt: new Date().toISOString(),
        patch: pagePatch || patch,
        source: 'opgg',
        mock: false,
        records,
      }
      if (cache) await cache.set(championId, bundle, patch)
      return bundle
    },
  }
}

function emptyBundle(reason: string, patch?: string): AugmentStatsBundle {
  return {
    fetchedAt: new Date().toISOString(),
    patch,
    source: 'opgg',
    mock: false,
    records: [],
    reason,
  }
}

function toPerfStat(r: OpggAugmentRecord, dict: readonly ArenaAugmentRecord[]): AugmentPerfStat | null {
  const match = dict.find((d) => d.id === r.id) ?? dict.find((d) => d.displayName.zh === r.name || d.displayName.en === r.name)
  return {
    augmentId: match?.id ?? r.id,
    displayName: match?.displayName ?? { en: r.name, zh: r.name },
    rarity: match?.rarity ?? r.rarity,
    iconUrl: r.imageUrl,
    averagePlacement: null,
    firstPlaceRate: null,
    pickRate: r.pickRate,
    winRate: r.winRate,
    sampleSize: r.playCount,
  }
}
