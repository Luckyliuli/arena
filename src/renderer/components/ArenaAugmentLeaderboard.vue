<template>
  <div class="augment-leaderboard">
    <div v-if="loading" class="state-line">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="state-line error">{{ error }}</div>
    <div class="meta-line">
      <span>{{ t('arenaLeaderboard.source') }}: {{ sourceLabel || '--' }}</span>
      <span>{{ rows.length }}</span>
    </div>

    <table class="leaderboard-table augment-table">
      <thead>
        <tr>
          <th class="rank-col">{{ t('arenaLeaderboard.columns.rank') }}</th>
          <th>{{ t('arenaLeaderboard.columns.augment') }}</th>
          <th class="rarity-col">{{ t('arenaLeaderboard.columns.rarity') }}</th>
          <th class="metric-col">
            <button data-sort="winRate" type="button" :aria-sort="ariaSort('winRate')" @click="$emit('sort', 'winRate')">
              {{ t('arenaLeaderboard.columns.winRate') }}
              <span aria-hidden="true">{{ sortMark('winRate') }}</span>
            </button>
          </th>
          <th class="metric-col">
            <button data-sort="pickRate" type="button" :aria-sort="ariaSort('pickRate')" @click="$emit('sort', 'pickRate')">
              {{ t('arenaLeaderboard.columns.pickRate') }}
              <span aria-hidden="true">{{ sortMark('pickRate') }}</span>
            </button>
          </th>
          <th class="sample-col">{{ t('arenaLeaderboard.columns.games') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="row.augmentId">
          <td class="rank-col">{{ index + 1 }}</td>
          <td>
            <div class="augment-name-cell">
              <img
                v-if="row.iconLarge || row.iconSmall"
                :src="getAugmentIconUrl(row.iconLarge || row.iconSmall)"
                :alt="augmentName(row)"
                class="augment-icon"
                loading="lazy"
              />
              <span class="augment-name">{{ augmentName(row) }}</span>
            </div>
          </td>
          <td class="rarity-col"><span class="rarity-badge" :class="'rarity-' + row.rarity">{{ rarityLabel(row.rarity) }}</span></td>
          <td class="metric-col winrate-value">{{ formatPercent(row.winRate) }}</td>
          <td class="metric-col">{{ formatPercent(row.pickRate) }}</td>
          <td class="sample-col">{{ row.sampleSize == null ? '-' : formatNumber(row.sampleSize) }}</td>
        </tr>
        <tr v-if="!loading && rows.length === 0">
          <td class="empty-row" colspan="6">{{ t('arenaLeaderboard.empty') }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { getAugmentIconUrl } from '../service/cdn'
import type {
  ArenaAugmentLeaderboardRow,
  ArenaAugmentRarity,
} from '../../shared/ipc-contract.ts'
import type {
  ArenaAugmentSortKey,
  ArenaLeaderboardSortDirection,
} from '../../shared/arena-leaderboard.ts'

const props = defineProps<{
  rows: ArenaAugmentLeaderboardRow[]
  loading: boolean
  error: string | null
  sourceLabel: string
  sortKey: ArenaAugmentSortKey
  sortDirection: ArenaLeaderboardSortDirection
}>()

defineEmits<{ sort: [key: ArenaAugmentSortKey] }>()
const { t, locale } = useI18n()

const rarityKeys: Record<ArenaAugmentRarity, string> = {
  silver: 'arenaLeaderboard.raritySilver',
  gold: 'arenaLeaderboard.rarityGold',
  prismatic: 'arenaLeaderboard.rarityPrismatic',
  unknown: 'arenaLeaderboard.rarityUnknown',
}
const augmentName = (row: ArenaAugmentLeaderboardRow) => locale.value === 'en-US' ? (row.displayName.en || row.displayName.zh) : (row.displayName.zh || row.displayName.en)
const rarityLabel = (rarity: ArenaAugmentRarity) => t(rarityKeys[rarity])
const formatPercent = (value: number | null) => value == null ? '-' : (value * 100).toFixed(1) + '%'
const formatNumber = (value: number) => value.toLocaleString()
const sortMark = (key: ArenaAugmentSortKey) => props.sortKey !== key ? '↕' : props.sortDirection === 'desc' ? '↓' : '↑'
const ariaSort = (key: ArenaAugmentSortKey) => props.sortKey !== key ? 'none' : props.sortDirection === 'desc' ? 'descending' : 'ascending'
</script>

<style scoped>
.augment-leaderboard { min-width: 0; }
.state-line { padding: 8px 0; color: var(--hex-fg-muted, #9aa0aa); font-size: 12px; }
.state-line.error { color: #dc5050; }
.meta-line { display: flex; justify-content: space-between; margin-bottom: 6px; color: var(--hex-fg-muted, #9aa0aa); font-size: 11px; }
.leaderboard-table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
.leaderboard-table th, .leaderboard-table td { padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,.05); text-align: left; }
.leaderboard-table th { color: var(--hex-fg-muted, #9aa0aa); font-size: 10px; font-weight: 600; text-transform: uppercase; }
.leaderboard-table th button { border: 0; padding: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.rank-col { width: 30px; }
.rarity-col { width: 54px; }
.metric-col { width: 52px; text-align: right !important; font-variant-numeric: tabular-nums; }
.sample-col { width: 52px; text-align: right !important; color: var(--hex-fg-muted, #9aa0aa); font-variant-numeric: tabular-nums; }
.augment-name-cell { display: flex; align-items: center; gap: 7px; min-width: 0; }
.augment-icon { width: 28px; height: 28px; flex: 0 0 auto; border-radius: 4px; object-fit: cover; }
.augment-name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.winrate-value { color: #72d6a0; font-weight: 800; }
.rarity-badge { display: inline-block; padding: 2px 6px; border-radius: 999px; font-size: 9px; }
.rarity-silver { background: #6c7a89; color: white; }
.rarity-gold { background: #dca63c; color: #1f2330; }
.rarity-prismatic { background: #c170d8; color: white; }
.rarity-unknown { background: #3a3f4b; color: #cbd5e1; }
.empty-row { padding: 18px 4px !important; text-align: center !important; color: var(--hex-fg-muted, #9aa0aa); }
</style>
