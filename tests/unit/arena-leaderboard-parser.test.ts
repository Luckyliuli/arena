import { describe, expect, it } from 'vitest'
import {
  parseArenaCombinations,
  parseArenaChampionStats,
  parseArenaChampionSynergies,
} from '../../src/main/services/arena-augment-data/opgg/leaderboardParser.ts'

function rscPage(payload: unknown): string {
  const body = '61:' + JSON.stringify(payload)
  const literal = JSON.stringify(body)
  return '<!DOCTYPE html><html><body><script>self.__next_f.push([1,' + literal + '])</script></body></html>'
}

describe('OP.GG Arena leaderboard parser', () => {
  it('reads the per-champion Arena average stats from a build page', () => {
    const html = rscPage(['$', '$L1', null, {
      champion: {
        average_stats: {
          win_rate: 52.65,
          pick_rate: 7.63,
          ban_rate: 3.62,
          first_place: 19.1,
          avg_place: 3.39,
        },
      },
    }])

    const stats = parseArenaChampionStats(html)
    expect(stats).not.toBeNull()
    expect(stats!.winRate).toBeCloseTo(0.5265)
    expect(stats!.pickRate).toBeCloseTo(0.0763)
    expect(stats!.banRate).toBeCloseTo(0.0362)
    expect(stats!.firstPlaceRate).toBeCloseTo(0.191)
    expect(stats!.averagePlacement).toBe(3.39)
  })

  it('reads three-player and two-player Arena combinations from the home page', () => {
    const html = rscPage(['$', '$L2', null, {
      children: [{
        teamData: [{
          champion_ids: [1, 2, 3],
          play: '123',
          win_rate: 60,
          pick_rate: 0.21,
          avg_place: 3.1,
          first_place_rate: 20,
        }],
        duoData: [{
          champion_ids: [1, 2],
          play: '99',
          win_rate: 58.5,
          pick_rate: 1.25,
          avg_place: 3.2,
          first_place_rate: 18.2,
        }],
      }],
    }])

    expect(parseArenaCombinations(html)).toEqual({
      trio: [{
        championIds: [1, 2, 3],
        winRate: 0.6,
        pickRate: 0.0021,
        averagePlacement: 3.1,
        firstPlaceRate: 0.2,
        sampleSize: 123,
      }],
      duo: [{
        championIds: [1, 2],
        winRate: 0.585,
        pickRate: 0.0125,
        averagePlacement: 3.2,
        firstPlaceRate: 0.182,
        sampleSize: 99,
      }],
    })
  })

  it('returns null or empty leaderboards when the page carries no matching data', () => {
    const html = rscPage(['$', 'different-page'])
    expect(parseArenaChampionStats(html)).toBeNull()
    expect(parseArenaCombinations(html)).toEqual({ trio: [], duo: [] })
  })

  it('reads champion-pair synergies from a build page as a duo fallback', () => {
    const html = rscPage(['$', null, {
      champion: { average_stats: { win_rate: 52, pick_rate: 7 } },
      synergies: [{
        champion_id: 2,
        play: '381',
        win_rate: 54.33,
        pick_rate: 1.01,
        avg_place: 3.27,
        first_place: 24.41,
      }],
    }])

    expect(parseArenaChampionSynergies(html)).toEqual([{
      teammateChampionId: 2,
      winRate: 0.5433,
      pickRate: 0.0101,
      averagePlacement: 3.27,
      firstPlaceRate: 0.2441,
      sampleSize: 381,
    }])
  })
})
