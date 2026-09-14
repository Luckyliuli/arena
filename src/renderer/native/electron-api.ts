import type {
  ArenaAugmentStatsRequest,
  ArenaAugmentStatsResult,
  ArenaChampionOptionsResult,
  ArenaLeaderboardSnapshotResult,
  ArenaItemStatsRequest,
  ArenaItemStatsResult,
  ElectronAPI,
} from '../../shared/ipc-contract.ts'

const getElectronAPI = () => window.electronAPI

export const hasElectronAPI = () => !!getElectronAPI()

export const requireElectronAPI = () => {
  const api = getElectronAPI()
  if (!api) {
    throw new Error('Electron API is not available')
  }
  return api
}

export const electronAPI: ElectronAPI = {
  store: {
    get: (...args) => requireElectronAPI().store.get(...args),
    set: (...args) => requireElectronAPI().store.set(...args),
    delete: (...args) => requireElectronAPI().store.delete(...args),
  },
  windows: {
    ready: () => requireElectronAPI().windows.ready(),
    showPopup: (...args) => requireElectronAPI().windows.showPopup(...args),
    hidePopup: (...args) => requireElectronAPI().windows.hidePopup(...args),
    hideFloating: (...args) => requireElectronAPI().windows.hideFloating(...args),
    hideAugmentSidePanel: (...args) => requireElectronAPI().windows.hideAugmentSidePanel(...args),
    toggleMain: (...args) => requireElectronAPI().windows.toggleMain(...args),
    confirmQuit: (...args) => requireElectronAPI().windows.confirmQuit(...args),
    restart: (...args) => requireElectronAPI().windows.restart(...args),
  },
  appInfo: {
    getVersionInfo: (...args) => requireElectronAPI().appInfo.getVersionInfo(...args),
    openLogDirectory: (...args) => requireElectronAPI().appInfo.openLogDirectory(...args),
  },
  appUpdate: {
    getState: (...args) => requireElectronAPI().appUpdate.getState(...args),
    check: (...args) => requireElectronAPI().appUpdate.check(...args),
    download: (...args) => requireElectronAPI().appUpdate.download(...args),
    install: (...args) => requireElectronAPI().appUpdate.install(...args),
  },
  locale: {
    get: (...args) => requireElectronAPI().locale.get(...args),
    set: (...args) => requireElectronAPI().locale.set(...args),
  },
  screenshot: {
    capture: (...args) => requireElectronAPI().screenshot.capture(...args),
    analyze: (...args) => requireElectronAPI().screenshot.analyze(...args),
  },
  winrate: {
    get: (...args) => requireElectronAPI().winrate.get(...args),
    loadChampionData: (...args) => requireElectronAPI().winrate.loadChampionData(...args),
  },
  autoScreenshot: {
    start: (...args) => requireElectronAPI().autoScreenshot.start(...args),
    stop: (...args) => requireElectronAPI().autoScreenshot.stop(...args),
    setConfig: (...args) => requireElectronAPI().autoScreenshot.setConfig(...args),
    getStats: (...args) => requireElectronAPI().autoScreenshot.getStats(...args),
    getConfig: (...args) => requireElectronAPI().autoScreenshot.getConfig(...args),
  },
  feedback: {
    submit: (...args) => requireElectronAPI().feedback.submit(...args),
  },
  lcu: {
    getChampionMonitorState: () => requireElectronAPI().lcu.getChampionMonitorState(),
    getChampionId: (...args) => requireElectronAPI().lcu.getChampionId(...args),
    getStatus: (...args) => requireElectronAPI().lcu.getStatus(...args),
    getCurrentSession: (...args) => requireElectronAPI().lcu.getCurrentSession(...args),
    getChampSelectSnapshot: (...args) => requireElectronAPI().lcu.getChampSelectSnapshot(...args),
    getPerkList: (...args) => requireElectronAPI().lcu.getPerkList(...args),
    applyPerk: (...args) => requireElectronAPI().lcu.applyPerk(...args),
    getGameflowPhase: (...args) => requireElectronAPI().lcu.getGameflowPhase(...args),
    getArenaSession: (...args) => requireElectronAPI().lcu.getArenaSession(...args),
    getManualLeaguePath: (...args) => requireElectronAPI().lcu.getManualLeaguePath(...args),
    selectManualLeaguePath: (...args) => requireElectronAPI().lcu.selectManualLeaguePath(...args),
    validateManualLeaguePath: (...args) =>
      requireElectronAPI().lcu.validateManualLeaguePath(...args),
    setManualLeaguePath: (...args) => requireElectronAPI().lcu.setManualLeaguePath(...args),
    clearManualLeaguePath: (...args) => requireElectronAPI().lcu.clearManualLeaguePath(...args),
  },
  diagnostics: {
    testShowFloating: (...args) => requireElectronAPI().diagnostics.testShowFloating(...args),
    testShowRandomFloating: (...args) =>
      requireElectronAPI().diagnostics.testShowRandomFloating(...args),
    testShowRandomPopup: (...args) =>
      requireElectronAPI().diagnostics.testShowRandomPopup(...args),
    testShowRandomArenaItems: (...args) =>
      requireElectronAPI().diagnostics.testShowRandomArenaItems(...args),
    logRendererError: (...args) => requireElectronAPI().diagnostics.logRendererError(...args),
    logRendererInfo: (...args) => requireElectronAPI().diagnostics.logRendererInfo(...args),
  },
  shell: {
    openExternal: (...args) => requireElectronAPI().shell.openExternal(...args),
  },
  arenaAugmentData: {
    getStats: (...args: [ArenaAugmentStatsRequest]): Promise<ArenaAugmentStatsResult> =>
      requireElectronAPI().arenaAugmentData.getStats(...args),
    getChampions: (): Promise<ArenaChampionOptionsResult> =>
      requireElectronAPI().arenaAugmentData.getChampions(),
  },
  arenaItemData: {
    getStats: (...args: [ArenaItemStatsRequest]): Promise<ArenaItemStatsResult> =>
      requireElectronAPI().arenaItemData.getStats(...args),
  },
  arenaLeaderboard: {
    getSnapshot: (): Promise<ArenaLeaderboardSnapshotResult> =>
      requireElectronAPI().arenaLeaderboard.getSnapshot(),
  },
  events: {
    on: (...args) => requireElectronAPI().events.on(...args),
    once: (...args) => requireElectronAPI().events.once(...args),
  },
}
