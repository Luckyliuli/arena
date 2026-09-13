// Arena augment dictionary loader. Per ADR-0004 the dictionary sits behind
// an adapter so its source can be swapped (CommunityDragon today, Riot API
// or OP.GG page scrape later) without ripple. This file is the only seam
// the rest of the app touches.

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

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

function resolvePath(rel) {
  // Resolve against the arena project root. The dictionary file lives
  // at arena/resources/augments-arena.json regardless of where the
  // caller sits in the source tree. relative to src/shared/ we need
  // two up-elevations to land at the project root.
  if (path.isAbsolute(rel)) return rel
  const here = path.dirname(url.fileURLToPath(import.meta.url))
  return path.resolve(here, '..', '..', rel)
}

let cached: readonly ArenaAugmentRecord[] | null = null

export function loadAugmentArenaDictionary(filePath?: string): readonly ArenaAugmentRecord[] {
  if (filePath) {
    const raw = fs.readFileSync(resolvePath(filePath), 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('augments-arena: expected an array, got ' + typeof parsed)
    }
    return Object.freeze(parsed)
  }
  if (cached) return cached
  const raw = fs.readFileSync(resolvePath(DEFAULT_RELATIVE), 'utf8')
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
