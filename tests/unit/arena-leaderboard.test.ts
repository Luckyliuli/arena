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
        name: '符文',
        rarity: '稀有度',
        sampleSize: '样本数',
        empty: '该英雄暂无榜单数据',
        metricPlacement: '平均名次',
        metricFirstplace: '第一名率',
        metricPicks: '选用率',
        raritySilver: '白银',
        rarityGold: '黄金',
        rarityPrismatic: '棱彩',
        rarityUnknown: '未知',
        loadFailed: '加载失败',
        apiUnavailable: '前端 IPC 不可用',
      },
    },
  },
})

beforeEach(() => {
  mockElectronApi = { arenaAugmentData: { getStats: mockGetStats } }
})

afterEach(() => {
  mockElectronApi = null
  mockGetStats.mockReset()
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
      ranked: { placement: [], firstplace: [], picks: [] },
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
            sampleSize: 1234,
          },
        ],
      },
      ranked: {
        placement: [
          {
            augmentId: 1,
            displayName: { en: 'Sample', zh: '示例符文' },
            rarity: 'gold',
            iconLarge: null,
            iconSmall: null,
            averagePlacement: 1.5,
            firstPlaceRate: 0.2,
            pickRate: 0.05,
            sampleSize: 1234,
          },
        ],
        firstplace: [],
        picks: [],
      },
      sourceLabel: 'mock',
    })
    const w = factory()
    await flushPromises()
    expect(w.text()).toContain('示例符文')
    // The mock-banner is rendered when bundle.mock is true
    expect(w.text()).toContain('mock')
    // Sample-size column is hidden in mock mode (TDD: hide stats that look
    // fake); the metric column renders 1.50 for placement
    expect(w.text()).toContain('1.50')
    w.unmount()
  })
})