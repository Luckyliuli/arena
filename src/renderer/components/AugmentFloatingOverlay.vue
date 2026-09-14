<template>
  <transition name="float-fade">
    <div v-if="visible" class="floating-overlay">
      <button class="close-btn" type="button" @click="closeOverlay('manual')" :title="t('common.close')" :aria-label="t('common.close')">
        <X class="close-icon" />
      </button>

      <!-- 斗魂强化符文推荐（固定三槽，空槽保留占位） -->
      <template v-if="hasCandidates">
        <div class="overlay-header">
          <span class="overlay-title">{{ t('augment.arenaOverlayTitle') }}</span>
          <span v-if="isMockData" class="mock-badge">{{ t('augment.placeholderData') }}</span>
        </div>

        <div class="augments-grid">
          <div
            v-for="(augment, index) in overlayAugments"
            :key="getSlotKey(augment, index)"
            class="augment-item"
            :class="[`rarity-${augment.rarity || 'unknown'}`, { 'top-pick': isTopPickIndex(index), 'empty-slot': augment.missing, 'not-recommended': augment.notRecommendedForChampion }]"
          >
            <div v-if="isTopPickIndex(index)" class="top-pick-badge">
              <span>*</span>
              {{ t('augment.priority') }}
            </div>

            <div class="augment-icon-frame">
              <img
                v-if="!augment.missing && augment.iconPath"
                :src="getAugmentIconUrl(augment.iconPath)"
                :alt="augment.name"
                class="augment-icon"
              />
              <span v-else-if="!augment.missing">{{ String(index + 1).padStart(2, '0') }}</span>
            </div>

            <div class="content">
              <h3 class="name">
                {{ augment.missing ? '' : augment.name }}
                <span v-if="augment.isUpgrade" class="upgrade-badge">
                  {{ augment.augmentLevel ? t('augment.upgradeLevel', { level: augment.augmentLevel }) : t('augment.upgrade') }}
                </span>
              </h3>
              <template v-if="!augment.missing">
                <span v-if="augment.notRecommendedForChampion" class="recommend-label unavailable">
                  {{ t('augment.notRecommendedForChampion') }}
                </span>
                <template v-else>
                  <span class="recommend-label" :class="getBadgeClass(augment)">
                    {{ getRecommendText(augment) }} · {{ formatScore(augment.recommendScore) }}
                  </span>
                  <div class="stat-line">
                    <span>{{ t('augment.pickRateShort') }}</span>
                    <strong>{{ formatPercent(augment.pickRate) }}</strong>
                  </div>
                </template>
              </template>
            </div>

            <div v-if="!augment.missing && !augment.notRecommendedForChampion" class="score-track">
              <div class="score-fill" :style="{ width: getScoreWidth(augment.recommendScore) }"></div>
            </div>
          </div>
        </div>
      </template>

      <!-- 错误状态 -->
      <div v-else class="error">
        {{ error || t('augment.noData') }}
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { X } from 'lucide-vue-next'
import { electronAPI } from '../native/electron-api.ts'
import { getAugmentIconUrl } from '../service/cdn'
import { formatPercent } from '../service/overlay-formatters.ts'
import {
  findArenaOverlayTopPickIndex,
  getArenaOverlayRecommendationScore,
  getArenaOverlayRecommendationTier,
  hasArenaOverlayMockData,
  orderArenaOverlayAugments,
} from '../service/arena-augment-overlay.ts'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const visible = ref(false)
const error = ref(null)
const detectedAugments = ref([])
const recommendationMock = ref(false)
const championId = ref(null)
const unsubscribeEvents = []

const overlayAugments = computed(() => orderArenaOverlayAugments(detectedAugments.value))
const hasCandidates = computed(() => detectedAugments.value.length > 0)
const topPickIndex = computed(() => findArenaOverlayTopPickIndex(overlayAugments.value))
const isMockData = computed(() => hasArenaOverlayMockData(overlayAugments.value, recommendationMock.value))

const isTopPickIndex = (index) => index === topPickIndex.value

const getSlotKey = (augment, index) => {
  if (augment?.missing) return `missing-${augment.detectedSlot ?? index}`
  return augment?.augmentId ?? augment?.id ?? augment?.name ?? index
}

/**
 * 把推荐度（0~1）转成 0~100 的整数；缺失时显示 --，不显示 0
 */
const formatScore = (value) => {
  const score = value == null || value === '' ? null : Number(value)
  if (score == null || !Number.isFinite(score)) return '--'
  return String(Math.round(score * 100))
}

const getScoreWidth = (value) => {
  const score = getArenaOverlayRecommendationScore({ recommendScore: value })
  if (score == null) return '0%'
  return `${Math.min(Math.max(score * 100, 0), 100)}%`
}

const RECOMMEND_TEXT_KEYS = {
  'must-pick': 'augment.scoreMustPick',
  strong: 'augment.scoreStrong',
  recommended: 'augment.scoreRecommended',
  optional: 'augment.scoreOptional',
  niche: 'augment.scoreNiche',
}

const getRecommendText = (augment) => {
  if (augment?.notRecommendedForChampion) return t('augment.notRecommendedForChampion')
  const tier = getArenaOverlayRecommendationTier(augment)
  return tier ? t(RECOMMEND_TEXT_KEYS[tier]) : t('augment.scoreUnknown')
}

const getBadgeClass = (augment) => augment?.notRecommendedForChampion ? 'unavailable' : getArenaOverlayRecommendationTier(augment) || 'unknown'

const logFloatingInfo = (message, details = {}) => {
  try {
    electronAPI.diagnostics.logRendererInfo({
      type: 'augment-floating',
      source: 'AugmentFloatingOverlay',
      message,
      url: window.location.href,
      details,
      timestamp: Date.now(),
    })
  } catch {
    // Best-effort diagnostics only.
  }
}

const getAugmentDebugId = (augment) => augment?.augmentId ?? augment?.id ?? null

const getDisplayDiagnostics = () => ({
  augmentIds: overlayAugments.value.map(getAugmentDebugId),
  detectedSlots: overlayAugments.value.map(augment => augment.detectedSlot ?? null),
  missingSlots: overlayAugments.value
    .map((augment, index) => augment?.missing ? index : null)
    .filter(index => index != null),
  topPickIndex: topPickIndex.value,
  topPickId: getAugmentDebugId(overlayAugments.value[topPickIndex.value]),
  mock: isMockData.value,
})

const logDisplayState = (message, data, details = {}) => {
  logFloatingInfo(message, {
    ...details,
    championId: championId.value || null,
    requestAugmentIds: (data?.augments || []).map(getAugmentDebugId),
    requestDiagnostics: data?.analysisDiagnostics || null,
    display: getDisplayDiagnostics(),
  })
}

/**
 * 显示浮窗（斗魂：数据已由主进程通过 arena-augment-data 适配器准备好）
 */
const showOverlay = (data) => {
  visible.value = true
  error.value = null

  logFloatingInfo('showOverlay received', {
    championId: data?.championId || null,
    augmentCount: Array.isArray(data?.augments) ? data.augments.length : 0,
    augmentIds: (data?.augments || []).map(getAugmentDebugId),
    detectedSlots: (data?.augments || []).map((augment, index) => (
      Number.isInteger(augment?.detectedSlot) ? augment.detectedSlot : index
    )),
    dataSource: data?.dataSource || null,
    partialUpdate: data?.partialUpdate === true,
    winratePending: data?.winratePending === true,
    recommendationMock: data?.recommendationMock === true,
    recommendationSource: data?.recommendationSource || null,
    topPickAugmentId: data?.topPickAugmentId ?? null,
    topPickDetectedSlot: data?.topPickDetectedSlot ?? null,
    analysisDiagnostics: data?.analysisDiagnostics || null,
  })

  if (!data || !Array.isArray(data.augments) || data.augments.length === 0) {
    detectedAugments.value = []
    recommendationMock.value = false
    championId.value = null
    error.value = t('augment.noData')
    logFloatingInfo('showOverlay received no data')
    return
  }

  championId.value = data.championId ?? null
  recommendationMock.value = data.recommendationMock === true
  detectedAugments.value = data.augments

  logDisplayState('display state applied', data, {
    mode: data.winratePending === true ? 'pending-recommendation' : 'full-recommendation',
    recommendationMock: data.recommendationMock === true,
  })
}

/**
 * 关闭浮窗
 */
const closeOverlay = (reason = 'manual') => {
  visible.value = false
  detectedAugments.value = []
  recommendationMock.value = false
  error.value = null
  logFloatingInfo('overlay closed', { reason })

  // 隐藏浮动窗口本身
  electronAPI.windows.hideFloating(reason)
}

/**
 * 监听事件
 */
onMounted(() => {
  console.log('🔧 [FloatingOverlay] 组件已挂载')

  unsubscribeEvents.push(electronAPI.events.on('augment-detected', (data) => {
    console.log('📊 [FloatingOverlay] 收到 augment-detected:', data)
    showOverlay(data)
  }))

  unsubscribeEvents.push(electronAPI.events.on('augment-cleared', (data) => {
    console.log('🔧 [FloatingOverlay] 收到 augment-cleared:', data)
    closeOverlay('augment-cleared')
  }))

  unsubscribeEvents.push(electronAPI.events.on('game-started', () => {
    console.log('🎮 [FloatingOverlay] 游戏开始，关闭浮窗')
    closeOverlay('game-started')
  }))

  unsubscribeEvents.push(electronAPI.events.on('game-in-progress', () => {
    console.log('🎮 [FloatingOverlay] 游戏进行中，关闭浮窗')
    closeOverlay('game-in-progress')
  }))

  unsubscribeEvents.push(electronAPI.events.on('game-phase-changed', (data) => {
    if (data && (data.phase === 'GameStart' || data.phase === 'InProgress')) {
      console.log('🎮 [FloatingOverlay] 游戏阶段变化，关闭浮窗')
      closeOverlay('game-phase-changed')
    }
  }))
})

onBeforeUnmount(() => {
  unsubscribeEvents.splice(0).forEach(unsubscribe => unsubscribe())
  closeOverlay('unmount')
})
</script>

<style scoped>
.floating-overlay {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(760px, calc(100vw - 8px));
  max-height: 100vh;
  background:
    linear-gradient(145deg, rgba(18, 27, 38, 0.9), rgba(6, 9, 12, 0.92)),
    rgba(7, 10, 13, 0.92);
  border: 1px solid rgba(200, 169, 106, 0.2);
  border-radius: 4px;
  padding: 6px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.66), 0 0 0 1px rgba(194, 156, 109, 0.08);
  box-sizing: border-box;
  font-family: 'Microsoft YaHei', Arial, sans-serif;
  color: var(--lol-ivory);
  z-index: 9999;
  overflow: hidden;
}

.overlay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 18px;
  margin-bottom: 4px;
  padding: 0 2px;
}

.overlay-title {
  color: #e2c08f;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.mock-badge {
  padding: 2px 8px;
  border: 1px solid rgba(226, 192, 143, 0.34);
  border-radius: 3px;
  background: rgba(194, 156, 109, 0.14);
  color: #e2c384;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.close-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid rgba(60, 74, 71, 0.45);
  border-radius: 3px;
  background: rgba(4, 15, 24, 0.54);
  color: #bacac6;
  cursor: pointer;
}

.close-icon {
  width: 14px;
  height: 14px;
}

.close-btn:hover {
  background: rgba(255, 180, 171, 0.14);
  border-color: rgba(255, 180, 171, 0.42);
  color: #ffb4ab;
}

.error {
  padding: 18px 8px;
  color: #bacac6;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}

.augments-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  align-items: stretch;
}

.augment-item {
  min-width: 0;
  min-height: 122px;
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 10px 10px 12px;
  position: relative;
  border: 1px solid rgba(60, 74, 71, 0.38);
  border-radius: 4px;
  background: rgba(31, 43, 53, 0.55);
  box-sizing: border-box;
}

.augment-item.empty-slot {
  opacity: 0.5;
  border-style: dashed;
}

.augment-item.not-recommended {
  opacity: 0.78;
  border-color: rgba(248, 113, 113, 0.28);
}

.augment-item.empty-slot .augment-icon-frame {
  border-color: rgba(244, 236, 220, 0.16);
  background: rgba(244, 236, 220, 0.03);
}

.augment-item.top-pick {
  border: 2px solid #e2c384;
  background: rgba(17, 29, 38, 0.92);
  box-shadow: inset 0 0 15px rgba(226, 195, 132, 0.18), 0 0 22px rgba(226, 195, 132, 0.14);
  z-index: 2;
}

.top-pick-badge {
  position: absolute;
  top: -13px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 22px;
  padding: 0 12px;
  border-radius: 4px;
  background: #e2c384;
  color: #402d00;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
  box-shadow: 0 0 12px rgba(226, 195, 132, 0.46);
}

.augment-icon-frame {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(226, 192, 143, 0.34);
  border-radius: 4px;
  background: rgba(8, 21, 30, 0.9);
  color: #e2c08f;
  font-size: 15px;
  font-weight: 900;
  overflow: hidden;
  box-shadow: inset 0 0 10px rgba(194, 156, 109, 0.12);
}

.top-pick .augment-icon-frame {
  border-color: rgba(226, 195, 132, 0.62);
  box-shadow: inset 0 0 15px rgba(226, 195, 132, 0.16), 0 0 12px rgba(226, 195, 132, 0.24);
}

.augment-icon {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.name {
  margin: 0;
  display: block;
  overflow: hidden;
  color: #d7e4f1;
  font-size: 16px;
  font-weight: 900;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-pick .name {
  color: #e2c384;
  text-shadow: 0 0 7px rgba(226, 195, 132, 0.28);
}

.stat-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 3px;
  border-bottom: 1px solid rgba(226, 192, 143, 0.16);
}

.stat-line span {
  color: #bacac6;
  font-size: 10px;
  font-weight: 900;
}

.stat-line strong {
  color: #e2c08f;
  font-size: 13px;
  font-weight: 900;
}

.top-pick .stat-line strong {
  color: #e2c384;
}

.recommend-label {
  align-self: flex-start;
  max-width: 100%;
  overflow: hidden;
  padding: 2px 7px;
  border: 1px solid rgba(226, 192, 143, 0.28);
  border-radius: 4px;
  background: rgba(194, 156, 109, 0.1);
  color: #e2c08f;
  font-size: 10px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recommend-label.must-pick,
.recommend-label.strong {
  border-color: rgba(226, 195, 132, 0.42);
  background: rgba(226, 195, 132, 0.12);
  color: #e2c384;
}

.upgrade-badge {
  margin-left: 6px;
  padding: 1px 5px;
  border: 1px solid rgba(129, 140, 248, 0.42);
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.14);
  color: #c7d2fe;
  font-size: 9px;
  font-weight: 900;
  vertical-align: middle;
  white-space: nowrap;
}

.recommend-label.unavailable {
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.08);
  color: #fca5a5;
}

.recommend-label.niche,
.recommend-label.unknown {
  border-color: rgba(186, 202, 198, 0.24);
  background: rgba(186, 202, 198, 0.08);
  color: #bacac6;
}

.score-track {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 6px;
  height: 3px;
  background: rgba(215, 228, 241, 0.08);
}

.score-fill {
  height: 100%;
  background: linear-gradient(90deg, #e2c08f, #e2c384);
}

@media (max-width: 820px) {
  .floating-overlay {
    width: 100vw;
    max-height: 100vh;
  }

  .augments-grid {
    gap: 6px;
  }

  .augment-item {
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 8px;
    padding: 8px 8px 10px;
  }

  .augment-icon-frame {
    width: 42px;
    height: 42px;
  }

  .name {
    font-size: 14px;
  }

  .recommend-label {
    padding: 1px 5px;
    font-size: 9px;
  }
}
</style>