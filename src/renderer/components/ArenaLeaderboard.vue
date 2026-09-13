<template>
  <section class="leaderboard-card">
    <header class="card-header">
      <BarChart3 class="card-icon" />
      <h3>{{ t('arenaLeaderboard.title') }}</h3>
      <div class="card-actions">
        <button class="reload-btn" type="button" :disabled="loading" :title="t('common.refresh')" @click="reload">
          <RefreshCw :class="{ spinning: loading }" />
        </button>
      </div>
    </header>

    <div v-if="bundle && bundle.mock" class="mock-banner">
      <AlertTriangle class="banner-icon" />
      <span>{{ t('arenaLeaderboard.mockWarning') }}</span>
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>
    <div v-else-if="loading" class="loading-line">{{ t('common.loading') }}</div>

    <div class="rank-tabs">
      <button v-for="opt in rankOptions" :key="opt.id" type="button" :class="{ active: currentRank === opt.id }" @click="currentRank = opt.id">
        {{ t(opt.titleKey) }}
      </button>
    </div>

    <div class="meta-line">
      <span class="meta-source">{{ t('arenaLeaderboard.source') }}: {{ sourceLabel }}</span>
      <span v-if="bundle" class="meta-count">{{ rows.length }} / {{ bundle.records.length }}</span>
    </div>

    <table class="leaderboard-table">
      <thead>
        <tr>
          <th class="rank-col">#</th>
          <th class="name-col">{{ t('arenaLeaderboard.name') }}</th>
          <th class="rarity-col">{{ t('arenaLeaderboard.rarity') }}</th>
          <th class="metric-col">{{ currentRankLabel }}</th>
          <th v-if="!bundle || !bundle.mock" class="sample-col">{{ t('arenaLeaderboard.sampleSize') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, idx) in rows" :key="row.augmentId">
          <td class="rank-col">{{ idx + 1 }}</td>
          <td class="name-col">
            <span class="augment-name">{{ row.displayName.zh || row.displayName.en }}</span>
            <small v-if="row.displayName.zh" class="augment-name-en">{{ row.displayName.en }}</small>
          </td>
          <td class="rarity-col">
            <span class="rarity-badge" :class="rarityClass(row.rarity)">{{ rarityLabel(row.rarity) }}</span>
          </td>
          <td class="metric-col">{{ formatPrimary(row) }}</td>
          <td v-if="!bundle || !bundle.mock" class="sample-col">{{ row.sampleSize == null ? "-" : row.sampleSize.toLocaleString() }}</td>
        </tr>
        <tr v-if="!loading && rows.length === 0">
          <td class="empty-row" :colspan="(bundle && bundle.mock) ? 4 : 5">{{ t('arenaLeaderboard.empty') }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertTriangle, BarChart3, RefreshCw } from 'lucide-vue-next'
import { electronAPI, hasElectronAPI } from '../native/electron-api.ts'
import { useI18n } from 'vue-i18n'
import type {
  ArenaAugmentLeaderboardRow,
  ArenaAugmentRankOrder,
  ArenaAugmentRarity,
  ArenaAugmentStatsBundle,
  ArenaAugmentStatsRequest,
  ArenaAugmentStatsResult,
} from '../../shared/ipc-contract.ts'

const { t } = useI18n()
const DEFAULT_CHAMPION_ID = 1
const DEFAULT_LIMIT = 20

const rankOptions: { id: ArenaAugmentRankOrder, titleKey: string }[] = [
  { id: 'placement', titleKey: 'arenaLeaderboard.rankPlacement' },
  { id: 'firstplace', titleKey: 'arenaLeaderboard.rankFirstplace' },
  { id: 'picks', titleKey: 'arenaLeaderboard.rankPicks' },
]

const RANK_TITLE_KEYS: Record<ArenaAugmentRankOrder, string> = {
  placement: 'arenaLeaderboard.metricPlacement',
  firstplace: 'arenaLeaderboard.metricFirstplace',
  picks: 'arenaLeaderboard.metricPicks',
}

const RARITY_LABEL_KEYS: Record<ArenaAugmentRarity, string> = {
  silver: 'arenaLeaderboard.raritySilver',
  gold: 'arenaLeaderboard.rarityGold',
  prismatic: 'arenaLeaderboard.rarityPrismatic',
  unknown: 'arenaLeaderboard.rarityUnknown',
}

const bundle = ref<ArenaAugmentStatsBundle | null>(null)
const ranked = ref<{ placement: ArenaAugmentLeaderboardRow[]; firstplace: ArenaAugmentLeaderboardRow[]; picks: ArenaAugmentLeaderboardRow[] }>({ placement: [], firstplace: [], picks: [] })
const sourceLabel = ref<string>('')
const loading = ref<boolean>(false)
const error = ref<string | null>(null)
const championId = ref<number>(DEFAULT_CHAMPION_ID)
const currentRank = ref<ArenaAugmentRankOrder>('placement')

const rows = computed<ArenaAugmentLeaderboardRow[]>(() => ranked.value[currentRank.value] || [])
const currentRankLabel = computed<string>(() => t(RANK_TITLE_KEYS[currentRank.value]))

function rarityClass(rarity: ArenaAugmentRarity): string {
  return 'rarity-' + rarity
}
function rarityLabel(rarity: ArenaAugmentRarity): string {
  return t(RARITY_LABEL_KEYS[rarity]);
}

function formatPrimary(row: ArenaAugmentLeaderboardRow): string {
  switch (currentRank.value) {
    case 'placement':
      return row.averagePlacement == null ? '-' : row.averagePlacement.toFixed(2);
    case 'firstplace':
      return row.firstPlaceRate == null ? '-' : (row.firstPlaceRate * 100).toFixed(1) + '%';
    case 'picks':
      return row.pickRate == null ? '-' : (row.pickRate * 100).toFixed(1) + '%';
  }
}

async function reload(): Promise<void> {
  if (!hasElectronAPI()) {
    error.value = t('arenaLeaderboard.apiUnavailable');
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const request: ArenaAugmentStatsRequest = { championId: championId.value, limit: DEFAULT_LIMIT };
    const result: ArenaAugmentStatsResult = await electronAPI.arenaAugmentData.getStats(request);
    if (!result.success || !result.bundle || !result.ranked) {
      throw new Error(result.error || t('arenaLeaderboard.loadFailed'));
    }
    bundle.value = result.bundle;
    ranked.value = result.ranked;
    sourceLabel.value = result.sourceLabel || result.bundle.source;
  } catch (err) {
    error.value = (err as Error).message || String(err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => { void reload(); });
</script>

<style scoped>
.leaderboard-card {
    background: var(--hex-bg-elevated, #1f2330);
    border: 1px solid var(--hex-border, #2c3140);
    border-radius: 8px;
    padding: 16px;
    color: var(--hex-fg, #e6e8ee);
    font-size: 13px;
}
.card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
}
.card-header h3 {
    margin: 0;
    flex: 1;
    font-size: 15px;
    font-weight: 600;
}
.card-icon { color: var(--hex-accent, #5e8ad4); width: 18px; height: 18px; }
.card-actions .reload-btn {
    background: transparent;
    border: 1px solid var(--hex-border, #2c3140);
    color: var(--hex-fg, #e6e8ee);
    border-radius: 4px;
    padding: 4px 6px;
    cursor: pointer;
}
.card-actions .reload-btn:disabled { opacity: 0.5; cursor: wait; }
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.mock-banner {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(220, 170, 60, 0.12);
    border: 1px solid rgba(220, 170, 60, 0.35);
    color: #dca63c;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 12px;
    margin-bottom: 10px;
}
.banner-icon { width: 14px; height: 14px; }

.error-banner {
    background: rgba(220, 80, 80, 0.12);
    border: 1px solid rgba(220, 80, 80, 0.35);
    color: #dc5050;
    padding: 8px 10px;
    border-radius: 4px;
    margin-bottom: 10px;
    font-size: 12px;
}
.loading-line { color: var(--hex-fg-muted, #9aa0aa); padding: 8px 0; }

.rank-tabs {
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
}
.rank-tabs button {
    background: transparent;
    border: 1px solid var(--hex-border, #2c3140);
    color: var(--hex-fg, #e6e8ee);
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
}
.rank-tabs button.active {
    background: var(--hex-accent, #5e8ad4);
    border-color: var(--hex-accent, #5e8ad4);
    color: white;
}

.meta-line {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--hex-fg-muted, #9aa0aa);
    margin-bottom: 6px;
}

.leaderboard-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}
.leaderboard-table th {
    text-align: left;
    padding: 6px 4px;
    border-bottom: 1px solid var(--hex-border, #2c3140);
    color: var(--hex-fg-muted, #9aa0aa);
    font-weight: 500;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.5px;
}
.leaderboard-table td {
    padding: 6px 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.leaderboard-table .rank-col { width: 32px; color: var(--hex-fg-muted, #9aa0aa); }
.leaderboard-table .rarity-col { width: 80px; }
.leaderboard-table .metric-col { text-align: right; font-variant-numeric: tabular-nums; }
.leaderboard-table .sample-col { text-align: right; color: var(--hex-fg-muted, #9aa0aa); font-variant-numeric: tabular-nums; }

.augment-name { display: block; }
.augment-name-en { color: var(--hex-fg-muted, #9aa0aa); font-size: 10px; }

.rarity-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
}
.rarity-silver { background: #6c7a89; color: white; }
.rarity-gold { background: #dca63c; color: #1f2330; }
.rarity-prismatic { background: #c170d8; color: white; }
.rarity-unknown { background: #3a3f4b; color: var(--hex-fg-muted, #9aa0aa); }

.empty-row {
    text-align: center;
    color: var(--hex-fg-muted, #9aa0aa);
    padding: 16px 4px;
}
</style>
