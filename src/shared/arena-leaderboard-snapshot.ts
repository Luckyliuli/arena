import fs from 'node:fs'
import path from 'node:path'
import { requireResourceFile } from './resource-path.ts'

export type ArenaChampionLeaderboardRow = {
  championId: number
  slug: string
  winRate: number | null
  pickRate: number | null
}

export type ArenaCombinationLeaderboardRow = {
  championIds: number[]
  winRate: number | null
  pickRate: number | null
  averagePlacement: number | null
  firstPlaceRate: number | null
  sampleSize: number | null
}

export type ArenaLeaderboardSnapshot = {
  schemaVersion: 1
  patch: string
  source: 'opgg'
  champions: ArenaChampionLeaderboardRow[]
  combinations: {
    trio: ArenaCombinationLeaderboardRow[]
    duo: ArenaCombinationLeaderboardRow[]
  }
}

const DEFAULT_RELATIVE = path.join('resources', 'arena-leaderboard-snapshot.json')
let cached: ArenaLeaderboardSnapshot | null = null

export function parseArenaLeaderboardSnapshot(raw: string): ArenaLeaderboardSnapshot {
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('arena-leaderboard-snapshot: expected an object')
  }
  if (parsed.schemaVersion !== 1 || parsed.source !== 'opgg') {
    throw new Error('arena-leaderboard-snapshot: unsupported schema or source')
  }
  if (!Array.isArray(parsed.champions)
    || !parsed.combinations
    || !Array.isArray(parsed.combinations.trio)
    || !Array.isArray(parsed.combinations.duo)) {
    throw new Error('arena-leaderboard-snapshot: invalid champion or combination data')
  }
  return parsed as ArenaLeaderboardSnapshot
}

export function loadArenaLeaderboardSnapshot(filePath?: string): ArenaLeaderboardSnapshot {
  if (filePath) {
    return parseArenaLeaderboardSnapshot(
      fs.readFileSync(requireResourceFile(filePath, 'arena-leaderboard-snapshot'), 'utf8'),
    )
  }
  if (cached) return cached
  cached = parseArenaLeaderboardSnapshot(
    fs.readFileSync(requireResourceFile(DEFAULT_RELATIVE, 'arena-leaderboard-snapshot'), 'utf8'),
  )
  return cached
}
