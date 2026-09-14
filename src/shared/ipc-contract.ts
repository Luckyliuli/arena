export type Unsubscribe = () => void

export type AppStoreKey =
  | 'lastSelectedChampionId'
  | 'championInsight.showDetails'
  | 'championInsight.hideOnGameStart'
  | 'championInsight.alwaysOnTop'
  | 'augments.showTopOverlay'
  | 'augments.showSidePanel'

export type SupportedDataLocale = 'zh-CN' | 'zh-TW' | 'en-US'

export type FeedbackCategory = 'suggestion' | 'question' | 'bug' | 'other'

export interface FeedbackSubmissionPayload {
  category: FeedbackCategory
  message: string
  contact?: string
  locale: SupportedDataLocale
  image?: Uint8Array
}

export interface FeedbackSubmissionResult extends OperationResult {
  id?: string
  logsIncluded?: number
}

export type GameflowPhase =
  | 'None'
  | 'Lobby'
  | 'Matchmaking'
  | 'CheckedIntoGame'
  | 'ReadyCheck'
  | 'ChampSelect'
  | 'GameStart'
  | 'InProgress'
  | 'WaitingForStats'
  | 'PreEndOfGame'
  | 'EndOfGame'

export type ChampSelectSnapshotStatus =
  | 'unavailable'
  | 'not-in-champ-select'
  | 'empty'
  | 'ready'

export interface LooseRecord {
  [key: string]: unknown
}

export interface OperationResult extends LooseRecord {
  success: boolean
  error?: string
}

export interface ClientVersionInfo extends LooseRecord {
  currentVersion?: string
  latestVersion?: string
  dataVersion?: string
  gamePatch?: string
  locale?: SupportedDataLocale
  downloadUrl?: string
  isNewer?: boolean
  severity?: string
  statusText?: string
  changelog?: LooseRecord[]
}

export interface AppUpdateState extends LooseRecord {
  phase?: string
  latestVersion?: string
  manualDownloadUrl?: string
  downloadDeferred?: boolean
  canCheck?: boolean
  canInstall?: boolean
  progress?: {
    percent?: number
    bytesPerSecond?: number
    [key: string]: unknown
  }
}

export interface TeamMember extends LooseRecord {
  cellId: number
  championId: number
  summonerId?: number
  spell1Id?: number
  spell2Id?: number
  championPickIntent?: number
}

export interface ChampSelectAction extends LooseRecord {
  actorCellId: number
  championId: number
  type: string
  completed: boolean
  id?: number
}

export interface ChampSelectBenchChampion extends LooseRecord {
  championId: number
  isPriority?: boolean
}

export interface ChampSelectTimer extends LooseRecord {
  adjustedTimeLeftInPhase?: number
  internalNowInEpochMs?: number
  phase?: string
  totalTimeInPhase?: number
}

export interface ChampSelectSession extends LooseRecord {
  localPlayerCellId: number
  myTeam: TeamMember[]
  theirTeam: TeamMember[]
  actions: ChampSelectAction[][]
  benchEnabled?: boolean
  benchChampions?: ChampSelectBenchChampion[]
  timer?: ChampSelectTimer
  errorCode?: string
}

export interface ChampSelectSnapshot extends LooseRecord {
  connected: boolean
  gameflowPhase: GameflowPhase | null
  isInChampSelect: boolean
  champSelectSession: ChampSelectSession | null
  localPlayerCellId: number | null
  selfChampionId: number | null
  benchEnabled: boolean
  benchChampions: ChampSelectBenchChampion[]
  myTeam: TeamMember[]
  actions: ChampSelectAction[][]
  timer: ChampSelectTimer | null
  status: ChampSelectSnapshotStatus
  reason: string | null
  updatedAt: number
}

export interface PerkPage extends LooseRecord {
  id: number
  name: string
  current: boolean
  isDeletable: boolean
  selectedPerkIds: number[]
  primaryStyleId: number
  subStyleId: number
}

export interface LcuStatusResult extends OperationResult {
  active: boolean
}

export interface LcuSessionResult extends OperationResult {
  session: ChampSelectSession | null
}

export interface LcuSnapshotResult extends OperationResult {
  snapshot: ChampSelectSnapshot | null
}

export interface LcuPerkListResult extends OperationResult {
  perks: PerkPage[]
}

export interface LcuChampionIdResult extends OperationResult {
  championId: number | null
}

export interface LcuGameflowResult extends OperationResult {
  phase: GameflowPhase | null
}

/**
 * Arena (斗魂竞技场) session context derived from LCU gameflow data.
 * Pure derivation lives in
 * src/main/services/arena-session/arena-session-state.ts.
 */
export type ArenaShoppingPhase = 'shopping' | 'not-shopping' | 'unknowable'

/** Which field proved the queue is Arena. `null` means the queue is unresolved. */
export type ArenaQueueEvidence = 'queue-id' | 'game-mode' | null

/** Where the champion id came from. `null` means no champion could be read. */
export type ArenaChampionSource = 'champ-select' | 'remembered' | null

export type ArenaSessionStatus = 'unavailable' | 'unknown' | 'not-arena' | 'arena'

export interface ArenaSessionState {
  /** LCU reported itself reachable. */
  connected: boolean
  /** Gameflow phase, normalized. */
  phase: string | null
  status: ArenaSessionStatus
  /** `true`/`false` once the queue is identified; `null` when it is not. */
  isArena: boolean | null
  queueEvidence: ArenaQueueEvidence
  queueId: number | null
  gameMode: string | null
  championId: number | null
  championSource: ArenaChampionSource
  /**
   * `unknowable` is a real answer: LCU only exposes the coarse `InProgress`
   * phase, so the shopping phase needs a visual/OCR signal before it can be
   * asserted. Never guess.
   */
  shoppingPhase: ArenaShoppingPhase
  /** Diagnostic only; never user-visible copy. */
  reason: string | null
  updatedAt: number
}

export interface LcuArenaSessionResult extends OperationResult {
  session: ArenaSessionState | null
}

export interface LocaleInfo extends LooseRecord {
  locale: SupportedDataLocale
  dataVersion?: string
  supportedLocales: ReadonlyArray<{
    code: SupportedDataLocale
    label: string
    nativeLabel: string
  }>
}

export type ArenaRecommendationTier =
  | 'must-pick'
  | 'strong'
  | 'recommended'
  | 'optional'
  | 'niche'

/**
 * One augment card slot as the main process ships it to the overlay windows.
 *
 * Declared here rather than left to each renderer to infer: the popup reads
 * these fields straight off the payload, and a field that never reaches the
 * contract silently degrades to `unknown` on the renderer side.
 */
export interface ArenaOverlayAugmentPayload extends LooseRecord {
  id?: number | null
  augmentId?: number | null
  name?: string
  rarity?: ArenaAugmentRarity
  iconPath?: string | null
  detectedSlot?: number | null
  missing?: boolean
  recommendScore?: number | null
  recommendationTier?: ArenaRecommendationTier | null
  isTopPick?: boolean
  pickRate?: number | null
  mock?: boolean
  dataAvailable?: boolean
  /** Recognised standard augment absent from the champion's OP.GG recommendations. */
  notRecommendedForChampion?: boolean
  /** CommunityDragon special option, excluded from normal augment scoring. */
  isSpecialOption?: boolean
  augmentLevel?: number | null
  isUpgrade?: boolean
}

export interface ArenaOverlayItemPayload extends LooseRecord {
  itemId?: number | null
  name?: string
  iconUrl?: string | null
  detectedSlot?: number | null
  missing?: boolean
  averagePlacement?: number | null
  firstPlaceRate?: number | null
  pickRate?: number | null
  sampleSize?: number | null
  winRate?: number | null
  dataAvailable?: boolean
  isTopPick?: boolean
}

export interface OverlayPayload extends LooseRecord {
  championId?: number | null
  championName?: string
  mode?: 'augments' | 'items'
  augments?: ArenaOverlayAugmentPayload[]
  items?: ArenaOverlayItemPayload[]
  dataSource?: string
  timestamp?: number
  error?: string
  recommendationMock?: boolean
  recommendationSource?: string
  topPickAugmentId?: number | null
  topPickDetectedSlot?: number | null
  suppressionReason?: 'special-options' | null
}

export interface GamePhaseChangedPayload {
  phase: GameflowPhase | null
  prevPhase: GameflowPhase | null
}

export interface ChampionMonitorState {
  phase: GameflowPhase | null
  selectedChampionId: number | null
  lastChampionId: number | null
  revision: number
}

export interface LocaleChangedPayload extends LooseRecord {
  locale: SupportedDataLocale
  dataVersion?: string
}

export type ArenaAugmentPerfStat = {
  augmentId: number
  averagePlacement: number | null
  firstPlaceRate: number | null
  pickRate: number | null
  /**
   * Third-party (OP.GG) arena win-rate figure, carried verbatim. Not one
   * of this project's own metrics — see
   * src/main/services/arena-augment-data/interface.ts for the full note.
   */
  winRate: number | null
  sampleSize: number | null
}

export type ArenaAugmentStatsBundle = {
  fetchedAt: string
  source: 'mock' | 'communitydragon' | 'opgg' | 'riot-api'
  /** True when records are seeded deterministically rather than sourced
   *  from real gameplay data. UI layers should suppress precision and
   *  flag the bundle as a placeholder. */
  mock: boolean
  records: ArenaAugmentPerfStat[]
  /**
   * Set only when the source produced no records, explaining why. The UI
   * should surface this instead of a generic "no data" message —
   * 'page-shape-changed' means the upstream scraper needs updating.
   */
  reason?: string | null
}

export type ArenaAugmentRarity = 'silver' | 'gold' | 'prismatic' | 'unknown'

export type ArenaAugmentLeaderboardRow = {
  augmentId: number
  displayName: { en: string, zh: string }
  rarity: ArenaAugmentRarity
  iconLarge: string | null
  iconSmall: string | null
  averagePlacement: number | null
  firstPlaceRate: number | null
  pickRate: number | null
  winRate: number | null
  sampleSize: number | null
}

export type ArenaAugmentRankOrder = 'placement' | 'firstplace' | 'picks' | 'winrate'

export type ArenaAugmentRankedSet = {
  placement: ArenaAugmentLeaderboardRow[]
  firstplace: ArenaAugmentLeaderboardRow[]
  picks: ArenaAugmentLeaderboardRow[]
  winrate: ArenaAugmentLeaderboardRow[]
}

export interface ArenaAugmentStatsRequest {
  championId: number
  patch?: string
  /** Cap per-rank row count. Defaults to 20. */
  limit?: number
}

export interface ArenaAugmentStatsResult extends OperationResult {
  bundle?: ArenaAugmentStatsBundle
  ranked?: ArenaAugmentRankedSet
  sourceLabel?: string
}

export interface ArenaChampionOption {
  id: number
  slug: string
  nameEn: string
  nameZh: string
}

export interface ArenaChampionOptionsResult extends OperationResult {
  patch?: string
  champions?: ArenaChampionOption[]
}

export type ArenaItemCategory = 'prismatic' | 'core' | 'boots' | 'starting' | 'final'

export type ArenaItemRef = {
  itemId: number
  name: string
  iconUrl: string | null
}

export type ArenaItemPerfStat = {
  items: ArenaItemRef[]
  averagePlacement: number | null
  firstPlaceRate: number | null
  pickRate: number | null
  winRate: number | null
  sampleSize: number | null
}

export type ArenaItemStatsBundle = {
  fetchedAt: string
  source: 'opgg'
  mock: false
  categories: Record<ArenaItemCategory, ArenaItemPerfStat[]>
  reason?: string | null
}

export interface ArenaItemStatsRequest {
  championId: number
}

export interface ArenaItemStatsResult extends OperationResult {
  bundle?: ArenaItemStatsBundle
  sourceLabel?: string
}

export interface ElectronEventMap {
  fromMain: [payload?: unknown]
  'for-popup': [payload: OverlayPayload]
  'screenshot-taken': [payload: LooseRecord]
  'winrate-updated': [payload: LooseRecord]
  'auto-screenshot-taken': [payload: LooseRecord]
  'game-phase-changed': [payload: GamePhaseChangedPayload]
  'champion-monitor-changed': [payload: ChampionMonitorState]
  'champ-select-start': [payload?: LooseRecord]
  'item-set-auto-apply-completed': [payload: LooseRecord]
  'game-started': [payload?: LooseRecord]
  'game-in-progress': [payload?: LooseRecord]
  'augment-detection-started': [payload?: LooseRecord]
  'augment-detected': [payload: OverlayPayload]
  'augment-cleared': [payload?: LooseRecord]
  'arena-item-detected': [payload: OverlayPayload]
  'arena-item-cleared': [payload?: LooseRecord]
  'game-ended': [payload?: LooseRecord]
  'end-of-game': [payload?: LooseRecord]
  'quit-confirm-requested': []
  'app-update-status-changed': [payload: AppUpdateState]
  'locale-changed': [payload: LocaleChangedPayload]
}

export type ElectronEventChannel = keyof ElectronEventMap

export interface ElectronAPI {
  store: {
    get<T = unknown>(key: AppStoreKey): Promise<T | undefined>
    set<T = unknown>(key: AppStoreKey, value: T): Promise<void>
    delete(key: AppStoreKey): Promise<void>
  }
  windows: {
    ready(): void
    showPopup(data: OverlayPayload): void
    hidePopup(reason?: string): void
    hideFloating(reason?: string): void
    hideAugmentSidePanel(reason?: string): void
    toggleMain(): void
    confirmQuit(): Promise<OperationResult>
    restart(): void
  }
  appInfo: {
    getVersionInfo(): Promise<OperationResult & { data?: ClientVersionInfo }>
    openLogDirectory(): Promise<OperationResult>
  }
  appUpdate: {
    getState(): Promise<OperationResult & { data?: AppUpdateState }>
    check(): Promise<OperationResult & { data?: AppUpdateState }>
    download(): Promise<OperationResult & { data?: AppUpdateState }>
    install(): Promise<OperationResult & { data?: AppUpdateState }>
  }
  locale: {
    get(): Promise<LocaleInfo>
    set(locale: SupportedDataLocale): Promise<LocaleInfo>
  }
  screenshot: {
    capture(): Promise<LooseRecord>
    analyze(imagePathOrBuffer: string | Uint8Array): Promise<LooseRecord>
  }
  winrate: {
    get(data: LooseRecord): Promise<OperationResult & { augments?: LooseRecord[]; timing?: LooseRecord }>
    loadChampionData(championId: number): Promise<OperationResult & { data?: LooseRecord }>
  }
  autoScreenshot: {
    start(config?: LooseRecord): Promise<LooseRecord>
    stop(): Promise<LooseRecord>
    setConfig(config: LooseRecord): Promise<LooseRecord>
    getStats(): Promise<LooseRecord>
    getConfig(): Promise<LooseRecord>
  }
  feedback: {
    submit(payload: FeedbackSubmissionPayload): Promise<FeedbackSubmissionResult>
  }
  lcu: {
    getChampionMonitorState(): Promise<ChampionMonitorState>
    getChampionId(): Promise<LcuChampionIdResult>
    getStatus(): Promise<LcuStatusResult>
    getCurrentSession(): Promise<LcuSessionResult>
    getChampSelectSnapshot(): Promise<LcuSnapshotResult>
    getPerkList(): Promise<LcuPerkListResult>
    applyPerk(data: LooseRecord): Promise<OperationResult>
    getGameflowPhase(): Promise<LcuGameflowResult>
    getArenaSession(): Promise<LcuArenaSessionResult>
    getManualLeaguePath(): Promise<LooseRecord>
    selectManualLeaguePath(): Promise<LooseRecord>
    validateManualLeaguePath(lolPath: string): Promise<LooseRecord>
    setManualLeaguePath(lolPath: string): Promise<LooseRecord>
    clearManualLeaguePath(): Promise<LooseRecord>
  }
  diagnostics: {
    testShowFloating(data: LooseRecord): Promise<OperationResult>
    testShowRandomFloating(): Promise<OperationResult>
    testShowRandomPopup(): Promise<OperationResult>
    testShowRandomArenaItems(): Promise<OperationResult>
    logRendererError(errorData: LooseRecord): Promise<OperationResult>
    logRendererInfo(data: LooseRecord): void
  }
  shell: {
    openExternal(url: string): Promise<OperationResult>
  }
  arenaAugmentData: {
    getStats(request: ArenaAugmentStatsRequest): Promise<ArenaAugmentStatsResult>
    getChampions(): Promise<ArenaChampionOptionsResult>
  }
  arenaItemData: {
    getStats(request: ArenaItemStatsRequest): Promise<ArenaItemStatsResult>
  }
  events: {
    on<K extends ElectronEventChannel>(
      channel: K,
      callback: (...args: ElectronEventMap[K]) => void,
    ): Unsubscribe
    once<K extends ElectronEventChannel>(
      channel: K,
      callback: (...args: ElectronEventMap[K]) => void,
    ): Unsubscribe
  }
}
