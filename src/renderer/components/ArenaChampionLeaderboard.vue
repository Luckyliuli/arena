<template>
  <div class="champion-leaderboard">
    <div v-if="loading" class="state-line">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="state-line error">{{ error }}</div>
    <div class="meta-line"><span>{{ t('arenaLeaderboard.source') }}: OP.GG</span><span>{{ rows.length }}</span></div>
    <table class="leaderboard-table champion-table">
      <thead>
        <tr>
          <th class="rank-col">{{ t('arenaLeaderboard.columns.rank') }}</th>
          <th>{{ t('arenaLeaderboard.columns.champion') }}</th>
          <th class="metric-col">{{ t('arenaLeaderboard.columns.winRate') }}</th>
          <th class="metric-col">{{ t('arenaLeaderboard.columns.pickRate') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="row.championId">
          <td class="rank-col">{{ index + 1 }}</td>
          <td>
            <button class="champion-row-button" type="button" @click="$emit('select-champion', row.championId)">
              <img :src="getChampionSquareIconUrl(row.championId)" :alt="championName(row.championId)" loading="lazy" />
              <span>{{ championName(row.championId) }}</span>
            </button>
          </td>
          <td class="metric-col winrate-value">{{ formatPercent(row.winRate) }}</td>
          <td class="metric-col">{{ formatPercent(row.pickRate) }}</td>
        </tr>
        <tr v-if="!loading && rows.length === 0"><td class="empty-row" colspan="4">{{ t('arenaLeaderboard.empty') }}</td></tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getChampionSquareIconUrl } from '../service/cdn'
import type { ArenaChampionOption } from '../../shared/ipc-contract.ts'
import type { ArenaChampionLeaderboardRow } from '../../shared/arena-leaderboard-snapshot.ts'

const props = defineProps<{
  rows: ArenaChampionLeaderboardRow[]
  championOptions: ArenaChampionOption[]
  loading: boolean
  error: string | null
}>()
defineEmits<{ 'select-champion': [championId: number] }>()
const { t, locale } = useI18n()
const optionsById = computed(() => new Map(props.championOptions.map(option => [option.id, option])))
const championName = (id: number) => {
  const option = optionsById.value.get(id)
  if (!option) return t('augment.championFallback', { id })
  return locale.value === 'en-US' ? option.nameEn : option.nameZh
}
const formatPercent = (value: number | null) => value == null ? '-' : (value * 100).toFixed(1) + '%'
</script>

<style scoped>
.state-line { padding: 8px 0; color: var(--hex-fg-muted, #9aa0aa); font-size: 12px; }
.state-line.error { color: #dc5050; }
.meta-line { display: flex; justify-content: space-between; margin-bottom: 6px; color: var(--hex-fg-muted, #9aa0aa); font-size: 11px; }
.leaderboard-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.leaderboard-table th, .leaderboard-table td { padding: 7px 4px; border-bottom: 1px solid rgba(255,255,255,.05); text-align: left; }
.leaderboard-table th { color: var(--hex-fg-muted, #9aa0aa); font-size: 10px; font-weight: 600; text-transform: uppercase; }
.rank-col { width: 32px; }
.metric-col { width: 70px; text-align: right !important; font-variant-numeric: tabular-nums; }
.champion-row-button { display: flex; align-items: center; gap: 8px; width: 100%; border: 0; padding: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.champion-row-button:hover span { color: #e2c384; }
.champion-row-button img { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; }
.champion-row-button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.winrate-value { color: #72d6a0; font-weight: 800; }
.empty-row { padding: 18px 4px !important; text-align: center !important; color: var(--hex-fg-muted, #9aa0aa); }
</style>
