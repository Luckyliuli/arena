import { describe, expect, it, vi } from 'vitest'
import { buildArenaLeaderboardSnapshot } from '../../src/main/services/arena-augment-data/opgg/leaderboardBuilder.ts'

function rscPage(payload: unknown): string {
  const literal = JSON.stringify('61:' + JSON.stringify(payload))
  return '<script>self.__next_f.push([1,' + literal + '])</script>'
}

const champions = [
  { id: 1, slug: 'Annie', nameEn: 'Annie', nameZh: '黑暗之女' },
  { id: 2, slug: 'Olaf', nameEn: 'Olaf', nameZh: '狂战士' },
]

describe('Arena leaderboard snapshot builder', () => {
  it('builds a deterministic snapshot and skips a champion whose page fails', async () => {
    const fetchChampionBuild = vi.fn(async (champion: typeof champions[number]) => {
      if (champion.id === 2) throw new Error('offline')
      return rscPage(['$', null, {
        champion: { average_stats: { win_rate: 52.65, pick_rate: 7.63 } },
      }])
    })

    const result = await buildArenaLeaderboardSnapshot({
      patch: '16.18',
      champions,
      fetchHomepage: async () => rscPage(['$', null, {
        teamData: [{
          champion_ids: [1, 2, 350],
          win_rate: 60,
          pick_rate: 0.21,
          avg_place: 3.1,
          first_place_rate: 20,
          play: '123',
        }],
        duoData: [{
          champion_ids: [1, 2],
          win_rate: 58.5,
          pick_rate: 1.25,
          avg_place: 3.2,
          first_place_rate: 18.2,
          play: '99',
        }],
      }]),
      fetchChampionBuild,
      concurrency: 2,
    })

    expect(result.snapshot).toEqual({
      schemaVersion: 1,
      patch: '16.18',
      source: 'opgg',
      champions: [{
        championId: 1,
        slug: 'Annie',
        winRate: 0.5265,
        pickRate: 0.0763,
      }],
      combinations: {
        trio: [{
          championIds: [1, 2, 350],
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
      },
    })
    expect(result.warnings).toEqual(['Olaf: skipped build page (offline)'])
    expect(fetchChampionBuild).toHaveBeenCalledTimes(2)
  })

  it('sorts champion and combination rows by win rate then pick rate', async () => {
    const result = await buildArenaLeaderboardSnapshot({
      patch: '16.18',
      champions,
      fetchHomepage: async () => rscPage(['$', null, {
        teamData: [
          { champion_ids: [1, 2, 3], win_rate: 55, pick_rate: 1 },
          { champion_ids: [4, 5, 6], win_rate: 60, pick_rate: 0.5 },
        ],
      }]),
      fetchChampionBuild: async champion => rscPage(['$', null, {
        champion: {
          average_stats: champion.id === 1
            ? { win_rate: 51, pick_rate: 8 }
            : { win_rate: 53, pick_rate: 2 },
        },
      }]),
    })

    expect(result.snapshot.champions.map(row => row.championId)).toEqual([2, 1])
    expect(result.snapshot.combinations.trio.map(row => row.championIds[0])).toEqual([4, 1])
  })

  it('builds duo rows from champion synergies and de-duplicates a mirrored pair', async () => {
    const result = await buildArenaLeaderboardSnapshot({
      patch: '16.18',
      champions,
      fetchHomepage: async () => rscPage(['$', null, { teamData: [] }]),
      fetchChampionBuild: async champion => rscPage(['$', null, {
        champion: { average_stats: { win_rate: 50, pick_rate: 1 } },
        synergies: [{
          champion_id: champion.id === 1 ? 2 : 1,
          play: champion.id === 1 ? '100' : '200',
          win_rate: 54,
          pick_rate: 1,
          avg_place: 3.2,
          first_place: 20,
        }],
      }]),
    })

    expect(result.snapshot.combinations.duo).toEqual([{
      championIds: [1, 2],
      winRate: 0.54,
      pickRate: 0.01,
      averagePlacement: 3.2,
      firstPlaceRate: 0.2,
      sampleSize: 200,
    }])
  })
})
