import store from './app-store.ts'

export const USER_PREFERENCE_KEYS = {
    showChampionDetails: 'championInsight.showDetails',
    hideChampionInsightOnGameStart: 'championInsight.hideOnGameStart',
    championInsightAlwaysOnTop: 'championInsight.alwaysOnTop',
    showAugmentTopOverlay: 'augments.showTopOverlay',
    autoApplyArenaItemSets: 'itemSets.autoApplyArena',
}

const LEGACY_ALWAYS_ON_TOP_MIGRATION_KEY = 'migrations.championInsightAlwaysOnTopDefaultV1'

export function getBooleanPreference(key: string, defaultValue = true): boolean {
    const value = store.get(key)
    if (value == null) {
        return defaultValue
    }

    return value !== false
}

export function shouldShowChampionDetails(): boolean {
    return getBooleanPreference(USER_PREFERENCE_KEYS.showChampionDetails, true)
}

export function shouldHideChampionInsightOnGameStart(): boolean {
    return getBooleanPreference(USER_PREFERENCE_KEYS.hideChampionInsightOnGameStart, true)
}

export function shouldKeepChampionInsightOnTop(): boolean {
    return getBooleanPreference(USER_PREFERENCE_KEYS.championInsightAlwaysOnTop, true)
}

export function shouldShowAugmentTopOverlay(): boolean {
    return getBooleanPreference(USER_PREFERENCE_KEYS.showAugmentTopOverlay, true)
}

export function shouldAutoApplyArenaItemSets(): boolean {
    return getBooleanPreference(USER_PREFERENCE_KEYS.autoApplyArenaItemSets, true)
}

/**
 * Older builds shipped `championInsight.alwaysOnTop = false`. That made the
 * Champion Details window open underneath the League client, which looked
 * like it never opened at all. Flip that legacy value once; later explicit
 * choices are preserved by the migration marker.
 */
export function migrateLegacyChampionInsightAlwaysOnTopPreference(): void {
    if (store.get(LEGACY_ALWAYS_ON_TOP_MIGRATION_KEY)) {
        return
    }

    if (store.get(USER_PREFERENCE_KEYS.championInsightAlwaysOnTop) === false) {
        store.set(USER_PREFERENCE_KEYS.championInsightAlwaysOnTop, true)
    }
    store.set(LEGACY_ALWAYS_ON_TOP_MIGRATION_KEY, true)
}
