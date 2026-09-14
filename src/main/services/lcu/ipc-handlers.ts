/**
 * LCU 服务相关的 IPC 处理器
 * 使用统一的 LCU 服务实现
 *
 * 迁移自 electron/modules/ipc-handlers.ts
 */

import logger from '../../modules/logger.ts'
import { getChampionMonitorState, rememberChampionId } from '../../modules/champion-monitor-state.ts'
import { getLCUServiceInstance } from './lcu-service.ts'
import { ChampionIdResult, ChampSelectSnapshot } from './types.ts'
import { readArenaSessionState } from '../arena-session/arena-session-service.ts'
import { shoppingPhaseSignalStore } from '../arena-session/shopping-phase-signal.ts'
import { trustedIpcMain as ipcMain } from '../../security/trusted-ipc.ts'

const getLcuServiceFromStore = async () => {
  const service = getLCUServiceInstance()
  if (!service.isActive()) {
    await service.getAuthToken()
  }

  return {
    service,
    error: service.isActive()
      ? null
      : '未从运行中的客户端发现 LCU',
  }
}

/**
 * 注册所有 LCU 相关的 IPC 处理器
 */
export function registerLCUIpcHandlers(): void {
  ipcMain.handle('lcu-get-champion-monitor-state', () => getChampionMonitorState())
  ipcMain.handle('lcu-get-status', async () => {
    const { service, error } = await getLcuServiceFromStore()
    if (!service) {
      return { success: false, active: false, error }
    }

    const active = service.isActive() && (await service.getLcuStatus())
    return {
      success: true,
      active,
    }
  })

  ipcMain.handle('lcu-get-current-session', async () => {
    const { service, error } = await getLcuServiceFromStore()
    if (!service) {
      return { success: false, session: null, error }
    }

    const session = await service.getCurrentSession()
    return {
      success: !!session,
      session,
      error: session ? null : '无有效的选人会话',
    }
  })

  ipcMain.handle('lcu-get-champ-select-snapshot', async () => {
    const { service, error } = await getLcuServiceFromStore()
    if (!service) {
      return {
        success: true,
        snapshot: {
          connected: false,
          gameflowPhase: null,
          isInChampSelect: false,
          champSelectSession: null,
          localPlayerCellId: null,
          selfChampionId: null,
          benchEnabled: false,
          benchChampions: [],
          myTeam: [],
          actions: [],
          timer: null,
          status: 'unavailable',
          reason: error || 'lcu-unavailable',
          updatedAt: Date.now(),
        } satisfies ChampSelectSnapshot,
        error,
      }
    }

    const snapshot = await service.getChampSelectSnapshot()
    return {
      success: true,
      snapshot,
      error: snapshot.status === 'ready' ? null : snapshot.reason,
    }
  })

  ipcMain.handle('lcu-get-perk-list', async () => {
    const { service, error } = await getLcuServiceFromStore()
    if (!service) {
      return { success: false, perks: [], error }
    }

    const perks = await service.getPerkList()
    return {
      success: true,
      perks,
    }
  })

  ipcMain.handle('lcu-apply-perk', async (_event, data) => {
    const { service, error } = await getLcuServiceFromStore()
    if (!service) {
      return { success: false, error }
    }

    const success = await service.applyPerk(data)
    return { success }
  })

  ipcMain.handle('lcu-get-gameflow-phase', async () => {
    const { service, error } = await getLcuServiceFromStore()
    if (!service) {
      return { success: false, phase: null, error }
    }

    const phase = await service.getGameflowPhase()
    return {
      success: !!phase,
      phase,
    }
  })

  // M3: Arena (斗魂竞技场) awareness. Reports whether the client is in an Arena
  // match, which champion is being played, and whether the shopping phase can
  // be asserted. Never mutates game state.
  ipcMain.handle('lcu-get-arena-session', async () => {
    const { service, error } = await getLcuServiceFromStore()

    try {
      const session = await readArenaSessionState({
        lcu: service,
        getRememberedChampionId: () => getChampionMonitorState().lastChampionId,
        getShoppingPhaseSignal: now => shoppingPhaseSignalStore.read(now),
      })

      return {
        success: true,
        session,
        error: session.status === 'unavailable' ? error ?? session.reason ?? undefined : undefined,
      }
    } catch (err) {
      logger.error('[arena-session] failed to read arena session:', err)
      return {
        success: false,
        session: null,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  /**
   * 获取当前选择的英雄ID
   */
  ipcMain.handle('get-champion-id', async (): Promise<ChampionIdResult> => {
    try {
      // 获取 LCU 服务实例
      const lcuService = getLCUServiceInstance()

      // 首次调用或需要刷新时获取 token
      if (!lcuService.isActive()) {
        logger.debug('[LCU] service inactive, refreshing auth token')
        const authResult = await lcuService.getAuthToken()
        logger.debug('[LCU] auth refresh result', {
          active: lcuService.isActive(),
          port: authResult?.port || null,
        })

        if (!lcuService.isActive()) {
          logger.debug('[LCU] service activation failed')
          return {
            success: false,
            championId: null,
            error: '未从运行中的客户端发现 LCU',
          }
        }
      }

      logger.debug('[LCU] reading readonly champ-select snapshot')
      const snapshot = await lcuService.getChampSelectSnapshot()

      logger.debug(
        `[LCU] 选人快照: status=${snapshot.status}, phase=${snapshot.gameflowPhase || 'unknown'}, self=${snapshot.selfChampionId || 'none'}, bench=${snapshot.benchChampions.length}`
      )

      if (snapshot.selfChampionId) {
        rememberChampionId(snapshot.selfChampionId)
        return {
          success: true,
          championId: snapshot.selfChampionId,
        }
      }

      logger.debug(`[LCU] current player champion not found (snapshot status: ${snapshot.status})`)

      return {
        success: false,
        championId: null,
        error: snapshot.reason || '未找到英雄选择 - 请确保已选择英雄',
      }
    } catch (error) {
      logger.error('[LCU] 获取英雄ID时发生错误:', error)
      const err = error as Error
      return {
        success: false,
        championId: null,
        error: err.message,
      }
    }
  })

  logger.info('LCU IPC 处理器已注册')
}
