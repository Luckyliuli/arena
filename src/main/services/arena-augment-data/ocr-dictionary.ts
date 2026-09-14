// Arena (斗魂竞技场) augment names for the OCR matcher.
//
// The screenshot/OCR pipeline used to hydrate its name table from the legacy
// ARAM `augments.json` data path (remote client-data, per locale). Arena
// augments are a different catalog, so the popup would never match a card.
// This module is the single seam that turns the bundled Arena dictionary
// (`resources/augments-arena.json`, built from CommunityDragon) into the
// `{ id, name, rarity, iconPath }` records the matcher consumes.
//
// It stays pure on purpose: no sharp / onnxruntime / Electron imports, so it
// can be unit-tested without booting the analyzer stack.

import {
  loadAugmentArenaDictionary,
  type ArenaAugmentRecord,
  type AugmentRarity,
} from '../../../shared/augment-dictionary.ts'

export type ArenaOcrAugment = {
  id: number
  name: string
  rarity: AugmentRarity
  iconPath: string | null
}

export type ArenaOcrLocaleData = {
  locale: string
  dataVersion: string
  source: 'arena-dictionary'
  augments: ArenaOcrAugment[]
}

/**
 * Pick the OCR name to match against for one locale.
 *
 * The Arena dictionary ships Simplified Chinese and English only. Traditional
 * Chinese clients display different names, so `zh-TW` intentionally reuses the
 * Simplified table: names that differ simply will not match, which is honest.
 * Guessing a translation would be worse than a miss.
 */
export function resolveArenaOcrLocaleName(
  locale: string,
  displayName: ArenaAugmentRecord['displayName'],
): string {
  return String(locale || '').toLowerCase().startsWith('en')
    ? displayName.en
    : displayName.zh
}

export function loadArenaAugmentsForOcr(locale: string): ArenaOcrAugment[] {
  return loadAugmentArenaDictionary().map(record => ({
    id: record.id,
    name: resolveArenaOcrLocaleName(locale, record.displayName),
    rarity: record.rarity,
    iconPath: record.iconLarge ?? record.iconSmall ?? null,
  }))
}

export function loadArenaOcrLocaleData(locale: string): ArenaOcrLocaleData {
  const augments = loadArenaAugmentsForOcr(locale)
  return {
    locale,
    // The dictionary carries no upstream patch marker; pin the version to its
    // size so a stale bundle shows up in logs as a different version string.
    dataVersion: `arena-dictionary-${augments.length}`,
    source: 'arena-dictionary',
    augments,
  }
}