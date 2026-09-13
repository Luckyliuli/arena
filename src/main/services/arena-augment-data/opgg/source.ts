// OP.GG Arena source — implements ArenaAugmentSource seam.
//
// Bridging:
//   HTML from ArenaAugmentHtmlFetcher
//     -> parseOpggAugmentsHtml() -> OpggArenaRecord[]
//     -> join with shared/augment-dictionary (T02) by display name (zh first,
//        then en as fallback; OP.GG may use a different slug system later)
//     -> emit AugmentPerfStat[]
//
// The id-mapping by display-name is deliberately forgiving: OP.GG Arena
// uses slugs ("prismatic_dawnbringer") while CDR uses numeric ids. We
// don't lock this down until we have a real fixture (i.e. once Playwright
// is wired in — see docs/adr/0005-opgg-scraper-mvp.md).

import {
  loadAugmentArenaDictionary,
  type ArenaAugmentRecord,
} from '../../../../shared/augment-dictionary.ts'
import type { ArenaAugmentSource, AugmentStatsBundle } from '../interface.ts'
import { parseOpggAugmentsHtml } from './parser.ts'
import {
  onlineOpggHtmlFetcher,
  type ArenaAugmentHtmlFetcher,
} from './fetcher.ts'

export interface OpggSourceOptions {
  fetcher?: ArenaAugmentHtmlFetcher
  /** When `fetcher` isn't set and `championKey` is unrecognised, the
   *  adapter still falls back to this default champion (an empty fixture
   *  resolves to records=[]). Avoid hard-coding a specific real champion
   *  in the production flow. */
  defaultChampionKey?: string
}

export function opggSource(opts: OpggSourceOptions = {}): ArenaAugmentSource {
  const fetcher = opts.fetcher ?? onlineOpggHtmlFetcher()
  const defaultChampionKey = opts.defaultChampionKey ?? 'leona'
  const label = opts.fetcher
    ? 'OP.GG Arena (custom fetcher)'
    : 'OP.GG Arena (online HTTPS — currently returns SSR skeleton, parser yields no rows)'

  return {
    id: 'opgg',
    label,
    async getStatsForChampion(_championId: number, _opts?: { patch?: string }): Promise<AugmentStatsBundle> {
      let html: string
      try {
        html = await fetcher(defaultChampionKey)
      } catch {
        return emptyBundle()
      }
      const parsed = parseOpggAugmentsHtml(html)
      if (parsed.length === 0) return emptyBundle()
      const dict = loadAugmentArenaDictionary()
      const records = parsed.map((r) => enrich(r, dict))
      return {
        fetchedAt: new Date().toISOString(),
        source: 'opgg',
        mock: false,
        records,
      }
    },
  }
}

function emptyBundle(): AugmentStatsBundle {
  return {
    fetchedAt: new Date().toISOString(),
    source: 'opgg',
    mock: false,
    records: [],
  }
}

function enrich(
  r: ReturnType<typeof parseOpggAugmentsHtml>[number],
  dict: ArenaAugmentRecord[]
): AugmentStatsBundle['records'][number] {
  const match = dictMatch(r.name, dict)
  const top4 = r.top4Rate
  return {
    augmentId: match?.id ?? 0,
    // OP.GG doesn't expose placement directly. Use top4Rate as a soft
    // proxy to keep the column alive in the M2 UI; nullify when the data
    // isn't present.
    averagePlacement: top4 != null ? Math.max(1, Math.min(8, 1 + 7 * (1 - top4))) : null,
    firstPlaceRate: r.top4Rate,
    pickRate: r.pickRate,
    sampleSize: r.playCount,
  }
}

function dictMatch(name: string, dict: ArenaAugmentRecord[]): ArenaAugmentRecord | undefined {
  if (!name) return undefined
  return dict.find((d) => d.displayName.zh === name || d.displayName.en === name)
}
