export type ChampionDetailMetric =
  | { kind: 'games'; value: number }
  | { kind: 'average-placement'; value: number }
  | null

function nullablePositive(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function nullablePlacement(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 1 ? number : null
}

export function resolveChampionDetailMetric(
  numGames: unknown,
  averagePlacement: unknown,
): ChampionDetailMetric {
  const games = nullablePositive(numGames)
  if (games != null) return { kind: 'games', value: games }
  const placement = nullablePlacement(averagePlacement)
  return placement == null ? null : { kind: 'average-placement', value: placement }
}
