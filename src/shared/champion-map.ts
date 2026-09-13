// Arena champion map loader.
//
// Maps a numeric champion id (the value LCU / Riot APIs use) onto the
// slug OP.GG puts in its Arena URLs, plus the localized names for
// diagnostics.
//
//   numeric id 1  ->  { slug: 'Annie', nameZh: '黑暗之女', nameEn: 'Annie' }
//
// Source: Data Dragon (see scripts/fetch-arena-champions.mjs). The file
// is a build artifact, not hand-maintained. Per ADR-0004 the map sits
// behind this loader so a different source can replace it without ripple.

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

export type ArenaChampionEntry = {
  id: number
  slug: string
  nameEn: string
  nameZh: string
}

export type ArenaChampionMap = {
  patch: string
  champions: ArenaChampionEntry[]
}

const DEFAULT_RELATIVE = path.join('resources', 'champions-arena.json')

function resolvePath(rel: string): string {
  if (path.isAbsolute(rel)) return rel
  const here = path.dirname(url.fileURLToPath(import.meta.url))
  return path.resolve(here, '..', '..', rel)
}

let cached: ArenaChampionMap | null = null

export function loadArenaChampionMap(filePath?: string): ArenaChampionMap {
  if (filePath) {
    return parseChampionMap(fs.readFileSync(resolvePath(filePath), 'utf8'))
  }
  if (cached) return cached
  cached = parseChampionMap(fs.readFileSync(resolvePath(DEFAULT_RELATIVE), 'utf8'))
  return cached
}

function parseChampionMap(raw: string): ArenaChampionMap {
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.champions)) {
    throw new Error('champions-arena: expected { patch, champions: [...] }')
  }
  return {
    patch: typeof parsed.patch === 'string' ? parsed.patch : 'unknown',
    champions: parsed.champions,
  }
}

/** OP.GG URL slug for a numeric champion id, or undefined when unknown. */
export function findChampionSlug(championId: number): string | undefined {
  return loadArenaChampionMap().champions.find(c => c.id === championId)?.slug
}

export function findChampionById(championId: number): ArenaChampionEntry | undefined {
  return loadArenaChampionMap().champions.find(c => c.id === championId)
}
