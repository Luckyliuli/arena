<template>
  <transition name="float-fade">
    <div v-if="visible" class="floating-overlay">
      <button class="close-btn" type="button" @click="closeOverlay('manual')" :title="t('common.close')" :aria-label="t('common.close')">
        <X class="close-icon" />
      </button>

      <div class="overlay-header">
        <span class="overlay-title">{{ t('augment.arenaItemsOverlayTitle') }}</span>
        <span class="overlay-source">{{ t('augment.itemCategoryPrismatic') }}</span>
      </div>

      <div class="augments-grid">
        <ArenaRecommendationCard
          v-for="(item, index) in orderedItems"
          :key="itemKey(item, index)"
          :name="item.name"
          :icon-path="item.iconUrl"
          rarity="prismatic"
          :missing="item.missing"
          :top-pick="item.isTopPick"
          :recommend-score="item.recommendScore"
          :recommendation-tier="recommendationTier(item)"
          :pick-rate="item.pickRate"
          :win-rate="item.winRate"
          :slot-index="index"
        />
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { electronAPI } from '../native/electron-api.ts'
import { getArenaOverlayRecommendationTier } from '../service/arena-augment-overlay.ts'
import type { ArenaOverlayItemPayload } from '../../shared/ipc-contract.ts'
import ArenaRecommendationCard from './ArenaRecommendationCard.vue'

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
const itemKey = (item: ArenaOverlayItemPayload, index: number) => item.missing ? `missing-${index}` : item.itemId ?? item.name ?? index
const recommendationTier = (item: ArenaOverlayItemPayload) => item.recommendationTier || getArenaOverlayRecommendationTier(item)
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
  unsubscribeEvents.push(electronAPI.events.on('game-phase-changed', data => {
    if (data && (data.phase === 'GameStart' || data.phase === 'InProgress')) closeOverlay('game-phase-change')
  }))
})
onBeforeUnmount(() => unsubscribeEvents.splice(0).forEach(unsubscribe => unsubscribe()))
</script>

<style scoped>
.floating-overlay { position: relative; width: 100%; height: 100%; padding: 7px 12px 8px; box-sizing: border-box; color: #f4ecdc; background: transparent; }
.close-btn { position: absolute; right: 5px; top: 3px; z-index: 5; display: grid; place-items: center; width: 20px; height: 20px; border: 0; border-radius: 4px; background: rgba(10,15,24,.55); color: #94a3b8; cursor: pointer; }
.close-icon { width: 13px; height: 13px; }
.overlay-header { display: flex; align-items: center; justify-content: space-between; padding: 0 24px 4px 3px; color: #cbd5e1; font-size: 11px; font-weight: 800; letter-spacing: .04em; }
.overlay-source { color: #94a3b8; font-weight: 600; }
.augments-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
</style>
