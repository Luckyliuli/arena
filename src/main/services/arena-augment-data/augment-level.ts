export function parseArenaAugmentLevel(value: unknown): number | null {
  const text = String(value || '').normalize('NFKC').trim()
  if (!text) return null

  const patterns = [
    /(?:lv|lvl|level)\s*[.:：]?\s*([0-9]+)/i,
    /(?:等级|等級)\s*[：:]?\s*([0-9]+)/,
    /([0-9]+)\s*(?:级|級)/,
    /^([1-3])$/, 
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match) continue
    const level = Number(match[1])
    return Number.isInteger(level) && level >= 1 && level <= 3 ? level : null
  }

  return null
}
