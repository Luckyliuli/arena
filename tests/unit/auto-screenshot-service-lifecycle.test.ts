import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveCaptureStage } from '../../src/main/auto-screenshot-policy.ts'
import { catalogAugmentIds, opggItemSource } from '../../src/main/services/arena-augment-data/index.ts'

const mocks = vi.hoisted(() => ({
  captureScreenshot: vi.fn(),
  analyzeScreenshot: vi.fn(),
  analyzeScreenshotGate: vi.fn(),
  warmupImageAnalyzer: vi.fn(),
  prepareWindows: vi.fn(),
  ensureFloatingWindow: vi.fn(),
  windows: [] as any[],
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    toBeijingISOString: vi.fn(() => '2026-08-30T12:00:00.000+08:00'),
  },
}))

vi.mock('../../src/main/screenshot.ts', () => ({
  CAPTURE_THUMBNAIL_SIZE: { width: 1280, height: 720 },
  captureScreenshot: mocks.captureScreenshot,
}))

vi.mock('../../src/main/image-analyzer.ts', () => ({
  analyzeScreenshot: mocks.analyzeScreenshot,
  analyzeScreenshotGate: mocks.analyzeScreenshotGate,
  warmupImageAnalyzer: mocks.warmupImageAnalyzer,
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => mocks.windows),
  },
}))

vi.mock('fs-extra', () => ({
  default: {
    ensureDir: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(async () => []),
    stat: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('../../src/main/modules/logger.ts', () => ({ default: mocks.logger }))
vi.mock('../../src/main/modules/window-manager.ts', () => ({
  applyAugmentSidePanelWindowLayout: vi.fn(),
  applyFloatingWindowLayout: vi.fn(),
  raiseOverlayWindow: vi.fn(),
  ensureAugmentOverlayWindows: mocks.prepareWindows,
  ensureFloatingWindow: mocks.ensureFloatingWindow,
}))
vi.mock('../../src/main/modules/overlay-window-state.ts', () => ({
  shouldRaiseOverlayWindow: vi.fn(() => false),
}))
vi.mock('../../src/main/modules/app-store.ts', () => ({
  default: { get: vi.fn(() => null) },
}))
vi.mock('../../src/main/modules/app-paths.ts', () => ({
  getPartialOcrScreenshotDir: vi.fn(() => '/tmp/aramgg-client-ocr-test'),
  getArenaAugmentCacheDir: vi.fn(() => '/tmp/aramgg-client-augment-cache-test'),
}))
vi.mock('../../src/main/augment-partial-merge.ts', () => ({
  createInitialPartialAugmentSelection: vi.fn(() => null),
  getAugmentIds: vi.fn((augments = []) => augments.map(augment => String(augment.id))),
  mergePartialAugments: vi.fn(() => null),
}))
vi.mock('../../src/main/modules/user-preferences.ts', () => ({
  shouldShowAugmentSidePanel: vi.fn(() => true),
  shouldShowAugmentTopOverlay: vi.fn(() => true),
}))

import autoScreenshotService from '../../src/main/auto-screenshot-service.ts'
import appStore from '../../src/main/modules/app-store.ts'

const createRunningIdleService = () => {
  autoScreenshotService.reset()
  autoScreenshotService.isRunning = true
  autoScreenshotService.controlOwner = 'gameflow'
  autoScreenshotService.captureMode = 'idle'
  autoScreenshotService.gameflowPhase = 'InProgress'
  autoScreenshotService.enableAnalysis = true
  autoScreenshotService.automaticThumbnailSize = { width: 1024, height: 576 }
  autoScreenshotService.pendingFullCapture = true
  autoScreenshotService.candidateStreak = 2
  return autoScreenshotService
}

const expectNextCaptureToUseGate = (service) => {
  expect(resolveCaptureStage({
    mode: service.captureMode,
    pendingFullCapture: service.pendingFullCapture,
    fullOcrCooldownUntil: service.fullOcrCooldownUntil,
    now: Date.now(),
  })).toBe('gate')
}

describe.sequential('automatic screenshot service lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.windows.length = 0
    mocks.prepareWindows.mockResolvedValue([])
  })

  afterEach(() => {
    autoScreenshotService.reset()
    vi.restoreAllMocks()
  })

  it('delivers the first detection only after the on-demand renderer is ready', async () => {
    const service = createRunningIdleService()
    service.lastDetectedAugmentIds = ['1', '2', '3']
    let ready!: () => void
    mocks.prepareWindows.mockReturnValue(new Promise<void>(resolve => { ready = resolve }))
    const send = vi.fn()
    mocks.windows.push({
      isDestroyed: () => false,
      webContents: { getURL: () => 'http://localhost/#/floating-overlay', send },
    })
    const payload = { augments: [{ id: 1 }, { id: 2 }, { id: 3 }] }
    const pending = service._sendAugmentDetectedPayload(payload)
    expect(send).not.toHaveBeenCalled()
    ready()
    await pending
    expect(send).toHaveBeenCalledWith('augment-detected', payload)
  })

  it('does not deliver a detection if stopped while its window is loading', async () => {
    const service = createRunningIdleService()
    service.lastDetectedAugmentIds = ['1', '2', '3']
    let ready!: () => void
    mocks.prepareWindows.mockReturnValue(new Promise<void>(resolve => { ready = resolve }))
    const send = vi.fn()
    mocks.windows.push({
      isDestroyed: () => false,
      webContents: { getURL: () => 'http://localhost/#/floating-overlay', send },
    })
    const pending = service._sendAugmentDetectedPayload({ augments: [{ id: 1 }, { id: 2 }, { id: 3 }] })
    service.stop('gameflow')
    ready()
    await pending
    expect(send).not.toHaveBeenCalled()
  })

  it('consumes a queued full capture before starting OCR', async () => {
    const service = createRunningIdleService()
    const imageBuffer = Buffer.from('full-frame')
    mocks.captureScreenshot.mockResolvedValue({
      success: true,
      buffer: imageBuffer,
      width: 1024,
      height: 576,
    })
    const queueAnalysis = vi.spyOn(service, '_queueAnalysis').mockImplementation(() => {})

    const result = await service._captureScreenshot(service.runId)

    expect(result.stage).toBe('full')
    expect(service.pendingFullCapture).toBe(false)
    expect(service.candidateStreak).toBe(0)
    expect(queueAnalysis).toHaveBeenCalledWith(imageBuffer)
    expectNextCaptureToUseGate(service)
  })

  it('runs a manual refresh as a full frame while OCR is in backoff', async () => {
    const service = createRunningIdleService()
    service.fullOcrCooldownUntil = Date.now() + 60000
    service.pendingFullCapture = false
    service.candidateStreak = 0
    service.manualHiddenAugmentIds = ['1', '2', '3']
    service.manualHiddenAugmentUntil = Date.now() + 60000
    mocks.captureScreenshot.mockResolvedValue({
      success: true,
      buffer: Buffer.from('manual-frame'),
      width: 1024,
      height: 576,
    })
    const queueAnalysis = vi.spyOn(service, '_queueAnalysis').mockImplementation(() => {})

    expect(service.triggerManualRefresh('test-hotkey')).toBe(true)
    await vi.waitFor(() => expect(mocks.captureScreenshot).toHaveBeenCalledOnce())

    expect(mocks.captureScreenshot).toHaveBeenCalledWith(expect.objectContaining({
      thumbnailSize: { width: 1024, height: 576 },
    }))
    expect(queueAnalysis).toHaveBeenCalledWith(Buffer.from('manual-frame'))
    expect(service.captureMode).toBe('active-selection')
    expect(service.manualHiddenAugmentIds).toEqual([])
    expect(service.manualHiddenAugmentUntil).toBe(0)
    expect(service.forceAugmentNotificationOnce).toBe(true)
  })

  it('queues a manual refresh requested while OCR is busy', async () => {
    const service = createRunningIdleService()
    service.isAnalyzing = true
    const queueAnalysis = vi.spyOn(service, '_queueAnalysis').mockImplementation(() => {})
    mocks.captureScreenshot.mockResolvedValue({
      success: true,
      buffer: Buffer.from('queued-manual-frame'),
      width: 1024,
      height: 576,
    })

    expect(service.triggerManualRefresh('busy-hotkey')).toBe(true)
    expect(service.manualRefreshQueued).toBe(true)
    expect(mocks.captureScreenshot).not.toHaveBeenCalled()

    service.isAnalyzing = false
    await service._drainManualRefreshQueue()
    await vi.waitFor(() => expect(mocks.captureScreenshot).toHaveBeenCalledOnce())
    expect(queueAnalysis).toHaveBeenCalledWith(Buffer.from('queued-manual-frame'))
  })

  it('re-notifies the same three augments after a manual refresh', async () => {
    const service = createRunningIdleService()
    service.lastDetectedAugmentIds = ['1', '2', '3']
    service.lastDetectedAugments = [
      { id: 1, name: '一', detectedSlot: 0 },
      { id: 2, name: '二', detectedSlot: 1 },
      { id: 3, name: '三', detectedSlot: 2 },
    ]
    service.lastDetectedAugmentAt = Date.now()
    service.forceAugmentNotificationOnce = true
    const notify = vi.spyOn(service, '_notifyAugmentDetected').mockResolvedValue(undefined)
    mocks.analyzeScreenshot.mockResolvedValue({
      success: true,
      timestamp: Date.now(),
      analysis: {
        cardCount: 3,
        confidence: 0.99,
        isAugmentPhase: true,
        augments: [
          { id: 1, name: '一', detectedSlot: 0 },
          { id: 2, name: '二', detectedSlot: 1 },
          { id: 3, name: '三', detectedSlot: 2 },
        ],
        slotDiagnostics: [],
        augmentGate: {
          ocrSkippedReason: null,
          titleActivity: { likely: true },
          rerollButtons: { visible: true },
        },
      },
    })

    await service._analyzeScreenshot(Buffer.from('same-augments-frame'))

    expect(notify).toHaveBeenCalledOnce()
    expect(service.forceAugmentNotificationOnce).toBe(false)
    expect(service.lastDetectedAugmentIds).toEqual(['1', '2', '3'])
  })

  it('returns to gate backoff when full OCR reports failure', async () => {
    const service = createRunningIdleService()
    const startedAt = Date.now()
    mocks.analyzeScreenshot.mockResolvedValue({ success: false, error: 'ocr-failed' })

    await service._analyzeScreenshot(Buffer.from('full-frame'))

    expect(service.pendingFullCapture).toBe(false)
    expect(service.candidateStreak).toBe(0)
    expect(service.fullOcrCooldownUntil).toBeGreaterThan(startedAt)
    expectNextCaptureToUseGate(service)
  })

  it('returns a gate false positive with no confirmed cards to backoff', async () => {
    const service = createRunningIdleService()
    const startedAt = Date.now()
    mocks.analyzeScreenshot.mockResolvedValue({
      success: true,
      timestamp: Date.now(),
      analysis: {
        cardCount: 0,
        confidence: 0,
        isAugmentPhase: false,
        augments: [],
        slotDiagnostics: [],
        augmentGate: {
          ocrSkippedReason: 'selection-ui-not-confirmed',
          titleActivity: { likely: false },
          rerollButtons: { visible: false },
        },
      },
    })

    await service._analyzeScreenshot(Buffer.from('false-positive-frame'))

    expect(service.captureMode).toBe('idle')
    expect(service.pendingFullCapture).toBe(false)
    expect(service.candidateStreak).toBe(0)
    expect(service.fullOcrCooldownUntil).toBeGreaterThan(startedAt)
    expectNextCaptureToUseGate(service)
  })

  it('enriches detected candidates through the Arena adapter and marks mock data', async () => {
    process.env.ARENA_AUGMENT_SOURCE = 'mock'
    try {
      const service = createRunningIdleService()
      const [leftId, centerId, rightId] = catalogAugmentIds().slice(0, 3)
      const result = await service._loadAugmentWinratePayload({
        championId: 1,
        augments: [
          { id: rightId, name: 'right', detectedSlot: 2 },
          { id: leftId, name: 'left', detectedSlot: 0 },
          { id: centerId, name: 'center', detectedSlot: 1 },
        ],
      })

      expect(result.recommendationMock).toBe(true)
      expect(result.recommendationSource).toBe('mock')
      expect(result.winrateResultCount).toBe(3)
      expect(result.augments.map(augment => augment.detectedSlot)).toEqual([2, 0, 1])
      expect(result.augments.every(augment => typeof augment.recommendScore === 'number')).toBe(true)
      expect(result.augments.every(augment => typeof augment.winRate === 'number')).toBe(true)
      expect(result.augments.every(augment => augment.mock === true)).toBe(true)
      expect(result.augments.filter(augment => augment.isTopPick)).toHaveLength(1)
      expect(result.topPickAugmentId).not.toBeNull()
      expect(result.topPickDetectedSlot).not.toBeNull()
    } finally {
      delete process.env.ARENA_AUGMENT_SOURCE
    }
  })
  it('returns an unconfirmed partial recognition to gate backoff', async () => {
    const service = createRunningIdleService()
    const startedAt = Date.now()
    vi.spyOn(service, '_savePartialOcrScreenshot').mockImplementation(() => {})
    mocks.analyzeScreenshot.mockResolvedValue({
      success: true,
      timestamp: Date.now(),
      analysis: {
        cardCount: 1,
        confidence: 0.75,
        isAugmentPhase: false,
        augments: [{ id: 1, name: '测试海克斯', detectedSlot: 0 }],
        slotDiagnostics: [],
        augmentGate: {
          ocrSkippedReason: 'selection-ui-not-confirmed',
          titleActivity: { likely: false },
          rerollButtons: { visible: false },
        },
      },
    })

    await service._analyzeScreenshot(Buffer.from('partial-frame'))

    expect(service.captureMode).toBe('idle')
    expect(service.pendingFullCapture).toBe(false)
    expect(service.candidateStreak).toBe(0)
    expect(service.fullOcrCooldownUntil).toBeGreaterThan(startedAt)
    expectNextCaptureToUseGate(service)
  })
  it('suppresses the recommendation payload when no champion is known', async () => {
    const service = createRunningIdleService()
    const send = vi.fn()
    mocks.windows.push({
      isDestroyed: () => false,
      webContents: { getURL: () => 'http://localhost/#/floating-overlay', send },
    })

    await service._notifyAugmentDetected({
      timestamp: Date.now(),
      analysis: {
        confidence: 1,
        partialUpdate: false,
        augments: [{ id: 1, name: '测试强化符文', detectedSlot: 0 }],
        slotDiagnostics: [],
        augmentGate: { titleActivity: { likely: true }, rerollButtons: { visible: false } },
      },
    })

    expect(send).not.toHaveBeenCalled()
    expect(mocks.logger.info).toHaveBeenCalledWith('Augment recommendation suppressed: champion unknown')
  })

  it('suppresses an all-special augment offer without producing a popup payload', async () => {
    process.env.ARENA_AUGMENT_SOURCE = 'mock'
    try {
      const service = createRunningIdleService()
      const result = await service._loadAugmentWinratePayload({
        championId: 1,
        augments: [
          { id: 365, name: '戒绝财富', rarity: 'unknown', detectedSlot: 0 },
          { id: 368, name: '渴望财富', rarity: 'unknown', detectedSlot: 1 },
          { id: 371, name: '强求财富', rarity: 'unknown', detectedSlot: 2 },
        ],
      })

      expect(result).toBeNull()
      expect(mocks.logger.info).toHaveBeenCalledWith('Augment recommendation suppressed: special options only', expect.any(Object))
    } finally {
      delete process.env.ARENA_AUGMENT_SOURCE
    }
  })

  it('matches prismatic item OCR texts and sends the item overlay payload', async () => {
    const service = createRunningIdleService()
    const fixture = readFileSync(fileURLToPath(new URL('../fixtures/opgg/arena-kalista-items.html', import.meta.url)), 'utf8')
    service.arenaItemSource = opggItemSource({ fetcher: async () => fixture, defaultChampionSlug: 'Kalista' })
    service.arenaItemDictionary = [
      { itemId: 443090, name: '收割者的过路费', iconUrl: null },
      { itemId: 443069, name: '断筋者', iconUrl: null },
      { itemId: 443054, name: '暗钢利爪', iconUrl: null },
    ]
    appStore.get.mockReturnValue(429)
    const send = vi.fn()
    const floatingWindow = {
      isDestroyed: () => false,
      isVisible: () => false,
      hide: vi.fn(),
      webContents: { getURL: () => 'http://localhost/#/floating-overlay', send },
    }
    mocks.windows.push(floatingWindow)
    mocks.ensureFloatingWindow.mockResolvedValue(floatingWindow)

    const handled = await service._tryArenaItemSelection({
      timestamp: Date.now(),
      analysis: {
        cardCount: 0,
        augments: [],
        slotDiagnostics: [
          { slot: 0, text: '收割者的过路费 3.09' },
          { slot: 1, text: '断筋者' },
          { slot: 2, text: '暗钢利爪' },
        ],
      },
    })

    expect(handled).toBe(true)
    expect(send).toHaveBeenCalledWith('arena-item-detected', expect.objectContaining({
      mode: 'items',
      championId: 429,
      items: expect.arrayContaining([
        expect.objectContaining({ itemId: 443090, detectedSlot: 0, isTopPick: true, recommendScore: expect.any(Number), recommendationTier: expect.any(String) }),
        expect.objectContaining({ itemId: 443069, detectedSlot: 1 }),
        expect.objectContaining({ itemId: 443054, detectedSlot: 2 }),
      ]),
    }))
  })

  it('does not show the prismatic overlay for ordinary item selections', async () => {
    const service = createRunningIdleService()
    const fixture = readFileSync(fileURLToPath(new URL('../fixtures/opgg/arena-kalista-items.html', import.meta.url)), 'utf8')
    service.arenaItemSource = opggItemSource({ fetcher: async () => fixture, defaultChampionSlug: 'Kalista' })
    service.arenaItemDictionary = [
      { itemId: 6632, name: '神圣分离者', iconUrl: null },
      { itemId: 3193, name: '石像鬼石板甲', iconUrl: null },
      { itemId: 3163, name: '巨型九头蛇', iconUrl: null },
    ]
    appStore.get.mockReturnValue(429)
    const send = vi.fn()
    mocks.windows.push({ isDestroyed: () => false, isVisible: () => false, hide: vi.fn(), webContents: { getURL: () => 'http://localhost/#/floating-overlay', send } })

    const handled = await service._tryArenaItemSelection({
      timestamp: Date.now(),
      analysis: {
        cardCount: 0,
        augments: [],
        slotDiagnostics: [
          { slot: 0, text: '神圣分离者' },
          { slot: 1, text: '石像鬼石板甲' },
          { slot: 2, text: '巨型九头蛇' },
        ],
      },
    })

    expect(handled).toBe(false)
    expect(send).not.toHaveBeenCalledWith('arena-item-detected', expect.anything())
  })

  it('recovers OP.GG-only augments that are absent from the CDragon dictionary', async () => {
    const service = createRunningIdleService()
    service.arenaAugmentSource = {
      id: 'opgg',
      label: 'test',
      getStatsForChampion: async () => ({
        source: 'opgg',
        mock: false,
        fetchedAt: new Date().toISOString(),
        records: [
          { augmentId: 1328, displayName: { en: 'Critical Rhythm', zh: '暴击律动' }, rarity: 'gold', iconUrl: 'https://example.com/1328.png', averagePlacement: null, firstPlaceRate: null, pickRate: 0.12, winRate: 0.48, sampleSize: 1000 },
          { augmentId: 38, displayName: { en: 'From Beginning to End', zh: '有始有终' }, rarity: 'gold', iconUrl: null, averagePlacement: null, firstPlaceRate: null, pickRate: 0.1, winRate: 0.5, sampleSize: 500 },
          { augmentId: 68, displayName: { en: 'Recursion', zh: '循环往复' }, rarity: 'gold', iconUrl: null, averagePlacement: null, firstPlaceRate: null, pickRate: 0.1, winRate: 0.5, sampleSize: 500 },
        ],
      }),
    }
    appStore.get.mockReturnValue(429)

    const payload = await service._tryArenaAugmentFallback({
      timestamp: Date.now(),
      analysis: {
        cardCount: 2,
        augments: [{ id: 38, detectedSlot: 1 }, { id: 68, detectedSlot: 2 }],
        slotDiagnostics: [
          { slot: 0, text: '暴击律动 街客' },
          { slot: 1, text: '有始有终 伤古' },
          { slot: 2, text: '循环往复 诗项' },
        ],
      },
    })

    expect(payload?.analysis.augments.map(augment => augment.id)).toEqual([1328, 38, 68])
    expect(payload?.analysis.augments[0]).toMatchObject({ name: '暴击律动', iconPath: 'https://example.com/1328.png' })
  })
})
