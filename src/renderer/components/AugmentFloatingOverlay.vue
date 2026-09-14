<template>
  <transition name="float-fade">
    <div v-if="visible" class="floating-overlay">
      <button class="close-btn" type="button" @click="closeOverlay('manual')" :title="t('common.close')" :aria-label="t('common.close')">
        <X class="close-icon" />
      </button>

      <template v-if="hasCandidates">
        <div class="overlay-header">
          <span class="overlay-title">{{ t('augment.arenaOverlayTitle') }}</span>
          <span v-if="isMockData" class="mock-badge">{{ t('augment.placeholderData') }}</span>
        </div>

        <div class="augments-grid">
          <ArenaRecommendationCard
            v-for="(augment, index) in overlayAugments"
            :key="getSlotKey(augment, index)"
            :name="augment.name"
            :icon-path="augment.iconPath || augment.iconUrl"
            :rarity="augment.rarity"
            :missing="augment.missing"
            :top-pick="isTopPickIndex(index)"
            :unavailable="augment.notRecommendedForChampion"
            :recommend-score="augment.recommendScore"
            :recommendation-tier="recommendationTier(augment)"
            :pick-rate="augment.pickRate"
            :win-rate="augment.winRate"
            :slot-index="index"
            :upgrade-label="upgradeLabel(augment)"
          />
        </div>
      </template>

      <div v-else class="error">{{ error || t('augment.noData') }}</div>
    </div>
  </transition>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { X } from 'lucide-vue-next'
import { electronAPI } from '../native/electron-api.ts'
import {
  findArenaOverlayTopPickIndex,
  getArenaOverlayRecommendationTier,
  hasArenaOverlayMockData,
  orderArenaOverlayAugments,
} from '../service/arena-augment-overlay.ts'
import { useI18n } from 'vue-i18n'
import ArenaRecommendationCard from './ArenaRecommendationCard.vue'

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
const isTopPickIndex = index => index === topPickIndex.value

const getSlotKey = (augment, index) => {
  if (augment?.missing) return `missing-${augment.detectedSlot ?? index}`
  return augment?.augmentId ?? augment?.id ?? augment?.name ?? index
}
const recommendationTier = augment => augment?.recommendationTier || getArenaOverlayRecommendationTier(augment)
const upgradeLabel = augment => {
  if (!augment?.isUpgrade) return null
  return augment.augmentLevel
    ? t('augment.upgradeLevel', { level: augment.augmentLevel })
    : t('augment.upgrade')
}
const logFloatingInfo = (message, details = {}) => {
  try {
    electronAPI.diagnostics.logRendererInfo({ type: 'augment-floating', source: 'AugmentFloatingOverlay', message, url: window.location.href, details, timestamp: Date.now() })
  } catch {
    // Best-effort diagnostics only.
  }
}
const getAugmentDebugId = augment => augment?.augmentId ?? augment?.id ?? null
const logDisplayState = (message, data, details = {}) => {
  logFloatingInfo(message, {
    ...details,
    championId: championId.value || null,
    requestAugmentIds: (data?.augments || []).map(getAugmentDebugId),
    display: {
      augmentIds: overlayAugments.value.map(getAugmentDebugId),
      detectedSlots: overlayAugments.value.map(augment => augment.detectedSlot ?? null),
      topPickIndex: topPickIndex.value,
      topPickId: getAugmentDebugId(overlayAugments.value[topPickIndex.value]),
      mock: isMockData.value,
    },
  })
}
const showOverlay = data => {
  visible.value = true
  error.value = null
  logFloatingInfo('showOverlay received', {
    championId: data?.championId || null,
    augmentCount: Array.isArray(data?.augments) ? data.augments.length : 0,
    augmentIds: (data?.augments || []).map(getAugmentDebugId),
    recommendationMock: data?.recommendationMock === true,
    topPickAugmentId: data?.topPickAugmentId ?? null,
    topPickDetectedSlot: data?.topPickDetectedSlot ?? null,
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
  logDisplayState('display state applied', data, { mode: 'full-recommendation' })
}
const closeOverlay = (reason = 'manual') => {
  visible.value = false
  detectedAugments.value = []
  recommendationMock.value = false
  error.value = null
  logFloatingInfo('overlay closed', { reason })
  electronAPI.windows.hideFloating(reason)
}

onMounted(() => {
  unsubscribeEvents.push(electronAPI.events.on('augment-detected', showOverlay))
  unsubscribeEvents.push(electronAPI.events.on('arena-item-detected', () => {
    visible.value = false
    detectedAugments.value = []
    recommendationMock.value = false
    error.value = null
  }))
  unsubscribeEvents.push(electronAPI.events.on('augment-cleared', () => closeOverlay('augment-cleared')))
  unsubscribeEvents.push(electronAPI.events.on('game-started', () => closeOverlay('game-started')))
  unsubscribeEvents.push(electronAPI.events.on('game-in-progress', () => closeOverlay('game-in-progress')))
  unsubscribeEvents.push(electronAPI.events.on('game-phase-changed', data => {
    if (data && (data.phase === 'GameStart' || data.phase === 'InProgress')) closeOverlay('game-phase-change')
  }))
})
onBeforeUnmount(() => {
  unsubscribeEvents.splice(0).forEach(unsubscribe => unsubscribe())
  closeOverlay('unmount')
})
</script>

<style scoped>
.floating-overlay { position: relative; width: 100%; height: 100%; padding: 7px 12px 8px; box-sizing: border-box; color: #f4ecdc; background: transparent; }
.close-btn { position: absolute; right: 5px; top: 3px; z-index: 5; display: grid; place-items: center; width: 20px; height: 20px; border: 0; border-radius: 4px; background: rgba(10,15,24,.55); color: #94a3b8; cursor: pointer; }
.close-icon { width: 13px; height: 13px; }
.overlay-header { display: flex; align-items: center; justify-content: space-between; padding: 0 24px 4px 3px; color: #cbd5e1; font-size: 11px; font-weight: 800; letter-spacing: .04em; }
.mock-badge { color: #e2c384; }
.error { padding: 18px 8px; color: #bacac6; font-size: 13px; font-weight: 700; text-align: center; }
.augments-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
</style>
