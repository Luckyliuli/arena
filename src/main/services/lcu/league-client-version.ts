import { getLCUServiceInstance } from './lcu-service.ts'

const VERSION_ENDPOINT = '/lol-patch/v1/game-version'
const VERSION_CACHE_MS = 60_000

export type LeagueClientVersion = {
  fullVersion: string
  patch: string
}

type VersionEndpointReader = (
  endpointPath: string
) => Promise<{ status: number; data: unknown } | null>

let cachedVersion: LeagueClientVersion | null = null
let cachedAt = 0

export function normalizeLeaguePatch(value: unknown): string {
  const match = String(value || '').trim().match(/^(\d{1,2})\.(\d{1,2})(?:\.|$)/)
  return match ? `${Number(match[1])}.${Number(match[2])}` : ''
}

export async function readLeagueClientVersion(
  reader: VersionEndpointReader = endpointPath =>
    getLCUServiceInstance().getReadOnlyJsonEndpoint(endpointPath),
  options: { force?: boolean } = {}
): Promise<LeagueClientVersion | null> {
  if (!options.force && cachedVersion && Date.now() - cachedAt < VERSION_CACHE_MS) {
    return cachedVersion
  }

  const response = await reader(VERSION_ENDPOINT)
  if (!response || response.status < 200 || response.status >= 300) {
    return null
  }

  const fullVersion = typeof response.data === 'string'
    ? response.data.trim()
    : String((response.data as { version?: unknown } | null)?.version || '').trim()
  const patch = normalizeLeaguePatch(fullVersion)
  if (!patch) {
    return null
  }

  cachedVersion = { fullVersion, patch }
  cachedAt = Date.now()
  return cachedVersion
}

export function clearLeagueClientVersionCache(): void {
  cachedVersion = null
  cachedAt = 0
}
