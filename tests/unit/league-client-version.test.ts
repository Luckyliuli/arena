import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLeagueClientVersionCache,
  normalizeLeaguePatch,
  readLeagueClientVersion,
} from '../../src/main/services/lcu/league-client-version.ts'

describe('League client version', () => {
  beforeEach(() => clearLeagueClientVersionCache())

  it('normalizes Tencent and Riot build strings to the OP.GG patch format', () => {
    expect(normalizeLeaguePatch('16.18.8174437+branch.releases-16-18.code.publictencent.content.release')).toBe('16.18')
    expect(normalizeLeaguePatch('16.18.1')).toBe('16.18')
    expect(normalizeLeaguePatch('invalid')).toBe('')
  })

  it('reads the real game version endpoint and caches the result', async () => {
    const reader = vi.fn(async () => ({ status: 200, data: '16.18.8174437+release' }))

    await expect(readLeagueClientVersion(reader)).resolves.toEqual({
      fullVersion: '16.18.8174437+release',
      patch: '16.18',
    })
    await readLeagueClientVersion(reader)

    expect(reader).toHaveBeenCalledOnce()
    expect(reader).toHaveBeenCalledWith('/lol-patch/v1/game-version')
  })

  it('does not invent a version when LCU is unavailable', async () => {
    await expect(readLeagueClientVersion(async () => null)).resolves.toBeNull()
  })
})
