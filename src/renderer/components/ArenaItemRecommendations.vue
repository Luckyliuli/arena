<template>
  <section class="arena-items-panel">
    <div class="section-title-row">
      <h3>{{ t('augment.arenaItemsTitle') }}</h3>
      <span v-if="bundle">{{ t('augment.itemCount', { count: totalRows }) }}</span>
    </div>

    <div v-if="loading" class="items-state">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="items-state error">{{ error }}</div>
    <div v-else-if="totalRows === 0" class="items-state">{{ t('augment.noArenaItems') }}</div>

    <section v-for="section in sections" v-else :key="section.id" class="item-category">
      <h4>{{ t(section.labelKey) }}</h4>
      <div class="item-table">
        <article v-for="(row, index) in section.rows" :key="rowKey(section.id, row, index)" class="item-row">
          <div class="item-primary">
            <div class="item-icons">
              <img
                v-for="item in row.items"
                :key="item.itemId"
                :src="item.iconUrl || ''"
                :alt="item.name"
                class="item-icon"
                loading="lazy"
                @error="handleImageError"
              />
            </div>
            <div class="item-name">{{ row.items.map(item => item.name).join(' + ') }}</div>
          </div>
          <div class="metric">
            <small>{{ t('arenaLeaderboard.metricPlacement') }}</small>
            <strong>{{ formatPlacement(row.averagePlacement) }}</strong>
          </div>
          <div class="metric">
            <small>{{ t('arenaLeaderboard.metricFirstplace') }}</small>
            <strong>{{ formatPercent(row.firstPlaceRate) }}</strong>
          </div>
          <div class="metric">
            <small>{{ t('arenaLeaderboard.metricPicks') }}</small>
            <strong>{{ formatPercent(row.pickRate) }}</strong>
          </div>
          <div class="metric">
            <small>{{ t('arenaLeaderboard.sampleSize') }}</small>
            <strong>{{ row.sampleSize == null ? '--' : formatNumber(row.sampleSize) }}</strong>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { electronAPI } from '../native/electron-api.ts'
import { formatNumber, formatPercent, handleImageError } from '../service/overlay-formatters.ts'
import type { ArenaItemCategory, ArenaItemPerfStat, ArenaItemStatsBundle } from '../../shared/ipc-contract.ts'

const props = defineProps<{ championId?: number | null }>()
const { t } = useI18n()

const bundle = ref<ArenaItemStatsBundle | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
let requestSequence = 0

const categoryMeta: { id: ArenaItemCategory; labelKey: string }[] = [
  { id: 'prismatic', labelKey: 'augment.itemCategoryPrismatic' },
  { id: 'core', labelKey: 'augment.itemCategoryCore' },
  { id: 'boots', labelKey: 'augment.itemCategoryBoots' },
  { id: 'starting', labelKey: 'augment.itemCategoryStarting' },
  { id: 'final', labelKey: 'augment.itemCategoryFinal' },
]

const sections = computed(() => categoryMeta
  .map(meta => ({ ...meta, rows: bundle.value?.categories[meta.id] ?? [] }))
  .filter(section => section.rows.length > 0))

const totalRows = computed(() => sections.value.reduce((count, section) => count + section.rows.length, 0))

const formatPlacement = (value: number | null) => value == null || !Number.isFinite(value) ? '--' : value.toFixed(2)
const rowKey = (category: ArenaItemCategory, row: ArenaItemPerfStat, index: number) => `${category}-${row.items.map(item => item.itemId).join('-') || index}`

const reasonMessage = (reason: string | null | undefined) => {
  if (reason === 'page-shape-changed') return t('augment.opggPageChanged')
  if (reason === 'fetch-failed') return t('augment.itemLoadFailed')
  return t('augment.noArenaItems')
}

const loadItems = async (championId?: number | null) => {
  const normalizedId = Number(championId)
  const sequence = ++requestSequence
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    bundle.value = null
    error.value = null
    return
  }

  loading.value = true
  error.value = null
  const startedAt = Date.now()
  try {
    const result = await electronAPI.arenaItemData.getStats({ championId: normalizedId })
    if (sequence !== requestSequence) return
    if (!result.success || !result.bundle) {
      throw new Error(result.error || t('augment.itemLoadFailed'))
    }
    bundle.value = result.bundle
    if (result.bundle.reason) error.value = reasonMessage(result.bundle.reason)
    electronAPI.diagnostics.logRendererInfo({
      type: 'arena-items',
      source: 'ArenaItemRecommendations',
      message: 'items loaded',
      details: { championId: normalizedId, recordCount: result.bundle.categories.prismatic.length, reason: result.bundle.reason, durationMs: Date.now() - startedAt },
      timestamp: Date.now(),
    })
  } catch (err) {
    if (sequence !== requestSequence) return
    bundle.value = null
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

watch(() => props.championId, loadItems, { immediate: true })
</script>

<style scoped>
.arena-items-panel { display: flex; flex-direction: column; gap: 14px; }
.section-title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.section-title-row h3 { margin: 0; font-size: 15px; font-weight: 700; color: #f8fafc; }
.section-title-row span { color: #94a3b8; font-size: 11px; }
.items-state { padding: 28px 16px; text-align: center; color: #94a3b8; font-size: 12px; }
.items-state.error { color: #fca5a5; }
.item-category { display: flex; flex-direction: column; gap: 7px; }
.item-category h4 { margin: 0; color: #cbd5e1; font-size: 12px; font-weight: 700; }
.item-table { display: flex; flex-direction: column; gap: 6px; }
.item-row { display: grid; grid-template-columns: minmax(150px, 1.6fr) repeat(4, minmax(54px, .65fr)); align-items: center; gap: 8px; padding: 8px; border: 1px solid rgba(148,163,184,.18); border-radius: 8px; background: rgba(15,23,42,.45); }
.item-primary { min-width: 0; display: flex; align-items: center; gap: 8px; }
.item-icons { display: flex; flex-shrink: 0; }
.item-icon { width: 30px; height: 30px; border-radius: 5px; object-fit: cover; }
.item-icons .item-icon + .item-icon { margin-left: -6px; }
.item-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #f8fafc; font-size: 11px; font-weight: 600; }
.metric { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.metric small { color: #94a3b8; font-size: 9px; }
.metric strong { color: #e2e8f0; font-size: 11px; font-variant-numeric: tabular-nums; }
@media (max-width: 560px) { .item-row { grid-template-columns: 1.4fr repeat(2, .6fr); } .metric:nth-last-child(-n+2) { display: none; } }
</style>
