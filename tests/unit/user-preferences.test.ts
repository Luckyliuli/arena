import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }))

vi.mock('../../src/main/modules/app-store.ts', () => ({
  default: { get: mocks.get, set: mocks.set },
}))

import {
  migrateLegacyChampionInsightAlwaysOnTopPreference,
  shouldAutoApplyArenaItemSets,
  shouldHideChampionInsightOnGameStart,
  shouldKeepChampionInsightOnTop,
  shouldShowChampionDetails,
} from '../../src/main/modules/user-preferences.ts'

describe('user preferences', () => {
  beforeEach(() => {
    mocks.get.mockReset()
    mocks.set.mockReset()
  })

  it('defaults Champion Details visibility to enabled', () => {
    mocks.get.mockReturnValue(undefined)
    expect(shouldShowChampionDetails()).toBe(true)
    expect(mocks.get).toHaveBeenCalledWith('championInsight.showDetails')
  })

  it('disables Champion Details only for an explicit false value', () => {
    mocks.get.mockReturnValue(false)
    expect(shouldShowChampionDetails()).toBe(false)

    mocks.get.mockReturnValue(true)
    expect(shouldShowChampionDetails()).toBe(true)
  })

  it('restores the previous hide-on-game-start preference and defaults to enabled', () => {
    expect(shouldHideChampionInsightOnGameStart()).toBe(true)
    expect(mocks.get).toHaveBeenCalledWith('championInsight.hideOnGameStart')
    mocks.get.mockReturnValue(false)
    expect(shouldHideChampionInsightOnGameStart()).toBe(false)
  })

  it('enables Arena item-set injection by default and still honors explicit changes', () => {
    expect(shouldAutoApplyArenaItemSets()).toBe(true)
    expect(mocks.get).toHaveBeenCalledWith('itemSets.autoApplyArena')
    mocks.get.mockReturnValue(false)
    expect(shouldAutoApplyArenaItemSets()).toBe(false)
  })

  it('enables always-on-top by default and still honors explicit changes', () => {
    expect(shouldKeepChampionInsightOnTop()).toBe(true)
    expect(mocks.get).toHaveBeenCalledWith('championInsight.alwaysOnTop')
    mocks.get.mockReturnValue(true)
    expect(shouldKeepChampionInsightOnTop()).toBe(true)
    mocks.get.mockReturnValue(false)
    expect(shouldKeepChampionInsightOnTop()).toBe(false)
  })

  it('migrates the legacy always-on-top default once so the details window is visible above League', () => {
    mocks.get.mockImplementation((key: string) => {
      if (key === 'migrations.championInsightAlwaysOnTopDefaultV1') return undefined
      if (key === 'championInsight.alwaysOnTop') return false
      return undefined
    })

    migrateLegacyChampionInsightAlwaysOnTopPreference()

    expect(mocks.set).toHaveBeenCalledWith('championInsight.alwaysOnTop', true)
    expect(mocks.set).toHaveBeenCalledWith('migrations.championInsightAlwaysOnTopDefaultV1', true)
  })

  it('does not override a pin choice made after the migration', () => {
    mocks.get.mockImplementation((key: string) => {
      if (key === 'migrations.championInsightAlwaysOnTopDefaultV1') return true
      if (key === 'championInsight.alwaysOnTop') return false
      return undefined
    })

    migrateLegacyChampionInsightAlwaysOnTopPreference()

    expect(mocks.set).not.toHaveBeenCalled()
  })
})
