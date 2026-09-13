// Public surface for OP.GG arena data adapter.

export {
  parseOpggAugmentsHtml,
  type OpggArenaRarity,
  type OpggArenaRecord,
} from './parser.ts'

export {
  onlineOpggHtmlFetcher,
  offlineOpggHtmlFetcher,
  type ArenaAugmentHtmlFetcher,
  type OnlineOpggFetcherOptions,
} from './fetcher.ts'

export {
  opggSource,
  type OpggSourceOptions,
} from './source.ts'
