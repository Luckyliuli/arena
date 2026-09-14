// Smoke test for the M2 leaderboard UI. Asserts the three rendering
// branches (api unavailable, loading, populated) compile + mount under
// @vue/test-utils without runtime errors. We mock the Electron
// bridge so the test doesn't depend on a running main process.

// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'

// Mock the native electron bridge before importing the component.
const mockGetStats = vi.fn()
const mockGetChampions = vi.fn()
const mockStoreGet = vi.fn()
let mockElectronApi: any = null

vi.mock('../../src/renderer/native/electron-api.ts', () => ({
  get electronAPI() {
    return mockElectronApi
  },
  hasElectronAPI() {
    return mockElectronApi !== null
  },
}))

import ArenaLeaderboard from '../../src/renderer/components/ArenaLeaderboard.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      common: { refresh: '刷新', loading: '加载中...' },
      arenaLeaderboard: {
        title: '强化符文榜单',
        mockWarning: '当前数据为占位',
        source: '数据源',
        rankPlacement: '按平均名次',
        rankFirstplace: '按第一名率',
        rankPicks: '按选用率',
        rankWinrate: 'OP.GG 胜率',
        name: '符文',
        rarity: '稀有度',
        sampleSize: '样本数',
        empty: '该英雄暂无榜单数据',
        metricPlacement: '平均名次',
        metricFirstplace: '第一名率',
        metricPicks: '选用率',
        metricWinrate: 'OP.GG 胜率',
        raritySilver: '白银',
        rarityGold: '黄金',
        rarityPrismatic: '棱彩',
        rarityUnknown: '未知',
        loadFailed: '加载失败',
        apiUnavailable: '前端 IPC 不可用',
        selectChampion: '选择英雄',
      },
    },
  },
})

beforeEach(() => {
  mockGetChampions.mockResolvedValue({
    success: true,
    patch: 'test',
    champions: [
      { id: 1, slug: 'Annie', nameZh: '黑暗之女', nameEn: 'Annie' },
      { id: 2, slug: 'Olaf', nameZh: '狂战士', nameEn: 'Olaf' },
    ],
  })
  mockStoreGet.mockResolvedValue(undefined)
  mockElectronApi = {
    arenaAugmentData: { getStats: mockGetStats, getChampions: mockGetChampions },
    store: { get: mockStoreGet },
  }
})

afterEach(() => {
  mockElectronApi = null
  mockGetStats.mockReset()
  mockGetChampions.mockReset()
  mockStoreGet.mockReset()
})

function factory() {
  return mount(ArenaLeaderboard, {
    global: { plugins: [i18n] },
  })
}

describe('ArenaLeaderboard', () => {
  it('renders the unavailable-API branch without throwing', async () => {
    mockElectronApi = null
    const w = factory()
    await nextTick()
    expect(w.text()).toContain('前端 IPC 不可用')
    w.unmount()
  })

  it('renders the loading branch while the request is pending', async () => {
    let resolveStats: ((v: any) => void) | null = null
    mockGetStats.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolveStats = r
        }),
    )
    const w = factory()
    await flushPromises()
    expect(w.text()).toContain('加载中')
    resolveStats!({
      success: true,
      bundle: {
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        mock: true,
        records: [],
      },
      ranked: { placement: [], firstplace: [], picks: [], winrate: [] },
      sourceLabel: 'mock',
    })
    await flushPromises()
    w.unmount()
  })

  it('renders rows from the populated branch', async () => {
    mockGetStats.mockResolvedValueOnce({
      success: true,
      bundle: {
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        mock: true,
        records: [
          {
            augmentId: 1,
            averagePlacement: 1.5,
            firstPlaceRate: 0.2,
            pickRate: 0.05,
            winRate: 0.55,
            sampleSize: 1234,
          },
        ],
      },
      ranked: {
        picks: [
          {
            augmentId: 1,
            displayName: { en: 'Sample', zh: '示例符文' },
            rarity: 'gold',
            iconLarge: null,
            iconSmall: null,
            averagePlacement: 1.5,
            firstPlaceRate: 0.2,
            pickRate: 0.05,
            winRate: 0.55,
            sampleSize: 1234,
          },
        ],
        placement: [],
        firstplace: [],
        winrate: [],
      },
      sourceLabel: 'mock',
    })
    const w = factory()
    await flushPromises()
    expect(w.text()).toContain('示例符文')
    expect(w.find('.augment-name-en').exists()).toBe(false)
    // The mock-banner is rendered when bundle.mock is true
    expect(w.text()).toContain('mock')
    // Sample-size column is hidden in mock mode (TDD: hide stats that look
    // fake); the default tab ranks by pick rate, so the metric column
    // renders 0.05 as 5.0%
    expect(w.text()).toContain('5.0%')
    w.unmount()
  })

  it('offers only rank tabs that the data source can actually fill', async () => {
    mockGetStats.mockResolvedValueOnce({
      success: true,
      bundle: {
        fetchedAt: new Date().toISOString(),
        source: 'opgg',
        mock: false,
        records: [],
      },
      ranked: { placement: [], firstplace: [], picks: [], winrate: [] },
      sourceLabel: 'OP.GG',
    })
    const w = factory()
    await flushPromises()
    // OP.GG publishes pick_rate / win_rate per augment only; average
    // placement and first-place rate are never available, so those tabs
    // would render a column of dashes.
    const labels = w.findAll('.rank-tabs button').map((b) => b.text())
    expect(labels).toEqual(['\u6309\u9009\u7528\u7387', 'OP.GG \u80dc\u7387'])
    w.unmount()
  })

  it('lets the leaderboard switch to another champion', async () => {
    mockGetStats.mockResolvedValue({
      success: true,
      bundle: {
        fetchedAt: new Date().toISOString(),
        source: 'opgg',
        mock: false,
        records: [],
      },
      ranked: { placement: [], firstplace: [], picks: [], winrate: [] },
      sourceLabel: 'OP.GG',
    })
    const w = factory()
    await flushPromises()

    expect(mockGetStats).toHaveBeenLastCalledWith({ championId: 1, limit: 20 })
    expect(w.text()).toContain('黑暗之女')

    await w.get('select[aria-label="选择英雄"]').setValue('2')
    await flushPromises()

    expect(mockGetStats).toHaveBeenLastCalledWith({ championId: 2, limit: 20 })
    expect(w.text()).toContain('狂战士')
    w.unmount()
  })
})
