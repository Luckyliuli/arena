<template>
  <section class="leaderboard-card">
    <header class="card-header">
      <BarChart3 class="card-icon" />
      <h3>{{ t('arenaLeaderboard.title') }}</h3>
      <label v-if="activeTab === 'augments'" class="champion-picker">
        <span class="sr-only">{{ t('arenaLeaderboard.selectChampion') }}</span>
        <select
          v-model.number="championId"
          :aria-label="t('arenaLeaderboard.selectChampion')"
          :disabled="augmentLoading || championOptions.length === 0"
          @change="loadAugments"
        >
          <option v-for="option in championOptions" :key="option.id" :value="option.id">{{ championLabel(option) }}</option>
        </select>
      </label>
      <div class="card-actions">
        <button class="reload-btn" type="button" :disabled="currentLoading" :title="t('common.refresh')" @click="refreshCurrent">
          <RefreshCw :class="{ spinning: currentLoading }" />
        </button>
      </div>
    </header>

    <nav class="leaderboard-tabs" role="tablist" :aria-label="t('arenaLeaderboard.title')">
      <button data-leaderboard-tab="augments" type="button" :class="{ active: activeTab === 'augments' }" @click="switchTab('augments')">{{ t('arenaLeaderboard.tabs.augments') }}</button>
      <button data-leaderboard-tab="champions" type="button" :class="{ active: activeTab === 'champions' }" @click="switchTab('champions')">{{ t('arenaLeaderboard.tabs.champions') }}</button>
      <button data-leaderboard-tab="combinations" type="button" :class="{ active: activeTab === 'combinations' }" @click="switchTab('combinations')">{{ t('arenaLeaderboard.tabs.combinations') }}</button>
    </nav>

    <div v-if="!hasApi" class="error-banner">{{ t('arenaLeaderboard.apiUnavailable') }}</div>
    <ArenaAugmentLeaderboard
      v-else-if="activeTab === 'augments'"
      :rows="sortedAugments"
      :loading="augmentLoading"
      :error="augmentError"
      :source-label="sourceLabel"
      :sort-key="sortKey"
      :sort-direction="sortDirection"
      @sort="toggleSort"
    />
    <ArenaChampionLeaderboard
      v-else-if="activeTab === 'champions'"
      :rows="snapshot?.champions || []"
      :champion-options="championOptions"
      :loading="snapshotLoading"
      :error="snapshotError"
      @select-champion="selectChampionFromHero"
    />
    <ArenaCombinationLeaderboard
      v-else
      :combinations="snapshot?.combinations || { trio: [], duo: [] }"
      :champion-options="championOptions"
      :loading="snapshotLoading"
      :error="snapshotError"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { BarChart3, RefreshCw } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { electronAPI, hasElectronAPI } from '../native/electron-api.ts'
import type {
  ArenaAugmentLeaderboardRow,
  ArenaAugmentStatsRequest,
  ArenaAugmentStatsResult,
  ArenaChampionOption,
} from '../../shared/ipc-contract.ts'
import type { ArenaLeaderboardSnapshot } from '../../shared/arena-leaderboard-snapshot.ts'
import {
  sortArenaAugmentRows,
  type ArenaAugmentSortKey,
  type ArenaLeaderboardSortDirection,
} from '../../shared/arena-leaderboard.ts'
import ArenaAugmentLeaderboard from './ArenaAugmentLeaderboard.vue'
import ArenaChampionLeaderboard from './ArenaChampionLeaderboard.vue'
import ArenaCombinationLeaderboard from './ArenaCombinationLeaderboard.vue'

type LeaderboardTab = 'augments' | 'champions' | 'combinations'
const DEFAULT_CHAMPION_ID = 1
const AUGMENT_LIMIT = 100
const { t, locale } = useI18n()
const hasApi = hasElectronAPI()
const activeTab = ref<LeaderboardTab>('augments')
const championOptions = ref<ArenaChampionOption[]>([])
const championId = ref(DEFAULT_CHAMPION_ID)
const augmentRows = ref<ArenaAugmentLeaderboardRow[]>([])
const augmentLoading = ref(false)
const augmentError = ref<string | null>(null)
const sourceLabel = ref('')
const sortKey = ref<ArenaAugmentSortKey>('winRate')
const sortDirection = ref<ArenaLeaderboardSortDirection>('desc')
const snapshot = ref<ArenaLeaderboardSnapshot | null>(null)
const snapshotLoading = ref(false)
const snapshotError = ref<string | null>(null)
let unsubscribeSnapshot = () => {}

const sortedAugments = computed(() => sortArenaAugmentRows(augmentRows.value, sortKey.value, sortDirection.value))
const currentLoading = computed(() => activeTab.value === 'augments' ? augmentLoading.value : snapshotLoading.value)
const championLabel = (option: ArenaChampionOption) => locale.value === 'en-US' ? option.nameEn : option.nameZh

function toggleSort(key: ArenaAugmentSortKey) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortKey.value = key
    sortDirection.value = 'desc'
  }
}

async function loadAugments() {
  if (!hasApi) return
  augmentLoading.value = true
  augmentError.value = null
  try {
    const request: ArenaAugmentStatsRequest = { championId: championId.value, limit: AUGMENT_LIMIT }
    const result: ArenaAugmentStatsResult = await electronAPI.arenaAugmentData.getStats(request)
    if (!result.success || !result.ranked) throw new Error(result.error || t('arenaLeaderboard.loadFailed'))
    augmentRows.value = result.ranked.winrate
    sourceLabel.value = result.sourceLabel || result.bundle?.source || 'OP.GG'
  } catch (error) {
    augmentError.value = (error as Error).message || String(error)
  } finally {
    augmentLoading.value = false
  }
}

async function loadSnapshot() {
  if (!hasApi) return
  snapshotLoading.value = true
  snapshotError.value = null
  try {
    const result = await electronAPI.arenaLeaderboard.getSnapshot()
    if (!result.success || !result.snapshot) throw new Error(result.error || t('arenaLeaderboard.loadFailed'))
    snapshot.value = result.snapshot
  } catch (error) {
    snapshotError.value = (error as Error).message || String(error)
  } finally {
    snapshotLoading.value = false
  }
}

function refreshCurrent() {
  if (activeTab.value === 'augments') void loadAugments()
  else void loadSnapshot()
}

function switchTab(tab: LeaderboardTab) {
  activeTab.value = tab
  if (tab !== 'augments' && !snapshot.value) void loadSnapshot()
}

function selectChampionFromHero(nextChampionId: number) {
  championId.value = nextChampionId
  activeTab.value = 'augments'
  void loadAugments()
}

async function initialize() {
  if (!hasApi) return
  try {
    const result = await electronAPI.arenaAugmentData.getChampions()
    if (result.success && result.champions?.length) {
      championOptions.value = result.champions
      const savedChampionId = Number(await electronAPI.store.get('lastSelectedChampionId'))
      championId.value = championOptions.value.some(option => option.id === savedChampionId)
        ? savedChampionId
        : championOptions.value[0].id
    }
  } catch {
    // The augment request below remains usable with its default champion.
  }

  await Promise.all([loadAugments(), loadSnapshot()])
}

onMounted(() => {
  if (!hasApi) return
  unsubscribeSnapshot = electronAPI.events.on('arena-leaderboard-updated', nextSnapshot => {
    snapshot.value = nextSnapshot
    snapshotError.value = null
  })
  void initialize()
})
onBeforeUnmount(() => unsubscribeSnapshot())
</script>

<style scoped>
.leaderboard-card { background: var(--hex-bg-elevated, #1f2330); border: 1px solid var(--hex-border, #2c3140); border-radius: 8px; padding: 14px; color: var(--hex-fg, #e6e8ee); font-size: 13px; min-width: 0; }
.card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.card-header h3 { margin: 0; flex: 1; font-size: 15px; font-weight: 700; }
.card-icon { width: 18px; height: 18px; color: var(--hex-accent, #5e8ad4); }
.card-actions .reload-btn { display: grid; place-items: center; width: 28px; height: 28px; border: 1px solid var(--hex-border, #2c3140); border-radius: 4px; background: transparent; color: var(--hex-fg, #e6e8ee); cursor: pointer; }
.card-actions .reload-btn:disabled { opacity: .55; cursor: wait; }
.reload-btn svg { width: 14px; height: 14px; }
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.leaderboard-tabs { display: flex; margin-bottom: 10px; }
.leaderboard-tabs button { flex: 1; height: 30px; border: 1px solid var(--hex-border, #2c3140); background: transparent; color: var(--hex-fg-muted, #9aa0aa); font-size: 12px; font-weight: 700; cursor: pointer; }
.leaderboard-tabs button:first-child { border-radius: 4px 0 0 4px; }
.leaderboard-tabs button:not(:first-child) { margin-left: -1px; }
.leaderboard-tabs button:last-child { border-radius: 0 4px 4px 0; }
.leaderboard-tabs button.active { position: relative; z-index: 1; background: var(--hex-accent, #5e8ad4); border-color: var(--hex-accent, #5e8ad4); color: white; }
.champion-picker { min-width: 104px; max-width: 142px; }
.champion-picker select { width: 100%; height: 28px; padding: 0 24px 0 8px; border: 1px solid var(--hex-border, #2c3140); border-radius: 4px; background: var(--hex-bg, #171a22); color: var(--hex-fg, #e6e8ee); font: inherit; font-size: 12px; cursor: pointer; }
.champion-picker select:disabled { opacity: .55; cursor: wait; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.error-banner { padding: 8px 10px; border: 1px solid rgba(220,80,80,.35); border-radius: 4px; background: rgba(220,80,80,.12); color: #dc5050; font-size: 12px; }
</style>
