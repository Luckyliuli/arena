<template>
  <div class="combination-leaderboard">
    <div class="combination-tabs" role="tablist">
      <button data-combination-tab="trio" type="button" :class="{ active: mode === 'trio' }" @click="mode = 'trio'">{{ t('arenaLeaderboard.combinationTabs.trio') }}</button>
      <button data-combination-tab="duo" type="button" :class="{ active: mode === 'duo' }" @click="mode = 'duo'">{{ t('arenaLeaderboard.combinationTabs.duo') }}</button>
    </div>
    <div v-if="loading" class="state-line">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="state-line error">{{ error }}</div>
    <div class="meta-line"><span>{{ t('arenaLeaderboard.source') }}: OP.GG</span><span>{{ rows.length }} / {{ totalRows }}</span></div>
    <table class="leaderboard-table combination-table">
      <thead><tr><th class="rank-col">{{ t('arenaLeaderboard.columns.rank') }}</th><th>{{ t('arenaLeaderboard.columns.combination') }}</th><th class="metric-col">{{ t('arenaLeaderboard.columns.winRate') }}</th><th class="metric-col">{{ t('arenaLeaderboard.columns.pickRate') }}</th><th class="metric-col">{{ t('arenaLeaderboard.columns.averagePlacement') }}</th></tr></thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="row.championIds.join('-')">
          <td class="rank-col">{{ index + 1 }}</td>
          <td>
            <div class="combination-cell">
              <div class="combination-icons">
                <img v-for="id in row.championIds" :key="id" :src="getChampionSquareIconUrl(id)" :alt="championName(id)" loading="lazy" />
              </div>
              <span>{{ row.championIds.map(championName).join(' + ') }}</span>
            </div>
          </td>
          <td class="metric-col winrate-value">{{ formatPercent(row.winRate) }}</td>
          <td class="metric-col">{{ formatPercent(row.pickRate) }}</td>
          <td class="metric-col">{{ row.averagePlacement == null ? '-' : row.averagePlacement.toFixed(2) }}</td>
        </tr>
        <tr v-if="!loading && rows.length === 0"><td class="empty-row" colspan="5">{{ t('arenaLeaderboard.empty') }}</td></tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getChampionSquareIconUrl } from '../service/cdn'
import type { ArenaChampionOption } from '../../shared/ipc-contract.ts'
import type { ArenaCombinationLeaderboardRow } from '../../shared/arena-leaderboard-snapshot.ts'

const props = defineProps<{
  combinations: { trio: ArenaCombinationLeaderboardRow[]; duo: ArenaCombinationLeaderboardRow[] }
  championOptions: ArenaChampionOption[]
  loading: boolean
  error: string | null
}>()
const MAX_ROWS = 50
const mode = ref<'trio' | 'duo'>('trio')
const { t, locale } = useI18n()
const optionsById = computed(() => new Map(props.championOptions.map(option => [option.id, option])))
const totalRows = computed(() => props.combinations[mode.value].length)
const rows = computed(() => props.combinations[mode.value].slice(0, MAX_ROWS))
const championName = (id: number) => {
  const option = optionsById.value.get(id)
  if (!option) return t('augment.championFallback', { id })
  return locale.value === 'en-US' ? option.nameEn : option.nameZh
}
const formatPercent = (value: number | null) => value == null ? '-' : (value * 100).toFixed(1) + '%'
</script>

<style scoped>
.combination-tabs { display: inline-flex; margin-bottom: 8px; }
.combination-tabs button { height: 26px; padding: 0 12px; border: 1px solid var(--hex-border, #2c3140); background: transparent; color: var(--hex-fg-muted, #9aa0aa); font-size: 11px; cursor: pointer; }
.combination-tabs button:first-child { border-radius: 4px 0 0 4px; }
.combination-tabs button:last-child { margin-left: -1px; border-radius: 0 4px 4px 0; }
.combination-tabs button.active { background: var(--hex-accent, #5e8ad4); border-color: var(--hex-accent, #5e8ad4); color: white; }
.state-line { padding: 8px 0; color: var(--hex-fg-muted, #9aa0aa); font-size: 12px; }
.state-line.error { color: #dc5050; }
.meta-line { display: flex; justify-content: space-between; margin-bottom: 6px; color: var(--hex-fg-muted, #9aa0aa); font-size: 11px; }
.leaderboard-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.leaderboard-table th, .leaderboard-table td { padding: 7px 3px; border-bottom: 1px solid rgba(255,255,255,.05); text-align: left; }
.leaderboard-table th { color: var(--hex-fg-muted, #9aa0aa); font-size: 10px; font-weight: 600; text-transform: uppercase; }
.rank-col { width: 28px; }
.metric-col { width: 54px; text-align: right !important; font-variant-numeric: tabular-nums; }
.combination-cell { display: flex; align-items: center; gap: 7px; min-width: 0; }
.combination-icons { display: flex; flex: 0 0 auto; }
.combination-icons img { width: 25px; height: 25px; margin-left: -7px; border: 1px solid #111827; border-radius: 50%; object-fit: cover; }
.combination-icons img:first-child { margin-left: 0; }
.combination-cell span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.winrate-value { color: #72d6a0; font-weight: 800; }
.empty-row { padding: 18px 4px !important; text-align: center !important; color: var(--hex-fg-muted, #9aa0aa); }
</style>
