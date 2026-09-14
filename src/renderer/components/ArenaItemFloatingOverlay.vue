<template>
  <transition name="float-fade">
    <div v-if="visible" class="arena-item-overlay">
      <button class="close-btn" type="button" @click="closeOverlay('manual')" :title="t('common.close')" :aria-label="t('common.close')">
        <X class="close-icon" />
      </button>

      <div class="overlay-header">
        <span class="overlay-title">{{ t('augment.arenaItemsOverlayTitle') }}</span>
        <span class="overlay-source">{{ t('augment.itemCategoryPrismatic') }}</span>
      </div>

      <div class="items-grid">
        <div
          v-for="(item, index) in orderedItems"
          :key="itemKey(item, index)"
          class="item-slot"
          :class="{ 'top-pick': item.isTopPick, 'empty-slot': item.missing, 'no-stat': !item.missing && item.recommendScore == null }"
        >
          <div v-if="item.isTopPick" class="top-pick-badge">* {{ t('augment.priority') }}</div>
          <div class="item-icon-frame">
            <img v-if="!item.missing && item.iconUrl" :src="item.iconUrl" :alt="item.name" class="item-icon" @error="handleImageError" />
            <span v-else>{{ String(index + 1).padStart(2, '0') }}</span>
          </div>
          <div class="item-content">
            <h3>{{ item.missing ? '' : item.name }}</h3>
            <template v-if="!item.missing">
              <template v-if="item.recommendScore != null">
                <div class="recommend-line" :class="item.recommendationTier || 'unknown'">
                  {{ recommendationText(item) }} · {{ formatScore(item.recommendScore) }}
                </div>
                <div class="metric-line">
                  <span>{{ t('augment.winRate') }} {{ formatPercent(item.winRate) }}</span>
                  <strong>{{ t('augment.pickRateShort') }} {{ formatPercent(item.pickRate) }}</strong>
                </div>
                <div class="metric-line muted">
                  <span>{{ t('arenaLeaderboard.sampleSize') }} {{ formatNumberOrDash(item.sampleSize) }}</span>
                  <span>{{ formatPlacement(item.averagePlacement) }}</span>
                </div>
              </template>
              <div v-else class="no-stats">{{ t('augment.noStats') }}</div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { electronAPI } from '../native/electron-api.ts'
import { formatNumber, formatPercent, handleImageError } from '../service/overlay-formatters.ts'
import type { ArenaOverlayItemPayload, ArenaRecommendationTier } from '../../shared/ipc-contract.ts'

const { t } = useI18n()
const visible = ref(false)
const items = ref<ArenaOverlayItemPayload[]>([])
const unsubscribeEvents: Array<() => void> = []

const orderedItems = computed(() => {
  const slots = Array<ArenaOverlayItemPayload>(3).fill({ missing: true })
  items.value.forEach((item, index) => {
    const slot = Number.isInteger(item.detectedSlot) && Number(item.detectedSlot) >= 0 && Number(item.detectedSlot) < 3 ? Number(item.detectedSlot) : index
    if (!slots[slot]?.missing) return
    slots[slot] = item
  })
  return slots
})

const TIER_KEYS: Record<ArenaRecommendationTier, string> = {
  'must-pick': 'augment.scoreMustPick',
  strong: 'augment.scoreStrong',
  recommended: 'augment.scoreRecommended',
  optional: 'augment.scoreOptional',
  niche: 'augment.scoreNiche',
}

const itemKey = (item: ArenaOverlayItemPayload, index: number) => item.missing ? `missing-${index}` : item.itemId ?? item.name ?? index
const recommendationText = (item: ArenaOverlayItemPayload) => item.recommendationTier ? t(TIER_KEYS[item.recommendationTier]) : t('augment.scoreUnknown')
const formatScore = (value: number) => String(Math.round(value * 100))
const formatNumberOrDash = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? formatNumber(number) : '--'
}
const formatPlacement = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number.toFixed(2) : '--'
}

const hideContent = () => {
  visible.value = false
  items.value = []
}

const closeOverlay = (reason = 'manual') => {
  hideContent()
  electronAPI.windows.hideFloating(reason)
}

const showItems = (payload: { items?: ArenaOverlayItemPayload[] }) => {
  const nextItems = Array.isArray(payload?.items) ? payload.items : []
  if (nextItems.length === 0) {
    hideContent()
    return
  }
  items.value = nextItems.slice(0, 3)
  visible.value = true
}

onMounted(() => {
  unsubscribeEvents.push(electronAPI.events.on('arena-item-detected', showItems))
  unsubscribeEvents.push(electronAPI.events.on('arena-item-cleared', () => closeOverlay('arena-item-cleared')))
  unsubscribeEvents.push(electronAPI.events.on('augment-detected', () => hideContent()))
  unsubscribeEvents.push(electronAPI.events.on('augment-cleared', () => hideContent()))
  unsubscribeEvents.push(electronAPI.events.on('game-started', () => closeOverlay('game-started')))
  unsubscribeEvents.push(electronAPI.events.on('game-in-progress', () => closeOverlay('game-in-progress')))
  unsubscribeEvents.push(electronAPI.events.on('game-phase-changed', (data) => {
    if (data && (data.phase === 'GameStart' || data.phase === 'InProgress')) closeOverlay('game-phase-changed')
  }))
})

onBeforeUnmount(() => unsubscribeEvents.splice(0).forEach(unsubscribe => unsubscribe()))
</script>

<style scoped>
.arena-item-overlay { position: relative; width: 100%; height: 100%; padding: 8px 14px 10px; box-sizing: border-box; color: #f4ecdc; font-family: inherit; }
.close-btn { position: absolute; right: 6px; top: 4px; z-index: 5; display: grid; place-items: center; width: 20px; height: 20px; border: 0; border-radius: 4px; background: rgba(10, 15, 24, .55); color: #94a3b8; cursor: pointer; }
.close-icon { width: 13px; height: 13px; }
.overlay-header { display: flex; align-items: center; justify-content: space-between; padding: 0 24px 4px 3px; color: #cbd5e1; font-size: 11px; font-weight: 800; letter-spacing: .04em; }
.overlay-source { color: #94a3b8; font-weight: 600; }
.items-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; height: 134px; }
.item-slot { position: relative; display: grid; grid-template-columns: 58px minmax(0, 1fr); gap: 8px; align-items: center; min-width: 0; padding: 8px; border: 1px solid rgba(148, 163, 184, .24); border-radius: 6px; background: rgba(15, 23, 42, .76); box-sizing: border-box; }
.item-slot.top-pick { border: 2px solid #e2c384; background: rgba(17, 29, 38, .94); box-shadow: 0 0 18px rgba(226, 195, 132, .18); }
.item-slot.empty-slot, .item-slot.no-stat { opacity: .62; border-style: dashed; }
.top-pick-badge { position: absolute; top: -10px; left: 10px; padding: 1px 7px; border-radius: 4px; background: #e2c384; color: #402d00; font-size: 9px; font-weight: 900; }
.item-icon-frame { display: grid; place-items: center; width: 58px; height: 58px; border: 1px solid rgba(226, 192, 143, .35); border-radius: 5px; background: rgba(3, 7, 18, .6); overflow: hidden; color: #64748b; font-size: 20px; font-weight: 900; }
.item-icon { width: 100%; height: 100%; object-fit: cover; }
.item-content { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.item-content h3 { margin: 0 0 1px; overflow: hidden; color: #f8fafc; font-size: 11px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.recommend-line { align-self: flex-start; max-width: 100%; overflow: hidden; padding: 1px 5px; border: 1px solid rgba(226, 192, 143, .28); border-radius: 4px; color: #e2c08f; font-size: 9px; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
.recommend-line.must-pick, .recommend-line.strong { border-color: rgba(226, 195, 132, .5); color: #f0d58f; }
.recommend-line.optional, .recommend-line.niche, .recommend-line.unknown { border-color: rgba(148, 163, 184, .24); color: #94a3b8; }
.metric-line { display: flex; justify-content: space-between; gap: 5px; color: #94a3b8; font-size: 9px; }
.metric-line strong { color: #cbd5e1; font-variant-numeric: tabular-nums; }
.metric-line.muted { color: #64748b; }
.no-stats { color: #94a3b8; font-size: 10px; font-weight: 700; }
</style>
