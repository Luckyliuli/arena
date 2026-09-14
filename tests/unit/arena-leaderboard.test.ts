// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

const mockGetStats = vi.fn()
const mockGetChampions = vi.fn()
const mockGetSnapshot = vi.fn()
const mockStoreGet = vi.fn()
let mockElectronApi: any = null
let snapshotUpdatedHandler: ((snapshot: any) => void) | null = null

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
      augment: { championFallback: '英雄 {id}' },
      arenaLeaderboard: {
        title: '强化符文榜单',
        selectChampion: '选择英雄',
        tabs: { augments: '符文榜', champions: '英雄榜', combinations: '组合榜' },
        combinationTabs: { trio: '三人组合', duo: '双人组合' },
        columns: {
          rank: '排名', augment: '符文', rarity: '稀有度', champion: '英雄',
          combination: '组合', winRate: '胜率', pickRate: '选用率', games: '场次',
          averagePlacement: '平均名次', firstPlace: '第一名率',
        },
        sortAscending: '升序', sortDescending: '降序',
        source: '数据源', sampleSize: '样本数', empty: '暂无数据', loadFailed: '加载失败',
        apiUnavailable: '前端 IPC 不可用', raritySilver: '白银', rarityGold: '黄金',
        rarityPrismatic: '棱彩', rarityUnknown: '未知', rankPicks: '按选用率',
        rankWinrate: 'OP.GG 胜率', metricPicks: '选用率', metricWinrate: 'OP.GG 胜率',
        metricPlacement: '平均名次', metricFirstplace: '第一名率', mockWarning: '占位数据',
      },
    },
  },
})

const championOptions = [
  { id: 1, slug: 'Annie', nameZh: '黑暗之女', nameEn: 'Annie' },
  { id: 2, slug: 'Olaf', nameZh: '狂战士', nameEn: 'Olaf' },
]

const augmentRows = Array.from({ length: 25 }, (_, index) => ({
  augmentId: index + 1,
  displayName: { zh: '符文' + (index + 1), en: 'Augment ' + (index + 1) },
  rarity: 'gold',
  iconLarge: null,
  iconSmall: null,
  winRate: 0.5 + index / 1000,
  pickRate: 0.3 - index / 100,
  sampleSize: 1000 + index,
  averagePlacement: null,
  firstPlaceRate: null,
}))

function statsResult() {
  return {
    success: true,
    bundle: { fetchedAt: new Date().toISOString(), source: 'opgg', mock: false, records: augmentRows },
    ranked: {
      placement: [],
      firstplace: [],
      picks: [...augmentRows].sort((a, b) => b.pickRate - a.pickRate),
      winrate: [...augmentRows].sort((a, b) => b.winRate - a.winRate),
    },
    sourceLabel: 'OP.GG',
  }
}

const snapshot = {
  schemaVersion: 1 as const,
  patch: '16.18',
  source: 'opgg' as const,
  champions: [
    { championId: 2, slug: 'Olaf', winRate: 0.54, pickRate: 0.12 },
    { championId: 1, slug: 'Annie', winRate: 0.52, pickRate: 0.08 },
  ],
  combinations: {
    trio: [{ championIds: [1, 2, 3], winRate: 0.6, pickRate: 0.03, averagePlacement: 2.8, firstPlaceRate: 0.2, sampleSize: 300 }],
    duo: [{ championIds: [1, 2], winRate: 0.58, pickRate: 0.05, averagePlacement: 3, firstPlaceRate: 0.18, sampleSize: 200 }],
  },
}

beforeEach(() => {
  mockGetChampions.mockResolvedValue({ success: true, patch: '16.18', champions: championOptions })
  mockGetStats.mockResolvedValue(statsResult())
  mockGetSnapshot.mockResolvedValue({ success: true, snapshot })
  mockStoreGet.mockResolvedValue(undefined)
  snapshotUpdatedHandler = null
  mockElectronApi = {
    store: { get: mockStoreGet },
    arenaAugmentData: { getStats: mockGetStats, getChampions: mockGetChampions },
    arenaLeaderboard: { getSnapshot: mockGetSnapshot },
    events: { on: vi.fn((channel: string, handler: (snapshot: any) => void) => {
      if (channel === 'arena-leaderboard-updated') snapshotUpdatedHandler = handler
      return vi.fn()
    }) },
  }
})

afterEach(() => {
  mockElectronApi = null
  mockGetStats.mockReset()
  mockGetChampions.mockReset()
  mockGetSnapshot.mockReset()
  mockStoreGet.mockReset()
})

function factory() {
  return mount(ArenaLeaderboard, { global: { plugins: [i18n] } })
}

describe('ArenaLeaderboard', () => {
  it('renders the unavailable-API branch without throwing', async () => {
    mockElectronApi = null
    const wrapper = factory()
    await flushPromises()
    expect(wrapper.text()).toContain('前端 IPC 不可用')
    wrapper.unmount()
  })

  it('shows every augment for the selected champion with win rate as the default sort', async () => {
    const wrapper = factory()
    await flushPromises()

    expect(mockGetStats).toHaveBeenLastCalledWith({ championId: 1, limit: 100 })
    expect(wrapper.find('select[aria-label="选择英雄"]').exists()).toBe(true)
    expect(wrapper.findAll('tbody tr')).toHaveLength(25)
    expect(wrapper.findAll('tbody tr')[0].text()).toContain('符文25')
  })

  it('changes the augment sort when a metric header is clicked', async () => {
    const wrapper = factory()
    await flushPromises()

    await wrapper.get('button[data-sort="pickRate"]').trigger('click')
    expect(wrapper.findAll('tbody tr')[0].text()).toContain('符文1')

    await wrapper.get('button[data-sort="pickRate"]').trigger('click')
    expect(wrapper.findAll('tbody tr')[0].text()).toContain('符文25')
  })

  it('switches to champion and combination leaderboards', async () => {
    const wrapper = factory()
    await flushPromises()

    await wrapper.get('button[data-leaderboard-tab="champions"]').trigger('click')
    expect(wrapper.find('select[aria-label="选择英雄"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('狂战士')

    await wrapper.get('button[data-leaderboard-tab="combinations"]').trigger('click')
    expect(wrapper.get('button[data-combination-tab="trio"]').classes()).toContain('active')
    expect(wrapper.text()).toContain('黑暗之女 + 狂战士 + 英雄 3')

    await wrapper.get('button[data-combination-tab="duo"]').trigger('click')
    expect(wrapper.text()).toContain('黑暗之女 + 狂战士')
    wrapper.unmount()
  })

  it('replaces the rendered snapshot when the background refresh completes', async () => {
    const wrapper = factory()
    await flushPromises()
    await wrapper.get('button[data-leaderboard-tab="champions"]').trigger('click')
    expect(wrapper.text()).toContain('狂战士')

    snapshotUpdatedHandler!({ ...snapshot, champions: [snapshot.champions[1]] })
    await flushPromises()
    expect(wrapper.text()).toContain('黑暗之女')
    expect(wrapper.text()).not.toContain('狂战士')
    wrapper.unmount()
  })

  it('opens the selected champion augment leaderboard from the champion table', async () => {
    const wrapper = factory()
    await flushPromises()

    await wrapper.get('button[data-leaderboard-tab="champions"]').trigger('click')
    await wrapper.get('.champion-row-button').trigger('click')
    await flushPromises()

    expect(wrapper.get('button[data-leaderboard-tab="augments"]').classes()).toContain('active')
    expect(mockGetStats).toHaveBeenLastCalledWith({ championId: 2, limit: 100 })
    wrapper.unmount()
  })
})
