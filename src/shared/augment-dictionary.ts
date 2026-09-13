// Arena augment dictionary loader. Per ADR-0004 the dictionary sits behind
// an adapter so its source can be swapped (CommunityDragon today, Riot API
// or OP.GG page scrape later) without ripple. This file is the only seam
// the rest of the app touches.

import fs from 'node:fs'
import path from 'node:path'
import { requireResourceFile } from './resource-path.ts'

export type AugmentRarity = 'silver' | 'gold' | 'prismatic' | 'unknown'

export type AugmentLocale = 'en' | 'zh'

export type ArenaAugmentRecord = {
  id: number
  apiName: string
  displayName: { en: string, zh: string }
  rarity: AugmentRarity
  iconLarge: string | null
  iconSmall: string | null
}

const DEFAULT_RELATIVE = path.join('resources', 'augments-arena.json')

let cached: readonly ArenaAugmentRecord[] | null = null

export function loadAugmentArenaDictionary(filePath?: string): readonly ArenaAugmentRecord[] {
  if (filePath) {
    const raw = fs.readFileSync(requireResourceFile(filePath, 'augments-arena'), 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('augments-arena: expected an array, got ' + typeof parsed)
    }
    return Object.freeze(parsed)
  }
  if (cached) return cached
  const raw = fs.readFileSync(requireResourceFile(DEFAULT_RELATIVE, 'augments-arena'), 'utf8')
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error('augments-arena: expected an array, got ' + typeof parsed)
  }
  cached = Object.freeze(parsed)
  return cached
}

// Lookup helpers for the OCR matcher / popup overlay.

export function findAugmentByName(name: string, locale: AugmentLocale = 'zh'): ArenaAugmentRecord | undefined {
  const dict = loadAugmentArenaDictionary()
  return dict.find(r => r.displayName[locale] === name || r.displayName.en === name)
}

export function findAugmentById(id: number): ArenaAugmentRecord | undefined {
  return loadAugmentArenaDictionary().find(r => r.id === id)
}
