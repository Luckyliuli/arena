<template>
  <div
    class="recommend-card"
    :class="[
      `rarity-${rarity || 'unknown'}`,
      { 'top-pick': topPick, 'empty-slot': missing, 'unavailable': unavailable },
    ]"
  >
    <div v-if="topPick" class="top-pick-badge"><span>*</span>{{ t('augment.priority') }}</div>

    <div class="recommend-icon-frame">
      <img v-if="!missing && iconPath" :src="getAugmentIconUrl(iconPath)" :alt="name" class="recommend-icon" @error="handleImageError" />
      <span v-else-if="!missing">{{ String((slotIndex ?? 0) + 1).padStart(2, '0') }}</span>
    </div>

    <div class="recommend-content">
      <h3 class="recommend-name">
        {{ missing ? '' : name }}
        <span v-if="upgradeLabel" class="upgrade-badge">{{ upgradeLabel }}</span>
      </h3>

      <template v-if="!missing">
        <div v-if="unavailable" class="recommend-unavailable">{{ t('augment.notRecommendedForChampion') }}</div>
        <template v-else-if="recommendScore != null">
          <div class="score-hero" :class="tierClass">
            <strong>{{ formatScore(recommendScore) }}</strong>
            <span>/100</span>
            <small>{{ recommendationText }}</small>
          </div>
          <div class="recommend-stats">
            <span>{{ t('augment.winRate') }} <strong>{{ formatPercent(winRate) }}</strong></span>
            <span>{{ t('augment.pickRateShort') }} <strong>{{ formatPercent(pickRate) }}</strong></span>
          </div>
        </template>
        <div v-else class="recommend-no-stats">{{ t('augment.noStats') }}</div>
      </template>
    </div>

    <div v-if="!missing && recommendScore != null && !unavailable" class="score-track">
      <div class="score-fill" :style="{ width: scoreWidth }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getAugmentIconUrl } from '../service/cdn'
import { formatPercent, handleImageError } from '../service/overlay-formatters.ts'
import type { ArenaRecommendationTier } from '../../shared/ipc-contract.ts'

const props = defineProps<{
  name?: string
  iconPath?: string | null
  rarity?: string | null
  missing?: boolean
  topPick?: boolean
  unavailable?: boolean
  recommendScore?: number | null
  recommendationTier?: ArenaRecommendationTier | null
  pickRate?: number | null
  winRate?: number | null
  slotIndex?: number
  upgradeLabel?: string | null
}>()

const { t } = useI18n()
const TIER_KEYS: Record<ArenaRecommendationTier, string> = {
  'must-pick': 'augment.scoreMustPick',
  strong: 'augment.scoreStrong',
  recommended: 'augment.scoreRecommended',
  optional: 'augment.scoreOptional',
  niche: 'augment.scoreNiche',
}
const tierClass = computed(() => props.recommendationTier || 'unknown')
const recommendationText = computed(() => props.recommendationTier ? t(TIER_KEYS[props.recommendationTier]) : t('augment.scoreUnknown'))
const formatScore = (value: number) => String(Math.round(value * 100))
const scoreWidth = computed(() => props.recommendScore == null ? '0%' : `${Math.min(Math.max(props.recommendScore * 100, 0), 100)}%`)
</script>

<style scoped>
.recommend-card { position: relative; display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 9px; align-items: center; min-width: 0; height: 140px; padding: 10px 10px 15px; box-sizing: border-box; border: 1px solid rgba(60, 74, 71, .38); border-radius: 5px; background: rgba(12, 18, 25, .8); }
.recommend-card.top-pick { border: 2px solid #e2c384; background: rgba(17, 29, 38, .96); box-shadow: inset 0 0 15px rgba(226,195,132,.18), 0 0 22px rgba(226,195,132,.14); }
.recommend-card.empty-slot, .recommend-card.unavailable { opacity: .72; }
.recommend-card.empty-slot { border-style: dashed; }
.top-pick-badge { position: absolute; top: -11px; left: 10px; display: inline-flex; align-items: center; gap: 4px; min-height: 21px; padding: 0 9px; border-radius: 4px; background: #e2c384; color: #402d00; font-size: 10px; font-weight: 900; white-space: nowrap; }
.top-pick-badge span { font-size: 12px; }
.recommend-icon-frame { display: grid; place-items: center; width: 52px; height: 52px; border: 1px solid rgba(226,192,143,.34); border-radius: 5px; background: rgba(3,7,18,.72); color: #e2c08f; font-size: 15px; font-weight: 900; overflow: hidden; }
.recommend-icon { width: 100%; height: 100%; object-fit: cover; }
.recommend-content { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.recommend-name { margin: 0; display: block; overflow: hidden; color: #d7e4f1; font-size: 15px; font-weight: 900; line-height: 1.15; text-overflow: ellipsis; white-space: nowrap; }
.score-hero { display: flex; align-items: baseline; gap: 5px; min-width: 0; padding: 5px 7px; border: 1px solid rgba(226,192,143,.38); border-radius: 4px; background: rgba(194,156,109,.13); color: #f0d58f; }
.score-hero strong { font-size: 29px; line-height: 1; font-weight: 1000; font-variant-numeric: tabular-nums; }
.score-hero > span { font-size: 10px; color: #aeb9b5; }
.score-hero small { margin-left: auto; overflow: hidden; font-size: 10px; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
.score-hero.must-pick, .score-hero.strong { border-color: rgba(226,195,132,.58); background: rgba(226,195,132,.18); color: #ffe5a3; }
.score-hero.optional, .score-hero.niche, .score-hero.unknown { border-color: rgba(148,163,184,.28); background: rgba(148,163,184,.08); color: #cbd5e1; }
.recommend-stats { display: flex; justify-content: space-between; gap: 6px; color: #94a3b8; font-size: 10px; }
.recommend-stats strong { color: #e2e8f0; font-variant-numeric: tabular-nums; }
.recommend-no-stats, .recommend-unavailable { padding: 6px 7px; border-radius: 4px; background: rgba(148,163,184,.08); color: #94a3b8; font-size: 11px; font-weight: 800; }
.recommend-unavailable { color: #fca5a5; background: rgba(248,113,113,.08); }
.score-track { position: absolute; left: 10px; right: 10px; bottom: 7px; height: 3px; background: rgba(215,228,241,.08); }
.score-fill { height: 100%; background: linear-gradient(90deg, #e2c08f, #e2c384); }
.upgrade-badge { margin-left: 5px; padding: 1px 5px; border: 1px solid rgba(129,140,248,.42); border-radius: 4px; background: rgba(99,102,241,.14); color: #c7d2fe; font-size: 9px; vertical-align: middle; }
</style>
